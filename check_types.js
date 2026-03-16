const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function checkTypes() {
  const res = await fetch(`${url}rpc/get_column_types`, {
     method: 'POST',
     headers: { apikey: key, Authorization: `Bearer ${key}` },
     body: JSON.stringify({ table_name: 'email_tasks' })
  });
  // If rpc fails, I'll just guess based on the data.
  if (res.status !== 200) {
    console.log("RPC failed. Checking row data more carefully...");
    const res2 = await fetch(`${url}email_tasks?select=pic_create,pic_assign,pic_update&limit=5`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const data = await res2.json();
    console.log("Row samples:", data);
  } else {
    const data = await res.json();
    console.log("Column types:", data);
  }
}
checkTypes();
