// supabaseAuth.js -> Handling Supabase Auth and Permission Logic
import {
  supabase,
  observeAuth as sbObserveAuth,
  assertSupabaseBrowserConfig,
} from "./supabaseClient";

export const auth = supabase.auth;
export const db = supabase; 

// username -> alias email (e.g. syahmi@yourapp.local)
export const toAliasEmail = (u) => `${u.trim().toLowerCase()}@yourapp.local`;

// Nicer error messages for auth
function mapAuthError(err) {
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Invalid credentials";
  if (msg.includes("secret api key") || msg.includes("secret/service key")) {
    return "Frontend Supabase key is invalid for browser use. Replace it with the project's publishable or anon key."
  }
  if (msg.includes("rate limit")) return "Too many attempts. Try again later.";
  return err?.message || "Unable to sign in";
}

// ---------- Role Permissions (Supabase) ----------
const ROLE_PERMS_TABLE = "role_permissions"; 

// Fallback if rolePermissions/{role} doc is missing
const roleToPermsFallback = {
  admin:  {
    "dashboard.view": true, "tools.view": true, "tools.*": true,
    "utilities.view": true, "utilities.*": true, "reports.view": true, "reports.*": true,
    "masterData.view": true, "masterData.*": true, "settings.view": true, "settings.*": true,
  },
  user:   { "dashboard.view": true, "tools.view": true, "utilities.view": true, "reports.view": true, "settings.view": false },
  viewer: { "dashboard.view": true },
};

function normalizePermissionRows(rows = []) {
  const out = {};
  (rows || []).forEach((row) => {
    const key = String(row?.permission ?? "").trim();
    if (!key) return;
    out[key] = Number(row?.allow ?? 0) === 1;
  });
  return out;
}

function getLicenseValidUntil(license) {
  return license?.valid_until ?? license?.validUntil ?? null;
}


// If Supabase provides a map, use it as-is; otherwise fall back
export function buildPermissionSnapshot(role, source) {
  if (source && typeof source === "object") return source;
  return roleToPermsFallback[role] || roleToPermsFallback.viewer;
}

// Fetch permissions from normalized role_permissions rows where role = roleId
export async function getRolePermissions(roleId) {
  if (!roleId) return null;
  try {
    const { data, error } = await supabase
      .from(ROLE_PERMS_TABLE)
      .select("permission,allow")
      .eq("role", roleId)
      .order("permission", { ascending: true });

    if (error || !data) return null;
    const normalized = normalizePermissionRows(data);
    return Object.keys(normalized).length ? normalized : null;
  } catch (err) {
    console.error("getRolePermissions error:", err);
    return null;
  }
}

// Optionally persist snapshot to localStorage (so Sidebar reads instantly)
export function persistPermissionSnapshot(role, permissions) {
  const snap = buildPermissionSnapshot(role || "viewer", permissions);
  try {
    localStorage.setItem("ff.role", role || "viewer");
    localStorage.setItem("ff.permissions", JSON.stringify(snap));
  } catch {
    // Ignore storage write failures in private browsing or locked-down environments.
  }
  return snap;
}

// ---------- Auth flows ----------

// Clears any stale local session so GoTrueClient isn't locked during login.
// IMPORTANT: Clear localStorage FIRST (synchronous) before any async Supabase call,
// because the async signOut itself hangs if the client is already in a locked state.
async function clearStaleSession() {
  // Synchronously clear all Supabase auth keys from localStorage.
  // GoTrueClient reads session from localStorage, so clearing these keys 
  // is sufficient to unblock the client without any async delay.
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    // Ignore storage cleanup failures and continue with auth flow.
  }
}

