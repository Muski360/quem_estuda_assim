import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

assert.ok(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY, "Configure the server environment.");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const resolve = process.argv.find(a => a.startsWith("--resolve="))?.slice(10);
const withdraw = process.argv.find(a => a.startsWith("--withdraw="))?.slice(11);
if (resolve) {
  assert.match(resolve, /^[0-9a-f-]{36}$/i);
  const { error } = await db.from("qe_content_reports").update({ status: "resolved" }).eq("id", resolve);
  assert.equal(error, null); console.log("Report resolved.");
} else if (withdraw) {
  assert.match(withdraw, /^enem-\d{4}-regular-\d{1,3}(?:-(?:ingles|espanhol))?$/);
  const { error } = await db.from("qe_explanations").update({ status: "quarantined" }).eq("question_id", withdraw);
  assert.equal(error, null); console.log("Explanation withdrawn; archived versions and question preserved.");
} else {
  const { data, error } = await db.from("qe_content_reports").select("id,question_id,version,category,message,created_at").eq("status", "open").order("created_at").limit(100);
  assert.equal(error, null); console.log(JSON.stringify(data, null, 2));
}
