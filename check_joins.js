const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function checkRelationships() {
  // Try the join directly to see if it works
  const res = await fetch(`${url}user_roles?select=role,role_permissions(permissions)&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  
  if (res.ok) {
    console.log("✅ Join user_roles -> role_permissions WORKS");
  } else {
    const err = await res.json();
    console.log("❌ Join user_roles -> role_permissions FAILED:", err.message);
  }

  const res2 = await fetch(`${url}profiles?select=*,user_roles(role),licenses(*)&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (res2.ok) {
    console.log("✅ Join profiles -> user_roles/licenses WORKS");
  } else {
    const err = await res2.json();
    console.log("❌ Join profiles -> user_roles/licenses FAILED:", err.message);
  }
}
checkRelationships();
