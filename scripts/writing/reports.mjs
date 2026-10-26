import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
assert.ok(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY, "Configure o ambiente do servidor.");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const resolve = process.argv.find(a => a.startsWith("--resolve="))?.slice(10);
if (resolve) {
  assert.match(resolve, /^[0-9a-f-]{36}$/i);
  const { error } = await db.from("qe_writing_reports").update({ status: "resolved" }).eq("id", resolve); assert.equal(error, null); console.log("Relato resolvido.");
} else {
  const { data, error } = await db.from("qe_writing_reports").select("id,content_id,edition,message,created_at").eq("status", "open").order("created_at").limit(100); assert.equal(error, null); console.log(JSON.stringify(data, null, 2));
}
