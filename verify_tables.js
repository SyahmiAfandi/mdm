const { createClient } = require('@supabase/supabase-js');
const url = "https://czoqxjrtqtkdmymqdsic.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";
const supabase = createClient(url, key);

async function verify() {
  console.log("Checking profiles...");
  const p = await supabase.from('profiles').select('id').limit(1);
  console.log("Profiles result:", p.error ? p.error.message : "Success (Found)");

  console.log("Checking counters...");
  const c = await supabase.from('counters').select('id').limit(1);
  console.log("Counters result:", c.error ? c.error.message : "Success (Found)");

  console.log("Checking email_tasks...");
  const e = await supabase.from('email_tasks').select('id').limit(1);
  console.log("Email Tasks result:", e.error ? e.error.message : "Success (Found)");
}
verify();
