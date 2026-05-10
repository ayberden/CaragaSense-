'use client';
import { useEffect } from 'react';

export function PwaRegistry() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').catch(function(err) {
          console.log('ServiceWorker registration failed: ', err);
        });
      });
    }
  }, []);
  return null;
}
