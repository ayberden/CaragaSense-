/**
 * Dev Bypass Configuration
 * ─────────────────────────────────────────────────────────────────
 * Set DEV_BYPASS = true  → Use local role picker (no Supabase needed)
 * Set DEV_BYPASS = false → Use real Supabase auth (production mode)
 *
 * Security: Hardened to strictly disallow dev bypass in production builds.
 */
export const DEV_BYPASS = process.env.NODE_ENV !== 'production' && false;
