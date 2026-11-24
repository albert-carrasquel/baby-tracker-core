/**
 * Registers the PWA Service Worker for offline shell caching.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failure should never block offline/local UI usage.
    });
  });
}
