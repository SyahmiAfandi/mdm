const url = "https://czoqxjrtqtkdmymqdsic.supabase.co/auth/v1/token?grant_type=password";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

async function testAuth(email, password) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
    
    console.log(`[TestAuth] Status: ${res.status} (${(performance.now() - t0).toFixed(0)}ms)`);
    const data = await res.json();
    if (res.ok) {
      console.log("[TestAuth] Success! Tokens acquired.");
    } else {
      console.log("[TestAuth] Failed:", JSON.stringify(data));
    }
  } catch (err) {
    console.log("[TestAuth] Error:", err.message);
  }
}

// Using the email I found earlier
testAuth("syahmi.afandi@unilever.com", "Password123!");
