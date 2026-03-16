const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/rest/v1/";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function checkUser(username) {
  const res = await fetch(`${url}profiles?username=eq.${username}&select=email,username`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log("Profile data for " + username + ":", JSON.stringify(data, null, 2));
  } else {
    const err = await res.text();
    console.log("Failed to fetch profile:", err);
  }
}
checkUser("syahmi");
