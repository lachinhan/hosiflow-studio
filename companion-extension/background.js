// HosiFlow Companion - Background Service Worker (Manifest V3)
// Cầu nối giao tiếp Local API: http://127.0.0.1:4826 & Hỗ trợ Đa Nền Tảng (Muse.ai + FlowMusic)

const API_BASE = 'http://127.0.0.1:4826/api';
let isProcessingJob = false;
let isLoopRunning = false;
const processedJobIds = new Set();
const activeWatchdogs = new Map();
const jobDurationMap = new Map();

// Đăng ký Alarm định kỳ để Service Worker tự động thức dậy trong MV3
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

// Thức dậy khi người dùng thao tác với tab Muse.ai hoặc Google Flow Music
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && (tab.url.includes('muse.ai') || tab.url.includes('flowmusic'))) {
    syncWithStudio();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && (tab.url.includes('muse.ai') || tab.url.includes('flowmusic'))) {
      syncWithStudio();
    }
  } catch {
    // Bỏ qua lỗi truy vấn tab
  }
});

// Lắng nghe Message từ Content Script (muse-bridge.js và flowmusic-adapter.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'MUSEFLOW_JOB_COMPLETED' || message?.type === 'FLOWMUSIC_JOB_COMPLETED') {
    handleJobCompleted(message);
    sendResponse({ received: true });
    return false;
  }
  if (message?.type === 'MUSEFLOW_KEEPALIVE') {
    sendResponse({ alive: true });
    return false;
  }
  if (message?.type === 'MUSEFLOW_FETCH_LOCAL_URL') {
    fetch(message.url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => sendResponse({ ok: true, dataUrl: reader.result });
        reader.onerror = () => sendResponse({ ok: false, error: 'Read failed' });
        reader.readAsDataURL(blob);
      })
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true; // async
  }
  return false;
});

