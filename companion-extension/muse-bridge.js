(() => {
  if (window.__museFlowBridgeInstalled) return;
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
      const reportScriptResult = async (res) => {
        try {
          await chrome.runtime.sendMessage({
            type: 'MUSEFLOW_JOB_COMPLETED',
            jobId: message.requestId,
            nodeId: message.nodeId || message.node_id,
            ok: Boolean(res?.ok),
            script_text: res?.script || null,
            error: res?.error || null,
          });
        } catch {}
      };
      generateScript(message, controller.signal)
        .then(async (res) => { await reportScriptResult(res); sendResponse(res); },
              async (error) => { const f = { ok: false, error: error.message || String(error) }; await reportScriptResult(f); sendResponse(f); })
        .finally(() => activeGenerations.delete(message.requestId || 'script'));
      return true;
    }
    if (message?.type === 'MUSEFLOW_GENERATE') {
      const controller = new AbortController();
      activeGenerations.set(message.requestId, controller);

      // Keepalive đánh thức Service Worker
      const keepAliveInterval = setInterval(() => {
        try { chrome.runtime.sendMessage({ type: 'MUSEFLOW_KEEPALIVE' }).catch(() => {}); } catch {}
      }, 5000);

      const reportResult = async (res) => {
        // Kênh 1: chrome.runtime.sendMessage
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

        // Kênh 2: Gửi trực tiếp về HTTP server của Studio (http://127.0.0.1:4826)
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
      };

      generate(message, controller.signal)
        .then(async (res) => { await reportResult(res); try { sendResponse(res); } catch {} },
              async (error) => { const f = { ok: false, code: error.code || 'MUSE_ERROR', error: error.message || String(error) }; await reportResult(f); try { sendResponse(f); } catch {}; })
        .finally(() => { clearInterval(keepAliveInterval); activeGenerations.delete(message.requestId); });
      return true;
    }
    if (message?.type === 'MUSEFLOW_STOP_GENERATION') {
      const stopped = message.requestId ? abortGeneration(message.requestId) : [...activeGenerations.keys()].some(id => abortGeneration(id));
      sendResponse({ ok: true, stopped }); return false;
    }
  });

  function findComposer() {
    const candidates = [...document.querySelectorAll('textarea')].filter(el => visible(el) && !el.disabled);
    return candidates.find(el => /message|消息/i.test(el.getAttribute('placeholder') || '')) || candidates[0] || null;
  }

  function visible(el) { return Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'); }
  const delay = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Generation stopped by user.', 'AbortError')); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(new DOMException('Generation stopped by user.', 'AbortError')); };
    signal?.addEventListener('abort', cancel, { once: true });
  });

  const activeGenerations = new Map();

  function clickMuseStop() {
    const button = [...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')].find(visible);
    if (button) { button.click(); return true; } return false;
  }

  function abortGeneration(requestId) {
    const controller = activeGenerations.get(requestId);
    if (!controller) return false;
    controller.abort(); clickMuseStop(); return true;
  }

  async function checkSession() {
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
    const messages = bubbles.map(el => ({ el, text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() }))
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

  const clickedAnimateButtons = new WeakSet();
  function findAnimateButton() {
    return [...document.querySelectorAll('button, [role="button"], div, span, a')].filter(visible).find(el => {
      if (clickedAnimateButtons.has(el)) return false;
      if (el.getAttribute('data-hosiflow-clicked') === 'true') return false;
      if (el.children.length > 2) return false;
      const text = (el.innerText || el.textContent || '').trim();
      return /animate.*video|animate this|animate into|tạo video/i.test(text) && text.length < 80;
    }) || null;
  }

  function isValidVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    url = url.trim();
    if (url.length < 8) return false;
    if (/\.(png|jpg|jpeg|webp|gif|svg|css|js|woff2?|json|ico)(\?|$)/i.test(url)) return false;
    if (/^https?:\/\/[^\/]+\/?$/i.test(url)) return false;
    if (/\/chat(?:\/|$)/i.test(url)) return false;
    if (/\.(mp4|webm|mov|m4v)(\?|$|#)/i.test(url)) return true;
    if (url.startsWith('blob:')) return true;
    if (url.startsWith('data:video/')) return true;
    if (/muse\.ai.*(?:\/v\/|\/video|\/stream|\/media|\/play|\/workspace\/imagine_media)/i.test(url)) return true;
    return false;
  }

  async function resolvePlayableVideoUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:video/')) return url;
    if (url.startsWith('blob:') || url.includes('/workspace/imagine_media/')) {
      try {
        console.log('[HosiFlow Bridge] Đang fetch video stream để chuyển thành Data URL phát nội bộ...', url);
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 1000) {
            console.log('[HosiFlow Bridge] Đã tải blob video thành công, kích thước:', blob.size);
            return await blobToDataUrl(blob);
          }
        }
      } catch (e) {
        console.warn('[HosiFlow Bridge] Không thể chuyển đổi sang blob:', e);
      }
    }
    return url;
  }

  // TRÍCH XUẤT VIDEO URL TỪ CHAT VÀ DOM CỦA MUSE
  async function extractVideoFromDOM(container, startTime, signal) {
    // 1. Quét tìm đường dẫn file MP4 trong mã nguồn HTML trang (như file workspace/imagine_media/...mp4)
    try {
      const pageHtml = document.body.innerHTML;
      const fileMatches = pageHtml.match(/(?:https?:\/\/[^\s"'<>\\]+)?\/?workspace\/imagine_media\/[^\s"'<>\\]+\.mp4/gi) || [];
      if (fileMatches.length > 0) {
        const rawPath = fileMatches[fileMatches.length - 1];
        const fullUrl = rawPath.startsWith('http') ? rawPath : `${window.location.origin}/${rawPath.replace(/^\//, '')}`;
        console.log('[HosiFlow Bridge] 🎯 Phát hiện đường dẫn video MP4 trong DOM:', fullUrl);
        const playable = await resolvePlayableVideoUrl(fullUrl);
        if (playable) return playable;
      }
    } catch {}

    // 2. Quét thẻ <video> đã render sẵn
    for (const v of document.querySelectorAll('video')) {
      const s = v.currentSrc || v.src || v.querySelector('source')?.src || '';
      if (s && isValidVideoUrl(s)) {
        return await resolvePlayableVideoUrl(s);
      }
    }

    // 3. Quét tất cả thẻ <a href>
    const searchRoot = container || document.body;
    for (const a of searchRoot.querySelectorAll('a[href]')) {
      const href = a.href || '';
      if (isValidVideoUrl(href)) return href;
    }

    // 4. Quét tất cả attributes tìm link .mp4
    for (const el of searchRoot.querySelectorAll('*')) {
      for (const attr of el.attributes) {
        const val = attr.value || '';
        const match = val.match(/https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov|m4v)[^\s"'<>]*/i);
        if (match && isValidVideoUrl(match[0])) return match[0];
      }
    }

    // 5. Tự động kích hoạt Play / click trên card để Muse tải stream video
    const playTarget = searchRoot.querySelector('button[aria-label*="play" i], [class*="play" i], button:has(svg), [role="button"]:has(svg)') ||
                       searchRoot.querySelector('img') ||
                       searchRoot;
    if (playTarget) {
      console.log('[HosiFlow Bridge] Kích hoạt click Play trên video card...', playTarget);
      try {
        playTarget.scrollIntoView({ block: 'nearest' });
        playTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        playTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        playTarget.click();
      } catch {}
    }

    // Đợi tối đa 4 giây sau click để video src hoặc network request xuất hiện
    const waitClickEnd = Date.now() + 4000;
    while (Date.now() < waitClickEnd) {
      if (signal?.aborted) break;

      // Check thẻ <video>
      for (const v of document.querySelectorAll('video')) {
        const s = v.currentSrc || v.src || v.querySelector('source')?.src || '';
        if (s && isValidVideoUrl(s)) return await resolvePlayableVideoUrl(s);
      }

      // Check PerformanceResourceTiming (.mp4 network request)
      try {
        const entries = performance.getEntriesByType('resource')
          .filter(e => e.startTime > (startTime - 5000))
          .filter(e => /\.(mp4|webm|mov|m4v)(\?|$|#)/i.test(e.name) || /video\//i.test(e.initiatorType))
          .sort((a, b) => b.startTime - a.startTime);
        if (entries.length > 0 && isValidVideoUrl(entries[0].name)) {
          return entries[0].name;
        }
      } catch {}

      await delay(300, signal);
    }

    return null;
  }

  // HÀM GENERATE CHÍNH ĐƯỢC ĐƠN GIẢN HOÁ THEO TIN NHẮN MỚI NHẤT
  async function generate({ prompt, timeoutSec = 600, mediaType = 'image', referenceImage = '', referenceImages = [], size = '16:9', requestId }, signal) {
    const throwIfAborted = () => { if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError'); };
    throwIfAborted();
    if (!String(prompt || '').trim()) throw new Error('Prompt is empty.');
    await waitHydrated(15000, signal);
    throwIfAborted();
    const composer = findComposer();
    if (!visible(composer)) throw new Error('Muse message box is not visible. Open the chat composer and retry.');

    const referenceList = Array.isArray(referenceImages) && referenceImages.length ? referenceImages : referenceImage ? [referenceImage] : [];
    if (referenceList.length) await attachReferences(referenceList, signal);
    throwIfAborted();

    const initialBubbleCount = assistantMessageElements().length;
    const priorBubbleTexts = new Map(assistantMessageElements().map(el => [el, (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()]));
    const startTime = performance.now();

    composer.scrollIntoView({ block: 'center' }); composer.focus();
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
    if (sendButton && !sendButton.disabled) { sendButton.click(); submitted = true; }
    else {
      const form = composer.closest('form');
      if (form && typeof form.requestSubmit === 'function') { form.requestSubmit(); submitted = true; }
      else {
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
        accepted = true; break;
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
          console.log(`[HosiFlow Bridge] Muse đang render ${mediaType}... vui lòng đợi...`);
        }
        await delay(1000, signal);
        continue;
      }

      // Xử lý nút Animate nếu Muse yêu cầu bấm
      if (mediaType === 'video') {
        const animateBtn = findAnimateButton();
        if (animateBtn) {
          console.log('[HosiFlow Bridge] Phát hiện nút Animate, tự động bấm...', animateBtn);
          clickedAnimateButtons.add(animateBtn);
          try { animateBtn.setAttribute('data-hosiflow-clicked', 'true'); } catch {}
          animateBtn.click();
          hasSeenStop = true;
          await delay(2000, signal);
          continue;
        }
      }

      // Kiểm tra tin nhắn phản hồi mới từ Assistant
      const currentBubbles = assistantMessageElements();
      const hasNewBubble = currentBubbles.length > initialBubbleCount;

      // Nếu chưa từng thấy Stop và chưa có bubble mới: Muse đang bắt đầu, đợi tiếp
      if (!hasSeenStop && !hasNewBubble) {
        await delay(600, signal);
        continue;
      }

      // Nút Stop đã tắt VÀ có tin nhắn mới (hoặc đã trải qua Stop): MUSE ĐÃ HOÀN THÀNH!
      console.log(`[HosiFlow Bridge] Muse đã hoàn thành ${mediaType}! Đang lấy kết quả...`);
      await delay(1500, signal); // Đợi 1.5s để React render hoàn tất

      const latestBubble = currentBubbles[currentBubbles.length - 1];
      const container = latestBubble?.closest('div[class*="groupable"]') || latestBubble?.parentElement || latestBubble || document.body;

      // ==========================================
      // NHÁNH 1: XỬ LÝ GENERATE VIDEO
      // ==========================================
      if (mediaType === 'video') {
        const videoUrl = await extractVideoFromDOM(container, startTime, signal);
        if (videoUrl && isValidVideoUrl(videoUrl)) {
          // Lấy poster image làm endFrame
          let endFrame = null;
          const posterImg = container.querySelector('img') || document.querySelector('[data-testid^="hatch-chat-attachment"] img');
          if (posterImg && posterImg.src) {
            try {
              const res = await fetch(posterImg.src, { credentials: 'include' });
              if (res.ok) {
                const b = await res.blob();
                endFrame = await blobToDataUrl(b);
              }
            } catch {}
          }
          console.log('[HosiFlow Bridge] ✅ Video đã hoàn thành xuất sắc:', videoUrl);
          return { ok: true, url: videoUrl, endFrame };
        }

        // Nếu chưa trích xuất được ngay, đợi thêm rồi thử lại
        await delay(1500, signal);
        continue;
      }

      // ==========================================
      // NHÁNH 2: XỬ LÝ GENERATE IMAGE
      // ==========================================
      const imageEl = container.querySelector('img') || document.querySelector('[data-testid^="hatch-chat-attachment-presentation-image"] img');
      const imgSrc = imageEl?.currentSrc || imageEl?.src || '';

      if (imgSrc && !/icon|badge|avatar|\.svg/i.test(imgSrc)) {
        if (imgSrc.startsWith('data:')) {
          console.log('[HosiFlow Bridge] ✅ Ảnh hoàn thành (data URL)');
          return { ok: true, url: imgSrc, endFrame: null };
        }
        try {
          const response = await fetch(imgSrc, { credentials: 'include' });
          if (response.ok) {
            const blob = await response.blob();
            const dataUrl = await blobToDataUrl(blob);
            console.log('[HosiFlow Bridge] ✅ Ảnh hoàn thành xuất sắc, kích thước:', blob.size, 'bytes');
            return { ok: true, url: dataUrl, endFrame: null };
          }
        } catch {}
      }

      // Kiểm tra từ chối (refusal) & hết credits
      const ctx = readNewAssistantContext(priorBubbleTexts);
      if (isRefusalContext(ctx)) {
        if (ctx !== refusalContext) { refusalContext = ctx; refusalContextSince = Date.now(); }
        const clearRefusal = inability.test(ctx) && sceneContext.test(ctx) && offerAlternative.test(ctx);
        if (clearRefusal || Date.now() - refusalContextSince >= 1200) {
          if (isStopVisible) clickMuseStop();
          const error = new Error(`Muse could not generate this scene: ${ctx.slice(-700)}`);
          error.code = 'SCENE_REFUSED';
          throw error;
        }
      } else { refusalContext = ''; refusalContextSince = 0; }

      await delay(800, signal);
    }

    throwIfAborted();
    throw new Error(`Timed out waiting for Muse ${mediaType} completion.`);
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
      const uploadButton = roots.flatMap(root => [...root.querySelectorAll('button,[role="button"],label')]).filter(visible).find(el =>
        /attach|upload|image|photo|file|đính kèm|tải lên/i.test(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.innerText || ''}`)
      );
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
      const transfer = new DataTransfer(); batch.forEach(file => transfer.items.add(file));
      if (batch.length > 1) input.multiple = true;
      setter.call(input, transfer.files);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const started = Date.now(), deadline = started + 8000;
      const accepted = () => batch.every(file => [...(input.files || [])].some(item => item.name === file.name && item.size === file.size));
      const previewSeen = () => previewElements().some(el => {
        const key = previewKey(el), src = el.matches('img') ? (el.currentSrc || el.src || '') : key.split('|', 1)[0];
        return !previousPreviews.has(key) && Boolean(src);
      });
      while (Date.now() < deadline) {
        if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError');
        if (previewSeen() || accepted() && Date.now() - started > 1000) return;
        await delay(160, signal);
      }
      throw new Error(`Muse did not confirm ${batch.length} reference image${batch.length === 1 ? '' : 's'} in the chat composer (upload input accepts: ${input.accept || 'any file'}); the prompt was not submitted.`);
    };

    if (files.length > 1 && !input.multiple) {
      for (const file of files) await uploadBatch([file]);
    } else await uploadBatch(files);
  }

  // GENERATE SCRIPT CHO PROMPT NODE
  async function generateScript({ prompt, timeoutSec = 180 }, signal) {
    if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError');
    if (!String(prompt || '').trim()) throw new Error('Prompt is empty.');

    await waitHydrated(15000, signal);
    const composer = findComposer();
    if (!visible(composer)) throw new Error('Muse message box is not visible.');

    const initialBubbles = assistantMessageElements();
    const initialTextMap = new Map(initialBubbles.map(el => [el, (el.innerText || el.textContent || '').trim()]));

    composer.scrollIntoView({ block: 'center' }); composer.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Muse message box is unsupported.');
    setter.call(composer, String(prompt));
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));

    let sendButton = null;
    for (let i = 0; i < 30; i++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      sendButton = [...document.querySelectorAll('button,[role="button"]')].filter(visible).find(b =>
        /send|gửi|发送/i.test(`${b.getAttribute('aria-label') || ''} ${b.getAttribute('data-testid') || ''} ${b.innerText || ''}`)
      );
      if (sendButton && !sendButton.disabled) break;
      await delay(100, signal);
    }

    if (sendButton && !sendButton.disabled) sendButton.click();
    else {
      const form = composer.closest('form');
      if (form && typeof form.requestSubmit === 'function') form.requestSubmit();
      else {
        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        composer.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
      }
    }

    const deadline = Date.now() + (Number(timeoutSec) || 180) * 1000;
    let lastText = '', stableSince = 0;

    while (Date.now() < deadline) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const bubbles = assistantMessageElements();
      const freshBubble = bubbles.find(el => !initialTextMap.has(el)) || bubbles[bubbles.length - 1];

      if (freshBubble) {
        const text = (freshBubble.innerText || freshBubble.textContent || '').trim();
        const isStopVisible = Boolean(
          document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="Dừng" i],button[aria-label*="停止"]')
        );

        if (text && text.length > 50) {
          if (text === lastText) {
            if (!stableSince) stableSince = Date.now();
            if (!isStopVisible && Date.now() - stableSince >= 2000) return { ok: true, script: text };
          } else { lastText = text; stableSince = 0; }
        }
      }
      await delay(400, signal);
    }

    if (lastText && lastText.length > 50) return { ok: true, script: lastText };
    throw new Error('Hết thời gian chờ Muse.ai soạn kịch bản.');
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Media conversion failed.'));
      reader.readAsDataURL(blob);
    });
  }

})();
