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
        } catch {}
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
    const button = [...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"],button[aria-label*="Dừng" i]')].find(visible);
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

  // Chuyển URL (kể cả blob: URL) sang Base64 Data URL an toàn tuyệt đối
  async function fetchToDataUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    try {
      const isBlob = url.startsWith('blob:');
      const response = await fetch(url, isBlob ? {} : { credentials: 'include' });
      const blob = await response.blob();
      if (blob && blob.size > 0) {
        return await blobToDataUrl(blob);
      }
    } catch (e) {
      console.warn('[HosiFlow Bridge] fetchToDataUrl error:', e);
    }
    return '';
  }

  // Chuyển HTMLImageElement sang Data URL trực tiếp qua Canvas
  function imageToDataUrl(imgEl) {
    try {
      if (!imgEl || !imgEl.naturalWidth || !imgEl.naturalHeight) return '';
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('[HosiFlow Bridge] imageToDataUrl error:', e);
      return '';
    }
  }

  // Selector thẻ attachment của Muse
  const attachmentSelector = '[data-testid^="hatch-chat-attachment-presentation-"]';

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

    // 1. Chụp lại snapshot các thẻ attachment và tin nhắn ĐANG CÓ trước khi gửi prompt
    const baselineElements = new Set(document.querySelectorAll(attachmentSelector));
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
      if (!composer.isConnected || !composer.value.trim() || bubbleCount() > beforeSendCount || document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"],button[aria-label*="Dừng" i]')) { accepted = true; break; }
      await delay(100, signal);
    }
    if (!submitted || !accepted) throw new Error('Muse did not confirm the prompt submission. Check the chat box and try again; MuseFlow will not resubmit automatically.');

    // Chờ 1.5 giây để Muse bắt đầu tạo tiến trình (tránh kiểm tra quá sớm khi nút Stop chưa kịp xuất hiện)
    await delay(1500, signal);

    const deadline = Date.now() + Math.min(900, Math.max(30, Number(timeoutSec) || 600)) * 1000;
    let refusalContext = '', refusalContextSince = 0;

    while (Date.now() < deadline) {
      throwIfAborted();

      // Kiểm tra trạng thái đang render qua nút Stop của Muse
      const stopButton = document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"],button[aria-label*="Dừng" i]');
      const isStopVisible = visible(stopButton);

      if (isStopVisible) {
        // ĐANG TẠO: BẮT BUỘC ĐỢI, TUYỆT ĐỐI KHÔNG ĐƯỢC RETURN SỚM!
        await delay(1000, signal);
        continue;
      }

      // CHỈ KHI NÚT STOP KHÔNG CÒN HIỂN THỊ (MUSE ĐÃ HOÀN TẤT GEN):
      // Thu thập các thẻ attachment MỚI sinh ra sau khi submit
      const freshCards = [...document.querySelectorAll(attachmentSelector)]
        .filter(el => !baselineElements.has(el) && !el.closest('form, [class*="chat-user-bubble"], [data-testid="hatch-composer-placeholder-overlay"]'));

      // ==========================================
      // NHÁNH 1: XỬ LÝ GENERATE IMAGE
      // ==========================================
      if (mediaType === 'image') {
        const imageCards = freshCards.filter(el => {
          const tid = el.getAttribute('data-testid') || '';
          return !/video/i.test(tid) && el.querySelector('video') === null;
        });

        if (imageCards.length > 0) {
          const card = imageCards[imageCards.length - 1];
          const img = card.querySelector('img');

          // ĐIỀU KIỆN TIÊN QUYẾT: Ảnh phải tải xong hoàn toàn và có kích thước thực > 100px!
          if (img && img.complete && img.naturalWidth > 100 && img.naturalHeight > 100) {
            console.log('[HosiFlow Bridge] 🎯 Đã phát hiện ảnh mới hoàn chỉnh:', img.naturalWidth, 'x', img.naturalHeight);

            // 1. Chuyển thành Data URL bằng Canvas (trực tiếp từ bộ nhớ ảnh decoded của browser)
            let dataUrl = imageToDataUrl(img);

            // 2. Fallback nếu canvas chưa lấy được: fetch blob URL
            if (!dataUrl || dataUrl.length < 200) {
              const rawSrc = img.currentSrc || img.src;
              if (rawSrc) {
                dataUrl = await fetchToDataUrl(rawSrc);
              }
            }

            if (dataUrl && dataUrl.startsWith('data:image/')) {
              console.log('[HosiFlow Bridge] ✅ Đã nạp ảnh thành Data URL thành công (size:', dataUrl.length, ')');
              return { ok: true, url: dataUrl };
            }
          }
        }
      }

      // ==========================================
      // NHÁNH 2: XỬ LÝ GENERATE VIDEO
      // ==========================================
      if (mediaType === 'video') {
        const videoCards = freshCards.filter(el => {
          const tid = el.getAttribute('data-testid') || '';
          return /video/i.test(tid) || el.querySelector('video') !== null;
        });

        const videoCard = videoCards.length > 0 ? videoCards[videoCards.length - 1] : (freshCards.length > 0 ? freshCards[freshCards.length - 1] : null);

        if (videoCard) {
          // Kích hoạt Play nếu thẻ video chưa mount
          const playBtn = videoCard.querySelector('button[aria-label*="play" i], [class*="play" i], [role="button"]') || videoCard;
          if (playBtn && !playBtn.hasAttribute('data-hf-played')) {
            playBtn.setAttribute('data-hf-played', 'true');
            try { playBtn.click(); } catch {}
            await delay(600, signal);
          }

          const container = videoCard.closest('[class*="groupable-bubble"], [data-testid*="message" i]') || videoCard;
          const searchStr = `${videoCard.outerHTML} ${container.outerHTML} ${document.body.innerHTML.slice(-8000)}`;

          // Bắt UUID 36 ký tự hex (chuẩn UUID của Muse)
          const uuidMatch = searchStr.match(/blob:https?:\/\/[^\/"'\s]+\/([0-9a-fA-F-]{36})/i) ||
                            searchStr.match(/([0-9a-fA-F-]{36})\.mp4/i) ||
                            searchStr.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i);

          if (uuidMatch && uuidMatch[1]) {
            const uuid = uuidMatch[1];
            console.log('[HosiFlow Bridge] 🎯 Đã tìm thấy UUID video từ Muse:', uuid);

            let endFrame = null;
            const img = videoCard.querySelector('img');
            if (img && img.complete && img.naturalWidth > 50) {
              endFrame = imageToDataUrl(img) || (await fetchToDataUrl(img.currentSrc || img.src));
            }

            const videoUrl = `https://muse.ai/${uuid}.mp4`;
            console.log('[HosiFlow Bridge] ✅ Trả về video URL chính thức:', videoUrl);
            return { ok: true, url: videoUrl, endFrame };
          }

          const videoEl = videoCard.querySelector('video');
          const directSrc = videoEl?.currentSrc || videoEl?.src || '';
          if (directSrc && !directSrc.startsWith('blob:') && !directSrc.startsWith('data:') && /\.(mp4|webm)/i.test(directSrc)) {
            return { ok: true, url: directSrc };
          }
        }
      }

      // Kiểm tra từ chối (refusal) & hết credits
      const currentContext = readNewAssistantContext(priorBubbleTexts), refusal = isRefusalContext(currentContext);
      if (refusal) {
        if (currentContext !== refusalContext) { refusalContext = currentContext; refusalContextSince = Date.now(); }
        const clearRefusal = inability.test(currentContext) && sceneContext.test(currentContext) && offerAlternative.test(currentContext);
        if (clearRefusal || Date.now() - refusalContextSince >= 1200) {
          if (isStopVisible) clickMuseStop();
          const error = new Error(`Muse từ chối tạo cảnh này: ${currentContext.slice(-600)}`);
          error.code = 'SCENE_REFUSED'; throw error;
        }
      } else { refusalContext = ''; refusalContextSince = 0; }

      await delay(500, signal);
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

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Media conversion failed.'));
      reader.readAsDataURL(blob);
    });
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