// Gửi kết quả hoàn thành về HosiFlow Studio Local API
async function handleJobCompleted(data) {
  // Luôn luôn giải phóng cờ bận trước tiên để không bao giờ bị deadlock
  isProcessingJob = false;

  const jobId = data.jobId || data.job_id;
  if (!jobId) return;

  // Xóa watchdog nếu có
  if (activeWatchdogs.has(jobId)) {
    clearTimeout(activeWatchdogs.get(jobId));
    activeWatchdogs.delete(jobId);
  }

  const rawDur = typeof data.duration === 'number' ? data.duration : jobDurationMap.get(jobId);
  const jobDuration = typeof rawDur === 'number' ? rawDur : 0;

  let finalUrl = data.url || null;
  const processedVersions = [];

  // Helper tải và lưu media lên Desktop Server để có stream MP3/MP4 nội bộ (và auto-trim)
  async function persistMedia(url, uploadId) {
    if (!url) return null;
    try {
      const isVideo = url.startsWith('data:video/') || url.includes('.mp4');
      const ext = isVideo ? 'mp4' : 'mp3';
      const mime = isVideo ? 'video/mp4' : 'audio/mpeg';
      const trimParam = (!isVideo && jobDuration > 0) ? `&trim_seconds=${encodeURIComponent(jobDuration)}` : '';

      let res = null;
      for (let retry = 0; retry < 5; retry++) {
        try {
          res = await fetch(url);
          if (res.ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!res || !res.ok) throw new Error(`Fetch failed ${res ? res.status : 'network'}`);
      const blob = await res.blob();
      const uploadRes = await fetch(`${API_BASE}/media/upload?id=${encodeURIComponent(uploadId)}&ext=${ext}${trimParam}`, {
        method: 'POST',
        headers: { 'Content-Type': mime },
        body: blob,
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        if (uploadData?.ok && uploadData?.url) {
          console.log(`[HosiFlow Companion] 💾 Media ${uploadId} đã lưu thành URL nội bộ (Cắt đúng ${jobDuration}s):`, uploadData.url);
          return uploadData.url;
        }
      }
    } catch (uploadErr) {
      console.warn(`[HosiFlow Companion] Upload media ${uploadId} lên server nội bộ thất bại, giữ nguyên URL gốc:`, uploadErr);
      return url;
    }
    return url;
  }

  // Xử lý tất cả các phiên bản (Version 1 & Version 2)
  if (data.ok && Array.isArray(data.versions) && data.versions.length > 0) {
    for (let i = 0; i < data.versions.length; i++) {
      const v = data.versions[i];
      const subId = i === 0 ? jobId : `${jobId}_v${i + 1}`;
      let savedUrl = await persistMedia(v.url, subId);
      if (!savedUrl) savedUrl = v.url;
      processedVersions.push({
        id: subId,
        title: v.title || `Bản ${i + 1}`,
        url: savedUrl,
      });
    }
    if (processedVersions.length > 0) {
      finalUrl = processedVersions[0].url;
    }
  } else if (data.ok && finalUrl) {
    let savedUrl = await persistMedia(finalUrl, jobId);
    if (!savedUrl) savedUrl = finalUrl;
    finalUrl = savedUrl;
    processedVersions.push({
      id: jobId,
      title: 'Bản 1',
      url: finalUrl,
    });
  }

  const dedupeKey = `${jobId}_${data.ok}`;
  if (processedJobIds.has(dedupeKey)) {
    console.log(`[HosiFlow Companion] Job ${jobId} đã được báo cáo trước đó, bỏ qua lặp.`);
    return;
  }
  processedJobIds.add(dedupeKey);
  if (processedJobIds.size > 200) {
    const first = processedJobIds.values().next().value;
    if (first) processedJobIds.delete(first);
  }

  console.log(`[HosiFlow Companion] 🚀 Đang gửi kết quả Job ${jobId} về Studio:`, data.ok ? 'SUCCESS' : 'FAILED', finalUrl || data.error);

  try {
    await fetch(`${API_BASE}/jobs/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        node_id: data.nodeId || data.node_id,
        ok: Boolean(data.ok),
        url: finalUrl,
        error: data.error || null,
        end_frame: data.endFrame || data.end_frame || null,
        script_text: data.script_text || data.script || null,
        versions: processedVersions.length > 0 ? processedVersions : undefined,
      }),
    });
  } catch (err) {
    console.error('[HosiFlow Companion] Lỗi gửi kết quả về Studio:', err);
  } finally {
    jobDurationMap.delete(jobId);
  }
}

// Khi click vào icon extension trên toolbar: chuyển sang tab Muse.ai hoặc FlowMusic, hoặc mở mới
chrome.action.onClicked.addListener(async () => {
  const museTab = await findMuseTab();
  const flowTab = await findFlowMusicTab();

  const targetTab = flowTab || museTab;
  if (targetTab && targetTab.id) {
    await chrome.tabs.update(targetTab.id, { active: true });
    if (targetTab.windowId) {
      await chrome.windows.update(targetTab.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: 'https://www.flowmusic.app' });
  }
  syncWithStudio();
});

// Hàm đồng bộ chính giữa Extension, App Desktop và các Tab AI (Muse.ai, FlowMusic)
async function syncWithStudio() {
  let appOnline = false;
  let hasMuseTab = false;
  let hasFlowTab = false;

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
      chrome.action.setTitle({ title: 'HosiFlow Companion: Desktop Studio chưa mở' });
      return;
    }

    // 2. Kiểm tra tab Muse.ai và tab Google Flow Music
    const [museTab, flowTab] = await Promise.all([
      findMuseTab(),
      findFlowMusicTab(),
    ]);

    hasMuseTab = Boolean(museTab && museTab.id);
    hasFlowTab = Boolean(flowTab && flowTab.id);

    // 3. Phản ánh trạng thái kết nối đa tab linh hoạt
    if (hasMuseTab && hasFlowTab) {
      chrome.action.setBadgeText({ text: 'ALL' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      chrome.action.setTitle({ title: 'HosiFlow Companion: Đã kết nối Muse.ai (Video) và FlowMusic (Audio)' });
    } else if (hasMuseTab) {
      chrome.action.setBadgeText({ text: 'MUSE' });
      chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' });
      chrome.action.setTitle({ title: 'HosiFlow Companion: Đã kết nối Muse.ai (Sẵn sàng video/ảnh)' });
    } else if (hasFlowTab) {
      chrome.action.setBadgeText({ text: 'FLOW' });
      chrome.action.setBadgeBackgroundColor({ color: '#a855f7' });
      chrome.action.setTitle({ title: 'HosiFlow Companion: Đã kết nối Google Flow Music (Sẵn sàng nhạc BGM)' });
    } else {
      chrome.action.setBadgeText({ text: 'TAB' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      chrome.action.setTitle({ title: 'HosiFlow Companion: Cần mở tab Muse.ai hoặc FlowMusic' });
    }

    // 4. Báo cáo nhịp tim Đa Nền Tảng (Multi-Provider Heartbeat) về Studio
    await fetch(`${API_BASE}/companion/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        muse_session_ready: hasMuseTab,
        flow_session_ready: hasFlowTab,
        muse_tab_id: museTab?.id || null,
        flow_tab_id: flowTab?.id || null,
      }),
      signal: AbortSignal.timeout(1500),
    }).catch(() => null);

    // 5. Nếu có ít nhất một nền tảng sẵn sàng và không bận -> kiểm tra Job
    if ((hasMuseTab || hasFlowTab) && !isProcessingJob) {
      await pollAndExecuteJob(museTab?.id, flowTab?.id);
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
      }, 1500);
    }
  }
}

