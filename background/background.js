chrome.runtime.onInstalled.addListener(() => {
  console.log('Auto Scroll Pro instalado.');
  // Inicializar estado si no existe
  chrome.storage.local.get(['stats_yt', 'stats_tk', 'stats_fb', 'stats_total'], (result) => {
    if (result.stats_total === undefined) {
      chrome.storage.local.set({
        stats_yt: 0,
        stats_tk: 0,
        stats_fb: 0,
        stats_total: 0
      });
    }
  });
});

// Escuchar mensajes desde los content scripts para actualizar estadísticas
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'incrementScroll') {
    // Manejo de fecha y límite diario
    const today = new Date().toDateString();
    
    chrome.storage.local.get(['stats_yt', 'stats_tk', 'stats_fb', 'stats_total', 'scrolls_today', 'last_date', 'is_premium'], (result) => {
      let yt = result.stats_yt || 0;
      let tk = result.stats_tk || 0;
      let fb = result.stats_fb || 0;
      let total = result.stats_total || 0;
      let scrollsToday = result.scrolls_today || 0;
      let lastDate = result.last_date || today;
      let isPremium = result.is_premium || false;

      // Reinicio diario
      if (lastDate !== today) {
        scrollsToday = 0;
        lastDate = today;
      }

      // Comprobar límite antes de incrementar
      if (!isPremium && scrollsToday >= 120) {
        // Enviar evento de límite alcanzado
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if(tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'showLimitOverlay' }).catch(() => {});
            // Desactivar auto scroll
            chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleAutoScroll', platform: request.platform, enabled: false }).catch(() => {});
          }
        });
        
        // Actualizar estado para desactivar toggle en el popup
        chrome.storage.local.set({ [`scroll_${request.platform}`]: false });
        
        sendResponse({ status: 'limit_reached' });
        return;
      }

      // Si pasa el check, incrementar
      if (request.platform === 'yt') yt++;
      if (request.platform === 'tk') tk++;
      if (request.platform === 'fb') fb++;
      total++;
      scrollsToday++;

      chrome.storage.local.set({
        stats_yt: yt,
        stats_tk: tk,
        stats_fb: fb,
        stats_total: total,
        scrolls_today: scrollsToday,
        last_date: lastDate
      });
    });
    sendResponse({ status: 'success' });
  } else if (request.action === 'updateRestAlarm') {
    chrome.alarms.clear('restAlarm');
    if (request.enabled && request.interval > 0) {
      chrome.alarms.create('restAlarm', { periodInMinutes: request.interval });
    }
    sendResponse({ status: 'success' });
  } else if (request.action === 'validate_license') {
    let key = request.key;
    let isValid = validateLicense(key);
    if (isValid) {
      chrome.storage.local.set({ is_premium: true, license_key: key });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  } else if (request.action === 'pip_heartbeat') {
    chrome.storage.local.get(['is_premium', 'pip_seconds_today', 'last_date'], (result) => {
      let today = new Date().toLocaleDateString();
      let isPremium = result.is_premium || false;
      let pipSeconds = result.pip_seconds_today || 0;
      
      if (result.last_date !== today) {
        pipSeconds = 0;
        chrome.storage.local.set({ last_date: today });
      }

      if (!isPremium) {
        pipSeconds += 1;
        chrome.storage.local.set({ pip_seconds_today: pipSeconds });
        if (pipSeconds >= 3600) { // 1 hora
          sendResponse({ limitReached: true });
        } else {
          sendResponse({ limitReached: false });
        }
      } else {
        sendResponse({ limitReached: false });
      }
    });
    return true; // Mantener canal abierto para respuesta async
  }
});

function validateLicense(key) {
  return false;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'restAlarm') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if(tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'showRestOverlay' }).catch(() => {});
      }
    });
  }
});
