const STORAGE_KEY = "BACKEND_URL";

export function normalizeUrl(url = "") {
  return url.trim().replace(/\/+$/, "");
}

export function isProd() {
  return import.meta.env.PROD; // true on Vercel build
}

export function getBackendUrl() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return normalizeUrl(saved);

  // ✅ allow env only in development
  if (!isProd()) {
    const env = import.meta.env.VITE_BACKEND_URL;
    if (env) return normalizeUrl(env);
  }

  // production with no saved url -> empty => must block app
  return "";
}

export function saveBackendUrl(url) {
  localStorage.setItem(STORAGE_KEY, normalizeUrl(url));
}

export function clearBackendUrl() {
  localStorage.removeItem(STORAGE_KEY);
}
