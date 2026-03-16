const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function checkTable(tableName) {
  const res = await fetch(`${url}${tableName}?limit=1`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  });
  if (res.status === 404 || res.status === 406) {
    console.log(`Table "${tableName}": ❌ NOT FOUND (${res.status})`);
  } else if (res.ok) {
    const data = await res.json();
    console.log(`Table "${tableName}": ✅ EXISTS (rows returned: ${data.length})`);
  } else {
    console.log(`Table "${tableName}": ⚠️ Status ${res.status}`);
  }
}

(async () => {
  await checkTable("stats_ping");
  await checkTable("health");
  await checkTable("email_tasks");
  await checkTable("counters");
})();
