import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://czoqxjrtqtkdmymqdsic.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3F4anJ0cXRrZG15bXFkc2ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI5MDI0NCwiZXhwIjoyMDg4ODY2MjQ0fQ.sUHBp0ABCLlKJ-Cte2riK5xjnDPWgSxH535RFjITOCQ";

const supabase = createClient(supabaseUrl, supabaseKey);

function safeStr(v) { return (v ?? "").toString().trim(); }
function normalizeStatus(s) {
  const v = safeStr(s).toUpperCase().replace(/\s+/g, "_");
  if (v === "INPROGRESS") return "IN_PROGRESS";
  if (v === "IN_PROGRESS") return "IN_PROGRESS";
  if (v === "COMPLETE") return "COMPLETE";
  return "NEW";
}

async function run() {
  const { data: snapDocs, error } = await supabase
    .from("email_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);
    
  if (error) { console.error("Error:", error); return; }

  const rows = (snapDocs || []).map((data) => {
    return {
      _id: data.id,
      taskNo: data.task_no,
      title: data.title,
      senderEmail: data.sender_email,
      receivedAt: data.received_at,
      pic_assign: data.pic_assign,
      status: normalizeStatus(data.status),
      remark: data.remark,
      pic_create: data.pic_create,
      createdAt: data.created_at,
      pic_update: data.pic_update,
      updatedAt: data.updated_at,
      messageId: data.message_id
    };
  });
  
  console.log("Mapped Rows:", rows);
}
run();
