// src/config/backend.js
const KEY_MODE = "backend_mode"; // "local" | "tunnel"
const KEY_TUNNEL = "backend_url_tunnel";
const KEY_LOCAL = "backend_url_local";

export function normalizeUrl(url) {
  if (!url) return "";
  let u = String(url).trim();
  // remove trailing slashes
  u = u.replace(/\/+$/, "");
  return u;
}

export function isLocalhostUrl(url) {
  const u = String(url || "").toLowerCase();
  return (
    u.includes("localhost") ||
    u.includes("127.0.0.1") ||
    u.includes("0.0.0.0")
  );
}

// ===== Mode =====
export function getBackendMode() {
  const m = localStorage.getItem(KEY_MODE);
  return m === "local" || m === "tunnel" ? m : "tunnel";
}

export function saveBackendMode(mode) {
  localStorage.setItem(KEY_MODE, mode === "local" ? "local" : "tunnel");
}

// ===== Tunnel =====
export function getBackendUrlTunnel() {
  return localStorage.getItem(KEY_TUNNEL) || "";
}
export function saveBackendUrlTunnel(url) {
  localStorage.setItem(KEY_TUNNEL, normalizeUrl(url));
}
export function clearBackendUrlTunnel() {
  localStorage.removeItem(KEY_TUNNEL);
}

// ===== Local =====
export function getBackendUrlLocal() {
  return localStorage.getItem(KEY_LOCAL) || "http://127.0.0.1:5000";
}
export function saveBackendUrlLocal(url) {
  localStorage.setItem(KEY_LOCAL, normalizeUrl(url));
}
export function clearBackendUrlLocal() {
  localStorage.removeItem(KEY_LOCAL);
}

// ✅ Canonical URL used by app
export function getBackendUrl() {
  const mode = getBackendMode();
  return mode === "local" ? getBackendUrlLocal() : getBackendUrlTunnel();
}
