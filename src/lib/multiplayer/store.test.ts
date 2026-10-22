import assert from "node:assert/strict";
import {test} from "node:test";
import {createRoomEngine} from "./store.ts";
import type {Room} from "./store.ts";
import {DEFAULT_SETTINGS} from "../math/generator.ts";
import {roundXp} from "../momentum.ts";

function match(settings = DEFAULT_SETTINGS) {
  const engine=createRoomEngine();
  const host=engine.createRoom("Host",settings);
  const guest=engine.joinRoom(host.room.code,"Visitante");
  const room=engine.startRoom(host.room.code,host.token);
  const state=()=>engine.exportRoom(room.code)!;
  const answer=(id:string)=>state().players.find((p)=>p.id===id)!.equation!.answer;
  return {engine,host,guest,room,state,answer};
}

test("pistas individuais autenticadas, sem exposição de gabarito ou token",()=>{
  const {engine,host,guest,room,answer}=match();
  assert.throws(()=>engine.readRoom(room.code,"inválido"),/sessão/);
  assert.throws(()=>engine.startRoom(room.code,guest.token),/host/);
  assert.throws(()=>engine.joinRoom(room.code,"Tarde"),/começou/);
  const other=engine.readRoom(room.code,guest.token);
  assert.notEqual(room.equation!.id,other.equation!.id);
  assert.equal("answer" in room.equation!,false);
  assert.equal("explanation" in room.equation!,false);
  assert.equal("token" in room.players[0],false);
  assert.equal("equation" in room.players[1],false);
  assert.equal(room.reveal,null);
  assert.throws(()=>engine.answerRoom(room.code,guest.token,room.equation!.id,answer(host.playerId)),/encerrada/);
  const first=engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId));
  assert.equal(first.correct,true);
  assert.equal(first.room.winnerId,null);
  assert.throws(()=>engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId)),/encerrada/);
  const second=engine.answerRoom(room.code,guest.token,other.equation!.id,answer(guest.playerId));
  assert.equal(second.correct,true);
  assert.deepEqual(second.room.players.map((p)=>p.score),[1,1]);
});

test("três erros em menos de 5s bloqueiam só o jogador na mesma questão",()=>{
  const realNow=Date.now;
  let now=100000;
  Date.now=()=>now;
  try {
    const {engine,host,guest,room,answer}=match({...DEFAULT_SETTINGS,seconds:30});
    const other=engine.readRoom(room.code,guest.token);
    for(let i=0;i<3;i++) {
      now+=200;
      const result=engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId)+1);
      assert.equal(result.correct,false);
      assert.equal(result.room.cooldownUntil,i===2 ? now+5000 : 0);
      assert.equal(result.room.players[0].score,0);
      assert.equal(result.room.reveal,null);
    }
    const until=now+5000;
    now+=200;
    assert.throws(()=>engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId)),/Bloqueio/);
    const blocked=engine.readRoom(room.code,host.token);
    assert.equal(blocked.cooldownUntil,until);
    assert.equal(blocked.players[0].xp,0);
    assert.equal(blocked.players[0].score,0);
    assert.equal(blocked.equation!.id,room.equation!.id);
    const opponent=engine.answerRoom(room.code,guest.token,other.equation!.id,answer(guest.playerId));
    assert.equal(opponent.room.players[1].score,1);
    assert.equal(engine.readRoom(room.code,host.token).equation!.id,room.equation!.id);
    now=until-1;
    assert.throws(()=>engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId)),/Bloqueio/);
    now=until;
    assert.equal(engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId)).correct,true);
  } finally {Date.now=realNow;}
});

test("janela de erros é estritamente menor que 5s e respostas infinitas são rejeitadas",()=>{
  const realNow=Date.now;
  let now=100000;
  Date.now=()=>now;
  try {
    const {engine,host,room,answer}=match();
    const wrong=()=>engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId)+1);
    wrong();
    now+=2500; wrong();
    now+=2500;
    assert.equal(wrong().room.cooldownUntil,0);
    now+=200;
    assert.throws(()=>engine.answerRoom(room.code,host.token,room.equation!.id,Infinity),/válido/);
    assert.equal(wrong().room.cooldownUntil,now+5000);
  } finally {Date.now=realNow;}
});

test("acerto e troca de questão não apagam erros ainda dentro da janela",()=>{
  const realNow=Date.now;
  let now=100000;
  Date.now=()=>now;
  try {
    const {engine,host,room,answer}=match();
    engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId)+1);
    now+=200;
    engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId));
    now+=650;
    const next=engine.readRoom(room.code,host.token);
    now+=200;
    engine.answerRoom(room.code,host.token,next.equation!.id,answer(host.playerId)+1);
    now+=200;
    const blocked=engine.answerRoom(room.code,host.token,next.equation!.id,answer(host.playerId)+1);
    assert.equal(blocked.room.cooldownUntil,now+5000);
    assert.equal(blocked.room.players[0].score,1);
  } finally {Date.now=realNow;}
});

