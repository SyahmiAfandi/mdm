const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/email_tasks?select=*&limit=5";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function check() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    
    if (!res.ok) {
        const err = await res.text();
        console.log("HTTP Error:", res.status, err);
        return;
    }
    
    const data = await res.json();
    console.log("Success! Data count:", data.length);
    console.log("First row:", data[0]);
  } catch(e) {
    console.error("Fetch Error:", e);
  }
}

check();
