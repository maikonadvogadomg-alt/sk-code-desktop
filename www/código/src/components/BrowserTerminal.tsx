/**
 * BrowserTerminal — Terminal 100% no navegador
 * Sem servidor, sem WebSocket, 100% standalone.
 * Funciona em APK Android WebView, navegador offline, qualquer ambiente.
 *
 * Recursos:
 * - Comandos VFS: ls, cat, write, mkdir, rm, mv, cp, pwd, cd, clear, help
 * - JavaScript REPL: node <arquivo> ou js: <código>
 * - npm install <pkg> → carrega via esm.sh (gratuito)
 * - curl/fetch <url> → proxy CORS gratuito em cascata
 * - Timeout padrão: 5 min | npm install: 15 min
 * - Conexão mantida até operação completar
 */

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import type { VirtualFileSystem } from "@/lib/virtual-fs";

interface Props {
  vfs?: VirtualFileSystem;
  externalCommand?: string;
  onCommandExecuted?: () => void;
  onCommandOutput?: (cmd: string, output: string, exitedClean: boolean) => void;
  onServerToggle?: (running: boolean, port?: number) => void;
  onBufferUpdate?: (buffer: string, hasError: boolean) => void;
}

/* ── Detecção de ambiente ───────────────────────────────────────────────────── */
// No APK (file://), o WebView já permite requisições diretas — sem proxy.
// No navegador (https://), usa proxy CORS como fallback.
const IS_APK = typeof window !== "undefined" && (
  window.location.protocol === "file:" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
);

const PROXIES: Array<(u: string) => string> = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

