import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../../app/api/auth/config/route.ts";
import { authErrorMessage } from "./errors.ts";
import { safeReturnTo } from "./return-to.ts";

test("login do Lê volta ao jogo e continua rejeitando redirecionamento externo", () => {
  assert.equal(safeReturnTo("/le"), "/le");
  assert.equal(safeReturnTo("//example.com"), "/");
  assert.equal(safeReturnTo("https://example.com/le"), "/");
});

test("configuração de auth expõe apenas URL e chave pública, sem exigir segredo administrativo", async () => {
  const original = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY, secret: process.env.SUPABASE_SECRET_KEY };
  try {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.SUPABASE_SECRET_KEY = "must-not-be-public";
    const response = await GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { url: "https://example.supabase.co", key: "sb_publishable_test" });
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal((await GET()).status, 200);
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    const unavailable = await GET();
    assert.equal(unavailable.status, 503);
    assert.match((await unavailable.json()).error, /sem entrar/);
  } finally {
    for (const [key, value] of Object.entries({ SUPABASE_URL: original.url, SUPABASE_PUBLISHABLE_KEY: original.key, SUPABASE_SECRET_KEY: original.secret })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("erros de autenticação orientam correção sem expor mensagens do provedor", () => {
  assert.match(authErrorMessage({ code: "invalid_credentials" }), /incorretos/);
  assert.match(authErrorMessage({ code: "email_not_confirmed" }), /Confirme/);
  assert.match(authErrorMessage({ code: "weak_password" }), /8 caracteres/);
  assert.match(authErrorMessage({ code: "provider_disabled" }), /Google/);
  assert.match(authErrorMessage({ code: "flow_state_expired" }), /novo link/);
  assert.match(authErrorMessage({ code: "over_request_rate_limit" }), /Aguarde/);
  assert.doesNotMatch(authErrorMessage(new Error("sensitive details")), /sensitive/);
});
