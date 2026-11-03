(() => {
  // Cho phép nạp lại khi extension reload mà không bị chặn
  window.__museFlowBridgeInstalled = true;

  // Lắng nghe Message từ Chrome Extension Background Service Worker
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'MUSEFLOW_CHECK_SESSION') {
      checkSession().then(sendResponse);
      return true;
    }
    if (message?.type === 'MUSEFLOW_GENERATE_SCRIPT') {
      const controller = new AbortController();
      activeGenerations.set(message.requestId || 'script', controller);
      generateScript(message, controller.signal)
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }))
        .finally(() => activeGenerations.delete(message.requestId || 'script'));
      return true;
    }
    if (message?.type === 'MUSEFLOW_GENERATE') {
      const controller = new AbortController();
      activeGenerations.set(message.requestId, controller);

      const keepAlive = setInterval(() => {
        try { chrome.runtime.sendMessage({ type: 'MUSEFLOW_KEEPALIVE' }).catch(() => {}); } catch {}
      }, 5000);

      const reportResult = async (res) => {
        // Kênh 1: Gửi thẳng tới Local API của Studio (ưu tiên cao nhất, không phụ thuộc service worker)
        try {
          await fetch('http://127.0.0.1:4826/api/jobs/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              job_id: message.requestId,
              node_id: message.nodeId || message.node_id,
              ok: Boolean(res?.ok),
              url: res?.url || null,
              error: res?.error || null,
              end_frame: res?.endFrame || null,
            }),
          });
        } catch {}

        // Kênh 2: Gửi qua runtime message
        try {
          await chrome.runtime.sendMessage({
            type: 'MUSEFLOW_JOB_COMPLETED',
            jobId: message.requestId,
            nodeId: message.nodeId || message.node_id,
            ok: Boolean(res?.ok),
            url: res?.url || null,
            error: res?.error || null,
            endFrame: res?.endFrame || null,
          });
        } catch {}
      };

      generate(message, controller.signal)
        .then(async (res) => {
          await reportResult(res);
          try { sendResponse(res); } catch {}
        })
        .catch(async (error) => {
          const f = { ok: false, code: error.code || 'MUSE_ERROR', error: error.message || String(error) };
          await reportResult(f);
          try { sendResponse(f); } catch {}
        })
        .finally(() => {
          clearInterval(keepAlive);
          activeGenerations.delete(message.requestId);
        });

      return true;
    }
    if (message?.type === 'MUSEFLOW_STOP_GENERATION') {
      const stopped = message.requestId ? abortGeneration(message.requestId) : [...activeGenerations.keys()].some(id => abortGeneration(id));
      sendResponse({ ok: true, stopped });
      return false;
    }
  });

  // Tự động đảm bảo người dùng đang ở tab "Main chat", tránh bị kẹt trong Side chat
  function ensureMainChat() {
    try {
      const sidebarItems = [...document.querySelectorAll('button, a, div[role="button"], span')].filter(visible);
      const mainChatEl = sidebarItems.find(el => {
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        return text === 'main chat' || text.startsWith('main chat');
      });
      if (mainChatEl) {
        const isAlreadyActive = mainChatEl.classList.contains('active') || mainChatEl.getAttribute('aria-selected') === 'true' || mainChatEl.closest('[aria-selected="true"]');
        if (!isAlreadyActive) {
          console.log('[HosiFlow Bridge] Đang chuyển trình duyệt sang Main chat...');
          mainChatEl.click();
        }
      }
    } catch {}
  }

  function findComposer() {
    ensureMainChat();
    const candidates = [...document.querySelectorAll('textarea')].filter(el => visible(el) && !el.disabled);
    return candidates.find(el => /message|消息/i.test(el.getAttribute('placeholder') || '')) || candidates[0] || null;
  }

  function visible(el) {
    return Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  }

  const delay = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Generation stopped by user.', 'AbortError')); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(new DOMException('Generation stopped by user.', 'AbortError')); };
    signal?.addEventListener('abort', cancel, { once: true });
  });

  const attachmentSelector = '[data-testid^="hatch-chat-attachment-presentation-"], [data-testid*="attachment"]';
  const activeGenerations = new Map();

  function clickMuseStop() {
    const button = [...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')].find(visible);
    if (button) { button.click(); return true; }
    return false;
  }

  function abortGeneration(requestId) {
    const controller = activeGenerations.get(requestId);
    if (!controller) return false;
    controller.abort();
    clickMuseStop();
    return true;
  }

  async function checkSession() {
    ensureMainChat();
    await waitHydrated(5000);
    const composer = findComposer();
    const ready = Boolean(composer && visible(composer) && !composer.disabled && !composer.readOnly);
    const loginRequired = Boolean(document.querySelector('input[type="password"],button[type="submit"]')) && /sign in|log in|登录/i.test(document.body?.innerText || '');
    return { ok: true, signedIn: ready && !loginRequired, title: document.title, composer: ready, loginRequired, url: location.href };
  }

  async function waitHydrated(timeout, signal) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const hydration = document.querySelector('[data-hatch-shell-hydration-state]');
      if (document.readyState === 'complete' && findComposer() && (!hydration || hydration.getAttribute('data-hatch-shell-hydration-state') === 'hydrated')) return;
      if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError');
      await delay(120, signal);
    }
    if (!findComposer()) throw new Error('Muse chat is not ready. Open the Muse chat page and wait for the message box to load.');
  }

  function attachments() {
    return [...document.querySelectorAll(attachmentSelector)]
      .filter(el => !el.closest('form,[class*="chat-user-bubble"]') && !el.closest('[data-testid="hatch-composer-placeholder-overlay"]'))
      .map(el => {
        const tid = el.getAttribute('data-testid') || '';
        const video = el.querySelector('video');
        const image = el.querySelector('img');
        const urls = [...el.querySelectorAll('a[href],video source[src],source[src],[data-video-src],[data-download-url]')]
          .map(item => ({
            url: item.href || item.src || item.getAttribute('data-video-src') || item.getAttribute('data-download-url') || '',
            download: item.getAttribute('download') || '',
            type: item.getAttribute('type') || ''
          }))
          .filter(item => item.url);

        const videoLink = urls.find(item => /video\//i.test(item.type) || /\.(?:mp4|webm|mov|m4v)(?:$|[?#])/i.test(item.url) || /\.(?:mp4|webm|mov|m4v)$/i.test(item.download))?.url || '';
        const videoUrl = video?.currentSrc || video?.src || videoLink || '';
        const media = video || image;
        const src = videoUrl || media?.currentSrc || media?.src || '';

        return {
          el,
          tid,
          src,
          videoUrl,
          isVideo: Boolean(videoUrl) || video instanceof HTMLVideoElement || /video/i.test(tid),
          width: video?.videoWidth || image?.naturalWidth || 0,
          height: video?.videoHeight || image?.naturalHeight || 0
        };
      })
      .filter(a => a.src);
  }

  function waitForAttachmentChange(timeoutMs, signal) {
    return new Promise(resolve => {
      let timer;
      const observer = new MutationObserver(() => finish());
      const finish = () => { observer.disconnect(); clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['src', 'poster', 'href', 'download', 'type', 'data-testid', 'data-video-src', 'data-download-url']
      });
      timer = setTimeout(finish, timeoutMs);
      signal?.addEventListener('abort', finish, { once: true });
    });
  }

  function assistantMessageElements() {
    return [...document.querySelectorAll(
      'div[class*="hatch-chat-groupable-bubble"],[data-message-author-role="assistant"],' +
      '[data-testid*="assistant" i],[data-testid*="message-content" i],' +
      '[class*="assistant-message" i],[class*="assistant-bubble" i]'
    )].filter(el => visible(el) && !el.closest(
      '[class*="chat-user-bubble"],[data-message-author-role="user"],[data-testid*="user-message" i]'
    ));
  }

  function readNewAssistantContext(previousBubbleTexts) {
    const bubbles = assistantMessageElements();
    const messages = bubbles
      .map(el => ({ el, text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() }))
      .filter(item => item.text && item.text !== previousBubbleTexts.get(item.el));
    return messages.map(item => item.text).join('\n').slice(-6000);
  }

  function isRefusalContext(context) {
    const text = String(context || '');
    const explicit = /(?:i|we)\s+(?:am\s+)?sorry[\s\S]{0,180}(?:cannot|can't|unable|won't)|(?:cannot|can't|couldn't|unable to|not able to)\s+(?:help|assist|create|generate|make|produce|fulfill|complete|comply)|(?:request|prompt).{0,100}(?:violat|disallowed|restricted|not allowed)|(?:policy|safety).{0,100}(?:prevent|restrict|unable)|generation (?:was )?(?:declined|blocked)|content (?:is )?not allowed|i can't comply/i;
    const inability = /(?:không tạo được|không thể tạo|chưa thể tạo|không thực hiện được|vẫn không tạo được|không làm được)/i;
    const sceneContext = /(?:cảnh|bản|đoạn|video|ảnh|nội dung|yêu cầu|này)/i;
    const offerAlternative = /(?:bản|phiên bản|phương án)\s+tương\s+đương|tương\s+đương.{0,100}(?:bám|theo|kịch bản)|muốn.{0,100}(?:tạo mới|thử lại|làm lại)|(?:would you like|do you want|want me to).{0,100}(?:create|make|generate|try)|equivalent alternative/i;
    return explicit.test(text) || (inability.test(text) && (sceneContext.test(text) || offerAlternative.test(text)));
  }

  // TRÍCH XUẤT VIDEO URL CHÍNH XÁC (HỖ TRỢ ĐẶC BIỆT DẠNG BLOB & UUID .MP4 THEO PHÁT HIỆN CỦA USER)
  function extractPlayableVideoUrl(rawString) {
    if (!rawString || typeof rawString !== 'string') return null;
    rawString = rawString.trim();
    if (!rawString || rawString.length < 8) return null;
    if (/\.(png|jpe?g|webp|gif|svg|ico|css|js)(\?|$)/i.test(rawString)) return null;

    // Phát hiện 1: blob:https://muse.ai/72a764d1-6988-41e2-9a16-0763a0f1cae2
    const blobMatch = rawString.match(/blob:https?:\/\/[^\/]+\/([0-9a-fA-F-]{36})/i);
    if (blobMatch && blobMatch[1]) {
      const uuid = blobMatch[1];
      console.log('[HosiFlow Bridge] 🎯 Đã tìm thấy UUID video từ Blob URL:', uuid);
      return `https://muse.ai/${uuid}.mp4`;
    }

    // Phát hiện 2: Direct URL .mp4
    if (/\.(?:mp4|webm|mov|m4v)(\?|$|#)/i.test(rawString)) {
      if (rawString.startsWith('http://') || rawString.startsWith('https://')) {
        return rawString;
      }
      return `${window.location.origin}/${rawString.replace(/^\//, '')}`;
    }

    // Phát hiện 3: UUID 36 ký tự có đuôi .mp4
    const uuidMp4Match = rawString.match(/([0-9a-fA-F-]{36})\.mp4/i);
    if (uuidMp4Match && uuidMp4Match[1]) {
      return `https://muse.ai/${uuidMp4Match[1]}.mp4`;
    }

    // Phát hiện 4: Đường dẫn tệp nội bộ Muse container (như trong Modal info)
    const mediaPathMatch = rawString.match(/(?:https?:\/\/[^\s"'<>\\]+)?\/?workspace\/imagine_media\/([^\s"'<>\\]+\.mp4)/i);
    if (mediaPathMatch && mediaPathMatch[0]) {
      const p = mediaPathMatch[0];
      return p.startsWith('http') ? p : `${window.location.origin}/${p.replace(/^\//, '')}`;
    }

    return null;
  }

  // Quét DOM tìm video clip sau khi Muse hoàn tất
  async function findCompletedVideo(baselineSrcs, startTime, signal) {
    // 1. Quét tất cả thẻ <video>
    for (const v of document.querySelectorAll('video')) {
      const s = v.currentSrc || v.src || v.querySelector('source')?.src || '';
      const found = extractPlayableVideoUrl(s);
      if (found) return found;
    }

    // 2. Quét tất cả thẻ <a>
    for (const a of document.querySelectorAll('a[href]')) {
      const found = extractPlayableVideoUrl(a.href);
      if (found) return found;
    }

    // 3. Quét các attachments mới xuất hiện & kích hoạt Play để Muse mount player
    const currentAtts = attachments();
    const freshAtts = currentAtts.filter(a => !baselineSrcs.has(a.src));
    const targetCards = freshAtts.length > 0 ? freshAtts : currentAtts.slice(-2);

    for (const item of targetCards) {
      const el = item.el;
      // Kích hoạt Play nếu chưa từng bấm
      const playBtn = el.querySelector('button[aria-label*="play" i], [class*="play" i], button:has(svg), [role="button"]:has(svg)') ||
                      el.querySelector('svg') ||
                      el;
      if (playBtn && !playBtn.hasAttribute('data-hosiflow-played')) {
        playBtn.setAttribute('data-hosiflow-played', 'true');
        console.log('[HosiFlow Bridge] Kích hoạt Play trên card video để nạp player stream...', playBtn);
        try {
          playBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          playBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          playBtn.click();
        } catch {}
      }

      // Quét các thuộc tính của card
      for (const attr of el.attributes) {
        const found = extractPlayableVideoUrl(attr.value);
        if (found) return found;
      }
      for (const child of el.querySelectorAll('*')) {
        for (const attr of child.attributes) {
          const found = extractPlayableVideoUrl(attr.value);
          if (found) return found;
        }
      }
    }

    // 4. Quét innerHTML của bong bóng tin nhắn Assistant mới nhất
    const bubbles = assistantMessageElements();
    if (bubbles.length > 0) {
      const latestBubble = bubbles[bubbles.length - 1];
      const bubbleHtml = latestBubble.innerHTML || '';

      const blobUrls = bubbleHtml.match(/blob:https?:\/\/[^\s"'<>\\]+/gi) || [];
      for (const b of blobUrls) {
        const found = extractPlayableVideoUrl(b);
        if (found) return found;
      }

      const mp4s = bubbleHtml.match(/(?:[0-9a-fA-F-]{36}\.mp4|workspace\/imagine_media\/[^\s"'<>\\]+\.mp4)/gi) || [];
      for (const m of mp4s) {
        const found = extractPlayableVideoUrl(m);
        if (found) return found;
      }
    }

    // 5. Quét Performance Resource Timing
    try {
      const entries = performance.getEntriesByType('resource')
        .filter(e => e.startTime > (startTime - 5000))
        .sort((a, b) => b.startTime - a.startTime);
      for (const e of entries) {
        const found = extractPlayableVideoUrl(e.name);
        if (found) return found;
      }
    } catch {}

    return null;
  }

  // HÀM GENERATE CHÍNH
  async function generate({ prompt, timeoutSec = 600, mediaType = 'image', referenceImage = '', referenceImages = [], size = '16:9', requestId }, signal) {
    const throwIfAborted = () => { if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError'); };
    throwIfAborted();
    if (!String(prompt || '').trim()) throw new Error('Prompt is empty.');

    ensureMainChat();
    await waitHydrated(15000, signal);
    throwIfAborted();

    const composer = findComposer();
    if (!visible(composer)) throw new Error('Muse message box is not visible. Open Main chat and retry.');

    const referenceList = Array.isArray(referenceImages) && referenceImages.length ? referenceImages : referenceImage ? [referenceImage] : [];
    if (referenceList.length) await attachReferences(referenceList, signal);
    throwIfAborted();

    const baseline = new Set(attachments().map(a => a.src));
    const priorBubbleTexts = new Map(assistantMessageElements().map(el => [el, (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()]));
    const initialBubbleCount = assistantMessageElements().length;
    const startTime = performance.now();

    composer.scrollIntoView({ block: 'center' });
    composer.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Muse message box is unsupported.');

    let targetPrompt = String(prompt || '').trim();
    const targetSize = size || '16:9';
    if (mediaType === 'video') {
      if (referenceList.length > 0 && !/animate.*video/i.test(targetPrompt)) {
        targetPrompt = `Animate this exact reference image into a video: ${targetPrompt}`;
      } else if (!/video/i.test(targetPrompt)) {
        targetPrompt = `Generate a cinematic video: ${targetPrompt}`;
      }
    }
    if (!/--(?:ar|aspect)\s+\d+:\d+/i.test(targetPrompt)) {
      const ratioKeyword = targetSize === '16:9' ? '--ar 16:9, widescreen 16:9 horizontal'
        : targetSize === '9:16' ? '--ar 9:16, vertical 9:16 portrait'
        : targetSize === '1:1' ? '--ar 1:1, square 1:1'
        : targetSize === '4:3' ? '--ar 4:3, standard 4:3'
        : `--ar ${targetSize}`;
      targetPrompt = `${targetPrompt} ${ratioKeyword}`;
    }

    setter.call(composer, targetPrompt);
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));

    let sendButton = null;
    for (let i = 0; i < 30; i++) {
      throwIfAborted();
      sendButton = [...document.querySelectorAll('button,[role="button"]')].filter(visible)
        .find(b => /send|发送/i.test(`${b.getAttribute('aria-label') || ''} ${b.getAttribute('data-testid') || ''} ${b.innerText || ''}`));
      if (sendButton && !sendButton.disabled) break;
      await delay(100, signal);
    }
    if (!composer.value.trim()) throw new Error('Muse did not accept the prompt into its message box. Nothing was submitted.');

    const bubbleCount = () => document.querySelectorAll('div[class*="hatch-chat-groupable-bubble"]').length;
    const beforeSendCount = bubbleCount();
    let submitted = false;
    throwIfAborted();

    if (sendButton && !sendButton.disabled) {
      sendButton.click();
      submitted = true;
    } else {
      const form = composer.closest('form');
      if (form && typeof form.requestSubmit === 'function') {
        form.requestSubmit();
        submitted = true;
      } else {
        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        composer.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        submitted = true;
      }
    }

    let accepted = false;
    for (let i = 0; i < 30; i++) {
      throwIfAborted();
      if (!composer.isConnected || !composer.value.trim() || bubbleCount() > beforeSendCount ||
          document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')) {
        accepted = true;
        break;
      }
      await delay(100, signal);
    }
    if (!submitted || !accepted) throw new Error('Muse did not confirm the prompt submission. Check the chat box and try again; MuseFlow will not resubmit automatically.');

    const deadline = Date.now() + Math.min(900, Math.max(30, Number(timeoutSec) || 600)) * 1000;
    let refusalContext = '', refusalContextSince = 0;
    let hasSeenStop = false;
    let lastLog = 0;

    while (Date.now() < deadline) {
      throwIfAborted();

      // Kiểm tra nút Stop của Muse
      const isStopVisible = Boolean(document.querySelector(
        '[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]'
      ));

      if (isStopVisible) {
        hasSeenStop = true;
        if (Date.now() - lastLog > 8000) {
          lastLog = Date.now();
          console.log(`[HosiFlow Bridge] Muse đang tạo ${mediaType}... vui lòng đợi...`);
        }
        await delay(1000, signal);
        continue;
      }

      // ==========================================
      // NHÁNH 1: XỬ LÝ GENERATE VIDEO
      // ==========================================
      if (mediaType === 'video') {
        const bubbles = assistantMessageElements();
        const hasNewContent = hasSeenStop || bubbles.length > initialBubbleCount;

        if (hasNewContent) {
          const videoUrl = await findCompletedVideo(baseline, startTime, signal);
          if (videoUrl) {
            // Lấy poster image làm endFrame
            let endFrame = null;
            const latestBubble = bubbles[bubbles.length - 1];
            const cardImg = latestBubble?.querySelector('img') || document.querySelector('[data-testid^="hatch-chat-attachment"] img');
            if (cardImg && cardImg.src) {
              try {
                const res = await fetch(cardImg.src, { credentials: 'include' });
                if (res.ok) {
                  const b = await res.blob();
                  endFrame = await blobToDataUrl(b);
                }
              } catch {}
            }
            console.log('[HosiFlow Bridge] ✅ Video đã hoàn thành thành công:', videoUrl);
            return { ok: true, url: videoUrl, endFrame };
          }
        }
      }

      // ==========================================
      // NHÁNH 2: XỬ LÝ GENERATE IMAGE
      // ==========================================
      if (mediaType === 'image') {
        const fresh = attachments().filter(a => !baseline.has(a.src));
        const matching = fresh.filter(a => !a.isVideo);
        if (matching.length > 0) {
          const best = matching[0];
          const media = best.el.querySelector('img') || null;
          const src = media?.currentSrc || media?.src || best.src;
          if (src) {
            if (src.startsWith('data:')) {
              console.log('[HosiFlow Bridge] ✅ Ảnh hoàn thành (Data URL)');
              return { ok: true, url: src, endFrame: null };
            }
            try {
              const response = await fetch(src, { credentials: 'include' });
              if (response.ok) {
                const blob = await response.blob();
                const dataUrl = await blobToDataUrl(blob);
                console.log('[HosiFlow Bridge] ✅ Ảnh hoàn thành xuất sắc, kích thước:', blob.size, 'bytes');
                return { ok: true, url: dataUrl, endFrame: null };
              }
            } catch (err) {
              return { ok: true, url: src, error: `Ảnh đã tạo nhưng không thể copy nội bộ: ${err.message}` };
            }
          }
        }
      }

      // Kiểm tra từ chối (refusal) & hết credits
      const currentContext = readNewAssistantContext(priorBubbleTexts);
      const refusal = isRefusalContext(currentContext);
      if (refusal) {
        if (currentContext !== refusalContext) { refusalContext = currentContext; refusalContextSince = Date.now(); }
        const clearRefusal = /(?:không tạo được|không thể tạo)/i.test(currentContext);
        if (clearRefusal || Date.now() - refusalContextSince >= 1200) {
          if (isStopVisible) clickMuseStop();
          const error = new Error(`Muse từ chối tạo cảnh này: ${currentContext.slice(-600)}`);
          error.code = 'SCENE_REFUSED';
          throw error;
        }
      } else {
        refusalContext = '';
        refusalContextSince = 0;
      }

      if (!isStopVisible && Date.now() - startTime > 5000) {
        const tail = (document.body?.innerText || '').slice(-800);
        if (/out of credits|insufficient credits|额度不足|积分不足/i.test(tail)) {
          throw new Error('Tài khoản Muse đã hết lượt Credits tạo media.');
        }
      }

      await waitForAttachmentChange(Math.min(600, deadline - Date.now()), signal);
    }

    throwIfAborted();
    throw new Error(`Hết thời gian chờ Muse hoàn tất ${mediaType}.`);
  }

  // ATTACH REFERENCES
  async function attachReferences(references, signal) {
    const files = await Promise.all(references.map(async (reference, index) => {
      const url = typeof reference === 'string' ? reference : reference?.url;
      if (!url) throw new Error(`Reference image ${index + 1} has no URL.`);
      let response = await fetch(url).catch(() => null);
      if (!response || !response.ok) {
        response = await fetch(url, { credentials: 'include' }).catch(() => null);
      }
      if (!response || !response.ok) throw new Error(`Could not load reference image ${index + 1} (${response?.status || 'network error'}).`);
      const blob = await response.blob();
      if (!blob.size) throw new Error(`Reference ${index + 1} is not a readable image.`);
      const detectedType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
      const extension = (detectedType.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
      return new File([blob], `museflow-reference-${String(index + 1).padStart(2, '0')}.${extension}`, { type: detectedType });
    }));

    const composer = findComposer();
    let composerRoot = composer.closest('form') || composer.parentElement;
    for (let i = 0; i < 8 && composerRoot?.parentElement; i++) {
      if (composerRoot.querySelector('input[type="file"]')) break;
      composerRoot = composerRoot.parentElement;
    }
    const acceptsImage = input => {
      const accept = (input.accept || '').toLowerCase();
      return !accept || accept.includes('image') || accept.includes('*/*') || /\.(png|jpe?g|webp|gif|bmp|avif)/.test(accept);
    };
    const findInput = () => {
      const all = [...document.querySelectorAll('input[type="file"]')].filter(input => !input.disabled && acceptsImage(input));
      const isImageInput = input => /image|\.png|\.jpe?g|\.webp|\.gif|\.avif/i.test(input.accept || '');
      return all.find(input => composerRoot?.contains(input) && isImageInput(input)) ||
        all.find(input => composerRoot?.contains(input)) ||
        all.find(isImageInput) || null;
    };
    let input = findInput();
    if (!input) {
      const roots = [composerRoot, composer.closest('form'), composer.parentElement].filter(Boolean);
      const uploadButton = roots.flatMap(root => [...root.querySelectorAll('button,[role="button"],label')]).filter(visible).find(el => /attach|upload|image|photo|file|đính kèm|tải lên/i.test(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.innerText || ''}`));
      if (uploadButton) { uploadButton.click(); await delay(250, signal); input = findInput(); }
    }
    if (!input) throw new Error('Muse image upload control was not found near the chat composer; the prompt was not submitted.');

    const previewSelector = 'img,[role="img"],[data-testid*="attachment" i],[data-testid*="upload" i],[class*="attachment" i],[class*="upload" i]';
    const previewElements = () => [...document.querySelectorAll(previewSelector)].filter(visible);
    const previewKey = el => {
      const src = el.matches('img') ? (el.currentSrc || el.src || '') : /url\(["']?(blob:|data:image\/|https?:)[^)]*\)/i.exec(getComputedStyle(el).backgroundImage)?.[0] || '';
      return `${src}|${el.getAttribute('data-testid') || ''}|${el.getAttribute('class') || ''}|${el.getAttribute('aria-label') || ''}|${el.getAttribute('title') || ''}`;
    };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
    if (!setter) throw new Error('Browser does not allow setting the Muse attachment input.');

    const uploadBatch = async (batch) => {
      const previousPreviews = new Set(previewElements().map(previewKey));
      const transfer = new DataTransfer();
      batch.forEach(file => transfer.items.add(file));
      if (batch.length > 1) input.multiple = true;
      setter.call(input, transfer.files);
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      const started = Date.now(), deadline = started + 8000;
      const accepted = () => batch.every(file => [...(input.files || [])].some(item => item.name === file.name && item.size === file.size && item.type === file.type));
      const previewSeen = () => previewElements().some(el => {
        const key = previewKey(el), src = el.matches('img') ? (el.currentSrc || el.src || '') : key.split('|', 1)[0];
        return !previousPreviews.has(key) && Boolean(src);
      });
      while (Date.now() < deadline) {
        if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError');
        if (previewSeen() || accepted() && Date.now() - started > 1000) return;
        await delay(160, signal);
      }
      throw new Error(`Muse did not confirm ${batch.length} reference image${batch.length === 1 ? '' : 's'} in the chat composer; the prompt was not submitted.`);
    };

    if (files.length > 1 && !input.multiple) {
      for (const file of files) await uploadBatch([file]);
    } else {
      await uploadBatch(files);
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Media conversion failed.'));
      reader.readAsDataURL(blob);
    });
  }

  // GENERATE SCRIPT (Kịch bản phân cảnh)
  async function generateScript({ prompt, timeoutSec = 180 }, signal) {
    const composer = findComposer();
    if (!composer) throw new Error('Muse chat box not found');
    composer.scrollIntoView({ block: 'center' });
    composer.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(composer, prompt);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const sendBtn = [...document.querySelectorAll('button,[role="button"]')].find(b => /send|gửi/i.test(`${b.getAttribute('aria-label') || ''} ${b.innerText || ''}`));
    if (sendBtn) sendBtn.click();
    else composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));

    await delay(3000, signal);
    const deadline = Date.now() + (Number(timeoutSec) || 180) * 1000;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError');
      const stopBtn = document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i]');
      if (!stopBtn) {
        const bubbles = assistantMessageElements();
        if (bubbles.length > 0) {
          const text = (bubbles[bubbles.length - 1].innerText || '').trim();
          if (text.length > 30) return { ok: true, script: text };
        }
      }
      await delay(1000, signal);
    }
    throw new Error('Timed out waiting for script generation');
  }
})();
