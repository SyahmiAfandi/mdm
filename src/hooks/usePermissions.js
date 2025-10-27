import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebaseClient";
import { doc, getDoc } from "firebase/firestore";


export function usePermissions() {
const [state, setState] = useState({ loading: true, role: null, perms: {} });


useEffect(() => {
const unsub = auth.onAuthStateChanged(async (u) => {
if (!u) { setState({ loading: false, role: null, perms: {} }); return; }
try {
const roleSnap = await getDoc(doc(db, "roles", u.uid));
const role = roleSnap.exists() ? roleSnap.data().role : null;
let perms = {};
if (role) {
const rp = await getDoc(doc(db, "rolePermissions", role));
perms = rp.exists() ? (rp.data().permissions || {}) : {};
}
setState({ loading: false, role, perms });
} catch (e) {
console.error(e);
setState({ loading: false, role: null, perms: {} });
}
});
return () => unsub();
}, []);


const can = useMemo(() => (key) => !!state.perms?.[key], [state.perms]);


return { ...state, can };
}