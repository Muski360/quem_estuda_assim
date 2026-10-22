import type { User } from "@supabase/supabase-js";

export const PROFILE_COLORS = [
  { value: "#b54b2d", label: "Terracota" },
  { value: "#315ca8", label: "Azul" },
  { value: "#3f7152", label: "Verde" },
  { value: "#75549b", label: "Violeta" },
  { value: "#a74768", label: "Rosa" },
  { value: "#8c682f", label: "Ocre" },
] as const;
export const AVATAR_BUCKET = "qe-avatars";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function profileDetails(user: Pick<User, "email" | "user_metadata">) {
  const metadata = user.user_metadata;
  const name = [metadata.display_name, metadata.full_name, metadata.name, user.email?.split("@")[0]]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "Estudante";
  const candidate = Object.hasOwn(metadata, "profile_avatar_url") ? metadata.profile_avatar_url : metadata.avatar_url ?? metadata.picture;
  let avatarUrl = "";
  if (typeof candidate === "string") {
    try { if (new URL(candidate).protocol === "https:") avatarUrl = candidate; } catch { /* Invalid provider images use initials. */ }
  }
  return {
    name: normalizeDisplayName(name).slice(0, 60),
    color: PROFILE_COLORS.find(({ value }) => value === metadata.profile_color)?.value ?? PROFILE_COLORS[0].value,
    avatarUrl,
    avatarPath: typeof metadata.profile_avatar_path === "string" ? metadata.profile_avatar_path : "",
  };
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words.at(-1)![0] : (words[0] ?? "?").slice(0, 2)).toLocaleUpperCase("pt-BR");
}

export function avatarFileError(file: Pick<File, "type" | "size">): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Escolha uma foto JPG, PNG ou WebP.";
  if (file.size === 0 || file.size > MAX_AVATAR_BYTES) return "A foto precisa ter até 5 MB e não pode estar vazia.";
  return null;
}
