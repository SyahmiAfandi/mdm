const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/email_tasks?select=*&order=created_at.desc";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function check() {
  const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    const text = await res.text();
    console.error("HTTP ERROR:", res.status, text);
    return;
  }
  const data = await res.json();
  console.log("Success! Data length:", data.length);
}
check();
