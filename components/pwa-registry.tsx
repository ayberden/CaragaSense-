'use client';
import { useEffect } from 'react';

export function PwaRegistry() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // In development, a service worker serves stale HTML against fresh JS
    // bundles and causes hydration errors. Unregister it and clear its caches.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
      });
    };

    // useEffect often runs after the window 'load' event has already fired,
    // in which case the listener would never be called.
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);
  return null;
}
