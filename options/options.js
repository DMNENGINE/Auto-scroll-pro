document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(item.getAttribute('data-target')).classList.add('active');
    });
  });

  const optShortcuts = document.getElementById('opt-shortcuts');
  const optRest = document.getElementById('opt-rest');
  const optRestInterval = document.getElementById('opt-rest-interval');

  chrome.storage.local.get(['shortcuts_enabled', 'rest_enabled', 'rest_interval'], (result) => {
    if(optShortcuts) optShortcuts.checked = result.shortcuts_enabled || false;
    if(optRest) optRest.checked = result.rest_enabled || false;
    if(optRestInterval) optRestInterval.value = result.rest_interval || 20;
  });

  if(optShortcuts) {
    optShortcuts.addEventListener('change', (e) => {
      chrome.storage.local.set({ 'shortcuts_enabled': e.target.checked });
    });
  }

  if(optRest) {
    optRest.addEventListener('change', (e) => {
      chrome.storage.local.set({ 'rest_enabled': e.target.checked });
      chrome.runtime.sendMessage({ action: 'updateRestAlarm', enabled: e.target.checked, interval: parseInt(optRestInterval.value) });
    });
  }

  if(optRestInterval) {
    optRestInterval.addEventListener('change', (e) => {
      chrome.storage.local.set({ 'rest_interval': e.target.value });
      if(optRest.checked) {
         chrome.runtime.sendMessage({ action: 'updateRestAlarm', enabled: true, interval: parseInt(e.target.value) });
      }
    });
  }
});
