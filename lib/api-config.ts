/**
 * Python API (Flask/YOLO) URL resolver
 * ─────────────────────────────────────────────────────────────────
 * Priority:
 *   1. NEXT_PUBLIC_PYTHON_API_URL  — set this on Vercel / any deployment
 *   2. Auto-detect: http://<hostname>:5000  — works for local dev
 *
 * On Vercel, the Flask server is NOT bundled. You need to either:
 *   a) Deploy the Flask API separately (e.g. Railway, Render, EC2)
 *      and set NEXT_PUBLIC_PYTHON_API_URL=https://your-api.example.com
 *   b) Or leave it unset — the app will show a friendly "API unavailable"
 *      message rather than crashing.
 */
export function getPythonApiUrl(): string {
  // Env var takes priority (set on Vercel or any cloud host)
  if (process.env.NEXT_PUBLIC_PYTHON_API_URL) {
    return process.env.NEXT_PUBLIC_PYTHON_API_URL.replace(/\/$/, '');
  }
  // Browser fallback: same host on port 5000 (local dev)
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:5000`;
  }
  return 'http://localhost:5000';
}

/** Returns true if a Python API URL has been explicitly configured for deployment */
export function isPythonApiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PYTHON_API_URL);
}
