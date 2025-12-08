/**
 * Service Worker Registration
 * Registers the PWA service worker for offline support
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('[PWA] Service Worker registered:', registration.scope);
      })
      .catch(function(err) {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  });
}
