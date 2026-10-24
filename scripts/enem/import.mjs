import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import assert from "node:assert/strict";

const directory = "output/enem";
const report = JSON.parse(await readFile(join(directory,"validation.json"),"utf8"));
const approved = JSON.parse(await readFile(join(directory,"approved.json"),"utf8"));
assert.equal(report.commit,"938c56fbd3b391e03d93316c920a90c3e54842e5");
assert.equal(approved.length,report.approved);
assert.equal(new Set(approved.map(q=>q.id)).size,approved.length);
assert.ok(approved.length>0);
const names = [...new Set([...JSON.stringify(approved).matchAll(/__ENEM_ASSETS__\/([a-f0-9]{64}\.(?:png|jpe?g|webp))/g)].map(m=>m[1]))];
let bytes=0;
for(const name of names){
  const data=await readFile(join(directory,"assets",name)); bytes+=data.length;
  assert.equal(createHash("sha256").update(data).digest("hex"),name.split(".")[0]);
}
console.log(JSON.stringify({questions:approved.length,quarantined:report.quarantined,images:names.length,imageBytes:bytes,dryRun:!process.argv.includes("--publish")}));
if(!process.argv.includes("--publish")) process.exit(0);
const review=JSON.parse(await readFile(join(directory,"visual-review.json"),"utf8").catch(error=>{
  if(error.code!=="ENOENT")throw error;
  return readFile("docs/enem-import-review.json","utf8");
}));
assert.equal(review.commit,report.commit,"Faça a conferência visual antes de publicar.");
assert.equal(review.approved,approved.length);
assert.equal(review.status,"approved");
assert.equal(review.digest,createHash("sha256").update(await readFile(join(directory,"approved.json"))).digest("hex"),"O acervo mudou desde a conferência visual.");
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
assert.ok(url&&key,"Configure as variáveis do Supabase no ambiente.");
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const existing=new Map();
for(let offset=0;;offset+=1000){
  const {data,error}=await db.from("qe_enem_questions").select("id,checksum").order("id").range(offset,offset+999);
  if(error) throw new Error(`Banco indisponível: ${error.code}. Execute npm run db:push.`);
  for(const q of data)existing.set(q.id,q.checksum);
  if(data.length<1000)break;
}
for(const q of approved)assert.ok(!existing.has(q.id)||existing.get(q.id)===q.checksum,`O conteúdo de ${q.id} mudou. Revise a migração antes de substituir o histórico.`);
const bucket=db.storage.from("qe-enem-assets");
const present=new Set();
for(let offset=0;;offset+=1000){
  const {data,error}=await bucket.list("",{limit:1000,offset,sortBy:{column:"name",order:"asc"}});
  if(error)throw new Error(`Não foi possível listar as imagens: ${error.message}`);
  for(const file of data)present.add(file.name);
  if(data.length<1000)break;
}
let done=0,position=0;
const missing=names.filter(name=>!present.has(name));
await Promise.all(Array.from({length:6},async()=>{
  while(position<missing.length){
    const name=missing[position++];
    const data=await readFile(join(directory,"assets",name));
    const contentType=extname(name)===".png"?"image/png":extname(name)===".webp"?"image/webp":"image/jpeg";
    let failure;
    for(let attempt=0;attempt<3;attempt++){
      const {error}=await bucket.upload(name,data,{contentType,cacheControl:"31536000",upsert:false});
      if(!error||error.statusCode==="409"){failure=null;break;} failure=error;
      await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    }
    if(failure)throw new Error(`Falha ao enviar ${name}: ${failure.message}`);
    done++;if(done%100===0)console.log(`Imagens: ${done}/${missing.length}`);
  }
}));
const prefix=bucket.getPublicUrl("").data.publicUrl.replace(/\/$/,"");
for(let index=0;index<approved.length;index+=50){
  const rows=JSON.parse(JSON.stringify(approved.slice(index,index+50)).replaceAll("__ENEM_ASSETS__",prefix)).map(q=>({...q,published:true}));
  const {error}=await db.from("qe_enem_questions").upsert(rows,{onConflict:"id"});
  if(error)throw new Error(`Falha no lote ${index}: ${error.code}`);
  if(index%500===0)console.log(`Questões: ${Math.min(index+50,approved.length)}/${approved.length}`);
}
for(let index=0;index<report.quarantine.length;index+=100){
  const {error}=await db.from("qe_enem_questions").update({published:false}).in("id",report.quarantine.slice(index,index+100).map(q=>q.id));
  if(error)throw new Error(`Falha ao retirar itens inválidos: ${error.code}`);
}
await writeFile(join(directory,"publication.json"),JSON.stringify({commit:report.commit,questions:approved.length,images:names.length,publishedAt:new Date().toISOString()},null,2));
console.log(`Publicado: ${approved.length} questões, ${names.length} imagens. Histórico preservado.`);
