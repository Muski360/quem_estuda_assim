import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";

export const SOURCE_COMMIT = "938c56fbd3b391e03d93316c920a90c3e54842e5";
const exec = promisify(execFile);
const source = resolve("output/enem-source");
const output = resolve("output/enem");
await mkdir(output, { recursive: true });
if (!await access(join(source, ".git")).then(() => true, () => false)) {
  await exec("git", ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", "https://github.com/yunger7/enem-api.git", source], { maxBuffer: 2 ** 20 });
  await exec("git", ["-C", source, "fetch", "--depth", "1", "origin", SOURCE_COMMIT], { maxBuffer: 2 ** 20 });
  await exec("git", ["-C", source, "checkout", "--detach", SOURCE_COMMIT], { maxBuffer: 2 ** 20 });
}
const { stdout } = await exec("git", ["-C", source, "rev-parse", "HEAD"]);
if (stdout.trim() !== SOURCE_COMMIT) throw new Error(`Use o commit ${SOURCE_COMMIT} no acervo. Nenhum arquivo foi sobrescrito.`);
const manifest = { commit: SOURCE_COMMIT, years: [] };
for (let year = 2009; year <= 2023; year++) {
  const page = `https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos/${year}`;
  const response = await fetch(page, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`INEP ${year}: HTTP ${response.status}`);
  const html = await response.text();
  const anchors = [...html.matchAll(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const links = [...new Set(anchors.filter(m => /gabarito/i.test(m[2]) && /download\.inep\.gov\.br/.test(m[1])).map(m => m[1].replaceAll("&amp;", "&")))];
  const selected = year === 2009 ? links.slice(0, 2) : [
    links.find(u => /(?:azul|_CD1\.pdf)/i.test(u)),
    links.find(u => /(?:azul|_CD7\.pdf)/i.test(u) && /(?:dia_?2|dia2|domingo|cad_7|caderno_?7|\b07_|_07_|_D2_|_CD7)/i.test(u)),
  ];
  if (!selected[0] || !selected[1] || selected[0] === selected[1]) throw new Error(`Verifique os cadernos azuis de ${year}: ${JSON.stringify(links)}`);
  const documents = [];
  for (const [index, url] of selected.entries()) {
    const file = join(output, `${year}-day${index + 1}.pdf`);
    const valid = await readFile(file).then(b => b.subarray(0, 4).toString() === "%PDF", () => false);
    if (!valid) {
      try {
        await exec(process.platform === "win32" ? "curl.exe" : "curl", ["--fail", "--silent", "--show-error", "--location", "--retry", "2", "--max-time", "45", "--output", file, url], { timeout: 150000 });
      } catch {
        // Some older INEP downloads reset TLS connections; the same public archive also serves HTTP.
        const pdf = await fetch(url.replace("https://download.inep.gov.br/", "http://download.inep.gov.br/"), { signal: AbortSignal.timeout(45000) });
        if (!pdf.ok) throw new Error(`INEP PDF ${year}: HTTP ${pdf.status}`);
        await writeFile(file, Buffer.from(await pdf.arrayBuffer()));
      }
      if (!(await readFile(file)).subarray(0, 4).equals(Buffer.from("%PDF"))) throw new Error(`PDF inválido: ${url}`);
    }
    documents.push({ day: index + 1, url, file: `${year}-day${index + 1}.pdf` });
  }
  manifest.years.push({ year, page, documents });
  await writeFile(join(output, "official-sources.json"), JSON.stringify(manifest, null, 2));
  console.log(`${year}: documentos oficiais disponíveis`);
}
