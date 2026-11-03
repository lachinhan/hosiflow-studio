// HosiFlow Companion - Background Service Worker (Manifest V3)
// Cầu nối giao tiếp Local API: http://127.0.0.1:4826

const API_BASE = 'http://127.0.0.1:4826/api';
let isProcessingJob = false;
let isLoopRunning = false;

// Đăng ký Alarm định kỳ để Service Worker tự động thức dậy trong MV3
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('hosiflow_keepalive', { periodInMinutes: 0.5 });
  syncWithStudio();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('hosiflow_keepalive', { periodInMinutes: 0.5 });
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
  let keepAliveInterval = null;
  try {
    const res = await fetch(`${API_BASE}/jobs/next`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (!res || !res.ok) return;

    const job = await res.json().catch(() => null);
    if (!job || !job.id) return;

    isProcessingJob = true;
    keepAliveInterval = setInterval(() => {
      chrome.runtime.getPlatformInfo?.(() => {});
    }, 5000);

    let reply;
    if (job.media_type === 'script') {
      reply = await safeSendMessage(tabId, {
        type: 'MUSEFLOW_GENERATE_SCRIPT',
        requestId: job.id,
        nodeId: job.node_id,
        prompt: job.prompt,
        timeoutSec: 180,
      });

      await fetch(`${API_BASE}/jobs/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          node_id: job.node_id,
          ok: reply?.ok || false,
          script_text: reply?.script || null,
          error: reply?.error || null,
        }),
      }).catch(() => null);
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

    await fetch(`${API_BASE}/jobs/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        node_id: job.node_id,
        ok: reply?.ok || false,
        url: reply?.url || null,
        error: reply?.error || null,
        end_frame: reply?.endFrame || null,
      }),
    }).catch(() => null);
  } catch {
    // Không làm gián đoạn vòng lặp chính
  } finally {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    isProcessingJob = false;
  }
}

// Khởi chạy đồng bộ ngay khi Service Worker được nạp
syncWithStudio();
