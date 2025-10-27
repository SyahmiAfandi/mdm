// firebaseClient.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore, doc, getDoc, Timestamp } from "firebase/firestore";

// --- Your Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyDpiE1uB9QUNZp7lgBPS9mEA0zx-W83F1U",
  authDomain: "mdm-tools-project.firebaseapp.com",
  projectId: "mdm-tools-project",
  appId: "1:859478727317:web:7bb227ce347340a97ad99c",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Keep users signed in after refresh
setPersistence(auth, browserLocalPersistence).catch(() => { /* ignore */ });

// username -> alias email (so you can login with "username" instead of an email)
export const toAliasEmail = (u) => `${u.trim().toLowerCase()}@yourapp.local`;

// Nicer error messages for auth
function mapAuthError(err) {
  const code = (err?.code || "").toLowerCase();
  if (code.includes("user-not-found") || code.includes("invalid-email")) return "User not found";
  if (code.includes("wrong-password")) return "Wrong password";
  if (code.includes("too-many-requests")) return "Too many attempts. Try again later.";
  return "Unable to sign in";
}

// ---------- Role Permissions (Firestore-driven) ----------
const ROLE_PERMS_COLLECTION = "rolePermissions"; // <- matches your Firestore

// Fallback if rolePermissions/{role} doc is missing
const roleToPermsFallback = {
  admin:  { "dashboard.view": true,  "settings.view": true,  },
  user:   { "dashboard.view": true,  "settings.view": false, },
  viewer: { "dashboard.view": true,  "settings.view": false, },
};

// If Firestore provides a map, use it as-is; otherwise fall back
export function buildPermissionSnapshot(role, source) {
  if (source && typeof source === "object") return source;
  return roleToPermsFallback[role] || roleToPermsFallback.viewer;
}

// Fetch permissions from rolePermissions/{roleId} -> { permissions: { ... } }
export async function getRolePermissions(roleId) {
  if (!roleId) return null;
  try {
    const ref = doc(db, ROLE_PERMS_COLLECTION, roleId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return (data && data.permissions && typeof data.permissions === "object")
      ? data.permissions
      : null;
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
  } catch {}
  return snap;
}

// ---------- Auth flows ----------
export async function loginWithUsername(username, password) {
  try {
    const email = toAliasEmail(username);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // These collections are keyed by user UID (as in your existing schema)
    const [roleSnap, profSnap, licSnap] = await Promise.all([
      getDoc(doc(db, "roles", uid)),     // { role: "admin" | "user" | "viewer" }
      getDoc(doc(db, "profiles", uid)),  // user profile fields
      getDoc(doc(db, "licenses", uid)),  // { validUntil: Timestamp }
    ]);

    const role = roleSnap.exists() ? roleSnap.data().role : null;
    const profile = profSnap.exists() ? profSnap.data() : null;
    const license = licSnap.exists() ? licSnap.data() : null;

    // License validity
    let licenseValid = false;
    if (license?.validUntil instanceof Timestamp) {
      licenseValid = new Date() < license.validUntil.toDate();
    }

    // Fetch role-based permissions from rolePermissions/{role}
    let permissions = null;
    if (role) permissions = await getRolePermissions(role);

    return { user: cred.user, role, profile, license, licenseValid, permissions };
  } catch (err) {
    throw new Error(mapAuthError(err));
  }
}

export const observeAuth = (cb) => onAuthStateChanged(auth, cb);
export const logout = () => signOut(auth);
