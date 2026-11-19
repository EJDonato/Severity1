import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    addEventListener('load', () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`) })
  } else {
    // In development a leftover offline worker (from a preview build on the same address) would serve stale pages.
    void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()))
    if ('caches' in window) void caches.keys().then((ks) => ks.forEach((k) => void caches.delete(k)))
  }
}
