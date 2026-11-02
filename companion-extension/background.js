// HosiFlow Companion - Background Service Worker
// Giao tiếp qua Local HTTP API: http://127.0.0.1:4826

const API_BASE = 'http://127.0.0.1:4826/api';
let isProcessingJob = false;
let preferredMuseTabId = null;

// Hàm kiểm tra định kỳ (Heartbeat & Job Poller)
async function syncWithStudio() {
  try {
    // 1. Ping Studio Desktop App
    const pingRes = await fetch(`${API_BASE}/ping`, { signal: AbortSignal.timeout(2000) });
    if (!pingRes.ok) throw new Error('App not responding');

    // 2. Kiểm tra tab Muse.ai trên trình duyệt
    const museTab = await findMuseTab();
    const hasMuseTab = Boolean(museTab && museTab.id);

    if (hasMuseTab) {
      // Đã mở tab Muse.ai và App đang bật -> ON XANH
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      // App đang bật nhưng chưa mở Muse.ai -> VÀNG
      chrome.action.setBadgeText({ text: 'TAB' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    }

    // 3. Gửi Heartbeat lên App để cập nhật trạng thái
    await fetch(`${API_BASE}/companion/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muse_session_ready: hasMuseTab }),
    });

    // 4. Nếu có tab Muse và không bận, kiểm tra xem App có job nào cần chạy không
    if (hasMuseTab && !isProcessingJob) {
      await pollAndExecuteJob(museTab.id);
    }
  } catch (err) {
    // Nếu không kết nối được App (App bị tắt hoặc chưa chạy) -> CHUYỂN NGAY VỀ OFF XÁM!
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
  }
}

async function findMuseTab() {
  const tabs = await chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] });
  if (!tabs.length) return null;
  if (preferredMuseTabId) {
    const pref = tabs.find((t) => t.id === preferredMuseTabId);
    if (pref) return pref;
  }
  return tabs.find((t) => t.active) || tabs[0];
}

async function pollAndExecuteJob(tabId) {
  try {
    const res = await fetch(`${API_BASE}/jobs/next`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return;
    const job = await res.json();
    if (!job || !job.id) return;

    isProcessingJob = true;
    console.log('[HosiFlow Companion] Đang thực thi Job:', job);

    let reply;
    if (job.media_type === 'script') {
      const payload = {
        type: 'MUSEFLOW_GENERATE_SCRIPT',
        requestId: job.id,
        prompt: job.prompt,
        timeoutSec: 180,
      };
      try {
        reply = await chrome.tabs.sendMessage(tabId, payload);
      } catch {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['muse-bridge.js'] });
        reply = await chrome.tabs.sendMessage(tabId, payload);
      }

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
      });
      return;
    }

    const payload = {
      type: 'MUSEFLOW_GENERATE',
      requestId: job.id,
      prompt: job.prompt,
      negativePrompt: job.negative_prompt || '',
      size: job.size || '16:9',
      duration: job.duration || 5,
      mediaType: job.media_type || 'image',
      referenceImages: job.reference_images || [],
      timeoutSec: 600,
    };

    let reply;
    try {
      reply = await chrome.tabs.sendMessage(tabId, payload);
    } catch {
      // Thử inject lại bridge nếu tab vừa reload
      await chrome.scripting.executeScript({ target: { tabId }, files: ['muse-bridge.js'] });
      reply = await chrome.tabs.sendMessage(tabId, payload);
    }

    // Gửi kết quả về Desktop App
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
    });
  } catch (err) {
    console.error('[HosiFlow Companion] Lỗi chạy job:', err);
  } finally {
    isProcessingJob = false;
  }
}

// Bắt đầu vòng lặp đồng bộ mỗi 2.5 giây
setInterval(syncWithStudio, 2500);
syncWithStudio();
