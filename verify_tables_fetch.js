const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function verify(tableName) {
  const res = await fetch(`${url}${tableName}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (res.status === 200) {
    console.log(`${tableName}: Success (Found)`);
  } else {
    const data = await res.json();
    console.log(`${tableName}: Error ${res.status} - ${data.message || 'Not Found'}`);
  }
}

async function run() {
  await verify('profiles');
  await verify('counters');
  await verify('email_tasks');
}
run();
