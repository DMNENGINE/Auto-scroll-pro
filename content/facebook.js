let autoScrollEnabled = false;
let isInitialized = false;

// Listeners iniciales
chrome.storage.local.get(['scroll_fb', 'shortcuts_enabled', 'pip_enabled'], (result) => {
  if (result.scroll_fb) {
    autoScrollEnabled = true;
    initAutoScroll();
  }
  if (result.shortcuts_enabled) {
    document.addEventListener('keydown', handleShortcuts);
  }
  if (result.pip_enabled) {
    injectPipButton();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleAutoScroll' && request.platform === 'fb') {
    autoScrollEnabled = request.enabled;
    if (autoScrollEnabled) initAutoScroll();
  } else if (request.action === 'showRestOverlay') {
    showRestOverlay();
  } else if (request.action === 'showLimitOverlay') {
    showLimitOverlay();
  } else if (request.action === 'updatePip') {
    if(request.enabled) injectPipButton();
    else removePipButton();
  }
});

function injectPipButton() {
  if (document.getElementById('auto-scroll-pip-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'auto-scroll-pip-btn';
  btn.innerHTML = '🪟 PiP';
  btn.style.cssText = "position:fixed; top:20px; right:20px; z-index:999999; padding:10px 15px; background:linear-gradient(135deg, #4f46e5, #3b82f6); color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); transition: transform 0.2s;";
  btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
  btn.onmouseout = () => btn.style.transform = 'scale(1)';
  
  btn.onclick = async () => {
    let mainVideo = getActiveFbVideo();
    
    if (mainVideo) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(()=>{});
      } else {
        await mainVideo.requestPictureInPicture().catch(e => console.error("PiP Error:", e));
      }
    }
  };
  document.body.appendChild(btn);

  if (!window.pipWatcherInterval) {
    window.pipWatcherInterval = setInterval(() => {
      if (document.pictureInPictureElement) {

        // Enviar latido de tiempo de PiP a background
        if (!window.pipTick) window.pipTick = 0;
        window.pipTick++;
        if (window.pipTick >= 2) {
          window.pipTick = 0;
          chrome.runtime.sendMessage({ action: 'pip_heartbeat' }, (res) => {
            if (res && res.limitReached) {
              document.exitPictureInPicture().catch(()=>{});
              chrome.storage.local.set({ pip_enabled: false });
              removePipButton();
              alert("Límite de 1 hora de PiP diario alcanzado. ¡Actualiza a Premium para uso ilimitado!");
            }
          });
        }

        let newActiveVideo = getActiveFbVideo();
        if (newActiveVideo && newActiveVideo !== document.pictureInPictureElement) {
          newActiveVideo.requestPictureInPicture().then(() => {
            if (newActiveVideo.paused) {
              newActiveVideo.play().catch(()=>{});
            }
          }).catch(e => console.log('PiP Auto-switch error:', e));
        }
      }
    }, 500);
  }
}

function getActiveFbVideo() {
  let videos = Array.from(document.querySelectorAll('video'));
  return videos.find(v => v.closest('div[data-pagelet="ReelsRootView"]')) || videos.find(v => v.offsetHeight > 100 && v.readyState > 2) || videos[0];
}

function removePipButton() {
  const btn = document.getElementById('auto-scroll-pip-btn');
  if(btn) btn.remove();
}