async function corsGet(url: string, timeoutMs = 300_000): Promise<string> {
  // APK: requisição direta, sem proxy
  if (IS_APK) {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (r.ok) return await r.text();
    throw new Error(`HTTP ${r.status}`);
  }
  // Navegador: tenta proxy CORS em cascata
  let lastErr: unknown;
  for (const proxy of PROXIES) {
    try {
      const r = await fetch(proxy(url), { signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok) return await r.text();
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Falha na requisição: ${(lastErr as Error)?.message ?? "desconhecido"}`);
}

/* ── Módulos carregados dinamicamente via esm.sh ────────────────────────────── */
const loadedModules: Record<string, unknown> = {};

async function loadModule(pkg: string): Promise<unknown> {
  if (loadedModules[pkg]) return loadedModules[pkg];
  const clean = pkg.replace(/^@/, "").replace(/\//g, "__");
  const url = `https://esm.sh/${pkg}`;
  const mod = await import(/* @vite-ignore */ url);
  loadedModules[pkg] = mod.default ?? mod;
  loadedModules[clean] = loadedModules[pkg];
  return loadedModules[pkg];
}

/* ── ANSI helpers ──────────────────────────────────────────────────────────── */
const C = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  green: "\x1b[32m",
  cyan:  "\x1b[36m",
  yellow:"\x1b[33m",
  red:   "\x1b[31m",
  blue:  "\x1b[34m",
  mag:   "\x1b[35m",
  gray:  "\x1b[90m",
  white: "\x1b[97m",
};
const ok    = (s: string) => `${C.green}${s}${C.reset}`;
const err   = (s: string) => `${C.red}${s}${C.reset}`;
const info  = (s: string) => `${C.cyan}${s}${C.reset}`;
const warn  = (s: string) => `${C.yellow}${s}${C.reset}`;
const dim   = (s: string) => `${C.dim}${s}${C.reset}`;

const HELP = `
${C.bold}${C.cyan}╔══════════════════════════════════════════════╗
║      SK Code Editor — Terminal Embutido      ║
║  Sem servidor · Standalone · 100% Gratuito   ║
╚══════════════════════════════════════════════╝${C.reset}

${C.bold}Arquivos (VFS — Virtual File System):${C.reset}
  ${ok("ls")} [pasta]         Listar arquivos
  ${ok("cat")} <arquivo>      Ver conteúdo
  ${ok("echo")} texto         Imprimir texto
  ${ok("mkdir")} pasta        Criar pasta (prefixo)
  ${ok("rm")} <arquivo>       Apagar arquivo
  ${ok("mv")} <de> <para>     Renomear/mover
  ${ok("cp")} <de> <para>     Copiar arquivo
  ${ok("pwd")}                Diretório atual
  ${ok("cd")} <pasta>         Mudar diretório
  ${ok("find")} .txt          Buscar arquivos por extensão
  ${ok("wc")} <arquivo>       Contar linhas/palavras

${C.bold}JavaScript:${C.reset}
  ${ok("node")} <arquivo.js>  Executar arquivo JS do VFS
  ${ok("js:")} <código>       Executar código JS direto

${C.bold}Pacotes (carrega via esm.sh — gratuito):${C.reset}
  ${ok("npm install")} <pkg>  Carregar pacote via CDN
  ${ok("require")} <pkg>      Ver módulo carregado

${C.bold}HTTP (proxy CORS gratuito — 3 serviços):${C.reset}
  ${ok("curl")} <url>         GET via proxy CORS
  ${ok("fetch")} <url>        Mesmo que curl

${C.bold}Sistema:${C.reset}
  ${ok("clear")} / ${ok("cls")}        Limpar terminal
  ${ok("help")}                Este menu
  ${ok("env")}                 Info do ambiente
  ${ok("ls --json")}           Listar em formato JSON
`;

/* ══════════════════════════════════════════════════════════════════════════════
   BrowserTerminal Component
══════════════════════════════════════════════════════════════════════════════ */
export default function BrowserTerminal({
  vfs,
  externalCommand,
  onCommandExecuted,
  onCommandOutput,
  onBufferUpdate,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const termRef       = useRef<Terminal | null>(null);
  const fitAddonRef   = useRef<FitAddon | null>(null);
  const cwdRef        = useRef<string>("/");
  const inputLineRef  = useRef<string>("");
  const bufferRef     = useRef<string>("");
  const runningRef    = useRef(false);

  /* ── write helpers ────────────────────────────────────────────────────────── */
  const writeln = useCallback((s: string) => {
    termRef.current?.writeln(s);
    bufferRef.current += s.replace(/\x1b\[[^m]*m/g, "") + "\n";
    const hasErr = /error|erro|failed|falhou|ENOENT|Exception/i.test(bufferRef.current.slice(-4000));
    onBufferUpdate?.(bufferRef.current.slice(-50_000), hasErr);
  }, [onBufferUpdate]);

  const writePrompt = useCallback(() => {
    const cwd = cwdRef.current === "/" ? "~" : "~" + cwdRef.current;
    termRef.current?.write(`\r\n${C.green}${cwd}${C.reset} ${C.dim}$${C.reset} `);
    inputLineRef.current = "";
  }, []);

  /* ── VFS helpers ─────────────────────────────────────────────────────────── */
  const resolvePath = useCallback((p: string): string => {
    if (!p || p === ".") return cwdRef.current;
    if (p.startsWith("/")) return p.endsWith("/") ? p : p + "/";
    const base = cwdRef.current === "/" ? "" : cwdRef.current;
    const joined = base + "/" + p;
    // normalize
    const parts = joined.split("/").filter(Boolean);
    const stack: string[] = [];
    for (const part of parts) {
      if (part === "..") stack.pop();
      else if (part !== ".") stack.push(part);
    }
    return stack.length ? "/" + stack.join("/") + "/" : "/";
  }, []);

  const vfsFiles = useCallback((): string[] => {
    if (!vfs) return [];
    try { return vfs.listFiles(); } catch { return Object.keys((vfs as any).toJSON?.() ?? {}); }
  }, [vfs]);

  const vfsRead = useCallback((p: string): string | null => {
    if (!vfs) return null;
    const norm = p.startsWith("/") ? p.slice(1) : p;
    try { return (vfs as any).readFile?.(norm) ?? (vfs as any).toJSON?.()?.[norm] ?? null; }
    catch { return null; }
  }, [vfs]);

  const vfsWrite = useCallback((p: string, content: string): void => {
    if (!vfs) return;
    const norm = p.startsWith("/") ? p.slice(1) : p;
    try { (vfs as any).writeFile?.(norm, content); } catch {}
  }, [vfs]);

  const vfsDelete = useCallback((p: string): void => {
    if (!vfs) return;
    const norm = p.startsWith("/") ? p.slice(1) : p;
    try {
      if ((vfs as any).deleteFile) { (vfs as any).deleteFile(norm); return; }
      const json = (vfs as any).toJSON?.() ?? {};
      delete json[norm];
      (vfs as any).clear?.(); (vfs as any).fromJSON?.(json);
    } catch {}
  }, [vfs]);

  /* ── JS eval executor ────────────────────────────────────────────────────── */
  const evalJS = useCallback(async (code: string): Promise<{ out: string; ok: boolean }> => {
    const output: string[] = [];
    const cap = (...args: unknown[]) => output.push(args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" "));

    const proxyFetch = async (url: string, opts?: RequestInit) => {
      if (url.startsWith("http")) {
        // APK: requisição direta sem proxy
        if (IS_APK) {
          const r = await fetch(url, { signal: AbortSignal.timeout(300_000), ...opts });
          const text = await r.text();
          return { ok: r.ok, status: r.status, text: async () => text, json: async () => JSON.parse(text) };
        }
        // Navegador: tenta proxy CORS
        for (const proxy of PROXIES) {
          try {
            const r = await fetch(proxy(url), { signal: AbortSignal.timeout(300_000), ...opts });
            if (r.ok) {
              const text = await r.text();
              return { ok: true, status: r.status, text: async () => text, json: async () => JSON.parse(text) };
            }
          } catch {}
        }
        throw new Error("Requisição falhou para " + url);
      }
      return fetch(url, opts);
    };

    const _require = (pkg: string) => {
      const m = loadedModules[pkg] ?? loadedModules[pkg.replace(/^@/, "").replace(/\//g, "__")];
      if (!m) throw new Error(`Módulo '${pkg}' não carregado. Use: npm install ${pkg}`);
      return m;
    };

    const ctx = {
      console: { log: cap, error: cap, warn: cap, info: cap, dir: cap, table: cap },
      fetch: proxyFetch,
      require: _require,
      process: { env: {}, argv: [], version: "v18.0.0 (browser)" },
      __modules: loadedModules,
      setTimeout, clearTimeout, setInterval, clearInterval,
      btoa, atob, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Error,
      Promise, Map, Set, WeakMap, WeakSet, Symbol, Proxy, Reflect,
      encodeURIComponent, decodeURIComponent,
    };

    try {
      const fn = new Function(...Object.keys(ctx), `"use strict";\n${code}`);
      const res = await fn(...Object.values(ctx));
      if (res !== undefined && !output.length) output.push(String(res));
      return { out: output.join("\n"), ok: true };
    } catch (e: any) {
      return { out: e.message, ok: false };
    }
  }, []);

  /* ── Command executor ────────────────────────────────────────────────────── */
  const runCommand = useCallback(async (rawCmd: string): Promise<void> => {
    const line = rawCmd.trim();
    if (!line) return;

    runningRef.current = true;
    const [cmd, ...args] = line.split(/\s+/);
    const arg1 = args[0] ?? "";
    const arg2 = args[1] ?? "";
    const rest = args.join(" ");

    const outLines: string[] = [];
    let isErr = false;

    try {
      /* ─── clear / cls ─────────────────────────────────────────────────── */
      if (cmd === "clear" || cmd === "cls") {
        termRef.current?.clear();
        runningRef.current = false;
        writePrompt();
        return;
      }

      /* ─── help ────────────────────────────────────────────────────────── */
      if (cmd === "help" || cmd === "?") {
        HELP.split("\n").forEach(l => writeln(l));
        onCommandOutput?.("help", "help exibido", true);
        runningRef.current = false;
        writePrompt();
        return;
      }

      /* ─── env ─────────────────────────────────────────────────────────── */
      if (cmd === "env") {
        writeln(info("Terminal Browser — standalone, sem servidor"));
        writeln(dim(`  Plataforma: ${navigator.platform}`));
        writeln(dim(`  User Agent: ${navigator.userAgent.slice(0, 80)}`));
        writeln(dim(`  Pacotes carregados: ${Object.keys(loadedModules).join(", ") || "(nenhum)"}`));
        writeln(dim(`  Arquivos VFS: ${vfsFiles().length}`));
        writeln(dim(`  Dir atual: ${cwdRef.current}`));
        runningRef.current = false;
        writePrompt();
        return;
      }

      /* ─── pwd ─────────────────────────────────────────────────────────── */
      if (cmd === "pwd") {
        writeln(cwdRef.current);
        outLines.push(cwdRef.current);
      }

      /* ─── cd ──────────────────────────────────────────────────────────── */
      else if (cmd === "cd") {
        if (!arg1 || arg1 === "~") { cwdRef.current = "/"; writeln(ok("/")); }
        else { cwdRef.current = resolvePath(arg1); writeln(ok(cwdRef.current)); }
      }

      /* ─── ls ──────────────────────────────────────────────────────────── */
      else if (cmd === "ls" || cmd === "dir") {
        const files = vfsFiles();
        if (!files.length) { writeln(warn("(VFS vazio — importe um projeto primeiro)")); }
        else {
          const cwd = cwdRef.current === "/" ? "" : cwdRef.current.slice(1, -1);
          const json = args.includes("--json");
          const shown = new Set<string>();
          const entries: string[] = [];
          for (const f of files) {
            if (cwd && !f.startsWith(cwd + "/") && f !== cwd) continue;
            const rel = cwd ? f.slice(cwd.length + 1) : f;
            const dir = rel.includes("/") ? rel.split("/")[0] + "/" : null;
            const entry = dir ?? rel;
            if (shown.has(entry)) continue;
            shown.add(entry);
            entries.push(entry);
            if (!json) writeln(dir ? `${C.blue}${dim(entry)}${C.reset}` : entry);
          }
          if (json) writeln(JSON.stringify(entries, null, 2));
          if (!entries.length) writeln(warn("(pasta vazia)"));
          outLines.push(entries.join("\n"));
        }
      }

      /* ─── cat ─────────────────────────────────────────────────────────── */
      else if (cmd === "cat") {
        if (!arg1) { writeln(err("Uso: cat <arquivo>")); isErr = true; }
        else {
          const p = arg1.startsWith("/") ? arg1.slice(1) : (cwdRef.current === "/" ? "" : cwdRef.current.slice(1, -1) + "/") + arg1;
          const content = vfsRead(p);
          if (content === null) { writeln(err(`Arquivo não encontrado: ${arg1}`)); isErr = true; }
          else {
            content.split("\n").forEach(l => writeln(l));
            outLines.push(content);
          }
        }
      }

      /* ─── echo ────────────────────────────────────────────────────────── */
      else if (cmd === "echo") {
        const out = rest.replace(/^["']|["']$/g, "");
        writeln(out);
        outLines.push(out);
      }

      /* ─── mkdir ───────────────────────────────────────────────────────── */
      else if (cmd === "mkdir") {
        if (!arg1) { writeln(err("Uso: mkdir <pasta>")); isErr = true; }
        else {
          const placeholder = arg1 + "/.gitkeep";
          vfsWrite(placeholder, "");
          writeln(ok(`Pasta criada: ${arg1}/`));
          outLines.push("ok");
        }
      }

      /* ─── rm ──────────────────────────────────────────────────────────── */
      else if (cmd === "rm") {
        if (!arg1) { writeln(err("Uso: rm <arquivo>")); isErr = true; }
        else {
          const p = arg1.startsWith("/") ? arg1.slice(1) : arg1;
          vfsDelete(p);
          writeln(ok(`Removido: ${arg1}`));
        }
      }

      /* ─── mv ──────────────────────────────────────────────────────────── */
      else if (cmd === "mv") {
        if (!arg1 || !arg2) { writeln(err("Uso: mv <de> <para>")); isErr = true; }
        else {
          const content = vfsRead(arg1);
          if (content === null) { writeln(err(`Não encontrado: ${arg1}`)); isErr = true; }
          else { vfsWrite(arg2, content); vfsDelete(arg1); writeln(ok(`${arg1} → ${arg2}`)); }
        }
      }

      /* ─── cp ──────────────────────────────────────────────────────────── */
      else if (cmd === "cp") {
        if (!arg1 || !arg2) { writeln(err("Uso: cp <de> <para>")); isErr = true; }
        else {
          const content = vfsRead(arg1);
          if (content === null) { writeln(err(`Não encontrado: ${arg1}`)); isErr = true; }
          else { vfsWrite(arg2, content); writeln(ok(`Copiado: ${arg1} → ${arg2}`)); }
        }
      }

      /* ─── find ────────────────────────────────────────────────────────── */
      else if (cmd === "find") {
        const query = (arg1 || "").toLowerCase();
        const results = vfsFiles().filter(f => !query || f.toLowerCase().includes(query));
        if (!results.length) writeln(warn("Nenhum arquivo encontrado."));
        else results.forEach(f => writeln(f));
        outLines.push(results.join("\n"));
      }

      /* ─── wc ──────────────────────────────────────────────────────────── */
      else if (cmd === "wc") {
        if (!arg1) { writeln(err("Uso: wc <arquivo>")); isErr = true; }
        else {
          const content = vfsRead(arg1);
          if (!content) { writeln(err("Não encontrado: " + arg1)); isErr = true; }
          else {
            const lines = content.split("\n").length;
            const words = content.split(/\s+/).filter(Boolean).length;
            const chars = content.length;
            writeln(`${lines}\t${words}\t${chars}\t${arg1}`);
            outLines.push(`${lines} linhas, ${words} palavras, ${chars} chars`);
          }
        }
      }

      /* ─── node / run JS ───────────────────────────────────────────────── */
      else if (cmd === "node") {
        if (!arg1) { writeln(err("Uso: node <arquivo.js>")); isErr = true; }
        else {
          const p = arg1.startsWith("/") ? arg1.slice(1) : arg1;
          const code = vfsRead(p);
          if (code === null) { writeln(err(`Arquivo não encontrado: ${arg1}`)); isErr = true; }
          else {
            writeln(dim(`▶ Executando ${arg1}...`));
            const result = await evalJS(code);
            if (result.out) result.out.split("\n").forEach(l => writeln(result.ok ? l : err(l)));
            if (!result.ok) isErr = true;
            outLines.push(result.out);
          }
        }
      }

      /* ─── js: <inline code> ───────────────────────────────────────────── */
      else if (line.startsWith("js:")) {
        const code = line.slice(3).trim();
        writeln(dim("▶ Avaliando JS..."));
        const result = await evalJS(code);
        if (result.out) result.out.split("\n").forEach(l => writeln(result.ok ? l : err(l)));
        if (!result.ok) isErr = true;
        outLines.push(result.out);
      }

      /* ─── npm install ─────────────────────────────────────────────────── */
      else if ((cmd === "npm" && arg1 === "install") || cmd === "pnpm" || cmd === "yarn") {
        const pkgs = cmd === "npm" ? args.slice(1) : args;
        if (!pkgs.length) { writeln(warn("Uso: npm install <pacote>")); }
        else {
          for (const pkg of pkgs) {
            writeln(info(`📦 Carregando ${pkg} via esm.sh...`));
            writeln(dim("   (timeout: 15 minutos — aguarde a instalação completar)"));
            try {
              const mod = await Promise.race([
                loadModule(pkg),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Timeout 15min")), 900_000)),
              ]);
              const keys = typeof mod === "object" && mod ? Object.keys(mod as object).slice(0, 10).join(", ") : typeof mod;
              writeln(ok(`✅ ${pkg} carregado! Exports: ${keys}`));
              writeln(dim(`   Use: require('${pkg}') nos arquivos JS`));
              outLines.push(`${pkg} carregado`);
            } catch (e: any) {
              writeln(err(`❌ Falha ao carregar ${pkg}: ${e.message}`));
              isErr = true;
            }
          }
        }
      }

      /* ─── npm start / run dev / run build ─────────────────────────────── */
      else if (cmd === "npm" && (arg1 === "start" || arg1 === "run")) {
        const script = arg2 || "start";
        const pkgJson = vfsRead("package.json");
        if (!pkgJson) { writeln(warn("Nenhum package.json encontrado no projeto.")); }
        else {
          try {
            const pkg = JSON.parse(pkgJson);
            const scriptCmd = pkg.scripts?.[script];
            if (!scriptCmd) {
              writeln(warn(`Script '${script}' não encontrado em package.json`));
              writeln(dim("Scripts disponíveis: " + Object.keys(pkg.scripts ?? {}).join(", ")));
            } else {
              writeln(info(`▶ npm run ${script} → ${scriptCmd}`));
              writeln(warn("⚠ Execução de scripts Node.js nativos requer um ambiente desktop."));
              writeln(dim("  Para APK: use o menu Preview (🌐) para visualizar projetos HTML."));
              writeln(dim("  Para JS puro: use 'node index.js' se o arquivo for compatível com browser."));
            }
          } catch { writeln(err("package.json inválido")); isErr = true; }
        }
      }

      /* ─── curl / fetch <url> ──────────────────────────────────────────── */
      else if (cmd === "curl" || cmd === "fetch") {
        if (!arg1) { writeln(err("Uso: curl <url>")); isErr = true; }
        else {
          writeln(info(`🌐 GET ${arg1}`));
          writeln(dim("   Proxy CORS em cascata: allorigins → corsproxy → codetabs"));
          try {
            const res = await Promise.race([
              corsGet(arg1, 300_000),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Timeout 5min")), 300_000)),
            ]);
            const preview = res.slice(0, 2000);
            preview.split("\n").forEach(l => writeln(l));
            if (res.length > 2000) writeln(dim(`... (${res.length - 2000} chars omitidos)`));
            outLines.push(res.slice(0, 50_000));
          } catch (e: any) {
            writeln(err(`❌ ${e.message}`));
            isErr = true;
          }
        }
      }

      /* ─── require <pkg> ──────────────────────────────────────────────── */
      else if (cmd === "require") {
        const mod = loadedModules[arg1];
        if (!mod) { writeln(warn(`'${arg1}' não carregado. Execute: npm install ${arg1}`)); }
        else {
          const keys = typeof mod === "object" ? Object.keys(mod as object).slice(0, 20).join(", ") : typeof mod;
          writeln(ok(`Módulo '${arg1}': ${keys}`));
          outLines.push(keys);
        }
      }

      /* ─── python / pip ────────────────────────────────────────────────── */
      else if (cmd === "python" || cmd === "python3" || cmd === "pip" || cmd === "pip3") {
        writeln(warn("Python nativo não disponível no browser/APK."));
        writeln(info("Alternativas:"));
        writeln(dim("  • Pyodide (Python no browser via WASM) — ver manual"));
        writeln(dim("  • Use JavaScript para lógica no editor (node <arquivo.js>)"));
      }

      /* ─── write <file> <content> ─────────────────────────────────────── */
      else if (cmd === "write") {
        if (!arg1) { writeln(err("Uso: write <arquivo> <conteúdo>")); isErr = true; }
        else {
          const content = args.slice(1).join(" ").replace(/\\n/g, "\n");
          vfsWrite(arg1, content);
          writeln(ok(`Arquivo criado: ${arg1} (${content.length} chars)`));
        }
      }

      /* ─── Comando desconhecido ─────────────────────────────────────────── */
      else {
        writeln(err(`Comando não encontrado: ${cmd}`));
        writeln(dim("  Digite 'help' para ver todos os comandos disponíveis."));
        isErr = true;
      }

    } catch (e: any) {
      writeln(err(`Erro: ${e.message}`));
      isErr = true;
      outLines.push(e.message);
    }

    const out = outLines.join("\n");
    onCommandOutput?.(line, out, !isErr);
    runningRef.current = false;
    writePrompt();
  }, [writeln, writePrompt, resolvePath, vfsFiles, vfsRead, vfsWrite, vfsDelete, evalJS, onCommandOutput]);

  /* ── Setup xterm ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Fira Code","Cascadia Code","JetBrains Mono",monospace',
      theme: {
        background: "#141c0d", foreground: "#c8dda8", cursor: "#88c060",
        cursorAccent: "#141c0d", selectionBackground: "#3d5c28",
        black: "#141c0d", red: "#e06c75", green: "#88c060",
        yellow: "#e5c07b", blue: "#61afef", magenta: "#c678dd",
        cyan: "#56b6c2", white: "#abb2bf", brightBlack: "#5c6370",
        brightRed: "#e06c75", brightGreen: "#98c379", brightYellow: "#e5c07b",
        brightBlue: "#61afef", brightMagenta: "#c678dd", brightCyan: "#56b6c2", brightWhite: "#ffffff",
      },
      scrollback: 50000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;
    setTimeout(() => { try { fitAddon.fit(); } catch {} }, 60);

    const ro = new ResizeObserver(() => { try { fitAddon.fit(); } catch {} });
    ro.observe(containerRef.current);

    // Boas-vindas
    term.writeln(`${C.green}╔══════════════════════════════════════════════╗${C.reset}`);
    term.writeln(`${C.green}║  SK Code Editor — Terminal Embutido v2.0     ║${C.reset}`);
    term.writeln(`${C.green}║  ${C.dim}Sem servidor · Gratuito · Funciona em APK${C.green}  ║${C.reset}`);
    term.writeln(`${C.green}╚══════════════════════════════════════════════╝${C.reset}`);
    term.writeln(dim(IS_APK
      ? "  Modo APK: requisições diretas sem proxy · sem limite"
      : "  Modo browser: proxy CORS ativado como fallback"
    ));
    term.writeln(dim("  Pacotes: esm.sh (npm install <pkg>)  |  JS: node <arquivo.js>"));
    term.writeln(dim("  Digite 'help' para ver todos os comandos."));

    // Input handling
    let inputBuf = "";
    let histIndex = -1;
    const history: string[] = [];

    const flush = async () => {
      const line = inputBuf.trim();
      inputBuf = "";
      term.write("\r\n");
      if (line) {
        history.unshift(line);
        histIndex = -1;
        await runCommand(line);
      } else {
        writePrompt();
      }
    };

    term.onKey(({ key, domEvent }) => {
      const ev = domEvent;
      if (ev.key === "Enter") { flush(); return; }
      if (ev.key === "Backspace") {
        if (inputBuf.length > 0) {
          inputBuf = inputBuf.slice(0, -1);
          term.write("\b \b");
        }
        return;
      }
      if (ev.key === "ArrowUp") {
        if (histIndex < history.length - 1) {
          histIndex++;
          const h = history[histIndex] ?? "";
          term.write("\r\x1b[K");
          const cwd = cwdRef.current === "/" ? "~" : "~" + cwdRef.current;
          term.write(`${C.green}${cwd}${C.reset} ${C.dim}$${C.reset} ${h}`);
          inputBuf = h;
        }
        return;
      }
      if (ev.key === "ArrowDown") {
        if (histIndex > 0) {
          histIndex--;
          const h = history[histIndex] ?? "";
          term.write("\r\x1b[K");
          const cwd = cwdRef.current === "/" ? "~" : "~" + cwdRef.current;
          term.write(`${C.green}${cwd}${C.reset} ${C.dim}$${C.reset} ${h}`);
          inputBuf = h;
        }
        return;
      }
      if (ev.ctrlKey && ev.key === "c") {
        term.writeln("^C");
        inputBuf = "";
        writePrompt();
        return;
      }
      if (ev.ctrlKey && ev.key === "l") {
        term.clear();
        writePrompt();
        return;
      }
      if (key.length === 1) {
        inputBuf += key;
        term.write(key);
      }
    });

    writePrompt();

    return () => { ro.disconnect(); term.dispose(); termRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── External commands (from AI or toolbar) ─────────────────────────────── */
  useEffect(() => {
    if (!externalCommand || !termRef.current) return;
    const term = termRef.current;
    const lines = externalCommand.split("\n");
    for (const line of lines) {
      const display = line.slice(0, 120);
      term.writeln(`\r\n${C.gray}[externo]${C.reset} ${display}`);
    }
    runCommand(externalCommand.split("\n")[0] || externalCommand);
    onCommandExecuted?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCommand]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#141c0d" }}
    />
  );
}
