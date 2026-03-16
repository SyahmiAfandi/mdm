const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function checkRow() {
  const res = await fetch(`${url}email_tasks?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const data = await res.json();
  console.log("Sample Row:", JSON.stringify(data[0], null, 2));
}
checkRow();