test("tempo configurado determina prazo e XP, só a meta de acertos encerra a corrida",()=>{
  const realNow=Date.now;
  let now=100000;
  Date.now=()=>now;
  try {
    const settings={...DEFAULT_SETTINGS,mode:["geometry","linear"] as const,seconds:10,rounds:5};
    const {engine,host,guest,room,answer}=match({...settings,mode:[...settings.mode]});
    assert.equal(room.endsAt-now,10000);
    let current=room;
    for(let i=0;i<5;i++) {
      assert.equal(current.equation!.mode,i%2 ? "linear":"geometry");
      now+=1000;
      const solved=engine.answerRoom(room.code,host.token,current.equation!.id,answer(host.playerId)).room;
      assert.equal(solved.reveal!.xp,roundXp(1,{...settings,mode:[...settings.mode]}));
      assert.equal(solved.players[0].score,i+1);
      assert.equal(solved.players[1].score,0);
      if(i<4) {
        assert.equal(solved.status,"playing");
        now+=650;
        current=engine.readRoom(room.code,host.token);
      } else {
        assert.equal(solved.status,"finished");
        assert.equal(solved.winnerId,host.playerId);
      }
    }
    const other=engine.readRoom(room.code,guest.token);
    assert.throws(()=>engine.answerRoom(room.code,guest.token,other.equation!.id,answer(guest.playerId)),/encerrada/);
    const restarted=engine.startRoom(room.code,host.token);
    assert.ok(restarted.players.every((p)=>p.score===0 && p.xp===0));
    assert.equal(restarted.cooldownUntil,0);
    assert.equal(restarted.round,1);
  } finally {Date.now=realNow;}
});

test("tempo esgotado mantém a questão sem gabarito; só o acerto avança, sem XP",()=>{
  const realNow=Date.now;
  let now=100000;
  Date.now=()=>now;
  try {
    const {engine,host,guest,room,answer}=match({...DEFAULT_SETTINGS,seconds:5});
    assert.equal("skipRoom" in engine,false);
    now+=60000;
    const expired=engine.readRoom(room.code,host.token);
    assert.equal(expired.equation!.id,room.equation!.id);
    assert.equal(expired.round,1);
    assert.equal(expired.reveal,null);
    assert.equal(expired.nextAt,null);
    assert.equal("answer" in expired.equation!,false);
    const wrong=engine.answerRoom(room.code,host.token,expired.equation!.id,answer(host.playerId)+1);
    assert.equal(wrong.correct,false);
    assert.equal(wrong.room.equation!.id,room.equation!.id);
    now+=200;
    const solved=engine.answerRoom(room.code,host.token,expired.equation!.id,answer(host.playerId));
    assert.equal(solved.correct,true);
    assert.equal(solved.room.players[0].score,1);
    assert.equal(solved.room.reveal!.xp,0);
    now+=650;
    const next=engine.readRoom(room.code,host.token);
    assert.equal(next.round,2);
    assert.notEqual(next.equation!.id,room.equation!.id);
    assert.throws(()=>engine.answerRoom(room.code,host.token,room.equation!.id,answer(host.playerId)),/encerrada/);
    assert.equal(next.status,"playing");
    assert.ok(next.players.every((p)=>p.xp===0));
    engine.leaveRoom(room.code,host.token);
    const alone=engine.readRoom(room.code,guest.token);
    assert.equal(alone.hostId,guest.playerId);
    assert.equal(alone.winnerId,guest.playerId);
    assert.equal(alone.status,"finished");
    engine.leaveRoom(room.code,guest.token);
    assert.equal(engine.exportRoom(room.code),null);
  } finally {Date.now=realNow;}
});

test("upgrade de sala antiga conserva sessão e progresso sem expor os dados privados",()=>{
  const {engine,host,room,state}=match({...DEFAULT_SETTINGS,mode:"geometry"});
  const saved=state();
  const equation=saved.players[0].equation!;
  const legacy={
    ...saved,version:undefined,round:1,equation,endsAt:room.endsAt,nextAt:null,
    players:saved.players.map(({id,name,token,lastAnswer})=>({id,name,token,lastAnswer,score:2})),
  };
  const restored=createRoomEngine(legacy as unknown as Room);
  const snapshot=restored.readRoom(room.code,host.token);
  assert.equal(snapshot.players[0].score,2);
  assert.equal(snapshot.players[0].xp,0);
  assert.deepEqual(snapshot.equation!.geometry,equation.geometry);
  assert.equal("answer" in snapshot.equation!,false);
  assert.equal(snapshot.equation!.formula,equation.formula);
  assert.equal("token" in snapshot.players[0],false);
  assert.equal(restored.exportRoom(room.code)!.version,2);
  assert.ok(engine.exportRoom(room.code));
});

test("salas salvas com expiração antiga retomam a mesma questão até acertar",()=>{
  const realNow=Date.now;
  let now=100000;
  Date.now=()=>now;
  try {
    const {host,room,state}=match({...DEFAULT_SETTINGS,seconds:5});
    const saved=state();
    const player=saved.players[0];
    const equation=player.equation!;
    player.reveal={answer:equation.answer,explanation:equation.explanation,xp:0,correct:false};
    player.nextAt=now+100;
    now+=10000;
    const engine=createRoomEngine(saved);
    const restored=engine.readRoom(room.code,host.token);
    assert.equal(restored.equation!.id,equation.id);
    assert.equal(restored.round,1);
    assert.equal(restored.reveal,null);
    assert.equal(restored.nextAt,null);
    const correct=engine.answerRoom(room.code,host.token,equation.id,equation.answer);
    assert.equal(correct.correct,true);
    assert.equal(correct.room.reveal!.xp,0);
  } finally {Date.now=realNow;}
});
