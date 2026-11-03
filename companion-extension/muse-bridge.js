(() => {
  if (window.__museFlowBridgeInstalled) return;
  window.__museFlowBridgeInstalled = true;

  console.log('[HosiFlow Bridge] 🚀 Đã nạp MuseFlow Bridge v1.3.0');

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'MUSEFLOW_CHECK_SESSION') {
      checkSession().then(sendResponse);
      return true;
    }
    if (message?.type === 'MUSEFLOW_GENERATE') {
      const controller = new AbortController();
      activeGenerations.set(message.requestId, controller);
      generate(message, controller.signal)
        .then(sendResponse, error => sendResponse({ ok: false, code: error.code || 'MUSE_ERROR', error: error.message || String(error) }))
        .finally(() => activeGenerations.delete(message.requestId));
      return true;
    }
    if (message?.type === 'MUSEFLOW_GENERATE_SCRIPT') {
      const controller = new AbortController();
      activeGenerations.set(message.requestId, controller);
      generateScript(message, controller.signal)
        .then(sendResponse, error => sendResponse({ ok: false, error: error.message || String(error) }))
        .finally(() => activeGenerations.delete(message.requestId));
      return true;
    }
    if (message?.type === 'MUSEFLOW_STOP_GENERATION') {
      const stopped = message.requestId ? abortGeneration(message.requestId) : [...activeGenerations.keys()].some(id => abortGeneration(id));
      sendResponse({ ok: true, stopped });
      return false;
    }
  });

  const attachmentSelector = '[data-testid^="hatch-chat-attachment-presentation-"]';
  const activeGenerations = new Map();

  function visible(el) {
    return Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  }

  const delay = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Generation stopped by user.', 'AbortError')); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(new DOMException('Generation stopped by user.', 'AbortError')); };
    signal?.addEventListener('abort', cancel, { once: true });
  });

  function findComposer() {
    const candidates = [...document.querySelectorAll('textarea')].filter(el => visible(el) && !el.disabled);
    return candidates.find(el => /message|tin nhắn|gửi|消息/i.test(el.getAttribute('placeholder') || '')) || candidates[0] || null;
  }

  function clickMuseStop() {
    const button = [...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="Dừng"]')].find(visible);
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
    const loginRequired = Boolean(document.querySelector('input[type="password"],button[type="submit"]')) && /sign in|log in|đăng nhập/i.test(document.body?.innerText || '');
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
    return [...document.querySelectorAll(attachmentSelector)].filter(el => {
      return !el.closest('form, [class*="chat-user-bubble"], [data-message-author-role="user"], [data-testid*="user-message" i], [data-testid="hatch-composer-placeholder-overlay"]');
    }).map(el => {
      const tid = el.getAttribute('data-testid') || '', video = el.querySelector('video'), image = el.querySelector('img');
      const urls = [...el.querySelectorAll('a[href], video source[src], source[src], [data-video-src], [data-download-url], a[download]')].map(item => ({
        url: item.href || item.src || item.getAttribute('data-video-src') || item.getAttribute('data-download-url') || '',
        download: item.getAttribute('download') || '',
        type: item.getAttribute('type') || ''
      })).filter(item => item.url);
      const videoLink = urls.find(item =>
        /video\//i.test(item.type) ||
        /\.(?:mp4|webm|mov|m4v)(?:$|[?#])/i.test(item.url) ||
        /\.(?:mp4|webm|mov|m4v)$/i.test(item.download) ||
        item.url.startsWith('blob:')
      )?.url || '';
      const videoUrl = video?.currentSrc || video?.src || videoLink || '';
      const media = video || image;
      return {
        el,
        tid,
        src: videoUrl || media?.currentSrc || media?.src || '',
        videoUrl,
        isVideo: Boolean(videoUrl) || video instanceof HTMLVideoElement || /video/i.test(tid),
        width: video?.videoWidth || image?.naturalWidth || 0,
        height: video?.videoHeight || image?.naturalHeight || 0
      };
    }).filter(a => a.src);
  }

  function waitForAttachmentChange(timeoutMs, signal) {
    return new Promise(resolve => {
      let timer;
      const observer = new MutationObserver(() => finish());
      const finish = () => {
        observer.disconnect();
        clearTimeout(timer);
        signal?.removeEventListener('abort', finish);
        resolve();
      };
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
    return [...document.querySelectorAll('div[class*="hatch-chat-groupable-bubble"], [data-message-author-role="assistant"], [data-testid*="assistant" i], [data-testid*="message-content" i], [class*="assistant-message" i], [class*="assistant-bubble" i]')].filter(el => visible(el) && !el.closest('[class*="chat-user-bubble"], [data-message-author-role="user"], [data-testid*="user-message" i]'));
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

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Media conversion failed.'));
      reader.readAsDataURL(blob);
    });
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
    if (referenceList.length) {
      console.log(`[HosiFlow Bridge] Đính kèm ${referenceList.length} ảnh tham chiếu...`);
      await attachReferences(referenceList, signal);
    }
    throwIfAborted();

    const baseline = new Set(attachments().map(a => a.src));
    const priorBubbleTexts = new Map(assistantMessageElements().map(el => [el, (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()]));

    composer.scrollIntoView({ block: 'center' });
    composer.focus();
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
      if (!composer.isConnected || !composer.value.trim() || bubbleCount() > beforeSendCount || document.querySelector('[data-testid="hatch-composer-stop-button"]')) {
        accepted = true;
        break;
      }
      await delay(100, signal);
    }
    if (!submitted || !accepted) throw new Error('Muse did not confirm prompt submission. Check chat box and try again.');

    console.log(`[HosiFlow Bridge] ⏳ Đang đợi Muse tạo ${mediaType}...`);
    const deadline = Date.now() + Math.min(900, Math.max(30, Number(timeoutSec) || 600)) * 1000;
    let lastProgress = Date.now(), firstWrongRatioAt = 0, wrongMediaSince = 0;
    let refusalContext = '', refusalContextSince = 0;

    while (Date.now() < deadline) {
      throwIfAborted();

      const fresh = attachments().filter(a => !baseline.has(a.src));
      const matching = fresh.filter(a => mediaType === 'video' ? a.isVideo : !a.isVideo);
      const wrongMedia = fresh.find(a => mediaType === 'image' ? a.isVideo : !a.isVideo);

      if (wrongMedia) {
        if (!wrongMediaSince) wrongMediaSince = Date.now();
        if (Date.now() - wrongMediaSince >= 2500) {
          const expected = mediaType === 'image' ? 'ảnh' : 'video';
          const actual = mediaType === 'image' ? 'video' : 'ảnh';
          const error = new Error(`Muse trả về ${actual} cho node Tạo ${expected}. Vui lòng chuyển Muse composer sang chế độ tạo ${expected} rồi thử lại.`);
          error.code = 'MEDIA_TYPE_MISMATCH';
          throw error;
        }
      } else {
        wrongMediaSince = 0;
      }

      const [ratioW, ratioH] = String(size || '16:9').split(':').map(Number);
      const expectedRatio = ratioW > 0 && ratioH > 0 ? ratioW / ratioH : (16 / 9);

      // Sắp xếp các media theo tỷ lệ gần nhất với yêu cầu
      const measured = matching.filter(a => a.width > 0 && a.height > 0).sort((a, b) => {
        const scoreA = Math.abs(Math.log((a.width / a.height) / expectedRatio));
        const scoreB = Math.abs(Math.log((b.width / b.height) / expectedRatio));
        if (Math.abs(scoreA - scoreB) > 0.015) return scoreA - scoreB;
        return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1;
      });

      const best = measured[0];
      const bestRatioError = best ? Math.abs(Math.log((best.width / best.height) / expectedRatio)) : Infinity;

      if (best && bestRatioError <= 0.09) {
        firstWrongRatioAt = 0;
      } else if (best && !firstWrongRatioAt) {
        firstWrongRatioAt = Date.now();
      }

      // Chọn kết quả nếu đúng tỷ lệ hoặc đã đợi quá 3.5s
      const result = best && (bestRatioError <= 0.09 || Date.now() - firstWrongRatioAt >= 3500) ? best : null;

      if (result) {
        const media = mediaType === 'video' ? (result.el.querySelector('video') || null) : (result.el.querySelector('img') || null);
        let src = mediaType === 'video' ? (result.videoUrl || media?.currentSrc || media?.src || '') : (media?.currentSrc || media?.src || '');

        // Nếu là video chưa có URL stream, thử click play để Muse kích hoạt URL
        if (mediaType === 'video' && !src) {
          const playBtn = result.el.querySelector('button[aria-label*="play" i], [class*="play" i], [role="button"]');
          if (playBtn) {
            try { playBtn.click(); } catch {}
          }
        }

        if (!src) {
          firstWrongRatioAt = firstWrongRatioAt || Date.now();
          await waitForAttachmentChange(Math.min(500, deadline - Date.now()), signal);
          continue;
        }

        console.log(`[HosiFlow Bridge] 🎯 Đã tìm thấy ${mediaType}:`, src);

        // Nạp binary blob của media
        let blob = null;
        try {
          const fetchOptions = src.startsWith('blob:') || src.startsWith('data:') ? {} : { credentials: 'include' };
          const response = await fetch(src, fetchOptions);
          if (response.ok) {
            blob = await response.blob();
          }
        } catch (fetchErr) {
          console.warn(`[HosiFlow Bridge] Fetch ${mediaType} blob failed:`, fetchErr);
        }

        // Trích xuất End Frame nếu là Video
        let endFrame = null;
        if (mediaType === 'video') {
          const poster = result.el.querySelector('img');
          if (poster && poster.complete && poster.naturalWidth > 0) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = poster.naturalWidth;
              canvas.height = poster.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(poster, 0, 0);
              endFrame = canvas.toDataURL('image/webp', 0.9);
              console.log('[HosiFlow Bridge] 📸 Trích xuất thành công End Frame poster');
            } catch {}
          }
        }

        // Tải media trực tiếp lên Local Axum Server để WebView2 và FFmpeg phát mượt mà
        let finalUrl = '';
        if (blob && blob.size > 0) {
          const ext = mediaType === 'video' ? 'mp4' : 'webp';
          try {
            const uploadUrl = `http://127.0.0.1:4826/api/media/upload?id=${encodeURIComponent(requestId)}&ext=${ext}`;
            const uploadRes = await fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': blob.type || (mediaType === 'video' ? 'video/mp4' : 'image/webp') },
              body: blob,
            });
            if (uploadRes.ok) {
              const data = await uploadRes.json();
              if (data?.ok && data?.url) {
                finalUrl = data.url;
                console.log('[HosiFlow Bridge] 🚀 Đã lưu trữ cục bộ thành công:', finalUrl);
              }
            }
          } catch (uploadErr) {
            console.warn('[HosiFlow Bridge] Không thể tải media lên Local Server:', uploadErr);
          }

          // Fallback sang Base64 Data URL nếu server chưa phản hồi
          if (!finalUrl) {
            finalUrl = await blobToDataUrl(blob);
            console.log('[HosiFlow Bridge] 📦 Sử dụng Base64 Data URL fallback (length:', finalUrl.length, ')');
          }
        } else {
          // Fallback cuối cùng
          finalUrl = src;
        }

        console.log(`[HosiFlow Bridge] ✅ HOÀN THÀNH TẠO ${mediaType.toUpperCase()}`);
        return { ok: true, url: finalUrl, endFrame };
      }

      // Kiểm tra nút Stop ở khung soạn thảo
      const composerEl = findComposer();
      const composerRoot = composerEl?.closest('form') || composerEl?.parentElement;
      const stop = Boolean(
        document.querySelector('[data-testid="hatch-composer-stop-button"]') ||
        (composerRoot && composerRoot.querySelector('button[aria-label*="Stop" i], button[aria-label*="停止"], button[aria-label*="Dừng"]'))
      );

      // Kiểm tra phản hồi từ chối (Refusal)
      const currentContext = readNewAssistantContext(priorBubbleTexts);
      const refusal = isRefusalContext(currentContext);
      if (refusal) {
        if (currentContext !== refusalContext) {
          refusalContext = currentContext;
          refusalContextSince = Date.now();
        }
        if (Date.now() - refusalContextSince >= 1200) {
          if (stop) clickMuseStop();
          const error = new Error(`Muse từ chối tạo nội dung này: ${currentContext.slice(-600)}`);
          error.code = 'SCENE_REFUSED';
          throw error;
        }
      } else {
        refusalContext = '';
        refusalContextSince = 0;
      }

      // Kiểm tra hết credits
      if (!stop && Date.now() - lastProgress > 5000) {
        const tail = (document.body?.innerText || '').slice(-800);
        if (/out of credits|insufficient credits|hết credits|hết lượt/i.test(tail)) {
          throw new Error('Tài khoản Muse.ai đã hết credits để thực hiện tác vụ.');
        }
      }

      await waitForAttachmentChange(Math.min(500, deadline - Date.now()), signal);
    }

    throwIfAborted();
    throw new Error(`Đã hết thời gian chờ Muse tạo ${mediaType}.`);
  }

  async function attachReferences(references, signal) {
    const files = await Promise.all(references.map(async (reference, index) => {
      const url = typeof reference === 'string' ? reference : reference?.url;
      if (!url) throw new Error(`Reference image ${index + 1} has no URL.`);

      let blob;
      try {
        const fetchOptions = url.startsWith('blob:') || url.startsWith('data:') ? {} : { credentials: 'include' };
        const response = await fetch(url, fetchOptions);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        blob = await response.blob();
      } catch (err) {
        throw new Error(`Không thể nạp reference image ${index + 1}: ${err.message}`);
      }

      if (!blob || !blob.size) throw new Error(`Reference ${index + 1} is not a readable image.`);
      const detectedType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
      const extension = (detectedType.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
      return new File([blob], `hosiflow-reference-${String(index + 1).padStart(2, '0')}.${extension}`, { type: detectedType });
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
      if (uploadButton) {
        uploadButton.click();
        await delay(250, signal);
        input = findInput();
      }
    }
    if (!input) throw new Error('Không tìm thấy nút đính kèm ảnh trên giao diện Muse.ai.');

    const previewSelector = 'img,[role="img"],[data-testid*="attachment" i],[data-testid*="upload" i],[class*="attachment" i],[class*="upload" i]';
    const previewElements = () => [...document.querySelectorAll(previewSelector)].filter(visible);
    const previewKey = el => {
      const src = el.matches('img') ? (el.currentSrc || el.src || '') : /url\(["']?(blob:|data:image\/|https?:)[^)]*\)/i.exec(getComputedStyle(el).backgroundImage)?.[0] || '';
      return `${src}|${el.getAttribute('data-testid') || ''}|${el.getAttribute('class') || ''}|${el.getAttribute('aria-label') || ''}|${el.getAttribute('title') || ''}`;
    };

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
    if (!setter) throw new Error('Trình duyệt không hỗ trợ gán file input.');

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
        if (previewSeen() || (accepted() && Date.now() - started > 1000)) return;
        await delay(160, signal);
      }
      throw new Error(`Muse không xác nhận ${batch.length} ảnh tham chiếu đính kèm.`);
    };

    if (files.length > 1 && !input.multiple) {
      for (const file of files) await uploadBatch([file]);
    } else {
      await uploadBatch(files);
    }
  }

  async function generateScript({ prompt, timeoutSec = 180 }, signal) {
    const composer = findComposer();
    if (!composer) throw new Error('Không tìm thấy khung chat Muse.ai');
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
    throw new Error('Hết thời gian chờ tạo kịch bản từ Muse.ai');
  }
})();
