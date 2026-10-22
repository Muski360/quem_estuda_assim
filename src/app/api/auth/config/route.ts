export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const headers = { "Cache-Control": "no-store" };
  if (!url || !key) {
    return Response.json(
      { error: "O login está temporariamente indisponível. Você pode continuar estudando sem entrar." },
      { status: 503, headers },
    );
  }
  return Response.json({ url, key }, { headers });
}
