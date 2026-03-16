const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/email_tasks?select=*&limit=1";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function check() {
  const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const data = await res.json();
  const keys = Object.keys(data[0]);
  keys.forEach(k => console.log(k));
}
check();