// Tìm tab Muse.ai đang mở trên toàn bộ cửa sổ trình duyệt (bảo đảm không sót)
async function findMuseTab() {
  try {
    const tabs = await chrome.tabs.query({});
    if (!tabs || tabs.length === 0) return null;
    return tabs.find((t) => t.url && t.url.includes('muse.ai')) || null;
  } catch {
    return null;
  }
}

// Tìm tab Google Flow Music đang mở trên toàn bộ cửa sổ trình duyệt (bảo đảm không sót)
async function findFlowMusicTab() {
  try {
    const tabs = await chrome.tabs.query({});
    if (!tabs || tabs.length === 0) return null;
    return tabs.find((t) => t.url && (t.url.includes('flowmusic.app') || t.url.includes('flowmusic'))) || null;
  } catch {
    return null;
  }
}

// Gửi message an toàn tới Content Script trong tab Muse.ai
async function safeSendMessage(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['muse-bridge.js'],
      });
      await new Promise((r) => setTimeout(r, 300));
      return await chrome.tabs.sendMessage(tabId, payload);
    } catch (e) {
      return { ok: false, error: 'Không thể kết nối với tab Muse.ai. Vui lòng làm mới lại tab Muse.ai (F5).' };
    }
  }
}

// Gửi message an toàn tới Content Script trong tab Google Flow Music
async function safeSendFlowMessage(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['flowmusic-adapter.js'],
      });
      await new Promise((r) => setTimeout(r, 400));
      return await chrome.tabs.sendMessage(tabId, payload);
    } catch (e) {
      return { ok: false, error: 'Không thể kết nối với tab FlowMusic. Vui lòng làm mới lại tab FlowMusic (F5).' };
    }
  }
}

