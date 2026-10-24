import assert from "node:assert/strict";
import { test } from "node:test";
import { avatarFileError, initials, MAX_AVATAR_BYTES, normalizeDisplayName, PROFILE_COLORS, profileDetails } from "./profile.ts";
import { EMPTY_STATS, isStudyActivity, newerStats, parsePendingActivities } from "./activity.ts";

test("perfil aproveita Google, respeita personalização e remove foto sem reativar a antiga", () => {
  const google = { email: "aluno@example.com", user_metadata: { full_name: "Ana Silva", avatar_url: "https://example.com/google.jpg" } };
  assert.equal(profileDetails(google).name, "Ana Silva");
  assert.equal(profileDetails(google).avatarUrl, "https://example.com/google.jpg");
  const custom = profileDetails({ ...google, user_metadata: { ...google.user_metadata, display_name: "  Ana   Souza  ", profile_color: PROFILE_COLORS[2].value, profile_avatar_url: null } });
  assert.equal(custom.name, "Ana Souza");
  assert.equal(custom.color, PROFILE_COLORS[2].value);
  assert.equal(custom.avatarUrl, "");
  assert.equal(profileDetails({ email: google.email, user_metadata: { avatar_url: "javascript:alert(1)", profile_color: "url(evil)" } }).avatarUrl, "");
  assert.equal(profileDetails({ email: google.email, user_metadata: { profile_color: "invalid" } }).color, PROFILE_COLORS[0].value);
  assert.equal(normalizeDisplayName("  Ana\n  Souza  "), "Ana Souza");
  assert.equal(initials("Ana Maria Souza"), "AS");
  assert.equal(initials("ana"), "AN");
});

test("foto aceita somente imagens suportadas até 5 MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.equal(avatarFileError({type,size:MAX_AVATAR_BYTES}), null);
  for (const type of ["image/svg+xml", "text/html", "application/pdf", ""]) assert.ok(avatarFileError({type,size:100}));
  for (const size of [0, MAX_AVATAR_BYTES + 1]) assert.ok(avatarFileError({type:"image/png",size}));
});

test("atividade exige UUID, modalidade conhecida e XP inteiro dentro dos limites", () => {
  const activity = { id: "12345678-1234-4000-8000-123456789abc", module: "scroll", xp: 45 };
  assert.equal(isStudyActivity(activity), true);
  assert.equal(isStudyActivity({ ...activity, module:"calculator", xp:60 }), true);
  for (const xp of [-1, 1.5, NaN, Infinity, 46, "10"]) assert.equal(isStudyActivity({ ...activity, xp }), false);
  for (const value of [null, {}, { ...activity, id:"fake" }, { ...activity, module:"other" }]) assert.equal(isStudyActivity(value), false);
  assert.equal(isStudyActivity({ ...activity, xp:0 }), true);
});

test("fila recuperada rejeita dados inválidos e deduplica eventos; respostas antigas não diminuem totais", () => {
  const activity = { id: "12345678-1234-4000-8000-123456789abc", module:"scroll", xp:10 };
  assert.deepEqual(parsePendingActivities(JSON.stringify([activity,activity,{...activity,id:"bad"} ])), [activity]);
  assert.deepEqual(parsePendingActivities(JSON.stringify(activity)), [activity]);
  for (const value of [null, "garbage", "{}", "null"]) assert.deepEqual(parsePendingActivities(value), []);
  const current = { scroll_questions:3, calculator_rounds:4, total_xp:60 };
  assert.equal(newerStats(current, EMPTY_STATS), current);
  assert.equal(newerStats(null, current), current);
  assert.equal(newerStats({ ...current, total_xp: 80 }, current).total_xp, 80, "Uma resposta antiga não desfaz o bônus de missão com a mesma contagem");
  assert.equal(newerStats(current, { ...current, total_xp: 80 }).total_xp, 80);
  assert.equal(isStudyActivity({ ...activity, module: "calculator", mode: "solo", correct: true, occurredAt: "2026-10-24T12:00:00Z" }), true);
  assert.equal(isStudyActivity({ ...activity, module: "calculator", mode: "solo" }), false);
});
