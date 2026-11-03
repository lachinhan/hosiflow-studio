(() => {
  if (window.__museFlowBridgeInstalled) return;
  window.__museFlowBridgeInstalled = true;

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
        .then(async (res) => {
          await reportScriptResult(res);
          sendResponse(res);
        }, async (error) => {
          const failRes = { ok: false, error: error.message || String(error) };
          await reportScriptResult(failRes);
          sendResponse(failRes);
        })
        .finally(() => activeGenerations.delete(message.requestId || 'script'));
      return true;
    }
    if (message?.type === 'MUSEFLOW_GENERATE') {
      const controller = new AbortController();
      activeGenerations.set(message.requestId, controller);

      // Keepalive định kỳ đánh thức Background Service Worker
      const keepAliveInterval = setInterval(() => {
        try {
          chrome.runtime.sendMessage({ type: 'MUSEFLOW_KEEPALIVE' }).catch(() => {});
        } catch {}
      }, 5000);

      const reportResult = async (res) => {
        // 1. Gửi qua Chrome Runtime Message (luôn đánh thức Service Worker)
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

        // 2. Dự phòng: Gửi trực tiếp Local API nếu trình duyệt cho phép
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
          await reportResult(res);
          try { sendResponse(res); } catch {}
        }, async (error) => {
          const failRes = { ok: false, code: error.code || 'MUSE_ERROR', error: error.message || String(error) };
          await reportResult(failRes);
          try { sendResponse(failRes); } catch {}
        })
        .finally(() => {
          clearInterval(keepAliveInterval);
          activeGenerations.delete(message.requestId);
        });
      return true;
    }
    if(message?.type==='MUSEFLOW_STOP_GENERATION'){
      const stopped=message.requestId?abortGeneration(message.requestId):[...activeGenerations.keys()].some(id=>abortGeneration(id));
      sendResponse({ok:true,stopped});return false;
    }
  });

  function findComposer() {
    const candidates=[...document.querySelectorAll('textarea')].filter(el=>visible(el)&&!el.disabled);
    return candidates.find(el=>/message|消息/i.test(el.getAttribute('placeholder')||''))||candidates[0]||null;
  }

  function visible(el) { return Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'); }
  const delay = (ms,signal) => new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Generation stopped by user.','AbortError'));return;}
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},ms);
    const cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new DOMException('Generation stopped by user.','AbortError'));};
    signal?.addEventListener('abort',cancel,{once:true});
  });
  const attachmentSelector='[data-testid^="hatch-chat-attachment-presentation-image"], [data-testid^="hatch-chat-attachment-presentation-video"], [data-testid*="video" i], video';
  const activeGenerations=new Map();

  function clickMuseStop(){
    const button=[...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')].find(visible);
    if(button){button.click();return true;}return false;
  }

  function abortGeneration(requestId){
    const controller=activeGenerations.get(requestId);
    if(!controller)return false;
    controller.abort();clickMuseStop();return true;
  }

  async function checkSession() {
    await waitHydrated(5000);
    const composer=findComposer();
    const ready=Boolean(composer&&visible(composer)&&!composer.disabled&&!composer.readOnly);
    const loginRequired=Boolean(document.querySelector('input[type="password"],button[type="submit"]'))&&/sign in|log in|登录/i.test(document.body?.innerText||'');
    return {ok:true,signedIn:ready&&!loginRequired,title:document.title,composer:ready,loginRequired,url:location.href};
  }

  async function waitHydrated(timeout,signal) {
    const end=Date.now()+timeout;
    while(Date.now()<end){
      const hydration=document.querySelector('[data-hatch-shell-hydration-state]');
      if(document.readyState==='complete'&&findComposer()&&(!hydration||hydration.getAttribute('data-hatch-shell-hydration-state')==='hydrated'))return;
      if(signal?.aborted)throw new DOMException('Generation stopped by user.','AbortError');
      await delay(120,signal);
    }
    if(!findComposer())throw new Error('Muse chat is not ready. Open the Muse chat page and wait for the message box to load.');
  }

  function attachments() {
    const elements = [...document.querySelectorAll(attachmentSelector)];

    document.querySelectorAll('video, a[href*=".mp4"], a[href*=".webm"], [data-video-src], [data-download-url]').forEach((v) => {
      const parent = v.closest('[data-testid^="hatch-chat-attachment-presentation-video"]') || v.parentElement || v;
      if (!elements.includes(parent)) {
        elements.push(parent);
      }
    });

    const list = [];
    const seen = new Set();

    for (const el of elements) {
      if (
        el.closest('form, [class*="chat-user-bubble"], [data-message-author-role="user"]') ||
        el.closest('[data-testid="hatch-composer-placeholder-overlay"]')
      ) {
        continue;
      }

      const tid = el.getAttribute('data-testid') || '';
      // Bỏ qua mọi attachment là file, code, script, json, document
      if (/file|code|script|document|text|json/i.test(tid)) {
        continue;
      }

      const video = el.matches('video') ? el : el.querySelector('video');
      const image = el.matches('img') ? el : el.querySelector('img');

      // Bỏ qua các icon file hoặc icon giao diện
      if (!video && image) {
        const imgSrc = image.currentSrc || image.src || '';
        if (/icon|badge|avatar|document|file|\.svg/i.test(imgSrc)) {
          continue;
        }
        if (image.naturalWidth > 0 && (image.naturalWidth < 180 || image.naturalHeight < 180)) {
          continue;
        }
      }

      const urls = [
        ...el.querySelectorAll('a[href], video source[src], source[src], [data-video-src], [data-download-url]'),
      ]
        .map((item) => ({
          url: item.href || item.src || item.getAttribute('data-video-src') || item.getAttribute('data-download-url') || '',
          download: item.getAttribute('download') || '',
          type: item.getAttribute('type') || '',
        }))
        .filter((item) => item.url);

      if (el.matches('a[href]')) {
        urls.push({ url: el.href, download: el.getAttribute('download') || '', type: el.getAttribute('type') || '' });
      }

      const videoLink =
        urls.find(
          (item) =>
            /video\//i.test(item.type) ||
            /\.(?:mp4|webm|mov|m4v)(?:$|[?#])/i.test(item.url) ||
            /\.(?:mp4|webm|mov|m4v)$/i.test(item.download) ||
            (item.download && /\.(?:mp4|webm|mov|m4v)/i.test(item.download))
        )?.url || '';
      const videoUrl = videoLink || video?.currentSrc || video?.src || video?.querySelector('source')?.src || '';
      const media = video || image;
      const src = videoUrl || media?.currentSrc || media?.src || '';

      if (src && !seen.has(src)) {
        seen.add(src);
        const isVideo =
          Boolean(videoUrl) ||
          video instanceof HTMLVideoElement ||
          /video/i.test(tid) ||
          /\.(?:mp4|webm|mov|m4v)/i.test(src);
        const w = video?.videoWidth || image?.naturalWidth || video?.clientWidth || el.clientWidth || 0;
        const h = video?.videoHeight || image?.naturalHeight || video?.clientHeight || el.clientHeight || 0;

        list.push({
          el,
          tid,
          src,
          videoUrl,
          isVideo,
          width: w,
          height: h,
        });
      }
    }

    return list;
  }

  function waitForAttachmentChange(timeoutMs,signal){
    return new Promise(resolve=>{
      let timer;
      const observer=new MutationObserver(()=>finish());
      const finish=()=>{observer.disconnect();clearTimeout(timer);signal?.removeEventListener('abort',finish);resolve();};
      observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','poster','href','download','type','data-testid','data-video-src','data-download-url']});
      timer=setTimeout(finish,timeoutMs);
      signal?.addEventListener('abort',finish,{once:true});
    });
  }

  function assistantMessageElements(){
    return [...document.querySelectorAll('div[class*="hatch-chat-groupable-bubble"],[data-message-author-role="assistant"],[data-testid*="assistant" i],[data-testid*="message-content" i],[class*="assistant-message" i],[class*="assistant-bubble" i]')].filter(el=>visible(el)&&!el.closest('[class*="chat-user-bubble"],[data-message-author-role="user"],[data-testid*="user-message" i]'));
  }

  function readNewAssistantContext(previousBubbleTexts){
    const bubbles=assistantMessageElements();
    // Muse wraps assistant replies in group containers too; excluding every group/msg
    // ancestor accidentally filtered out the refusal text that should trigger retry.
    const messages=bubbles.map(el=>({el,text:(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim()})).filter(item=>item.text&&item.text!==previousBubbleTexts.get(item.el));
    return messages.map(item=>item.text).join('\n').slice(-6000);
  }

  function isRefusalContext(context){
    const text=String(context||'');
    const explicit=/(?:i|we)\s+(?:am\s+)?sorry[\s\S]{0,180}(?:cannot|can't|unable|won't)|(?:cannot|can't|couldn't|unable to|not able to)\s+(?:help|assist|create|generate|make|produce|fulfill|complete|comply)|(?:request|prompt).{0,100}(?:violat|disallowed|restricted|not allowed)|(?:policy|safety).{0,100}(?:prevent|restrict|unable)|generation (?:was )?(?:declined|blocked)|content (?:is )?not allowed|i can't comply/i;
    const inability=/(?:không tạo được|không thể tạo|chưa thể tạo|không thực hiện được|vẫn không tạo được|không làm được)/i;
    const sceneContext=/(?:cảnh|bản|đoạn|video|ảnh|nội dung|yêu cầu|này)/i;
    const offerAlternative=/(?:bản|phiên bản|phương án)\s+tương\s+đương|tương\s+đương.{0,100}(?:bám|theo|kịch bản)|muốn.{0,100}(?:tạo mới|thử lại|làm lại)|(?:would you like|do you want|want me to).{0,100}(?:create|make|generate|try)|equivalent alternative/i;
    return explicit.test(text)||inability.test(text)&&(sceneContext.test(text)||offerAlternative.test(text));
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
    const candidates = [...document.querySelectorAll('button, [role="button"], div, span, a')].filter(visible);
    return candidates.find(el => {
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
          canvas.width = elementOrUrl.naturalWidth;
          canvas.height = elementOrUrl.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(elementOrUrl, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl && dataUrl.length > 100) return dataUrl;
        } catch {}
      }

      const url = typeof elementOrUrl === 'string' ? elementOrUrl : (elementOrUrl?.currentSrc || elementOrUrl?.src);
      if (!url) return '';
      if (url.startsWith('data:image')) return url;

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return url;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result || url);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch {
      return typeof elementOrUrl === 'string' ? elementOrUrl : (elementOrUrl?.currentSrc || elementOrUrl?.src || '');
    }
  }

  async function generate({prompt,timeoutSec=600,mediaType='image',referenceImage='',referenceImages=[],size='16:9',requestId},signal) {
    const throwIfAborted=()=>{if(signal?.aborted)throw new DOMException('Generation stopped by user.','AbortError');};
    throwIfAborted();
    if(!String(prompt||'').trim())throw new Error('Prompt is empty.');
    await waitHydrated(15000,signal);
    throwIfAborted();
    const composer=findComposer();
    if(!visible(composer))throw new Error('Muse message box is not visible. Open the chat composer and retry.');
    const referenceList=Array.isArray(referenceImages)&&referenceImages.length?referenceImages:referenceImage?[referenceImage]:[];
    if(referenceList.length)await attachReferences(referenceList,signal);
    throwIfAborted();
    const baseline=new Set(attachments().map(a=>a.src));
    const priorBubbleTexts=new Map(assistantMessageElements().map(el=>[el,(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim()]));
    composer.scrollIntoView({block:'center'});composer.focus();
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;
    if(!setter)throw new Error('Muse message box is unsupported.');
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
    composer.dispatchEvent(new Event('input',{bubbles:true}));
    composer.dispatchEvent(new Event('change',{bubbles:true}));
    let sendButton=null;
    for(let i=0;i<30;i++){
      throwIfAborted();
      sendButton=[...document.querySelectorAll('button,[role="button"]')].filter(visible).find(b=>/send|发送/i.test(`${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''} ${b.innerText||''}`));
      if(sendButton&&!sendButton.disabled)break;
      await delay(100,signal);
    }
    if(!composer.value.trim())throw new Error('Muse did not accept the prompt into its message box. Nothing was submitted.');
    const bubbleCount=()=>document.querySelectorAll('div[class*="hatch-chat-groupable-bubble"]').length;
    const beforeSendCount=bubbleCount();
    let submitted=false;
    throwIfAborted();
    if(sendButton&&!sendButton.disabled){sendButton.click();submitted=true;}
    else {
      // Match M2A's keyboard fallback: submit once only when Muse exposes no active Send button.
      const form=composer.closest('form');
      if(form&&typeof form.requestSubmit==='function'){form.requestSubmit();submitted=true;}
      else {
        composer.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
        composer.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}));
        submitted=true;
      }
    }
    let accepted=false;
    for(let i=0;i<30;i++){
      throwIfAborted();
      if(!composer.isConnected||!composer.value.trim()||bubbleCount()>beforeSendCount||document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')){accepted=true;break;}
      await delay(100,signal);
    }
    if(!submitted||!accepted)throw new Error('Muse did not confirm the prompt submission. Check the chat box and try again; MuseFlow will not resubmit automatically.');
    const deadline=Date.now()+Math.min(900,Math.max(30,Number(timeoutSec)||600))*1000;
    let lastProgress=Date.now(),firstWrongRatioAt=0,wrongMediaSince=0;
    let refusalContext='',refusalContextSince=0;
    while(Date.now()<deadline){
      throwIfAborted();
      const fresh=attachments().filter(a=>!baseline.has(a.src));
      const matching=fresh.filter(a=>mediaType==='video'?a.isVideo:!a.isVideo);
      const wrongMedia=fresh.find(a=>mediaType==='image'?a.isVideo:!a.isVideo);
      if (mediaType === 'video') {
        const animateBtn = findAnimateButton();
        if (animateBtn) {
          console.log('[HosiFlow Bridge] Đã phát hiện nút Animate video từ Muse, bấm 1 lần duy nhất...', animateBtn);
          clickedAnimateButtons.add(animateBtn);
          try { animateBtn.setAttribute('data-hosiflow-clicked', 'true'); } catch {}
          clickElement(animateBtn);
          wrongMediaSince = 0;
          await delay(2500, signal);
          continue;
        }
      }
      if(wrongMedia){
        const stopBtn = Boolean(document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]'));
        const hasAnimate = mediaType === 'video' ? Boolean(findAnimateButton()) : false;
        if(!stopBtn && !hasAnimate && !wrongMediaSince) wrongMediaSince=Date.now();
        if(!stopBtn && !hasAnimate && wrongMediaSince && (Date.now()-wrongMediaSince>=30000)){
          const expected=mediaType==='image'?'image':'video',actual=mediaType==='image'?'video':'image';
          const error=new Error(`Muse returned a ${actual} for a Generate ${expected==='image'?'Image':'Video'} node. Switch the Muse composer to ${expected} generation, then retry.`);
          error.code='MEDIA_TYPE_MISMATCH';
          throw error;
        }
      }
      else wrongMediaSince=0;
      const [ratioW,ratioH]=String(size||'16:9').split(':').map(Number),expectedRatio=ratioW>0&&ratioH>0?ratioW/ratioH:1;
      const candidates = matching;
      const measured = candidates.sort((a,b)=>{
        const wA = a.width || 16, hA = a.height || 9;
        const wB = b.width || 16, hB = b.height || 9;
        const scoreA = Math.abs(Math.log((wA / hA) / expectedRatio));
        const scoreB = Math.abs(Math.log((wB / hB) / expectedRatio));
        if (Math.abs(scoreA - scoreB) > 0.05) return scoreA - scoreB;
        return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1;
      });

      const best = measured[0];
      if (best) {
        const media = mediaType === 'video'
          ? (best.el.querySelector('video') || (best.el.matches('video') ? best.el : null))
          : (best.el.querySelector('img') || (best.el.matches('img') ? best.el : null));
        let src = mediaType === 'video'
          ? (best.videoUrl || media?.currentSrc || media?.src || best.src || '')
          : (media?.currentSrc || media?.src || best.src || '');

        if (src) {
          let endFrame = null;
          let finalUrl = src;

          if (mediaType === 'image') {
            finalUrl = await imageToDataUrl(media || src);
          } else if (mediaType === 'video') {
            const posterImg = best.el.querySelector('img');
            endFrame = media?.poster || (posterImg ? await imageToDataUrl(posterImg) : null);
          }

          console.log('[HosiFlow Bridge] Đã phát hiện media khớp:', finalUrl ? (finalUrl.slice(0, 50) + '...') : '');
          return { ok: true, url: finalUrl, endFrame };
        }
      }

      const stop=Boolean(document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]'));
      const currentContext=readNewAssistantContext(priorBubbleTexts),refusal=isRefusalContext(currentContext);
      if(refusal){
        if(currentContext!==refusalContext){refusalContext=currentContext;refusalContextSince=Date.now();}
        const clearRefusal=inability.test(currentContext)&&sceneContext.test(currentContext)&&offerAlternative.test(currentContext);
        if(clearRefusal||Date.now()-refusalContextSince>=1200){
          if(stop)clickMuseStop();
          const error=new Error(`Muse could not generate this scene: ${currentContext.slice(-700)}`);error.code='SCENE_REFUSED';throw error;
        }
      }
      else{refusalContext='';refusalContextSince=0;}
      if(!stop&&Date.now()-lastProgress>5000){
        const tail=(document.body?.innerText||'').slice(-800);
        if(/out of credits|insufficient credits|额度不足|积分不足/i.test(tail))throw new Error('Muse account has insufficient image credits.');
      }
      await waitForAttachmentChange(Math.min(500,deadline-Date.now()),signal);
    }
    throwIfAborted();
    throw new Error(`Timed out waiting for a new Muse ${mediaType} attachment. Prompt was submitted once; it was not resubmitted.`);
  }

  async function attachReferences(references,signal){
    const files=await Promise.all(references.map(async(reference,index)=>{
      const url=typeof reference==='string'?reference:reference?.url;
      if(!url)throw new Error(`Reference image ${index+1} has no URL.`);
      let response = await fetch(url).catch(() => null);
      if (!response || !response.ok) {
        response = await fetch(url, { credentials: 'include' }).catch(() => null);
      }
      if (!response || !response.ok) throw new Error(`Could not load reference image ${index+1} (${response?.status || 'network error'}).`);
      const blob = await response.blob();
      if (!blob.size) throw new Error(`Reference ${index+1} is not a readable image.`);
      const detectedType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
      const extension = (detectedType.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
      return new File([blob], `museflow-reference-${String(index+1).padStart(2, '0')}.${extension}`, { type: detectedType });
    }));
    const composer=findComposer();
    let composerRoot=composer.closest('form')||composer.parentElement;
    for(let i=0;i<8&&composerRoot?.parentElement;i++){
      if(composerRoot.querySelector('input[type="file"]'))break;
      composerRoot=composerRoot.parentElement;
    }
    const acceptsImage=input=>{
      const accept=(input.accept||'').toLowerCase();
      return !accept||accept.includes('image')||accept.includes('*/*')||/\.(png|jpe?g|webp|gif|bmp|avif)/.test(accept);
    };
    const findInput=()=>{
      const all=[...document.querySelectorAll('input[type="file"]')].filter(input=>!input.disabled&&acceptsImage(input));
      const isImageInput=input=>/image|\.png|\.jpe?g|\.webp|\.gif|\.avif/i.test(input.accept||'');
      return all.find(input=>composerRoot?.contains(input)&&isImageInput(input))||
        all.find(input=>composerRoot?.contains(input))||
        all.find(isImageInput)||null;
    };
    let input=findInput();
    if(!input){
      const roots=[composerRoot,composer.closest('form'),composer.parentElement].filter(Boolean);
      const uploadButton=roots.flatMap(root=>[...root.querySelectorAll('button,[role="button"],label')]).filter(visible).find(el=>/attach|upload|image|photo|file|đính kèm|tải lên/i.test(`${el.getAttribute('aria-label')||''} ${el.getAttribute('title')||''} ${el.innerText||''}`));
      if(uploadButton){uploadButton.click();await delay(250,signal);input=findInput();}
    }
    if(!input)throw new Error('Muse image upload control was not found near the chat composer; the prompt was not submitted.');
    const previewSelector='img,[role="img"],[data-testid*="attachment" i],[data-testid*="upload" i],[class*="attachment" i],[class*="upload" i]';
    const previewElements=()=>[...document.querySelectorAll(previewSelector)].filter(visible);
    const previewKey=el=>{
      const src=el.matches('img')?(el.currentSrc||el.src||''):/url\(["']?(blob:|data:image\/|https?:)[^)]*\)/i.exec(getComputedStyle(el).backgroundImage)?.[0]||'';
      return `${src}|${el.getAttribute('data-testid')||''}|${el.getAttribute('class')||''}|${el.getAttribute('aria-label')||''}|${el.getAttribute('title')||''}`;
    };
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'files')?.set;
    if(!setter)throw new Error('Browser does not allow setting the Muse attachment input.');
    const uploadBatch=async(batch)=>{
      const previousPreviews=new Set(previewElements().map(previewKey));
      const transfer=new DataTransfer();batch.forEach(file=>transfer.items.add(file));
      if(batch.length>1)input.multiple=true;
      setter.call(input,transfer.files);
      input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
      input.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
      const started=Date.now(),deadline=started+8000;
      const accepted=()=>batch.every(file=>[...(input.files||[])].some(item=>item.name===file.name&&item.size===file.size&&item.type===file.type));
      const previewSeen=()=>previewElements().some(el=>{
        const key=previewKey(el),src=el.matches('img')?(el.currentSrc||el.src||''):key.split('|',1)[0];
        return !previousPreviews.has(key)&&Boolean(src);
      });
      while(Date.now()<deadline){if(signal?.aborted)throw new DOMException('Generation stopped by user.','AbortError');if(previewSeen()||accepted()&&Date.now()-started>1000)return;await delay(160,signal);}
      throw new Error(`Muse did not confirm ${batch.length} reference image${batch.length===1?'':'s'} in the chat composer (upload input accepts: ${input.accept||'any file'}); the prompt was not submitted.`);
    };
    if(files.length>1&&!input.multiple){
      for(const file of files)await uploadBatch([file]);
    }else await uploadBatch(files);
  }

  async function generateScript({ prompt, timeoutSec = 180 }, signal) {
    if (signal?.aborted) throw new DOMException('Generation stopped by user.', 'AbortError');
    if (!String(prompt || '').trim()) throw new Error('Prompt is empty.');

    await waitHydrated(15000, signal);
    const composer = findComposer();
    if (!visible(composer)) throw new Error('Muse message box is not visible.');

    const initialBubbles = assistantMessageElements();
    const initialTextMap = new Map(initialBubbles.map(el => [el, (el.innerText || el.textContent || '').trim()]));

    composer.scrollIntoView({ block: 'center' });
    composer.focus();
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

    if (sendButton && !sendButton.disabled) {
      sendButton.click();
    } else {
      const form = composer.closest('form');
      if (form && typeof form.requestSubmit === 'function') form.requestSubmit();
      else {
        composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        composer.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
      }
    }

    // Chờ tin nhắn trả về từ Muse Assistant
    const deadline = Date.now() + (Number(timeoutSec) || 180) * 1000;
    let lastText = '';
    let stableSince = 0;

    while (Date.now() < deadline) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const bubbles = assistantMessageElements();
      // Tìm bubble mới nhất
      const freshBubble = bubbles.find(el => !initialTextMap.has(el)) || bubbles[bubbles.length - 1];

      if (freshBubble) {
        const text = (freshBubble.innerText || freshBubble.textContent || '').trim();
        const isStopVisible = Boolean(
          document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="Dừng" i],button[aria-label*="停止"]')
        );

        if (text && text.length > 50) {
          if (text === lastText) {
            if (!stableSince) stableSince = Date.now();
            // Nếu text không đổi trong 2 giây và nút Stop đã tắt -> ĐÃ HOÀN THÀNH
            if (!isStopVisible && Date.now() - stableSince >= 2000) {
              return { ok: true, script: text };
            }
          } else {
            lastText = text;
            stableSince = 0;
          }
        }
      }

      await delay(400, signal);
    }

    if (lastText && lastText.length > 50) {
      return { ok: true, script: lastText };
    }

    throw new Error('Hết thời gian chờ Muse.ai soạn kịch bản.');
  }

  function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('Media conversion failed.'));reader.readAsDataURL(blob);});}

})();