function showLimitOverlay() {
  if(document.getElementById('auto-scroll-limit-overlay')) return;
  let overlay = document.createElement('div');
  overlay.id = 'auto-scroll-limit-overlay';
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.95);color:white;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;backdrop-filter:blur(10px);";
  overlay.innerHTML = `
    <h1 style="font-size:40px;margin-bottom:10px;font-weight:bold;color:#f87171;">🚫 Límite Diario Alcanzado</h1>
    <p style="font-size:18px;margin-bottom:40px;opacity:0.8;">Has llegado al límite de 120 scrolls del plan gratuito.</p>
    <p style="font-size:16px;margin-bottom:20px;opacity:0.6;">Introduce una Licencia Premium en la extensión para scrolls infinitos.</p>
    <button id="close-limit-btn" style="padding:15px 40px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:30px;font-size:16px;font-weight:bold;cursor:pointer;transition:background 0.2s;">Cerrar (Auto-scroll desactivado)</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById('close-limit-btn').onclick = () => overlay.remove();
}

function showRestOverlay() {
  if(document.getElementById('auto-scroll-rest-overlay')) return;
  let overlay = document.createElement('div');
  overlay.id = 'auto-scroll-rest-overlay';
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.95);color:white;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;backdrop-filter:blur(10px);";
  overlay.innerHTML = `
    <h1 style="font-size:40px;margin-bottom:20px;font-weight:bold;">⏱️ Tiempo de Descanso</h1>
    <p style="font-size:18px;margin-bottom:40px;opacity:0.8;">Has estado haciendo scroll durante un rato. ¡Tómate un respiro y parpadea!</p>
    <button id="close-rest-btn" style="padding:15px 40px;background:linear-gradient(135deg, #4f46e5, #3b82f6);color:white;border:none;border-radius:30px;font-size:18px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(79,70,229,0.4);transition:transform 0.2s;">Continuar viendo</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById('close-rest-btn').onclick = () => overlay.remove();
}

// Shortcuts listener
document.addEventListener('keydown', (e) => {
  chrome.storage.local.get(['shortcuts_enabled'], (result) => {
    if(result.shortcuts_enabled) {
      if(e.code === 'Space') {
        const videos = Array.from(document.querySelectorAll('video'));
        const activeVideo = videos.find(v => {
          const rect = v.getBoundingClientRect();
          return rect.top >= -50 && rect.bottom <= window.innerHeight + 50 && rect.height > 100;
        });
        if(activeVideo) {
          activeVideo.paused ? activeVideo.play() : activeVideo.pause();
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  });
});

function initAutoScroll() {
  if (isInitialized) return;
  isInitialized = true;
  console.log("Auto Scroll Pro: FB Reels inicializado");
  
  setInterval(() => {
    if (!autoScrollEnabled) return;
    
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      const rect = video.getBoundingClientRect();
      const isVisible = (rect.top >= -50 && rect.bottom <= window.innerHeight + 50 && rect.height > 100);
      
      if (isVisible && !video.dataset.autoScrollListener) {
        video.dataset.autoScrollListener = "true";
        
        let lastTime = -1;
        video.addEventListener('timeupdate', () => {
          if (!autoScrollEnabled) return;
          
          let currentTime = video.currentTime;
          let duration = video.duration;
          
          let isNearEnd = duration > 0 && (duration - currentTime < 0.4);
          let hasLooped = lastTime > (duration * 0.7) && currentTime < 1.0;
          
          if ((isNearEnd || hasLooped) && !video.dataset.isScrolling) {
            video.dataset.isScrolling = "true";
            console.log("Auto Scroll Pro: FB Reel terminado o en loop, haciendo scroll...");
            try { chrome.runtime.sendMessage({ action: 'incrementScroll', platform: 'fb' }); } catch(e) {}
            
            // Hacer scroll al siguiente
            let nextBtn = document.querySelector('[aria-label="Next reel"], [aria-label="Siguiente reel"]');
            
            if(nextBtn) {
              nextBtn.click();
            } else {
              window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
            }
            
            setTimeout(() => { video.dataset.isScrolling = ""; }, 2500);
          }
          lastTime = currentTime;
        });
      }
    });
  }, 1000);
}

function simulateScroll() {
  let nextBtn = document.querySelector('[aria-label="Next reel"], [aria-label="Siguiente reel"]');
  if (nextBtn) { nextBtn.click(); return; }
  window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
}

function simulateScrollUp() {
  let prevBtn = document.querySelector('[aria-label="Previous reel"], [aria-label="Reel anterior"]');
  if (prevBtn) { prevBtn.click(); return; }
  window.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('nexttrack', () => simulateScroll());
  navigator.mediaSession.setActionHandler('previoustrack', () => simulateScrollUp());
}
