import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const base=process.env.SCROLL_TEST_BASE_URL??"http://localhost:3000";
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
assert.ok(url&&key&&secret,"Configure o Supabase antes do teste de integração.");
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const accounts=[];
async function account(){
  const email=`qe-scroll-test-${crypto.randomUUID()}@example.com`,password=`Qa!${crypto.randomUUID()}a1`;
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(error)throw new Error(`QA account: ${error.code}`);
  accounts.push(data.user.id);
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await client.auth.signInWithPassword({email,password});
  if(signed.error)throw new Error(`QA login: ${signed.error.code}`);
  return {id:data.user.id,client,token:signed.data.session.access_token};
}
async function request(user,input="view=stats",expected=200){
  const response=await fetch(`${base}/api/scroll${typeof input==="string"?`?${input}`:""}`,{
    method:typeof input==="string"?"GET":"POST",
    headers:{...(user?{Authorization:`Bearer ${user.token}`}:{ }),...(typeof input==="string"?{}:{"Content-Type":"application/json"})},
    body:typeof input==="string"?undefined:JSON.stringify(input),
  });
  const data=await response.json();
  assert.equal(response.status,expected,JSON.stringify(data));
  assert.match(response.headers.get("cache-control"),/private, no-store/);
  return data;
}
const settings={area:"all",year:2023,language:"ingles",mode:"session",target:5,timed:false,minutes:3,goal:5};
const noAnswerLeak=session=>{
  for(const item of session.items){
    if(item.status==="pending")assert.equal(item.correctIndex,null);
    assert.equal(item.question.correct_index,undefined);
    assert.equal(item.question.correctIndex,undefined);
    for(const option of item.question.alternatives)assert.equal(option.isCorrect,undefined);
  }
};
try{
  const a=await account(),b=await account();
  await request(null,"view=stats",401);
  const denied=await a.client.from("qe_enem_questions").select("correct_index").limit(1);
  assert.ok(denied.error,"Usuário conseguiu ler gabaritos diretamente");
  const core=await a.client.rpc("qe_scroll_command_core",{p_action:"start",p_data:{settings}});
  assert.ok(core.error,"Núcleo desprotegido");
  const legacy=await a.client.rpc("qe_record_study_activity",{p_event_id:crypto.randomUUID(),p_module:"scroll",p_xp:45});
  assert.ok(legacy.error,"XP de Scroll ainda aceito sem questão");
  let session=await request(a,{action:"start",settings});
  noAnswerLeak(session);
  await request(b,`view=session&sessionId=${session.id}`,404);
  const answered=new Set();let first,last;
  for(let index=0;index<5;index++){
    const item=session.items[0];
    if(!first)first=item.question.id;
    last=item.question.id;answered.add(last);
    const {data:q,error}=await admin.from("qe_enem_questions").select("correct_index").eq("id",last).single();
    assert.equal(error,null);
    const choice=index===4?(q.correct_index+1)%5:q.correct_index;
    const command={action:"answer",sessionId:session.id,itemId:item.id,choice,activeMs:0};
    const results=await Promise.all([request(a,command),request(a,command)]);
    assert.deepEqual(results[0],results[1],"Reenvio não foi idempotente");
    assert.equal(results[0].answered,index+1);
    assert.equal(results[0].items[0].correctIndex,q.correct_index);
    session=await request(a,{action:"next",sessionId:session.id});
  }
  assert.equal(session.finished,true);
  assert.equal(session.xp,50);
  let stats=await request(a);
  assert.equal(stats.answered,5);assert.equal(stats.correct,4);assert.equal(stats.today,5);assert.equal(stats.xp,50);assert.equal(stats.streak,1);
  const errors=await request(a,"view=history&filter=errors");
  assert.equal(errors.items.length,1);assert.equal(errors.items[0].question.id,last);
  session=await request(a,{action:"start",settings:{...settings,mode:"errors"}});
  assert.equal(session.items[0].question.id,last);
  const correct=(await admin.from("qe_enem_questions").select("correct_index").eq("id",last).single()).data.correct_index;
  session=await request(a,{action:"answer",sessionId:session.id,itemId:session.items[0].id,choice:correct,activeMs:0});
  assert.equal(session.xp,0);
  assert.equal((await request(a,"view=history&filter=errors")).items.length,0);
  await request(a,{action:"favorite",questionId:first,favorite:true});
  assert.equal((await request(a,"view=history&filter=favorites")).items[0].question.id,first);
  session=await request(a,{action:"start",settings:{...settings,mode:"favorites"}});
  assert.equal(session.items[0].question.id,first);
  const favoriteCorrect=(await admin.from("qe_enem_questions").select("correct_index").eq("id",first).single()).data.correct_index;
  await request(a,{action:"answer",sessionId:session.id,itemId:session.items[0].id,choice:favoriteCorrect,activeMs:0});
  stats=await request(a);assert.equal(stats.answered,5);assert.equal(stats.correct,4);assert.equal(stats.today,5);assert.equal(stats.reviews,2);assert.equal(stats.xp,50);
  session=await request(a,{action:"start",settings:{...settings,mode:"feed",area:"mathematics",year:2012}});
  noAnswerLeak(session);
  for(const item of session.items){assert.equal(item.question.area,"mathematics");assert.equal(item.question.year,2012);assert.ok(!answered.has(item.question.id));}
  const skipped=session.items[0];
  session=await request(a,{action:"skip",sessionId:session.id,itemId:skipped.id,activeMs:0});
  assert.equal(session.items[0].status,"skipped");assert.equal(session.answered,0);assert.equal(session.xp,0);
  const skippedProgress=await admin.from("qe_scroll_progress").select("first_answered_at").eq("user_id",a.id).eq("question_id",skipped.question.id).maybeSingle();
  assert.equal(skippedProgress.data?.first_answered_at??null,null);
  session=await request(a,{action:"start",settings:{...settings,timed:true}});
  const timed=session.items[0];
  const invalid=await a.client.rpc("qe_scroll_command",{p_action:"answer",p_data:{sessionId:session.id,itemId:timed.id,choice:null,activeMs:0}});
  assert.equal(invalid.error?.code,"22023");
  session=await request(a,{action:"pause",sessionId:session.id,itemId:timed.id,paused:true});
  assert.ok(session.items[0].pausedAt);
  await request(a,{action:"answer",sessionId:session.id,itemId:timed.id,choice:0,activeMs:0},400);
  session=await request(a,{action:"pause",sessionId:session.id,itemId:timed.id,paused:false});
  assert.equal(session.items[0].pausedAt,null);
  await admin.from("qe_scroll_items").update({deadline:new Date(Date.now()-1000).toISOString()}).eq("id",timed.id);
  session=await request(a,{action:"answer",sessionId:session.id,itemId:timed.id,choice:0,activeMs:0});
  assert.equal(session.items[0].status,"expired");assert.equal(session.items[0].correctIndex,null);assert.equal(session.xp,0);
  stats=await request(a,{action:"settings",settings:{...settings,goal:20}});
  assert.equal(stats.settings.goal,20);
  const calc=await a.client.rpc("qe_record_study_activity",{p_event_id:crypto.randomUUID(),p_module:"calculator",p_xp:5});
  assert.equal(calc.error,null);
  stats=await request(a);assert.equal(stats.totalXp,75);assert.equal(stats.answered,5);
  session=await request(a,{action:"start",settings:{...settings,mode:"feed"}});
  await new Promise(resolve=>setTimeout(resolve,1100));
  session=await request(a,{action:"finish",sessionId:session.id,activeMs:1000});
  assert.equal(session.activeMs,1000,"Encerrar perdeu o tempo ativo da questão pendente");
  await request(a,{action:"finish",sessionId:session.id,activeMs:1000});
  stats=await request(a);assert.equal(stats.activeMs,1000,"Reenvio duplicou o tempo ativo");assert.equal(stats.answered,5);
  assert.equal((await request(b)).answered,0);
  console.log("OK: autenticação, RLS, gabarito privado, concorrência, XP, combo, inéditas, filtros, erros, favoritos, meta, revisão, pausa, prazo e integração com Calcula.");
}finally{
  for(const id of accounts){const {error}=await admin.auth.admin.deleteUser(id);if(error)console.error(`Não foi possível remover a conta temporária ${id}: ${error.code}`);}
}
