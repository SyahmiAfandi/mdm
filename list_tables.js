const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function listTables() {
  const res = await fetch(`${url}rpc/get_tables`, { 
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}` } 
  });
  // If rpc fails, try another way
  if (res.status !== 200) {
     console.log("RPC failed, status:", res.status);
     const res2 = await fetch(`${url}?select=name`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
     });
     console.log("Root select status:", res2.status);
     const data = await res2.json();
     console.log("Tables:", data);
  } else {
    const data = await res.json();
    console.log("Tables:", data);
  }
}
listTables();
