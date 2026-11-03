(() => {
  window.__museFlowBridgeInstalled = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'MUSEFLOW_CHECK_SESSION') {
      checkSession().then(sendResponse);
      return true;
    }
    if (message?.type === 'MUSEFLOW_GENERATE_SCRIPT') {
      const controller = new AbortController();
      activeGenerations.set(message.requestId || 'script', controller);
      generateScript(message, controller.signal)
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }))
        .finally(() => activeGenerations.delete(message.requestId || 'script'));
      return true;
    }
    if (message?.type === 'MUSEFLOW_GENERATE') {
      const controller = new AbortController();
      activeGenerations.set(message.requestId, controller);

      const reportToLocalServer = async (res) => {
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
        } catch (e) {
          console.warn('[HosiFlow Bridge] reportToLocalServer notice:', e);
        }
      };

      generate(message, controller.signal)
        .then(async (res) => {
          await reportToLocalServer(res);
          sendResponse(res);
        }, async (error) => {
          const res = { ok: false, code: error.code || 'MUSE_ERROR', error: error.message || String(error) };
          await reportToLocalServer(res);
          sendResponse(res);
        })
        .finally(() => activeGenerations.delete(message.requestId));
      return true;
    }
    if (message?.type === 'MUSEFLOW_STOP_GENERATION') {
      const stopped = message.requestId ? abortGeneration(message.requestId) : [...activeGenerations.keys()].some(id => abortGeneration(id));
      sendResponse({ ok: true, stopped });
      return false;
    }
  });

  function findComposer() {
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

  const activeGenerations = new Map();

  function clickMuseStop() {
    const button = document.querySelector('[data-testid="hatch-composer-stop-button"]');
    if (button && visible(button)) { button.click(); return true; }
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

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Media conversion failed.'));
      reader.readAsDataURL(blob);
    });
  }

  // Chuyển đổi toàn diện ảnh sang Base64 Data URL
  async function extractImageDataUrl(imgEl) {
    if (!imgEl) return '';
    const src = imgEl.currentSrc || imgEl.src || '';

    // 1. Fetch trực tiếp blob URL (blob:https://muse.ai/<UUID>)
    if (src.startsWith('blob:')) {
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        if (blob && blob.size > 0) {
          const dataUrl = await blobToDataUrl(blob);
          if (dataUrl && dataUrl.startsWith('data:image/')) {
            return dataUrl;
          }
        }
      } catch (e) {
        console.warn('[HosiFlow Bridge] Fetch blob failed, trying canvas:', e);
      }
    }

    // 2. Xuất trực tiếp qua Canvas (hỗ trợ cả WEBP và PNG)
    try {
      if (imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth;
        canvas.height = imgEl.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0);

        let dUrl = canvas.toDataURL('image/webp');
        if (dUrl && dUrl.startsWith('data:image/webp') && dUrl.length > 200) {
          return dUrl;
        }
        dUrl = canvas.toDataURL('image/png');
        if (dUrl && dUrl.startsWith('data:image/png') && dUrl.length > 200) {
          return dUrl;
        }
      }
    } catch (e) {
      console.warn('[HosiFlow Bridge] Canvas export failed:', e);
    }

    // 3. URL thông thường (https://...)
    if (src && !src.startsWith('blob:') && !src.startsWith('data:')) {
      try {
        const response = await fetch(src, { credentials: 'include' });
        const blob = await response.blob();
        if (blob && blob.size > 0) {
          return await blobToDataUrl(blob);
        }
      } catch (e) {
        console.warn('[HosiFlow Bridge] Fetch https failed:', e);
      }
    }

    return src.startsWith('data:image/') ? src : '';
  }

  function assistantMessageElements() {
    return [...document.querySelectorAll('div[class*="hatch-chat-groupable-bubble"],[data-message-author-role="assistant"],[data-testid*="assistant" i],[data-testid*="message-content" i],[class*="assistant-message" i],[class*="assistant-bubble" i]')].filter(el => visible(el) && !el.closest('[class*="chat-user-bubble"],[data-message-author-role="user"],[data-testid*="user-message" i]'));
  }

  function readNewAssistantContext(previousBubbleTexts) {
    const bubbles = assistantMessageElements();
    const messages = bubbles.map(el => ({ el, text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() })).filter(item => item.text && item.text !== previousBubbleTexts.get(item.el));
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

    // 1. Chụp lại snapshot danh sách URL ảnh và video ĐANG CÓ trước khi submit
    const baselineImgUrls = new Set([...document.querySelectorAll('img')].map(i => i.currentSrc || i.src || '').filter(Boolean));
    const priorBubbleTexts = new Map(assistantMessageElements().map(el => [el, (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()]));

    composer.scrollIntoView({ block: 'center' }); composer.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Muse message box is unsupported.');
    setter.call(composer, String(prompt));
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));

    let sendButton = null;
    for (let i = 0; i < 30; i++) {
      throwIfAborted();
      sendButton = [...document.querySelectorAll('button,[role="button"]')].filter(visible).find(b => /send|gửi|发送/i.test(`${b.getAttribute('aria-label') || ''} ${b.getAttribute('data-testid') || ''} ${b.innerText || ''}`));
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
      if (!composer.isConnected || !composer.value.trim() || bubbleCount() > beforeSendCount || document.querySelector('[data-testid="hatch-composer-stop-button"]')) { accepted = true; break; }
      await delay(100, signal);
    }
    if (!submitted || !accepted) throw new Error('Muse did not confirm the prompt submission. Check the chat box and try again; MuseFlow will not resubmit automatically.');

    // Chờ 2 giây để Muse khởi tạo tiến trình
    await delay(2000, signal);

    const deadline = Date.now() + Math.min(900, Math.max(30, Number(timeoutSec) || 600)) * 1000;
    let refusalContext = '', refusalContextSince = 0;

    while (Date.now() < deadline) {
      throwIfAborted();

      // Kiểm tra bong bóng tin nhắn mới nhất của Assistant
      const bubbles = assistantMessageElements();
      const latestBubble = bubbles[bubbles.length - 1];

      // ==========================================
      // NHÁNH 1: XỬ LÝ GENERATE IMAGE
      // ==========================================
      if (mediaType === 'image') {
        // Tìm ảnh mới nhất trong bubble cuối cùng của Assistant hoặc trên toàn trang
        let targetImg = latestBubble ? latestBubble.querySelector('img') : null;
        if (!targetImg) {
          const allImgs = [...document.querySelectorAll('img')].filter(img => {
            if (!img || !img.isConnected) return false;
            if (img.closest('form, [class*="chat-user-bubble"], [data-testid="hatch-composer-placeholder-overlay"]')) return false;
            const src = img.currentSrc || img.src || '';
            if (!src || /avatar|icon|logo|badge|emoji|\.svg/i.test(src)) return false;
            return !baselineImgUrls.has(src);
          });
          targetImg = allImgs[allImgs.length - 1] || null;
        }

        if (targetImg) {
          const src = targetImg.currentSrc || targetImg.src || '';
          const hasUuid = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(src);
          const isLoaded = targetImg.complete && targetImg.naturalWidth > 64;

          // Nếu ảnh là ảnh mới và đã tải xong
          if (!baselineImgUrls.has(src) && (hasUuid || isLoaded)) {
            console.log('[HosiFlow Bridge] 🎯 Phát hiện ảnh mới từ Muse:', targetImg.naturalWidth, 'x', targetImg.naturalHeight, src);
            const dataUrl = await extractImageDataUrl(targetImg);
            if (dataUrl && dataUrl.startsWith('data:image/')) {
              console.log('[HosiFlow Bridge] ✅ Trích xuất thành công Base64 Data URL (size:', dataUrl.length, ')');
              return { ok: true, url: dataUrl };
            }
          }
        }
      }

      // ==========================================
      // NHÁNH 2: XỬ LÝ GENERATE VIDEO
      // ==========================================
      if (mediaType === 'video') {
        // Nếu có nút play thì bấm để Muse stream video
        if (latestBubble) {
          const playBtn = latestBubble.querySelector('button[aria-label*="play" i], [class*="play" i], [role="button"]');
          if (playBtn && !playBtn.hasAttribute('data-hf-played')) {
            playBtn.setAttribute('data-hf-played', 'true');
            try { playBtn.click(); } catch {}
            await delay(800, signal);
          }
        }

        // Quét tìm UUID 36 ký tự từ bong bóng tin nhắn mới nhất
        const searchStr = `${latestBubble ? latestBubble.outerHTML : ''} ${document.body.innerHTML.slice(-12000)}`;
        const uuidMatch = searchStr.match(/blob:https?:\/\/[^\/"'\s]+\/([0-9a-fA-F-]{36})/i) ||
                          searchStr.match(/([0-9a-fA-F-]{36})\.mp4/i) ||
                          searchStr.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i);

        if (uuidMatch && uuidMatch[1]) {
          const uuid = uuidMatch[1];
          console.log('[HosiFlow Bridge] 🎯 Đã tìm thấy UUID video từ Muse:', uuid);

          // 1. Trích xuất endFrame poster
          let endFrame = null;
          const posterImg = (latestBubble ? latestBubble.querySelector('img') : null) || document.querySelector('img[src*="muse.ai"]');
          if (posterImg) {
            endFrame = await extractImageDataUrl(posterImg);
          }

          // 2. Chuyển đổi video sang Base64 Data URL thông qua MAIN WORLD để đọc blob trực tiếp
          let videoDataUrl = '';

          // Cách A: Nhờ background service worker thực thi hàm trong Main World (tránh lỗi Isolated World cấm đọc blob)
          try {
            const bgReply = await chrome.runtime.sendMessage({ type: 'MUSEFLOW_EXTRACT_VIDEO_BLOB', uuid });
            if (bgReply?.ok && bgReply?.dataUrl) {
              videoDataUrl = bgReply.dataUrl;
              console.log('[HosiFlow Bridge] ✅ Nhận video Data URL từ Main World:', videoDataUrl.length);
            }
          } catch (e) {
            console.warn('[HosiFlow Bridge] Request Main World extract failed:', e);
          }

          // Cách B: Quét trực tiếp các candidate blob trong content script
          if (!videoDataUrl) {
            const videoEl = latestBubble ? latestBubble.querySelector('video') : document.querySelector('video');
            const candidateUrls = [
              uuidMatch[0].startsWith('blob:') ? uuidMatch[0] : null,
              `blob:https://muse.ai/${uuid}`,
              videoEl?.currentSrc,
              videoEl?.src,
              ...[...document.querySelectorAll('video source[src], source[src], [data-video-src], [data-download-url], a[href*="blob:"]')].map(el => el.currentSrc || el.src || el.href || el.getAttribute('data-video-src') || el.getAttribute('data-download-url'))
            ].filter(Boolean);

            for (const candUrl of candidateUrls) {
              if (videoDataUrl) break;
              try {
                const res = await fetch(candUrl);
                if (res.ok) {
                  const b = await res.blob();
                  if (b && b.size > 1000) {
                    videoDataUrl = await blobToDataUrl(b);
                    console.log('[HosiFlow Bridge] ✅ Đã nạp video blob thành công:', b.size, 'bytes');
                    break;
                  }
                }
              } catch (err) {}
            }
          }

          // 3. Nếu đã nạp thành công Video Base64 Data URL -> trả về ngay cho Studio!
          if (videoDataUrl && videoDataUrl.startsWith('data:video/')) {
            console.log('[HosiFlow Bridge] ✅ HOÀN THÀNH TẠO VIDEO (Data URL size:', videoDataUrl.length, ')');
            return { ok: true, url: videoDataUrl, endFrame };
          }

          // 4. Nếu chưa nạp được blob video -> tiếp tục đợi trong vòng lặp while
          const playBtn = latestBubble ? latestBubble.querySelector('button[aria-label*="play" i], [class*="play" i], [role="button"]') : null;
          if (playBtn) {
            try { playBtn.click(); } catch {}
          }
          console.log('[HosiFlow Bridge] Đang đợi Muse mount blob video stream...');
          await delay(1000, signal);
          continue;
        }

        const videoEl = latestBubble ? latestBubble.querySelector('video') : document.querySelector('video');
        const directSrc = videoEl?.currentSrc || videoEl?.src || '';
        if (directSrc && !directSrc.startsWith('blob:') && !directSrc.startsWith('data:') && /\.(mp4|webm)/i.test(directSrc)) {
          return { ok: true, url: directSrc };
        }
      }

      // Kiểm tra từ chối (refusal) & hết credits
      const currentContext = readNewAssistantContext(priorBubbleTexts), refusal = isRefusalContext(currentContext);
      if (refusal) {
        if (currentContext !== refusalContext) { refusalContext = currentContext; refusalContextSince = Date.now(); }
        const clearRefusal = inability.test(currentContext) && sceneContext.test(currentContext) && offerAlternative.test(currentContext);
        if (clearRefusal || Date.now() - refusalContextSince >= 1200) {
          clickMuseStop();
          const error = new Error(`Muse từ chối tạo cảnh này: ${currentContext.slice(-600)}`);
          error.code = 'SCENE_REFUSED'; throw error;
        }
      } else { refusalContext = ''; refusalContextSince = 0; }

      await delay(600, signal);
    }

    throwIfAborted();
    throw new Error(`Timed out waiting for a new Muse ${mediaType} attachment. Prompt was submitted once; it was not resubmitted.`);
  }

  async function attachReferences(references, signal) {
    const files = await Promise.all(references.map(async (reference, index) => {
      const url = typeof reference === 'string' ? reference : reference?.url;
      if (!url) throw new Error(`Reference image ${index + 1} has no URL.`);

      let blob;
      try {
        if (url.startsWith('data:')) {
          const res = await fetch(url);
          blob = await res.blob();
        } else {
          const isBlob = url.startsWith('blob:');
          const res = await fetch(url, isBlob ? {} : { credentials: 'include' });
          blob = await res.blob();
        }
      } catch (err) {
        throw new Error(`Could not load reference image ${index + 1}: ${err.message}`);
      }

      if (!blob || !blob.size) throw new Error(`Reference ${index + 1} is not a readable image.`);
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
      const transfer = new DataTransfer(); batch.forEach(file => transfer.items.add(file));
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
      while (Date.now() < deadline) { if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError'); if (previewSeen() || accepted() && Date.now() - started > 1000) return; await delay(160, signal); }
      throw new Error(`Muse did not confirm ${batch.length} reference image${batch.length === 1 ? '' : 's'} in the chat composer (upload input accepts: ${input.accept || 'any file'}); the prompt was not submitted.`);
    };
    if (files.length > 1 && !input.multiple) {
      for (const file of files) await uploadBatch([file]);
    } else await uploadBatch(files);
  }

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
      const stopBtn = document.querySelector('[data-testid="hatch-composer-stop-button"]');
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
