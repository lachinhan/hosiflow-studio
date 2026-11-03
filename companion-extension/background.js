// HosiFlow Companion - Background Service Worker (Manifest V3)
// Cầu nối giao tiếp Local API: http://127.0.0.1:4826

const API_BASE = 'http://127.0.0.1:4826/api';
let isProcessingJob = false;
let isLoopRunning = false;
const processedJobIds = new Set();

// Đăng ký Alarm định kỳ để Service Worker tự động thức dậy trong MV3
// Lưu ý: periodInMinutes tối thiểu là 1 trong Chrome MV3
function setupKeepAliveAlarm() {
  try {
    chrome.alarms.create('hosiflow_keepalive', { periodInMinutes: 1 });
  } catch (err) {
    console.warn('[HosiFlow Companion] Alarms setup notice:', err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupKeepAliveAlarm();
  syncWithStudio();
});

chrome.runtime.onStartup.addListener(() => {
  setupKeepAliveAlarm();
  syncWithStudio();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'hosiflow_keepalive') {
    syncWithStudio();
  }
});

// Thức dậy khi người dùng thao tác với tab Muse.ai
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('muse.ai')) {
    syncWithStudio();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.includes('muse.ai')) {
      syncWithStudio();
    }
  } catch {
    // Bỏ qua lỗi truy vấn tab
  }
});

// Lắng nghe Message từ Content Script (muse-bridge.js)
// Khi Content Script gửi chrome.runtime.sendMessage, MV3 Service Worker tự động thức dậy!
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'MUSEFLOW_JOB_COMPLETED') {
    handleJobCompleted(message);
    sendResponse({ received: true });
    return false;
  }
  if (message?.type === 'MUSEFLOW_KEEPALIVE') {
    sendResponse({ alive: true });
    return false;
  }
  return false;
});

// Gửi kết quả hoàn thành về HosiFlow Studio Local API
async function handleJobCompleted(data) {
  const jobId = data.jobId || data.job_id;
  if (!jobId) return;

  if (processedJobIds.has(jobId)) {
    console.log(`[HosiFlow Companion] Job ${jobId} đã được báo cáo trước đó, bỏ qua lặp.`);
    return;
  }
  processedJobIds.add(jobId);
  isProcessingJob = false;

  console.log(`[HosiFlow Companion] Đang gửi kết quả Job ${jobId} về Studio:`, data.ok ? 'SUCCESS' : 'FAILED');

  try {
    await fetch(`${API_BASE}/jobs/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        node_id: data.nodeId || data.node_id,
        ok: Boolean(data.ok),
        url: data.url || null,
        error: data.error || null,
        end_frame: data.endFrame || data.end_frame || null,
        script_text: data.script_text || data.script || null,
      }),
    });
  } catch (err) {
    console.error('[HosiFlow Companion] Lỗi gửi kết quả về Studio:', err);
  }
}

// Khi click vào icon extension trên toolbar: mở hoặc chuyển sang tab Muse.ai
chrome.action.onClicked.addListener(async () => {
  const museTab = await findMuseTab();
  if (museTab && museTab.id) {
    await chrome.tabs.update(museTab.id, { active: true });
    if (museTab.windowId) {
      await chrome.windows.update(museTab.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: 'https://muse.ai' });
  }
  syncWithStudio();
});

// Hàm đồng bộ chính giữa Extension, App Desktop và Tab Muse.ai
async function syncWithStudio() {
  let appOnline = false;
  let hasMuseTab = false;

  try {
    // 1. Kiểm tra Studio Desktop App qua Local HTTP
    const pingRes = await fetch(`${API_BASE}/ping`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(1500),
    }).catch(() => null);

    if (pingRes && pingRes.ok) {
      appOnline = true;
    }

    if (!appOnline) {
      // Desktop App chưa bật hoặc đóng -> Hiển thị OFF (màu xám)
      chrome.action.setBadgeText({ text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
      return;
    }

    // 2. Kiểm tra tab Muse.ai
    const museTab = await findMuseTab();
    hasMuseTab = Boolean(museTab && museTab.id);

    if (hasMuseTab) {
      // Cả App và Muse.ai đều sẵn sàng -> Hiển thị ON (màu xanh lá)
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      // App đang bật nhưng chưa mở tab Muse.ai -> Hiển thị TAB (màu cam)
      chrome.action.setBadgeText({ text: 'TAB' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    }

    // 3. Báo cáo nhịp tim (Heartbeat) về Studio
    await fetch(`${API_BASE}/companion/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muse_session_ready: hasMuseTab }),
      signal: AbortSignal.timeout(1500),
    }).catch(() => null);

    // 4. Nếu tab Muse.ai sẵn sàng và không bận -> kiểm tra Job
    if (hasMuseTab && !isProcessingJob) {
      await pollAndExecuteJob(museTab.id);
    }
  } catch {
    // Tránh để lỗi mạng làm crash service worker
  } finally {
    // Lên lịch vòng lặp tiếp theo khi app online
    if (appOnline && !isLoopRunning) {
      isLoopRunning = true;
      setTimeout(() => {
        isLoopRunning = false;
        syncWithStudio();
      }, 2000);
    }
  }
}

