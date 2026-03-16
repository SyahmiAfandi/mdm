const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function listTables() {
  const res = await fetch(url + "?select=*", {
     method: 'GET',
     headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  // If ?select=* fails, it might just return 400.
  // The correct way to get the table list is often via the openapi spec at /rest/v1/
  const res2 = await fetch(url, { headers: { apikey: key } });
  const data = await res2.json();
  console.log("Paths in OpenAPI:");
  console.log(Object.keys(data.paths).filter(p => p !== "/rpc/get_tables" && p !== "/"));
}
listTables();
