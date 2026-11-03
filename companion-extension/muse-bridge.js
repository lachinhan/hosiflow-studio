(() => {
  if (window.__museFlowBridgeInstalled) return;
  window.__museFlowBridgeInstalled = true;

  // ========================================================
  // INTERCEPT FETCH + XHR ĐỂ BẮT VIDEO URL TỪ API MUSE
  // Đây là cách đáng tin cậy nhất: bắt response trước khi Muse render
  // ========================================================
  const _interceptedVideoUrls = []; // Danh sách URL video bắt được từ network

  (function patchNetwork() {
    // Patch window.fetch
    const _origFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await _origFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        // Chỉ intercept các API call của Muse (không intercept external CDN)
        if (/muse\.ai|api\//i.test(url) && !/\.(png|jpg|jpeg|webp|gif|svg|css|js|woff)/i.test(url)) {
          const clone = response.clone();
          clone.json().then(data => {
            const jsonStr = JSON.stringify(data);
            // Tìm URL .mp4/.webm trong JSON response
            const matches = jsonStr.match(/https?:\/\/[^"'\\]+\.(?:mp4|webm|mov|m4v)[^"'\\]*/gi) || [];
            matches.forEach(u => {
              if (!_interceptedVideoUrls.includes(u)) {
                console.log('[HosiFlow Bridge] 🎯 Bắt được video URL từ Muse API fetch:', u);
                _interceptedVideoUrls.push(u);
              }
            });
          }).catch(() => {});
        }
        // Cũng kiểm tra URL trực tiếp là .mp4
        if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(typeof args[0] === 'string' ? args[0] : '')) {
          const directUrl = typeof args[0] === 'string' ? args[0] : '';
          if (directUrl && !_interceptedVideoUrls.includes(directUrl)) {
            console.log('[HosiFlow Bridge] 🎯 Bắt được video URL trực tiếp từ fetch:', directUrl);
            _interceptedVideoUrls.push(directUrl);
          }
        }
      } catch {}
      return response;
    };

    // Patch XMLHttpRequest
    const _origOpen = XMLHttpRequest.prototype.open;
    const _origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._hosiflowUrl = url || '';
      return _origOpen.apply(this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener('load', function() {
        try {
          const url = this._hosiflowUrl || '';
          if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
            if (!_interceptedVideoUrls.includes(url)) {
              console.log('[HosiFlow Bridge] 🎯 Bắt được video URL từ XHR:', url);
              _interceptedVideoUrls.push(url);
            }
          }
          if (/muse\.ai|api\//i.test(url) && this.responseText) {
            const matches = this.responseText.match(/https?:\/\/[^"'\\]+\.(?:mp4|webm|mov|m4v)[^"'\\]*/gi) || [];
            matches.forEach(u => {
              if (!_interceptedVideoUrls.includes(u)) {
                console.log('[HosiFlow Bridge] 🎯 Bắt được video URL từ XHR response:', u);
                _interceptedVideoUrls.push(u);
              }
            });
          }
        } catch {}
      });
      return _origSend.apply(this, args);
    };
  })();

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
      const keepAliveInterval = setInterval(() => {
        try { chrome.runtime.sendMessage({ type: 'MUSEFLOW_KEEPALIVE' }).catch(() => {}); } catch {}
      }, 5000);
      const reportResult = async (res) => {
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

  // ========== HELPERS ==========
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
    const btn = [...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')].find(visible);
    if (btn) { btn.click(); return true; } return false;
  }
  function abortGeneration(requestId) {
    const c = activeGenerations.get(requestId);
    if (!c) return false;
    c.abort(); clickMuseStop(); return true;
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

  // ========== TÌM VIDEO URL - ĐA CHIẾN LƯỢC ==========

  // Chiến lược 1: URL đã bắt được từ fetch/XHR intercept (đáng tin cậy nhất)
  function getInterceptedVideoUrl(capturedBefore) {
    // Chỉ lấy URL được bắt SAU khi bắt đầu job này
    return _interceptedVideoUrls.find(u => !capturedBefore.has(u)) || '';
  }

  // Chiến lược 2: PerformanceResourceTiming API
  function getVideoUrlFromPerformance(startTime) {
    try {
      return performance.getEntriesByType('resource')
        .filter(e => e.startTime > startTime && /\.(mp4|webm|mov|m4v)(\?|$|#)/i.test(e.name))
        .sort((a, b) => b.startTime - a.startTime)[0]?.name || '';
    } catch { return ''; }
  }

  // Chiến lược 3: Quét DOM tìm URL video trong tất cả attributes
  function getVideoUrlFromDOM(root) {
    try {
      const all = root ? [root, ...root.querySelectorAll('*')] : [...document.querySelectorAll('*')];
      for (const el of all) {
        // Kiểm tra <video src>, <source src>
        if (el.tagName === 'VIDEO' || el.tagName === 'SOURCE') {
          const s = el.currentSrc || el.src || '';
          if (s && /\.(mp4|webm|mov|m4v)/i.test(s)) return s;
        }
        // Kiểm tra <a href>
        if (el.tagName === 'A' && /\.(mp4|webm|mov|m4v)/i.test(el.href || '')) return el.href;
        // Quét tất cả attributes
        for (const attr of [...(el.attributes || [])]) {
          if (/https?:\/\//i.test(attr.value) && /\.(mp4|webm|mov|m4v)/i.test(attr.value)) {
            return attr.value.match(/https?:\/\/[^\s"'<>]*/)?.[0] || '';
          }
        }
      }
    } catch {}
    return '';
  }

  // Chiến lược 4: Quét React fiber state để tìm video URL
  function getVideoUrlFromReactFiber(containerEl) {
    try {
      function searchFiber(fiber, depth) {
        if (!fiber || depth > 20) return '';
        const state = fiber.memoizedState;
        if (state) {
          const stateStr = JSON.stringify(state);
          const m = stateStr.match(/https?:\/\/[^"']+\.(?:mp4|webm|mov|m4v)[^"']*/i);
          if (m) return m[0];
        }
        const props = fiber.memoizedProps;
        if (props) {
          const propsStr = JSON.stringify(props);
          const m = propsStr.match(/https?:\/\/[^"']+\.(?:mp4|webm|mov|m4v)[^"']*/i);
          if (m) return m[0];
        }
        return searchFiber(fiber.child, depth + 1) || searchFiber(fiber.sibling, depth + 1);
      }
      // Tìm React fiber key trên DOM element
      const el = containerEl || document.body;
      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
      if (fiberKey) {
        return searchFiber(el[fiberKey], 0) || '';
      }
    } catch {}
    return '';
  }

  // Chiến lược 5: Click play button để trigger lazy load, rồi đợi <video src>
  async function clickPlayAndWaitForVideoSrc(container, signal) {
    try {
      const playBtn = container.querySelector(
        '[role="button"], button, [aria-label*="play" i], [data-testid*="play" i], [class*="play" i]'
      ) || container;
      playBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      playBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      playBtn.click();
      // Đợi <video> có src sau khi click
      const end = Date.now() + 5000;
      while (Date.now() < end) {
        if (signal?.aborted) break;
        const videos = [...document.querySelectorAll('video')];
        for (const v of videos) {
          const s = v.currentSrc || v.src || '';
          if (s && /\.(mp4|webm|mov|m4v)/i.test(s)) return s;
        }
        await delay(200, signal);
      }
    } catch {}
    return '';
  }

  // ========== HÀM TỔNG HỢP: DETECT MUSE VIDEO COMPLETION ==========
  function isMuseStillGenerating() {
    return Boolean([...document.querySelectorAll(
      '[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]'
    )].find(visible));
  }

  function hasNewVideoAttachment(baselineEls) {
    const allVideoContainers = [
      ...document.querySelectorAll(
        '[data-testid^="hatch-chat-attachment-presentation-video"], ' +
        '[data-testid*="video" i], ' +
        'video'
      )
    ].filter(el =>
      !el.closest('form, [class*="chat-user-bubble"], [data-message-author-role="user"]') &&
      !el.closest('[data-testid="hatch-composer-placeholder-overlay"]')
    );
    return allVideoContainers.filter(el => !baselineEls.has(el));
  }

  // ========== ATTACHMENTS (CHỈ DÙNG CHO ẢNH) ==========
  function imageAttachments(baseline) {
    const elements = [...document.querySelectorAll(
      '[data-testid^="hatch-chat-attachment-presentation-image"]'
    )];
    const list = [];
    const seen = new Set();
    for (const el of elements) {
      if (el.closest('form, [class*="chat-user-bubble"], [data-message-author-role="user"]') ||
          el.closest('[data-testid="hatch-composer-placeholder-overlay"]')) continue;
      const tid = el.getAttribute('data-testid') || '';
      if (/file|code|script|document|text|json/i.test(tid)) continue;
      const image = el.querySelector('img') || (el.matches('img') ? el : null);
      if (!image) continue;
      const imgSrc = image.currentSrc || image.src || '';
      if (!imgSrc) continue;
      if (/icon|badge|avatar|document|file|\.svg/i.test(imgSrc)) continue;
      if (image.naturalWidth > 0 && (image.naturalWidth < 180 || image.naturalHeight < 180)) continue;
      if (baseline && baseline.has(imgSrc)) continue;
      if (seen.has(imgSrc)) continue;
      seen.add(imgSrc);
      list.push({ el, src: imgSrc, width: image.naturalWidth, height: image.naturalHeight });
    }
    return list;
  }

  function waitForDOMChange(timeoutMs, signal) {
    return new Promise(resolve => {
      let timer;
      const obs = new MutationObserver(() => finish());
      const finish = () => { obs.disconnect(); clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
      obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
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
    return bubbles.map(el => ({ el, text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() }))
      .filter(item => item.text && item.text !== previousBubbleTexts.get(item.el))
      .map(item => item.text).join('\n').slice(-6000);
  }

  function isRefusalContext(context) {
    const t = String(context || '');
    const explicit = /(?:i|we)\s+(?:am\s+)?sorry[\s\S]{0,180}(?:cannot|can't|unable|won't)|(?:cannot|can't|couldn't|unable to|not able to)\s+(?:help|assist|create|generate|make|produce|fulfill|complete|comply)|(?:request|prompt).{0,100}(?:violat|disallowed|restricted|not allowed)|(?:policy|safety).{0,100}(?:prevent|restrict|unable)|generation (?:was )?(?:declined|blocked)|content (?:is )?not allowed|i can't comply/i;
    const inability = /(?:không tạo được|không thể tạo|chưa thể tạo|không thực hiện được|vẫn không tạo được|không làm được)/i;
    const sceneContext = /(?:cảnh|bản|đoạn|video|ảnh|nội dung|yêu cầu|này)/i;
    const offerAlt = /(?:bản|phiên bản|phương án)\s+tương\s+đương|tương\s+đương.{0,100}(?:bám|theo|kịch bản)|muốn.{0,100}(?:tạo mới|thử lại|làm lại)|(?:would you like|do you want|want me to).{0,100}(?:create|make|generate|try)|equivalent alternative/i;
    return explicit.test(t) || (inability.test(t) && (sceneContext.test(t) || offerAlt.test(t)));
  }

  const clickedAnimateButtons = new WeakSet();
  function clickElement(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'nearest' });
    try { el.focus(); } catch {}
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    el.click();
  }
  function findAnimateButton() {
    return [...document.querySelectorAll('button, [role="button"], div, span, a')].filter(visible).find(el => {
      if (clickedAnimateButtons.has(el)) return false;
      if (el.getAttribute('data-hosiflow-clicked') === 'true') return false;
      if (el.children.length > 2) return false;
      const text = (el.innerText || el.textContent || '').trim();
      return /animate.*video|animate this|animate into|tạo video/i.test(text) && text.length < 80;
    }) || null;
  }

  async function imageToDataUrl(elementOrUrl) {
    try {
      if (elementOrUrl instanceof HTMLImageElement && elementOrUrl.complete && elementOrUrl.naturalWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = elementOrUrl.naturalWidth; canvas.height = elementOrUrl.naturalHeight;
          canvas.getContext('2d').drawImage(elementOrUrl, 0, 0);
          const d = canvas.toDataURL('image/png');
          if (d && d.length > 100) return d;
        } catch {}
      }
      const url = typeof elementOrUrl === 'string' ? elementOrUrl : (elementOrUrl?.currentSrc || elementOrUrl?.src);
      if (!url) return '';
      if (url.startsWith('data:image')) return url;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return url;
      const blob = await res.blob();
      return await new Promise(resolve => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result || url);
        r.onerror = () => resolve(url);
        r.readAsDataURL(blob);
      });
    } catch {
      return typeof elementOrUrl === 'string' ? elementOrUrl : (elementOrUrl?.currentSrc || elementOrUrl?.src || '');
    }
  }

  // ========== MAIN GENERATE FUNCTION ==========
  async function generate({ prompt, timeoutSec = 600, mediaType = 'image', referenceImage = '', referenceImages = [], size = '16:9', requestId }, signal) {
    const throwIfAborted = () => { if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError'); };
    throwIfAborted();
    if (!String(prompt || '').trim()) throw new Error('Prompt is empty.');
    await waitHydrated(15000, signal);
    throwIfAborted();
    const composer = findComposer();
    if (!visible(composer)) throw new Error('Muse message box is not visible.');

    const referenceList = Array.isArray(referenceImages) && referenceImages.length ? referenceImages : referenceImage ? [referenceImage] : [];
    if (referenceList.length) await attachReferences(referenceList, signal);
    throwIfAborted();

    // Snapshot baseline trước khi submit
    const baselineImageSrcs = new Set(
      [...document.querySelectorAll('[data-testid^="hatch-chat-attachment-presentation-image"] img')]
        .map(img => img.currentSrc || img.src).filter(Boolean)
    );
    const baselineVideoEls = new Set(
      [...document.querySelectorAll(
        '[data-testid^="hatch-chat-attachment-presentation-video"], [data-testid*="video" i], video'
      )].filter(el =>
        !el.closest('form, [class*="chat-user-bubble"], [data-message-author-role="user"]') &&
        !el.closest('[data-testid="hatch-composer-placeholder-overlay"]')
      )
    );
    // Snapshot intercepted URLs trước khi submit
    const capturedBeforeSet = new Set(_interceptedVideoUrls);
    // Snapshot PerformanceAPI start time
    const perfStartTime = performance.now();

    const priorBubbleTexts = new Map(assistantMessageElements().map(el => [el, (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()]));

    // Build và submit prompt
    let targetPrompt = String(prompt || '').trim();
    if (mediaType === 'video') {
      if (referenceList.length > 0 && !/animate.*video/i.test(targetPrompt)) {
        targetPrompt = `Animate this exact reference image into a video: ${targetPrompt}`;
      } else if (!/video/i.test(targetPrompt)) {
        targetPrompt = `Generate a cinematic video: ${targetPrompt}`;
      }
    }
    if (!/--(?:ar|aspect)\s+\d+:\d+/i.test(targetPrompt)) {
      const ratioKw = targetSize => ({
        '16:9': '--ar 16:9, widescreen 16:9 horizontal',
        '9:16': '--ar 9:16, vertical 9:16 portrait',
        '1:1': '--ar 1:1, square 1:1',
        '4:3': '--ar 4:3, standard 4:3',
      })[targetSize] || `--ar ${targetSize}`;
      targetPrompt = `${targetPrompt} ${ratioKw(size || '16:9')}`;
    }

    composer.scrollIntoView({ block: 'center' }); composer.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Muse message box is unsupported.');
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
    if (!composer.value.trim()) throw new Error('Muse did not accept the prompt into its message box.');
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
    if (!submitted || !accepted) throw new Error('Muse did not confirm the prompt submission.');

    const deadline = Date.now() + Math.min(900, Math.max(30, Number(timeoutSec) || 600)) * 1000;
    let wrongMediaSince = 0, refusalContext = '', refusalContextSince = 0;
    let lastDebugLog = 0, videoClickAttempts = 0;

    while (Date.now() < deadline) {
      throwIfAborted();

      // ===== XỬ LÝ VIDEO =====
      if (mediaType === 'video') {
        // Kiểm tra Animate button (Muse gợi ý tạo video từ ảnh)
        const animateBtn = findAnimateButton();
        if (animateBtn) {
          console.log('[HosiFlow Bridge] Bấm nút Animate...');
          clickedAnimateButtons.add(animateBtn);
          try { animateBtn.setAttribute('data-hosiflow-clicked', 'true'); } catch {}
          clickElement(animateBtn);
          await delay(2500, signal);
          continue;
        }

        // === CHIẾN LƯỢC 1: Kiểm tra fetch/XHR intercept ngay cả khi đang gen ===
        const interceptedUrl = getInterceptedVideoUrl(capturedBeforeSet);
        if (interceptedUrl) {
          console.log('[HosiFlow Bridge] ✅ VIDEO URL từ network intercept:', interceptedUrl);
          return { ok: true, url: interceptedUrl, endFrame: null };
        }

        const stillGenerating = isMuseStillGenerating();

        if (stillGenerating) {
          // Vẫn đang gen: log debug mỗi 10s
          if (Date.now() - lastDebugLog > 10000) {
            lastDebugLog = Date.now();
            console.log('[HosiFlow Bridge] Muse đang gen video... đợi...');
          }
          await delay(800, signal);
          continue;
        }

        // Stop button biến mất → Muse ĐÃ XONG
        console.log('[HosiFlow Bridge] Stop button biến mất → Muse đã xong. Đang tìm video URL...');

        // Chiến lược 2: PerformanceAPI
        const perfUrl = getVideoUrlFromPerformance(perfStartTime);
        if (perfUrl) {
          console.log('[HosiFlow Bridge] ✅ VIDEO URL từ PerformanceAPI:', perfUrl);
          return { ok: true, url: perfUrl, endFrame: null };
        }

        // Chiến lược 3: DOM attribute scan
        const newVideoEls = hasNewVideoAttachment(baselineVideoEls);
        console.log('[HosiFlow Bridge] New video elements found:', newVideoEls.length);

        for (const el of newVideoEls) {
          const domUrl = getVideoUrlFromDOM(el);
          if (domUrl) {
            console.log('[HosiFlow Bridge] ✅ VIDEO URL từ DOM scan:', domUrl);
            return { ok: true, url: domUrl, endFrame: null };
          }
          // Chiến lược 4: React fiber
          const fiberUrl = getVideoUrlFromReactFiber(el);
          if (fiberUrl) {
            console.log('[HosiFlow Bridge] ✅ VIDEO URL từ React fiber:', fiberUrl);
            return { ok: true, url: fiberUrl, endFrame: null };
          }
        }

        // Chiến lược 5: Click play trên video container mới nhất
        if (newVideoEls.length > 0 && videoClickAttempts < 3) {
          videoClickAttempts++;
          const target = newVideoEls[newVideoEls.length - 1];
          console.log(`[HosiFlow Bridge] Click play để load video src (lần ${videoClickAttempts}/3)...`);
          const clickUrl = await clickPlayAndWaitForVideoSrc(target, signal);
          if (clickUrl) {
            console.log('[HosiFlow Bridge] ✅ VIDEO URL sau click play:', clickUrl);
            return { ok: true, url: clickUrl, endFrame: null };
          }
          // Sau click, kiểm tra lại PerformanceAPI và intercept
          await delay(1000, signal);
          const perfUrl2 = getVideoUrlFromPerformance(perfStartTime);
          if (perfUrl2) return { ok: true, url: perfUrl2, endFrame: null };
          const interceptedUrl2 = getInterceptedVideoUrl(capturedBeforeSet);
          if (interceptedUrl2) return { ok: true, url: interceptedUrl2, endFrame: null };
          continue;
        }

        // DEBUG: Dump toàn bộ thông tin để điều tra
        if (Date.now() - lastDebugLog > 5000) {
          lastDebugLog = Date.now();
          const allVideos = [...document.querySelectorAll('video')];
          const allAttach = [...document.querySelectorAll('[data-testid^="hatch-chat-attachment"]')];
          const perfAll = performance.getEntriesByType('resource').filter(e => /video|mp4|webm|media|cdn|muse/i.test(e.name));
          console.log('[HosiFlow Bridge] DEBUG videos:', allVideos.map(v => ({ src: v.src, currentSrc: v.currentSrc, poster: v.poster })));
          console.log('[HosiFlow Bridge] DEBUG attachments:', allAttach.map(el => ({ tid: el.dataset.testid, html: el.outerHTML.slice(0, 400) })));
          console.log('[HosiFlow Bridge] DEBUG perf resources:', perfAll.map(e => e.name));
          console.log('[HosiFlow Bridge] DEBUG intercepted:', _interceptedVideoUrls);
          console.log('[HosiFlow Bridge] DEBUG new video els:', newVideoEls.map(el => el.outerHTML.slice(0, 300)));
        }

        // Chờ DOM thay đổi và thử lại
        await waitForDOMChange(2000, signal);
        continue;
      }

      // ===== XỬ LÝ ẢNH =====
      const freshImages = imageAttachments(baselineImageSrcs);
      if (freshImages.length > 0) {
        const [ratioW, ratioH] = String(size || '16:9').split(':').map(Number);
        const expectedRatio = ratioW > 0 && ratioH > 0 ? ratioW / ratioH : 1;
        const best = freshImages.sort((a, b) => {
          const rA = Math.abs(Math.log((a.width / (a.height || 1)) / expectedRatio));
          const rB = Math.abs(Math.log((b.width / (b.height || 1)) / expectedRatio));
          return rA - rB;
        })[0];
        if (best) {
          const imgEl = best.el.querySelector('img') || (best.el.matches('img') ? best.el : null);
          const finalUrl = await imageToDataUrl(imgEl || best.src);
          console.log('[HosiFlow Bridge] ✅ Ảnh hoàn thành:', finalUrl?.slice(0, 60));
          return { ok: true, url: finalUrl, endFrame: null };
        }
      }

      // Kiểm tra refusal và credits
      const stop = isMuseStillGenerating();
      const ctx = readNewAssistantContext(priorBubbleTexts);
      if (isRefusalContext(ctx)) {
        if (ctx !== refusalContext) { refusalContext = ctx; refusalContextSince = Date.now(); }
        if (Date.now() - refusalContextSince >= 1200) {
          if (stop) clickMuseStop();
          const e = new Error(`Muse could not generate this scene: ${ctx.slice(-700)}`); e.code = 'SCENE_REFUSED'; throw e;
        }
      } else { refusalContext = ''; refusalContextSince = 0; }
      if (!stop) {
        const tail = (document.body?.innerText || '').slice(-800);
        if (/out of credits|insufficient credits|额度不足|积分不足/i.test(tail)) throw new Error('Muse account has insufficient image credits.');
      }
      await waitForDOMChange(Math.min(500, deadline - Date.now()), signal);
    }
    throwIfAborted();
    throw new Error(`Timed out waiting for a new Muse ${mediaType} attachment. Prompt was submitted once; it was not resubmitted.`);
  }

  // ========== ATTACH REFERENCES ==========
  async function attachReferences(references, signal) {
    const files = await Promise.all(references.map(async (reference, index) => {
      const url = typeof reference === 'string' ? reference : reference?.url;
      if (!url) throw new Error(`Reference image ${index + 1} has no URL.`);
      let response = await fetch(url).catch(() => null);
      if (!response || !response.ok) response = await fetch(url, { credentials: 'include' }).catch(() => null);
      if (!response || !response.ok) throw new Error(`Could not load reference image ${index + 1} (${response?.status || 'network error'}).`);
      const blob = await response.blob();
      if (!blob.size) throw new Error(`Reference ${index + 1} is not a readable image.`);
      const detectedType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
      const ext = (detectedType.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
      return new File([blob], `museflow-reference-${String(index + 1).padStart(2, '0')}.${ext}`, { type: detectedType });
    }));
    const composer = findComposer();
    let composerRoot = composer.closest('form') || composer.parentElement;
    for (let i = 0; i < 8 && composerRoot?.parentElement; i++) {
      if (composerRoot.querySelector('input[type="file"]')) break;
      composerRoot = composerRoot.parentElement;
    }
    const acceptsImage = input => { const a = (input.accept || '').toLowerCase(); return !a || a.includes('image') || a.includes('*/*') || /\.(png|jpe?g|webp|gif|bmp|avif)/.test(a); };
    const findInput = () => {
      const all = [...document.querySelectorAll('input[type="file"]')].filter(i => !i.disabled && acceptsImage(i));
      const isImg = i => /image|\.png|\.jpe?g|\.webp|\.gif|\.avif/i.test(i.accept || '');
      return all.find(i => composerRoot?.contains(i) && isImg(i)) || all.find(i => composerRoot?.contains(i)) || all.find(isImg) || null;
    };
    let input = findInput();
    if (!input) {
      const roots = [composerRoot, composer.closest('form'), composer.parentElement].filter(Boolean);
      const uploadBtn = roots.flatMap(r => [...r.querySelectorAll('button,[role="button"],label')]).filter(visible)
        .find(el => /attach|upload|image|photo|file|đính kèm|tải lên/i.test(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.innerText || ''}`));
      if (uploadBtn) { uploadBtn.click(); await delay(250, signal); input = findInput(); }
    }
    if (!input) throw new Error('Muse image upload control was not found near the chat composer.');
    const previewSelector = 'img,[role="img"],[data-testid*="attachment" i],[data-testid*="upload" i],[class*="attachment" i],[class*="upload" i]';
    const previewElements = () => [...document.querySelectorAll(previewSelector)].filter(visible);
    const previewKey = el => {
      const src = el.matches('img') ? (el.currentSrc || el.src || '') : /url\(["']?(blob:|data:image\/|https?:)[^)]*\)/i.exec(getComputedStyle(el).backgroundImage)?.[0] || '';
      return `${src}|${el.getAttribute('data-testid') || ''}|${el.getAttribute('class') || ''}`;
    };
    const setter2 = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
    if (!setter2) throw new Error('Browser does not allow setting the Muse attachment input.');
    const uploadBatch = async (batch) => {
      const prevPreviews = new Set(previewElements().map(previewKey));
      const transfer = new DataTransfer(); batch.forEach(f => transfer.items.add(f));
      if (batch.length > 1) input.multiple = true;
      setter2.call(input, transfer.files);
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      const started = Date.now(), dl = started + 8000;
      const accepted = () => batch.every(f => [...(input.files || [])].some(i => i.name === f.name && i.size === f.size));
      const previewSeen = () => previewElements().some(el => { const key = previewKey(el); return !prevPreviews.has(key) && Boolean(key.split('|')[0]); });
      while (Date.now() < dl) {
        if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError');
        if (previewSeen() || (accepted() && Date.now() - started > 1000)) return;
        await delay(160, signal);
      }
      throw new Error(`Muse did not confirm ${batch.length} reference image(s) in the chat composer.`);
    };
    if (files.length > 1 && !input.multiple) { for (const f of files) await uploadBatch([f]); }
    else await uploadBatch(files);
  }

  // ========== GENERATE SCRIPT ==========
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
      sendButton = [...document.querySelectorAll('button,[role="button"]')].filter(visible)
        .find(b => /send|gửi|发送/i.test(`${b.getAttribute('aria-label') || ''} ${b.getAttribute('data-testid') || ''} ${b.innerText || ''}`));
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
        const isStopVisible = Boolean(document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="Dừng" i],button[aria-label*="停止"]'));
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

})();
