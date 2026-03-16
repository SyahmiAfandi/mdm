const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function checkIdColumn() {
  const res = await fetch(`${url}rpc/get_column_definitions`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ table_name: 'email_tasks' })
  });
  if (res.status === 200) {
    const data = await res.json();
    console.log("Column Definitions:", JSON.stringify(data.filter(c => c.column_name === 'id'), null, 2));
  } else {
    // Fallback: try to see if it's identity or has default
    console.log("RPC failed. Checking row data to see ID format...");
    const res2 = await fetch(`${url}email_tasks?select=id&limit=5`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const data = await res2.json();
    console.log("IDs:", data);
  }
}
checkIdColumn();
