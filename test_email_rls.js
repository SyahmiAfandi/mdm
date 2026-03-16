const url = process.env.VITE_SUPABASE_URL || 'https://czoqxjrtqtkdmymqdsic.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ';

async function check() {
  const res = await fetch(`${url}/rest/v1/email_tasks?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Length:", data.length);
}
check();