// Tìm tab Muse.ai đang mở trên trình duyệt
async function findMuseTab() {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] });
    if (!tabs || tabs.length === 0) return null;
    return tabs.find((t) => t.active) || tabs[0];
  } catch {
    return null;
  }
}

// Gửi message an toàn tới Content Script trong tab Muse.ai
async function safeSendMessage(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    // Nếu tab vừa mở hoặc reload, tự động nạp lại muse-bridge.js
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['muse-bridge.js'],
      });
      await new Promise((r) => setTimeout(r, 200));
      return await chrome.tabs.sendMessage(tabId, payload);
    } catch (e) {
      return { ok: false, error: 'Không thể kết nối với tab Muse.ai. Vui lòng tải lại trang Muse.ai.' };
    }
  }
}

// Xử lý Job do Desktop App giao
async function pollAndExecuteJob(tabId) {
  try {
    const res = await fetch(`${API_BASE}/jobs/next`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (!res || !res.ok) return;

    const job = await res.json().catch(() => null);
    if (!job || !job.id) return;

    isProcessingJob = true;

    let reply;
    if (job.media_type === 'script') {
      reply = await safeSendMessage(tabId, {
        type: 'MUSEFLOW_GENERATE_SCRIPT',
        requestId: job.id,
        nodeId: job.node_id,
        prompt: job.prompt,
        timeoutSec: 180,
      });

      if (reply) {
        await handleJobCompleted({
          jobId: job.id,
          nodeId: job.node_id,
          ok: reply.ok,
          script_text: reply.script || null,
          error: reply.error || null,
        });
      }
      return;
    }

    reply = await safeSendMessage(tabId, {
      type: 'MUSEFLOW_GENERATE',
      requestId: job.id,
      nodeId: job.node_id,
      prompt: job.prompt,
      negativePrompt: job.negative_prompt || '',
      size: job.size || '16:9',
      duration: job.duration || 5,
      mediaType: job.media_type || 'image',
      referenceImages: job.reference_images || [],
      timeoutSec: 600,
    });

    if (reply && (reply.url || reply.error || reply.ok === false)) {
      await handleJobCompleted({
        jobId: job.id,
        nodeId: job.node_id,
        ok: reply.ok,
        url: reply.url || null,
        error: reply.error || null,
        endFrame: reply.endFrame || null,
      });
    }
  } catch (err) {
    console.error('[HosiFlow Companion] pollAndExecuteJob error:', err);
  }
}

// Khởi chạy đồng bộ ngay khi Service Worker được nạp
syncWithStudio();
