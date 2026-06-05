document.addEventListener('DOMContentLoaded', () => {
  // Manejo de navegación del menú lateral
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remover 'active' de todos los items y vistas
      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      // Activar el item clickeado y su vista correspondiente
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.classList.add('active');
      }
    });
  });

  // Manejo de los toggles de plataformas
  const platforms = ['yt', 'tk', 'fb', 'ig'];
  
  platforms.forEach(platform => {
    const toggle = document.getElementById(`toggle-${platform}`);
    const statusBox = document.getElementById(`status-${platform}`);

    // Cargar estado guardado
    chrome.storage.local.get([`scroll_${platform}`], (result) => {
      toggle.checked = result[`scroll_${platform}`] || false;
      updateStatus(platform, toggle.checked);
    });

    // Guardar estado al cambiar
    toggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      chrome.storage.local.set({ [`scroll_${platform}`]: isEnabled });
      updateStatus(platform, isEnabled);
      
      // Enviar mensaje al content script para activar/desactivar
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if(tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleAutoScroll', 
            platform: platform, 
            enabled: isEnabled
          }).catch(() => {
            // Error ignorado, el content script puede no estar inyectado
          });
        }
      });
    });
  });

  function updateStatus(platform, isEnabled) {
    const statusBox = document.getElementById(`status-${platform}`);
    if(isEnabled) {
      statusBox.className = 'status-box success';
      statusBox.textContent = 'Auto-scroll ACTIVADO';
    } else {
      statusBox.className = 'status-box success';
      statusBox.textContent = 'Compatible aquí • Auto-scroll desactivado';
    }
  }

  // Manejo de atajos
  const toggleShortcuts = document.getElementById('toggle-shortcuts');
  chrome.storage.local.get(['shortcuts_enabled'], (result) => {
    if(toggleShortcuts) toggleShortcuts.checked = result.shortcuts_enabled || false;
  });
  if(toggleShortcuts) {
    toggleShortcuts.addEventListener('change', (e) => {
      chrome.storage.local.set({ 'shortcuts_enabled': e.target.checked });
    });
  }

  // Manejo de PiP
  const togglePip = document.getElementById('toggle-pip');
  chrome.storage.local.get(['pip_enabled'], (result) => {
    if(togglePip) togglePip.checked = result.pip_enabled || false;
  });
  if(togglePip) {
    togglePip.addEventListener('change', (e) => {
      chrome.storage.local.set({ 'pip_enabled': e.target.checked });
      // Enviar mensaje al content script si es necesario
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if(tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'updatePip', enabled: e.target.checked }).catch(() => {});
        }
      });
    });
  }

  // Manejo de descanso
  const toggleRest = document.getElementById('toggle-rest');
  const restInterval = document.getElementById('rest-interval');
  chrome.storage.local.get(['rest_enabled', 'rest_interval'], (result) => {
    if(toggleRest) toggleRest.checked = result.rest_enabled || false;
    if(restInterval) restInterval.value = result.rest_interval || 20;
  });
  if(toggleRest) {
    toggleRest.addEventListener('change', (e) => {
      chrome.storage.local.set({ 'rest_enabled': e.target.checked });
      chrome.runtime.sendMessage({ action: 'updateRestAlarm', enabled: e.target.checked, interval: parseInt(restInterval.value) });
    });
  }
  if(restInterval) {
    restInterval.addEventListener('change', (e) => {
      chrome.storage.local.set({ 'rest_interval': e.target.value });
      if(toggleRest.checked) {
         chrome.runtime.sendMessage({ action: 'updateRestAlarm', enabled: true, interval: parseInt(e.target.value) });
      }
    });
  }

  // Cargar estadísticas
  chrome.storage.local.get(['stats_yt', 'stats_tk', 'stats_fb', 'stats_ig', 'stats_total'], (result) => {
    document.getElementById('stat-yt').textContent = result.stats_yt || 0;
    document.getElementById('stat-tk').textContent = result.stats_tk || 0;
    const statFb = document.getElementById('stat-fb');
    if(statFb) statFb.textContent = result.stats_fb || 0;
    document.getElementById('stat-total').textContent = result.stats_total || 0;
  });

  // Lógica de la Ruleta
  const wheel = document.getElementById('spin-wheel');
  const spinBtn = document.getElementById('spin-btn');
  const resultDiv = document.getElementById('wheel-result');
  if(wheel && spinBtn) {
    const options = ["Seguir Viendo", "Tomar Agua", "Ir a Dormir", "Estirar", "Leer 10 min", "Cerrar App"];
    let currentRotation = 0;
    
    spinBtn.addEventListener('click', () => {
      spinBtn.disabled = true;
      resultDiv.textContent = "Girando...";
      resultDiv.classList.remove('pulse-text');
      
      const extraSpins = 4 + Math.floor(Math.random() * 4); // 4 a 7 giros completos
      const randomOptionIndex = Math.floor(Math.random() * options.length);
      
      const centerAngle = randomOptionIndex * 60 + 30;
      const targetAngle = 270 - centerAngle; // Apuntar hacia arriba (270 grados en CSS transform)
      
      currentRotation = currentRotation + (360 * extraSpins) + targetAngle - (currentRotation % 360);
      
      // Añadir un pequeño offset aleatorio para que no caiga exactamente en el medio siempre (opcional)
      const offset = (Math.random() * 40) - 20; 
      const finalRotation = currentRotation + offset;
      
      wheel.style.transform = `rotate(${finalRotation}deg)`;
      
      setTimeout(() => {
        spinBtn.disabled = false;
        resultDiv.textContent = `¡${options[randomOptionIndex]}!`;
        resultDiv.classList.add('pulse-text');
      }, 3000); // 3 segundos que dura la animación CSS
    });
  }

  // Lógica Premium y Licencia
  const scrollsCount = document.getElementById('scrolls-count');
  const scrollsFill = document.getElementById('scrolls-fill');
  const premiumBadge = document.getElementById('premium-badge');
  const licenseStatus = document.getElementById('license-status');
  const licenseInput = document.getElementById('license-input');
  const validateBtn = document.getElementById('validate-btn');
  const licenseMsg = document.getElementById('license-msg');
  
  // Elementos a ocultar/mostrar
  const sidebarProBtn = document.getElementById('sidebar-pro-btn');
  const pipPremiumBanner = document.getElementById('pip-premium-banner');
  const pipProContent = document.getElementById('pip-pro-content');
  const licenseLimitText = document.getElementById('license-limit-text');
  const pipLimitText = document.getElementById('pip-limit-text');

  chrome.storage.local.get(['scrolls_today', 'is_premium', 'license_key', 'pip_seconds_today'], (result) => {
    let todayCount = result.scrolls_today || 0;
    let isPremium = result.is_premium || false;
    
    if (isPremium) {
       if(premiumBadge) premiumBadge.style.display = 'block';
       if(scrollsCount) scrollsCount.parentElement.innerHTML = 'Plan Premium: Scrolls Ilimitados 😎';
       if(scrollsFill) {
         scrollsFill.style.width = '100%';
         scrollsFill.style.backgroundColor = '#10b981';
       }
       if(licenseStatus) {
         licenseStatus.textContent = 'PREMIUM ACTIVADO';
         licenseStatus.style.color = '#10b981';
       }
       if(licenseInput) {
         licenseInput.value = result.license_key || '';
         licenseInput.disabled = true;
         validateBtn.disabled = true;
       }
       
       // Ocultar botones de compra
       if(sidebarProBtn) sidebarProBtn.style.display = 'none';
       if(pipPremiumBanner) pipPremiumBanner.style.display = 'none';
       if(pipLimitText) pipLimitText.style.display = 'none';
       if(licenseLimitText) licenseLimitText.textContent = '¡Disfruta de scrolls ilimitados sin restricciones!';
       
    } else {
       if(premiumBadge) premiumBadge.style.display = 'none';
       if(scrollsCount) scrollsCount.textContent = todayCount;
       if(scrollsFill) {
         let pct = Math.min((todayCount / 120) * 100, 100);
         scrollsFill.style.width = `${pct}%`;
         if(pct >= 100) scrollsFill.style.backgroundColor = '#ef4444';
       }
       
       if(pipPremiumBanner) pipPremiumBanner.style.display = 'flex';
       if (pipLimitText) {
          pipLimitText.style.display = 'block';
          let pipSeconds = result.pip_seconds_today || 0;
          let remaining = Math.max(3600 - pipSeconds, 0);
          let m = Math.floor(remaining / 60);
          let s = remaining % 60;
          pipLimitText.textContent = `Tiempo restante hoy: ${m}:${s < 10 ? '0' : ''}${s} (Gratuito)`;
          if (remaining === 0) {
             pipLimitText.textContent = "Límite de 1 hora de PiP agotado.";
             if(togglePip) { togglePip.checked = false; togglePip.disabled = true; }
          }
       }
    }
  });

  if (validateBtn) {
    validateBtn.addEventListener('click', () => {
      const key = licenseInput.value.trim().toUpperCase();
      
      if (!key.startsWith("PRO-")) {
        showError("La clave debe empezar por PRO-"); return;
      }
      const parts = key.split('-');
      if(parts.length !== 4) {
        showError("El formato de la clave es incorrecto."); return;
      }
      
      // Validar checksum
      let sum = 0;
      let str = parts[1] + parts[2];
      for(let i=0; i<str.length; i++) {
        sum += str.charCodeAt(i);
      }
      let expected = (sum * 1337 % 1296).toString(36).toUpperCase().padStart(2, '0');
      
      if (parts[3] === expected) {
         chrome.storage.local.set({ is_premium: true, license_key: key }, () => {
           if(licenseMsg) {
             licenseMsg.style.color = '#10b981';
             licenseMsg.textContent = "¡Licencia Premium validada y activada con éxito!";
           }
           setTimeout(() => window.location.reload(), 2000);
         });
      } else {
         showError("Clave inválida o caducada.");
      }
    });
  }
  
  function showError(msg) {
    if(licenseMsg) {
      licenseMsg.style.color = '#ef4444';
      licenseMsg.textContent = msg;
    }
  }
});
