/**
 * Service Worker Registration
 * Registers the PWA service worker for offline support
 * Only in production - disabled in development to avoid caching issues
 */
if ('serviceWorker' in navigator) {
  const isLocalhost = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    // In development: unregister any existing service workers to avoid cache issues
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for (let registration of registrations) {
        registration.unregister();
        console.log('[PWA] Service Worker unregistered for development');
      }
    });
  } else {
    // In production: register service worker
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
}
