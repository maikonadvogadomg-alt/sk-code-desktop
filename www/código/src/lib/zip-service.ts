import JSZip from "jszip";
import { saveAs } from "file-saver";

// ── Extensões binárias (não decodificar como texto) ────────────────────────
const BINARY_EXTS = new Set([
  "png","jpg","jpeg","gif","webp","ico","bmp","tiff","tif","avif",
  "pdf","zip","tar","gz","bz2","xz","7z","rar","wasm",
  "exe","dll","so","dylib","apk","dex","class","jar","aar",
  "ttf","otf","woff","woff2","eot",
  "mp3","mp4","wav","ogg","flac","webm","mov","avi","mkv","aac",
  "bin","dat","db","sqlite","sqlite3","pak","img","iso",
]);

function isBinaryPath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return BINARY_EXTS.has(ext);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Conteúdo binário é armazenado como "__binary__:<base64>"
export function isBinaryContent(content: string): boolean {
  return content.startsWith("__binary__:");
}

export function getBinaryBytes(content: string): Uint8Array {
  return base64ToUint8(content.slice("__binary__:".length));
}

export function makeBinaryContent(bytes: Uint8Array): string {
  return "__binary__:" + uint8ToBase64(bytes);
}

// ── Exportar como ZIP ─────────────────────────────────────────────────────────
export async function exportAsZip(
  files: Record<string, string>,
  projectName: string = "projeto"
): Promise<void> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    if (isBinaryContent(content)) {
      zip.file(path, getBinaryBytes(content));
    } else {
      zip.file(path, content);
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${projectName}.zip`);
}

// ── Gerar ZIP como base64 (para enviar ao Drive) ───────────────────────────
export async function generateZipBase64(
  files: Record<string, string>
): Promise<string> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    if (isBinaryContent(content)) {
      zip.file(path, getBinaryBytes(content));
    } else {
      zip.file(path, content);
    }
  }
  const uint8 = await zip.generateAsync({ type: "uint8array" });
  return uint8ToBase64(uint8);
}

// ── Importar de qualquer arquivo ──────────────────────────────────────────────
export async function importFromZip(
  file: File
): Promise<Record<string, string>> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".tar.gz") || name.endsWith(".tgz") || name.endsWith(".tar")) {
    return importFromTar(file);
  }

  if (name.endsWith(".zip")) {
    return importFromZipFile(file);
  }

  // Qualquer outro arquivo: importa diretamente como arquivo único
  return importSingleFile(file);
}

// ── Importar arquivo único (não-arquivo) ──────────────────────────────────────
async function importSingleFile(file: File): Promise<Record<string, string>> {
  const path = file.name;
  if (isBinaryPath(path)) {
    const buf = await file.arrayBuffer();
    return { [path]: makeBinaryContent(new Uint8Array(buf)) };
  }
  try {
    const text = await file.text();
    return { [path]: text };
  } catch {
    const buf = await file.arrayBuffer();
    return { [path]: makeBinaryContent(new Uint8Array(buf)) };
  }
}

// ── Importar de ZIP ───────────────────────────────────────────────────────────
async function importFromZipFile(
  file: File
): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(file);
  const files: Record<string, string> = {};
  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      const binary = isBinaryPath(relativePath);
      const promise = binary
        ? zipEntry.async("uint8array").then((bytes) => {
            files[relativePath] = makeBinaryContent(bytes);
          })
        : zipEntry
            .async("string")
            .then((content) => {
              files[relativePath] = content;
            })
            .catch(() =>
              zipEntry.async("uint8array").then((bytes) => {
                files[relativePath] = makeBinaryContent(bytes);
              })
            );
      promises.push(promise);
    }
  });

  await Promise.all(promises);
  return stripTopLevelFolder(files);
}

// ── Importar de TAR / TAR.GZ ──────────────────────────────────────────────────
async function importFromTar(file: File): Promise<Record<string, string>> {
  const name = file.name.toLowerCase();
  const raw = await file.arrayBuffer();
  let tarBuffer: ArrayBuffer;

  if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) {
    tarBuffer = await decompressGzip(raw);
  } else {
    tarBuffer = raw;
  }

  return parseTar(tarBuffer);
}

// Descompressão gzip usando DecompressionStream nativo do browser
async function decompressGzip(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(new Uint8Array(compressed));
  writer.close();
  return new Response(stream.readable).arrayBuffer();
}

// Parser tar puro em JavaScript (formato POSIX/ustar) — sem limite de tamanho
function parseTar(buffer: ArrayBuffer): Record<string, string> {
  const bytes = new Uint8Array(buffer);
  const files: Record<string, string> = {};
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let offset = 0;

  const readStr = (start: number, len: number) =>
    decoder.decode(bytes.slice(start, start + len)).replace(/\0+$/, "").trim();

  const parseOctal = (start: number, len: number) =>
    parseInt(readStr(start, len) || "0", 8) || 0;

  while (offset + 512 <= bytes.length) {
    const header = offset;

    if (bytes[header] === 0 && bytes[header + 1] === 0) {
      offset += 512;
      continue;
    }

    let name = readStr(header, 100);
    const typeflag = readStr(header + 156, 1);
    const size = parseOctal(header + 124, 12);

    const prefix = readStr(header + 345, 155);
    if (prefix) name = prefix + "/" + name;

    offset += 512;

    const isRegularFile = typeflag === "0" || typeflag === "" || typeflag === "\0";

    if (isRegularFile && size > 0 && name) {
      const fileBytes = bytes.slice(offset, offset + size);
      const cleanName = name.replace(/^\.\//, "");
      if (cleanName && !cleanName.endsWith("/")) {
        if (isBinaryPath(cleanName)) {
          files[cleanName] = makeBinaryContent(fileBytes);
        } else {
          files[cleanName] = decoder.decode(fileBytes);
        }
      }
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return stripTopLevelFolder(files);
}

// Remove pasta raiz única se todos os arquivos estiverem dentro dela
// Ex: "meu-projeto/src/index.ts" → "src/index.ts"
function stripTopLevelFolder(files: Record<string, string>): Record<string, string> {
  const keys = Object.keys(files);
  if (keys.length === 0) return files;

  const firstSlash = keys[0].indexOf("/");
  if (firstSlash <= 0) return files;

  const prefix = keys[0].slice(0, firstSlash + 1);
  const allHavePrefix = keys.every(k => k.startsWith(prefix));

  if (!allHavePrefix) return files;

  const topLevel = prefix.slice(0, -1);
  const isTechnicalFolder = ["src", "public", "lib", "dist", "components", "pages", "app"].includes(topLevel);
  if (isTechnicalFolder) return files;

  const stripped: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    stripped[k.slice(prefix.length)] = v;
  }
  return stripped;
}
