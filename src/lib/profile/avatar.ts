import { avatarFileError } from "./profile";

export async function prepareAvatar(file: File): Promise<Blob> {
  const error = avatarFileError(file);
  if (error) throw new Error(error);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("Não foi possível abrir esta foto. Tente outro arquivo JPG, PNG ou WebP."); }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a foto neste navegador.");
    const size = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 512, 512);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível preparar a foto.")), "image/webp", 0.88,
    ));
  } finally { bitmap.close(); }
}