export async function loginWithUsername(username, password) {
  try {
    const t0 = performance.now();
    await clearStaleSession();
    const { url, key } = assertSupabaseBrowserConfig();

    let email = username.trim();

    // Step 1: Resolve username -> email via raw FETCH (Bypasses client hangs)
    if (!email.includes("@")) {
      console.log(`[Login] Resolving username '${email}' via raw fetch...`);
      try {
        // Direct fetch is faster and won't hang the SDK connection pool
        const res = await fetch(`${url}/rest/v1/profiles?username=eq.${email}&select=email`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(3000) // 3 second hard timeout
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data?.[0]?.email) {
            email = data[0].email;
            console.log(`[Login] Resolved email: ${email}`);
          }
        }
      } catch (err) {
        console.warn("[Login] Raw fetch failed/timed out. Proceeding with input as email.", err);
      }
    }

    // Step 2: Authenticate via raw FETCH (Bypasses SDK HANG)
    console.log(`[Login] B1: Authenticating via raw API...`);
    const authUrl = `${url}/auth/v1/token?grant_type=password`;
    
    // Explicit timeout helper to ensure B2 ALWAYS prints
    const authStart = Date.now();
    const authController = new AbortController();
    const authTimeout = setTimeout(() => authController.abort(), 12000); // 12s hard limit for the main auth
    
    let authRes;
    try {
        authRes = await fetch(authUrl, {
        method: "POST",
        headers: {
          "apikey": key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password }),
        signal: authController.signal
      });
      clearTimeout(authTimeout);
    } catch (e) {
      console.error("[Login] B1 FAILED (Fetch error/timeout):", e.message);
      throw new Error("Authentication timed out or network error.");
    }
    
    console.log(`[Login] B2: Auth response received status=${authRes?.status} (${Date.now() - authStart}ms)`);
    const authData = await authRes.json();
    if (!authRes.ok) {
      console.error("[Login] B2 FAILED (API error):", authData);
      throw new Error(authData.error_description || authData.error || "Invalid credentials");
    }
    
    const user = authData.user;
    if (!user) throw new Error("No user found in response");

    // Step 3: Sync SDK state (NON-BLOCKING)
    // We fire and forget this so the "stupid" SDK can take its time to sync locally
    // while we already proceed with the login.
    console.log(`[Login] B3: Syncing SDK session (Fire-and-forget)...`);
    const syncStart = Date.now();
    supabase.auth.setSession({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token
    }).catch(err => console.warn("[Login] setSession background error:", err));
    
    const uid = user.id;
    const syncElapsed = Date.now() - syncStart;
    console.log(`[Login] B4: Auth OK (${syncElapsed}ms). Fetching metadata (NON-BLOCKING)...`);

    // Step 4: Fetch profiles, user_roles, and licenses in PARALLEL via RAW FETCH.
    // This is the "Total Raw Bypass" - we don't trust the SDK client for critical login path.
    let profile = null, role = null, license = null, permissions = null;
    
    try {
      console.log(`[Login] B5: Fetching metadata via high-speed raw API...`);
      const headers = {
        apikey: key,
        Authorization: `Bearer ${authData.access_token}`
      };

      const [profRes, roleRes, licRes] = await Promise.all([
        fetch(`${url}/rest/v1/profiles?id=eq.${uid}&select=*`, { headers, signal: AbortSignal.timeout(3000) }).then(r => r.json()),
        fetch(`${url}/rest/v1/user_roles?id=eq.${uid}&select=role`, { headers, signal: AbortSignal.timeout(3000) }).then(r => r.json()),
        fetch(`${url}/rest/v1/licenses?id=eq.${uid}&select=*`, { headers, signal: AbortSignal.timeout(3000) }).then(r => r.json()),
      ]);

      profile = profRes?.[0] || null;
      role = roleRes?.[0]?.role || null;
      license = licRes?.[0] || null;
      console.log(`[Login] B6: Metadata received (role=${role})`);

      if (role) {
        // We can still use the SDK helper for permissions as it's less likely to deadlock, 
        // but for total safety we can keep it as is or raw fetch it too.
        permissions = await getRolePermissions(role);
      }
    } catch (metaErr) {
      console.warn("[Login] B5/B6 FAILED or Timed Out (Bypassing):", metaErr.message);
    }

    let licenseValid = true;
    const validUntil = getLicenseValidUntil(license);
    if (validUntil) {
      licenseValid = new Date() < new Date(validUntil);
    }

    console.log(`[Login] TOTAL SUCCESS: ${(performance.now() - t0).toFixed(0)}ms (redirecting...)`);
    return { user, role, profile, license, licenseValid, permissions };
  } catch (err) {
    console.error(`[Login] CRITICAL FAILURE:`, err.message);
    throw new Error(mapAuthError(err));
  }
}

export const observeAuth = sbObserveAuth;
export const logout = async () => {
  await supabase.auth.signOut();
  try {
    localStorage.removeItem("mdm_auth_v1");
    localStorage.removeItem("ff.role");
    localStorage.removeItem("ff.permissions");
    localStorage.removeItem("perm_cache_v1");
    localStorage.removeItem("username");
  } catch {
    // Ignore storage cleanup failures during logout.
  }
};
