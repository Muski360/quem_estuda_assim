import { createRoom, runRoomCommand } from "@/lib/multiplayer/supabase-store";
import { RoomError } from "@/lib/multiplayer/store";
import { isGameSettings } from "@/lib/math/generator";

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const token = (request: Request) =>
  request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
const validCode = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{6}$/i.test(value);
function failure(error: unknown) {
  if (error instanceof RoomError)
    return json({ error: error.message }, error.status);
  if (error instanceof SyntaxError)
    return json({ error: "JSON inválido." }, 400);
  console.error("Rooms API:", error);
  return json(
    { error: "Não foi possível acessar a sala. Tente novamente." },
    500,
  );
}

export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get("code");
    if (!validCode(code))
      throw new RoomError("Informe um código de sala válido.");
    return json(await runRoomCommand({ action: "read", code }, token(request)));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 2048)
      throw new RoomError("Requisição muito grande.", 413);
    const text = await request.text();
    if (text.length > 2048)
      throw new RoomError("Requisição muito grande.", 413);
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new RoomError("Requisição inválida.");
    const data = body as Record<string, unknown>;
    if (data.action === "create") {
      if (typeof data.name !== "string" || !isGameSettings(data.settings))
        throw new RoomError("Configuração de partida inválida.");
      return json(await createRoom(data.name, data.settings), 201);
    }
    if (!validCode(data.code))
      throw new RoomError("Informe um código de sala válido.");
    switch (data.action) {
      case "join":
        if (typeof data.name !== "string")
          throw new RoomError("Informe seu nome.");
        return json(
          await runRoomCommand(
            { action: "join", code: data.code, name: data.name },
            token(request),
          ),
        );
      case "start":
        return json(
          await runRoomCommand(
            { action: "start", code: data.code },
            token(request),
          ),
        );
      case "skip":
        throw new RoomError("No multiplayer, resolva corretamente a questão para avançar.");
      case "answer":
        if (
          typeof data.equationId !== "string" ||
          data.equationId.length > 100 ||
          typeof data.answer !== "number" ||
          !Number.isFinite(data.answer)
        )
          throw new RoomError("Resposta inválida.");
        return json(
          await runRoomCommand(
            {
              action: "answer",
              code: data.code,
              equationId: data.equationId,
              answer: data.answer,
            },
            token(request),
          ),
        );
      case "leave":
        return json(
          await runRoomCommand(
            { action: "leave", code: data.code },
            token(request),
          ),
        );
      default:
        throw new RoomError("Ação não reconhecida.");
    }
  } catch (error) {
    return failure(error);
  }
}