// Xử lý Job do Desktop App giao (Tự động phân luồng: Audio -> FlowMusic, Image/Video/Script -> Muse.ai)
async function pollAndExecuteJob(museTabId, flowTabId) {
  try {
    const res = await fetch(`${API_BASE}/jobs/next`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (!res || !res.ok) return;

    const job = await res.json().catch(() => null);
    if (!job || !job.id) return;

    isProcessingJob = true;

    try {
      // 0. TÁC VỤ BÓC TÁCH SẢN PHẨM AFFILIATE (Shopee / TikTok Shop)
      if (job.media_type === 'product' || job.media_type === 'scrape_product') {
        const productUrl = (job.prompt || (job.reference_images && job.reference_images[0]) || '').trim();
        console.log(`[HosiFlow Companion] 🛒 Đang bóc tách dữ liệu sản phẩm từ URL: ${productUrl}`);

        try {
          const productData = await scrapeProductViaBrowser(productUrl);
          await handleJobCompleted({
            jobId: job.id,
            nodeId: job.node_id,
            ok: productData.ok,
            url: productData.images && productData.images[0] ? productData.images[0] : null,
            script_text: JSON.stringify(productData),
            error: productData.error,
          });
        } catch (scrapeErr) {
          await handleJobCompleted({
            jobId: job.id,
            nodeId: job.node_id,
            ok: false,
            error: `Lỗi bóc tách sản phẩm: ${scrapeErr.message || String(scrapeErr)}`,
          });
        }
        return;
      }

      // 1. TÁC VỤ ÂM NHẠC -> Chuyển sang Google Flow Music (flowmusic.app)
      if (job.media_type === 'audio') {
        let activeFlowTabId = flowTabId;
        const targetDuration = typeof job.duration === 'number' ? job.duration : 0;
        jobDurationMap.set(job.id, targetDuration);

        if (activeFlowTabId) {
          try {
            const currentTab = await chrome.tabs.get(activeFlowTabId);
            if (currentTab?.url && (currentTab.url.includes('/library') || currentTab.url.includes('/playlists') || currentTab.url.includes('/settings'))) {
              console.log('[HosiFlow Companion] 🔄 Tab đang ở trang phụ Library, tự động đưa về trang tạo nhạc https://www.flowmusic.app...');
              await chrome.tabs.update(activeFlowTabId, { url: 'https://www.flowmusic.app/' });
              await new Promise((r) => setTimeout(r, 3000));
            }
          } catch {}
        } else {
          const recheckTab = await findFlowMusicTab();
          if (recheckTab && recheckTab.id) {
            activeFlowTabId = recheckTab.id;
          } else {
            console.log('[HosiFlow Companion] 🚀 Chưa có tab FlowMusic, tự động mở tab https://www.flowmusic.app...');
            try {
              const newTab = await chrome.tabs.create({ url: 'https://www.flowmusic.app', active: true });
              activeFlowTabId = newTab.id;
              await new Promise((r) => setTimeout(r, 3500));
            } catch (createErr) {
              await handleJobCompleted({
                jobId: job.id,
                nodeId: job.node_id,
                ok: false,
                error: 'Không thể tự động mở tab FlowMusic. Vui lòng mở https://www.flowmusic.app thủ công.',
              });
              return;
            }
          }
        }

        try {
          await chrome.tabs.update(activeFlowTabId, { active: true });
          const tabObj = await chrome.tabs.get(activeFlowTabId);
          if (tabObj?.windowId) {
            await chrome.windows.update(tabObj.windowId, { focused: true });
          }
        } catch (focusErr) {
          console.warn('[HosiFlow Companion] Không thể focus tab FlowMusic:', focusErr);
        }

        console.log(`[HosiFlow Companion] 🎵 Đang truyền lệnh tạo nhạc (${targetDuration}s) sang FlowMusic:`, job.prompt);

        const reply = await safeSendFlowMessage(activeFlowTabId, {
          type: 'FLOWMUSIC_GENERATE',
          requestId: job.id,
          nodeId: job.node_id,
          prompt: job.prompt,
          duration: targetDuration,
          timeoutSec: 300,
        });

        if (reply && reply.started) {
          console.log('[HosiFlow Companion] ✅ Tab FlowMusic đã nhận lệnh và bắt đầu sinh nhạc bất đồng bộ.');
          const currentJobId = job.id;
          const watchdog = setTimeout(() => {
            if (isProcessingJob) {
              console.warn(`[HosiFlow Companion] ⚠️ Watchdog: Job âm nhạc ${currentJobId} quá 5 phút chưa xong.`);
              isProcessingJob = false;
              handleJobCompleted({
                jobId: currentJobId,
                nodeId: job.node_id,
                ok: false,
                duration: targetDuration,
                error: 'Quá thời gian chờ (5 phút) trên Google Flow Music. Hãy thử tạo lại.',
              });
            }
          }, 310000);

          activeWatchdogs.set(currentJobId, watchdog);
          return;
        }

        if (reply && reply.ok && reply.url) {
          await handleJobCompleted({
            jobId: job.id,
            nodeId: job.node_id,
            ok: true,
            duration: targetDuration,
            url: reply.url,
            error: null,
          });
          return;
        }

        await handleJobCompleted({
          jobId: job.id,
          nodeId: job.node_id,
          ok: false,
          duration: targetDuration,
          error: reply?.error || 'Không thể gửi lệnh tạo nhạc vào FlowMusic. Vui lòng F5 tab FlowMusic.',
        });
        return;
      }

      // 2. CÁC TÁC VỤ KỊCH BẢN, ẢNH, VIDEO -> Chuyển sang Muse.ai
      if (!museTabId) {
        await handleJobCompleted({
          jobId: job.id,
          nodeId: job.node_id,
          ok: false,
          error: 'Chưa mở tab Muse.ai (https://muse.ai) để thực hiện tác vụ hình ảnh/video.',
        });
        return;
      }

      if (job.media_type === 'script') {
        const reply = await safeSendMessage(museTabId, {
          type: 'MUSEFLOW_GENERATE_SCRIPT',
          requestId: job.id,
          nodeId: job.node_id,
          prompt: job.prompt,
          timeoutSec: 180,
        });

        await handleJobCompleted({
          jobId: job.id,
          nodeId: job.node_id,
          ok: reply ? Boolean(reply.ok) : false,
          script_text: reply?.script || null,
          error: reply?.error || (reply ? null : 'Mất kết nối với Muse tab'),
        });
        return;
      }

      const reply = await safeSendMessage(museTabId, {
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

      if (reply) {
        let finalUrl = reply.url || null;
        if (reply.ok && finalUrl && finalUrl.startsWith('data:video/')) {
          try {
            const res = await fetch(finalUrl);
            const blob = await res.blob();
            const uploadRes = await fetch(`${API_BASE}/media/upload?id=${encodeURIComponent(job.id)}&ext=${job.media_type === 'image' ? 'png' : 'mp4'}`, {
              method: 'POST',
              headers: { 'Content-Type': job.media_type === 'image' ? 'image/png' : 'video/mp4' },
              body: blob,
            });
            if (uploadRes.ok) {
              const data = await uploadRes.json();
              if (data?.ok && data?.url) {
                finalUrl = data.url;
                console.log('[HosiFlow Companion] 🚀 Media đã lưu thành stream URL:', finalUrl);
              }
            }
          } catch (uploadErr) {
            console.warn('[HosiFlow Companion] Upload media blob lên server thất bại, giữ Data URL:', uploadErr);
          }
        }

        await handleJobCompleted({
          jobId: job.id,
          nodeId: job.node_id,
          ok: Boolean(reply.ok),
          url: finalUrl,
          error: reply.error || null,
          endFrame: reply.endFrame || null,
        });
      } else {
        await handleJobCompleted({
          jobId: job.id,
          nodeId: job.node_id,
          ok: false,
          error: 'Mất kết nối với tab Muse.ai hoặc tác vụ bị gián đoạn.',
        });
      }
    } finally {
      if (job.media_type !== 'audio') {
        isProcessingJob = false;
      }
    }
  } catch (err) {
    console.error('[HosiFlow Companion] pollAndExecuteJob error:', err);
    isProcessingJob = false;
  }
}

// Khởi chạy đồng bộ ngay khi Service Worker được nạp
syncWithStudio();

// Trình bóc tách dữ liệu sản phẩm Shopee & TikTok Shop thông qua Chrome Tab DOM Rendering
async function scrapeProductViaBrowser(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith('http')) {
    throw new Error('URL sản phẩm không hợp lệ: ' + rawUrl);
  }

  console.log('[HosiFlow Companion] 🛒 Bắt đầu bóc tách DOM sản phẩm:', rawUrl);

  // 1. Kiểm tra xem người dùng có đang mở sẵn tab này trên Chrome không
  const allTabs = await chrome.tabs.query({});
  let targetTab = allTabs.find(
    (t) =>
      t.url &&
      (t.url === rawUrl ||
        (rawUrl.includes('shopee.vn') && t.url.includes('shopee.vn')) ||
        (rawUrl.includes('tiktok.com') && t.url.includes('tiktok.com')))
  );

  let createdTabId = null;
  if (!targetTab || !targetTab.id) {
    console.log('[HosiFlow Companion] 🚀 Tự động mở tab Chrome ngầm để load JavaScript DOM...');
    const newTab = await chrome.tabs.create({ url: rawUrl, active: false });
    createdTabId = newTab.id;
    targetTab = newTab;

    // Đợi trang hoàn tất tải tài nguyên
    await new Promise((resolve) => {
      let isDone = false;
      const listener = (tabId, changeInfo) => {
        if (tabId === createdTabId && changeInfo.status === 'complete') {
          isDone = true;
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(true);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      // Timeout tối đa 6 giây nếu mạng chậm
      setTimeout(() => {
        if (!isDone) {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(false);
        }
      }, 6000);
    });

    // Chờ thêm 1.5s để React / Next.js / Vue hydrate DOM
    await new Promise((r) => setTimeout(r, 1500));
  } else {
    console.log('[HosiFlow Companion] ⚡ Tìm thấy tab sản phẩm đang mở sẵn trên Chrome, bóc tách ngay lập tức!');
  }

  // 2. Tiêm script đọc trực tiếp DOM đã render đầy đủ
  let extracted = null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: () => {
        const curUrl = window.location.href;
        const isShopee = curUrl.includes('shopee.vn') || curUrl.includes('shopee.com');
        const isTikTok = curUrl.includes('tiktok.com');

        // 1. Tiêu đề sản phẩm
        let title = '';
        if (isShopee) {
          const h1 = document.querySelector('h1, .vR6K3w, ._44qnta, [class*="product-briefing"] span, [class*="product-title"]');
          title = h1 ? h1.innerText.trim() : document.title.replace(' | Shopee Việt Nam', '').replace(' | Shopee', '').trim();
        } else if (isTikTok) {
          const h1 = document.querySelector('h1, [class*="title"], [data-e2e="product-title"]');
          title = h1 ? h1.innerText.trim() : document.title.replace(' - TikTok Shop', '').replace(' | TikTok', '').trim();
        } else {
          title = document.querySelector('h1')?.innerText?.trim() || document.title;
        }

        // 2. Hình ảnh sản phẩm chất lượng cao
        const rawImgs = [];
        document.querySelectorAll('img').forEach((img) => {
          const s = img.src || img.getAttribute('src') || '';
          if (isShopee && (s.includes('susercontent.com/file/') || s.includes('cf.shopee.vn/file/'))) {
            if (!s.includes('icon') && !s.includes('avatar') && !s.includes('logo') && !s.includes('badge')) {
              // Bỏ hậu tố thumbnail để lấy link ảnh gốc full HD
              const clean = s.split('_tn')[0].split('_b')[0];
              rawImgs.push(clean);
            }
          } else if (isTikTok && (s.includes('ibyteimg.com') || s.includes('tiktokcdn'))) {
            if (!s.includes('avatar') && !s.includes('icon')) {
              rawImgs.push(s);
            }
          }
        });

        // Quét thêm style background-image
        document.querySelectorAll('[style*="background-image"]').forEach((el) => {
          const bg = el.style.backgroundImage || '';
          const m = bg.match(/url\(["']?(https:\/\/[^"']+)["']?\)/);
          if (m && (m[1].includes('susercontent.com/file/') || m[1].includes('ibyteimg.com'))) {
            rawImgs.push(m[1].split('_tn')[0]);
          }
        });

        const uniqueImgs = Array.from(new Set(rawImgs)).filter((u) => u.startsWith('http'));

        // 3. Giá bán (Bóc tách chuẩn xác, loại bỏ voucher rác / số lẻ như ₫2.)
        let price = '';
        let originalPrice = '';
        let discount = '';

        function isValidVnPrice(str) {
          if (!str) return false;
          const clean = str.replace(/[^0-9]/g, '');
          if (clean.length < 4) return false; // Dưới 1.000 đ thì bỏ qua (tránh dính số lẻ 2, 2.5, 2.)
          return true;
        }

        // Ưu tiên 1: Quét các selector giá đặc trưng của Shopee / TikTok Shop
        const primaryPriceSelectors = [
          '.G27FPf', // Shopee modern desktop/mobile current price
          '.pqTWkA', // Shopee classic current price
          '._3n5NQx',
          '.pdp-price',
          '[data-qa="product_price"]',
          '.item-price-current',
          '[data-e2e="product-price"]',
          '[class*="current-price"]',
          '[class*="sale-price"]',
        ];

        for (const sel of primaryPriceSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const txt = el.innerText.trim();
            const m = txt.match(/₫?\s*([1-9][0-9]{0,2}(?:\.[0-9]{3})+)/);
            if (m && isValidVnPrice(m[1])) {
              price = '₫' + m[1];
              break;
            }
          }
        }

        // Ưu tiên 2: Tìm phần tử có ký hiệu ₫ có font-size LỚN NHẤT trên trang (giá sản phẩm luôn in to nhất)
        if (!price) {
          const candidateElements = [];
          document.querySelectorAll('div, span, p, h1, h2, h3').forEach((el) => {
            if (el.children.length === 0 && (el.innerText.includes('₫') || el.innerText.includes('đ'))) {
              const txt = el.innerText.trim();
              const m = txt.match(/([1-9][0-9]{0,2}(?:\.[0-9]{3})+)/);
              if (m && isValidVnPrice(m[0])) {
                const val = parseInt(m[0].replace(/\./g, ''), 10);
                if (val >= 5000) {
                  const fSize = parseFloat(window.getComputedStyle(el).fontSize) || 12;
                  candidateElements.push({ text: '₫' + m[0], fontSize: fSize, val });
                }
              }
            }
          });

          if (candidateElements.length > 0) {
            candidateElements.sort((a, b) => b.fontSize - a.fontSize);
            price = candidateElements[0].text;
          }
        }

        // Ưu tiên 3: Quét regex toàn trang tìm các khoản tiền lớn hơn 10.000đ
        if (!price) {
          const allMatches = document.body.innerText.match(/₫\s*([1-9][0-9]{0,2}(?:\.[0-9]{3})+)/g) || [];
          for (const raw of allMatches) {
            const digits = raw.replace(/[^0-9]/g, '');
            const num = parseInt(digits, 10);
            if (num >= 10000) {
              price = '₫' + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
              break;
            }
          }
        }

        // Giá gốc nếu có
        const origEl = document.querySelector('._0ZTE9w, [class*="original-price"], .original-price, del');
        if (origEl) {
          const origM = origEl.innerText.match(/([1-9][0-9]{0,2}(?:\.[0-9]{3})+)/);
          if (origM && isValidVnPrice(origM[0])) {
            originalPrice = '₫' + origM[0];
          }
        }

        // 4. Đánh giá sao & số lượng đã bán
        let rating = 4.9;
        let soldCount = '';
        const starMatch = document.body.innerText.match(/([45]\.[0-9])\s*\/\s*5/);
        if (starMatch) {
          rating = Number(starMatch[1]);
        }
        const soldMatch = document.body.innerText.match(/([0-9.,]+k?\+?)\s*(?:đã bán|sold)/i);
        if (soldMatch) {
          soldCount = soldMatch[0];
        }

        // 5. Mô tả & Điểm bán hàng độc nhất (USP)
        let desc = '';
        const descEl = document.querySelector('.f7VUfc, ._3y7v4s, .product-description, [class*="description"], [class*="detail"]');
        if (descEl) desc = descEl.innerText.trim();

        const uspList = [];
        if (desc) {
          const lines = desc
            .split(/\r?\n|•|-|\*|;/)
            .map((l) => l.trim())
            .filter((l) => l.length >= 8 && l.length <= 80 && !l.includes('http'));
          const seen = new Set();
          for (const l of lines) {
            const clean = l.replace(/^[0-9+.\-–—\s]+/, '').trim();
            if (clean.length >= 6 && !seen.has(clean.toLowerCase())) {
              seen.add(clean.toLowerCase());
              uspList.push(clean);
              if (uspList.length >= 4) break;
            }
          }
        }

        return {
          platform: isShopee ? 'shopee' : isTikTok ? 'tiktok' : 'other',
          title: title || (isShopee ? 'Sản Phẩm Shopee' : 'Sản Phẩm TikTok Shop'),
          price: price || '199.000 ₫',
          originalPrice,
          discount,
          rating,
          soldCount: soldCount || '1.2k+ đã bán',
          description: desc || title,
          uspList:
            uspList.length > 0
              ? uspList
              : ['Thiết kế sang trọng, hiện đại, bắt mắt', 'Độ bền cao, gia công tỉ mỉ', 'Ưu đãi độc quyền trên video'],
          images: uniqueImgs,
        };
      },
    });

    if (results && results[0] && results[0].result) {
      extracted = results[0].result;
    }
  } catch (injectErr) {
    console.warn('[HosiFlow Companion] Lỗi inject script đọc DOM:', injectErr);
  } finally {
    // Đóng tab nếu tab này do extension tự mở ngầm
    if (createdTabId) {
      try {
        await chrome.tabs.remove(createdTabId);
      } catch {}
    }
  }

  if (extracted && (extracted.title || (extracted.images && extracted.images.length > 0))) {
    console.log('[HosiFlow Companion] ✅ Bóc tách thành công:', extracted.title, `(${extracted.images.length} ảnh)`);
    return {
      ok: true,
      ...extracted,
    };
  }

  throw new Error('Không thể đọc dữ liệu từ trang Shopee/TikTok. Vui lòng mở trang sản phẩm trên Chrome trước!');
}
