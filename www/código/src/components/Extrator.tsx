/**
 * Extrator Jurídico — componente React nativo
 * Sem iframe · Sem limite de tamanho · Varredura profunda de subpáginas
 * APK: fetch direto (sem proxy) · Browser: proxy CORS em cascata
 */
import { useState, useCallback, useRef } from "react";
import { ArrowLeft, Download, Copy, X, Search, RefreshCw, ExternalLink, FileText, Code2, Link, Globe, Layers, CheckCheck } from "lucide-react";
import { loadAISlots, getActiveSlot, sendAIMessage } from "@/lib/ai-service";

interface Props { onBack: () => void }

/* ── Tipos ──────────────────────────────────────────────────────────────────── */
interface ScriptItem  { i:number; full:string; size:number; hc:boolean; hf:boolean; ha:boolean }
interface AssetItem   { url:string; type:string; name:string }
interface LinkItem    { url:string; text:string; ext:boolean }
interface ApiItem     { url:string; path:string }
interface PageMeta    { title:string; desc:string; lang:string; gen:string; url:string }
interface PageResult  { url:string; html:string; meta:PageMeta; scripts:ScriptItem[]; assets:AssetItem[]; links:LinkItem[]; apis:ApiItem[]; tech:string[]; textContent:string }
interface ExtractResult {
  rootUrl: string; pages: PageResult[];
  scripts: ScriptItem[]; assets: AssetItem[]; links: LinkItem[]; apis: ApiItem[];
  tech: string[];
}
interface ModalState  { title:string; content:string }

/* ── Detecção de ambiente ────────────────────────────────────────────────────── */
const IS_APK = typeof window !== "undefined" && (
  window.location.protocol === "file:" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
);

// NativeFetch: ponte Java no APK — HTTP nativo sem CORS (injetado pelo MainActivity)
declare global { interface Window { NativeFetch?: { fetch(url:string, timeoutMs:number): string } } }

const PROXIES: Array<{ name:string; fn:(u:string)=>string }> = [
  { name:"allorigins.win", fn:u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { name:"corsproxy.io",   fn:u=>`https://corsproxy.io/?${encodeURIComponent(u)}` },
  { name:"codetabs.com",   fn:u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
];

async function fetchViaProxy(
  url: string,
  onStatus?: (msg:string)=>void,
  timeoutMs = 30_000
): Promise<string> {
  // APK + NativeFetch: HTTP via Java — zero CORS, funciona em qualquer site
  if (IS_APK && window.NativeFetch) {
    onStatus?.(`Buscando ${url.replace(/^https?:\/\//,"").slice(0,55)}…`);
    const result = window.NativeFetch.fetch(url, timeoutMs);
    if (result.startsWith("__ERR__:")) throw new Error(result.slice(8));
    if (!result || result.length < 10) throw new Error("Resposta vazia do servidor");
    return result;
  }
  // APK sem NativeFetch: fetch direto (fallback)
  if (IS_APK) {
    onStatus?.(`Conectando a ${url.replace(/^https?:\/\//,"").slice(0,55)}…`);
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  }
  // Browser: proxy cascade
  let lastErr: unknown;
  for (let i = 0; i < PROXIES.length; i++) {
    const p = PROXIES[i];
    try {
      onStatus?.(`Proxy ${i+1}/3: ${p.name}…`);
      const r = await fetch(p.fn(url), { signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status}`); continue; }
      const text = await r.text();
      if (text.length < 40) { lastErr = new Error("Resposta vazia"); continue; }
      return text;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Falha ao acessar o site: ${(lastErr as Error)?.message ?? "erro desconhecido"}`);
}

/* ── Parsers ────────────────────────────────────────────────────────────────── */
function parseMeta(html:string, base:string): PageMeta {
  const g = (p:RegExp) => (html.match(p)?.[1] ?? "").trim();
  return {
    title: g(/<title[^>]*>([^<]*)<\/title>/i),
    desc:  g(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
          || g(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i),
    lang:  g(/<html[^>]+lang=["']([^"']*)["']/i),
    gen:   g(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i),
    url:   base,
  };
}

function extractText(html:string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s{2,}/g," ").trim();
}

function parseScripts(html:string): ScriptItem[] {
  const out:ScriptItem[] = []; let m:RegExpExecArray|null; let idx=0;
  const p = /<script(?![^>]+src=)[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = p.exec(html)) !== null) {
    const c = (m[1] ?? "").trim();
    if (!c || c.length < 30) continue;
    const hc = /calc[uú]|c[aá]lculo|remuner|sal[aá]rio|benef[ií]cio|previdenci|inss|fator\s*previd|aposentad|pens[aã]o|corre[çc][aã]o|coeficiente|rmc|rma|segurado|competência|contrib|parcela|honorár|adiantamento|férias|rescisão|trabalhista/i.test(c);
    const hf = /Math\.|function\s+calc|=\s*[\d.]+\s*[*\/+\-]|parseFloat|parseInt|\.toFixed\(|f[oó]rmula|aliq|juros|amortiz|desconto/i.test(c);
    const ha = /fetch\s*\(|XMLHttpRequest|\.ajax\s*\(|axios\.|\.post\s*\(|\.get\s*\(/i.test(c);
    out.push({ i: idx++, full: c, size: c.length, hc, hf, ha });
  }
  return out;
}

function parseAssets(html:string, base:string): AssetItem[] {
  const seen = new Set<string>(), out:AssetItem[] = [];
  const rules: Array<[RegExp, string]> = [
    [/<script[^>]+src=["']([^"']+)["']/gi, "script"],
    [/<link[^>]+href=["']([^"']+\.css(?:[?#][^"']*)?)["']/gi, "stylesheet"],
    [/<img[^>]+src=["']([^"']+)["']/gi, "image"],
    [/<link[^>]+href=["']([^"']+\.(?:woff2?|ttf|otf|eot)(?:[?#][^"']*)?)["']/gi, "font"],
  ];
  for (const [p, t] of rules) {
    let m:RegExpExecArray|null; p.lastIndex=0;
    while ((m = p.exec(html)) !== null) {
      try {
        const s = m[1].trim();
        if (!s || s.startsWith("data:")) continue;
        const abs = s.startsWith("http") ? s : new URL(s, base).toString();
        if (!seen.has(abs)) { seen.add(abs); out.push({ url:abs, type:t, name: s.split("/").pop()?.split("?")[0] ?? s }); }
      } catch {}
    }
  }
  return out;
}

function parseLinks(html:string, base:string): LinkItem[] {
  const seen = new Set<string>(), out:LinkItem[] = [];
  let bh = "";
  try { bh = new URL(base).hostname; } catch {}
  let m:RegExpExecArray|null;
  const p = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = p.exec(html)) !== null) {
    try {
      const h = m[1].trim();
      if (!h || h.startsWith("javascript:") || h.startsWith("mailto:") || h.startsWith("tel:")) continue;
      const abs = h.startsWith("http") ? h : new URL(h, base).toString();
      if (!seen.has(abs)) {
        seen.add(abs);
        const txt = m[2].replace(/<[^>]+>/g,"").trim().slice(0,120);
        const ext = !!bh && new URL(abs).hostname !== bh;
        out.push({ url:abs, text:txt||"(sem texto)", ext });
      }
    } catch {}
  }
  return out;
}

function getSameOriginLinks(html:string, base:string): string[] {
  const seen = new Set<string>(), out:string[] = [];
  let bh = ""; try { bh = new URL(base).hostname; } catch {}
  let m:RegExpExecArray|null;
  const p = /href=["']([^"'#?][^"']*)["']/gi;
  while ((m = p.exec(html)) !== null) {
    try {
      const h = m[1].trim();
      if (!h || h.startsWith("javascript:")) continue;
      const abs = h.startsWith("http") ? h : new URL(h, base).toString();
      const u = new URL(abs);
      if (u.hostname !== bh) continue;
      const n = u.origin + u.pathname;
      if (!seen.has(n) && n !== base.split("?")[0]) { seen.add(n); out.push(n); }
    } catch {}
  }
  return out;
}

function parseApis(html:string, base:string): ApiItem[] {
  const out:ApiItem[] = [], seen = new Set<string>();
  const patterns = [
    /fetch\s*\(\s*['"`]([^'"`\s]+)['"`]/g,
    /['"`](\/api\/[^'"`\s?#]{2,})['"`]/g,
    /action=["']([^"']+\.(?:php|aspx|jsp|do)[^"']*)["']/gi,
  ];
  for (const pat of patterns) {
    let m:RegExpExecArray|null;
    while ((m = pat.exec(html)) !== null) {
      try {
        let u = m[1];
        if (u.startsWith("/")) u = new URL(u, base).toString();
        if (!u.startsWith("http")) continue;
        const k = new URL(u).pathname;
        if (!seen.has(k)) { seen.add(k); out.push({ url:u, path:k }); }
      } catch {}
    }
  }
  return out.slice(0, 100);
}

const TECH_SIG: Record<string, RegExp[]> = {
  "React":    [/react(?:\.min)?\.js/,/__REACT_/,/data-reactroot/],
  "Next.js":  [/__NEXT_DATA__/,/\/_next\/static/],
  "Vue.js":   [/vue(?:\.min)?\.js/,/__vue_/],
  "Angular":  [/angular(?:\.min)?\.js/,/ng-version/],
  "jQuery":   [/jquery(?:\.min)?\.js/,/\$\(document\)\.ready/],
  "Bootstrap":[/bootstrap(?:\.min)?\.css/],
  "WordPress":[/wp-content/,/wp-includes/],
  "Laravel":  [/laravel/,/_token.*csrf/],
  "PHP":      [/\.php/,/PHPSESSID/],
  "Tailwind": [/tailwindcss/],
  "ASP.NET":  [/__VIEWSTATE/,/\.aspx/],
};
function detectTech(html:string): string[] {
  return Object.entries(TECH_SIG).filter(([,pp])=>pp.some(p=>p.test(html))).map(([n])=>n);
}

function parsePage(html:string, url:string): PageResult {
  return {
    url, html,
    meta:    parseMeta(html, url),
    scripts: parseScripts(html),
    assets:  parseAssets(html, url),
    links:   parseLinks(html, url),
    apis:    parseApis(html, url),
    tech:    detectTech(html),
    textContent: extractText(html),
  };
}

function mergeResults(pages:PageResult[]): Omit<ExtractResult,"rootUrl"|"pages"> {
  const seenAsset = new Set<string>(), seenLink = new Set<string>(), seenApi = new Set<string>();
  const scripts:ScriptItem[] = [], assets:AssetItem[] = [], links:LinkItem[] = [], apis:ApiItem[] = [];
  const techSet = new Set<string>();
  let idx = 0;
  for (const pg of pages) {
    for (const s of pg.scripts) scripts.push({ ...s, i: idx++ });
    for (const a of pg.assets) { if (!seenAsset.has(a.url)) { seenAsset.add(a.url); assets.push(a); } }
    for (const l of pg.links)  { if (!seenLink.has(l.url))  { seenLink.add(l.url);  links.push(l); } }
    for (const a of pg.apis)   { if (!seenApi.has(a.path))  { seenApi.add(a.path);  apis.push(a); } }
    pg.tech.forEach(t => techSet.add(t));
  }
  return { scripts, assets, links, apis, tech: [...techSet] };
}

/* ── Helpers visuais ────────────────────────────────────────────────────────── */
const S = {
  bg:  "#0d1208", bg2: "#141c0d", bg3: "#1a2410", bg4: "#223018",
  grn: "#5fad3c", grn2:"#7dcf55", grn3:"#aed98a",
  gld: "#d4aa4e", gld2:"#f0c96a",
  txt: "#c8dda8", txt2:"#a0b880", txt3:"#6d8a50",
  red: "#e06c75", blu: "#56b6c2", pur: "#c678dd", org: "#d19a66",
  rad: 8,
} as const;

function Badge({ color, children }:{ color:string; children:React.ReactNode }) {
  const bgs: Record<string,string> = { grn:"rgba(95,173,60,.18)", gld:"rgba(212,170,78,.18)", blu:"rgba(86,182,194,.18)", pur:"rgba(198,120,221,.18)", red:"rgba(224,108,117,.18)", txt:"rgba(160,184,128,.08)" };
  const fgs: Record<string,string> = { grn:S.grn2, gld:S.gld2, blu:S.blu, pur:S.pur, red:S.red, txt:S.txt2 };
  return (
    <span style={{ background:bgs[color]??bgs.txt, color:fgs[color]??fgs.txt, padding:"2px 7px", borderRadius:10, fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

function CopyBtn({ text }:{ text:string }) {
  const [copied,setCopied] = useState(false);
  return (
    <button
      onClick={()=>{ navigator.clipboard?.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),1800); }}
      style={{ display:"flex",alignItems:"center",gap:4, background:S.bg3, border:`1px solid ${S.bg4}`, borderRadius:S.rad, padding:"4px 10px", color:S.txt2, fontSize:12, cursor:"pointer" }}
    >
      {copied ? <><CheckCheck size={12} color={S.grn2}/> Copiado!</> : <><Copy size={12}/> Copiar</>}
    </button>
  );
}

function dlBlob(content:string, name:string, mime="text/plain;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content],{ type:mime }));
  a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
}

const SHORTCUTS = [
  { label:"TJMG",  url:"https://www.tjmg.jus.br" },
  { label:"STJ",   url:"https://www.stj.jus.br" },
  { label:"STF",   url:"https://www.stf.jus.br" },
  { label:"TRT-3", url:"https://www.trt3.jus.br" },
  { label:"Calc.Jurídico", url:"https://www.calculojuridico.com.br" },
  { label:"JusBrasil", url:"https://www.jusbrasil.com.br" },
  { label:"Diário Oficial MG", url:"https://jornal.iof.mg.gov.br" },
  { label:"INSS",  url:"https://meu.inss.gov.br" },
  { label:"e-SAJ TJSP", url:"https://esaj.tjsp.jus.br" },
  { label:"TCU",   url:"https://portal.tcu.gov.br" },
];

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════════════════════ */
export default function Extrator({ onBack }: Props) {
  const [url,      setUrl]      = useState("");
  const [depth,    setDepth]    = useState(1);
  const [maxSub,   setMaxSub]   = useState(10);
  const [loading,  setLoading]  = useState(false);
  const [loadMsg,  setLoadMsg]  = useState("Conectando…");
  const [error,    setError]    = useState<string|null>(null);
  const [result,   setResult]   = useState<ExtractResult|null>(null);
  const [tab,      setTab]      = useState<"overview"|"text"|"scripts"|"assets"|"links"|"apis">("overview");
  const [scrFil,   setScrFil]   = useState<"all"|"calc"|"math"|"ajax">("all");
  const [modal,    setModal]    = useState<ModalState|null>(null);
  const [linkFil,  setLinkFil]  = useState("");
  const [linkExt,  setLinkExt]  = useState("");
  const [assFil,   setAssFil]   = useState("");
  const [assType,  setAssType]  = useState("");
  const [aiMsg,    setAiMsg]    = useState<{role:string;text:string}[]>([]);
  const [aiInput,  setAiInput]  = useState("");
  const [aiLoading,setAiLoad]   = useState(false);
  const [showAI,   setShowAI]   = useState(false);
  const abortRef = useRef<AbortController|null>(null);

  /* ── Extração ──────────────────────────────────────────────────────────── */
  const doExtract = useCallback(async () => {
    let rawUrl = url.trim();
    if (!rawUrl) return;
    if (!/^https?:\/\//i.test(rawUrl)) rawUrl = "https://" + rawUrl;

    setLoading(true); setError(null); setResult(null);
    abortRef.current = new AbortController();

    try {
      /* Página principal */
      setLoadMsg("Buscando página principal…");
      const html = await fetchViaProxy(rawUrl, setLoadMsg, 30_000);
      const root = parsePage(html, rawUrl);
      const pages: PageResult[] = [root];

      /* Subpáginas (depth >= 2) */
      if (depth >= 2) {
        const subUrls = getSameOriginLinks(html, rawUrl).slice(0, maxSub);
        let done = 0;
        for (const sub of subUrls) {
          if (abortRef.current?.signal.aborted) break;
          done++;
          setLoadMsg(`Subpágina ${done}/${subUrls.length}: ${sub.replace(/^https?:\/\//,"").slice(0,50)}…`);
          try {
            const sh = await fetchViaProxy(sub, undefined, 20_000);
            pages.push(parsePage(sh, sub));
          } catch { /* ignora subpáginas que falham */ }

          /* Profundidade 3 — sub-subpáginas (primeiras 3 subpáginas) */
          if (depth >= 3 && done <= 3) {
            const subSub = getSameOriginLinks(sh ?? "", sub).slice(0, 5);
            for (const ss of subSub) {
              if (abortRef.current?.signal.aborted) break;
              if (pages.some(p=>p.url===ss)) continue;
              setLoadMsg(`Profundo: ${ss.replace(/^https?:\/\//,"").slice(0,50)}…`);
              try {
                const ssh = await fetchViaProxy(ss, undefined, 15_000);
                pages.push(parsePage(ssh, ss));
              } catch {}
            }
          }
        }
      }

      const merged = mergeResults(pages);
      setResult({ rootUrl:rawUrl, pages, ...merged });
      setTab("overview");
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Erro desconhecido";
      setError(msg);
    } finally {
      setLoading(false); setLoadMsg("Conectando…");
    }
  // eslint-disable-next-line
  }, [url, depth, maxSub]);

  /* ── Carregar JS externo ──────────────────────────────────────────────── */
  const loadExternal = useCallback(async (fileUrl:string) => {
    setModal({ title:`Carregando ${fileUrl.split("/").pop() ?? fileUrl}…`, content:"⏳ Buscando via proxy CORS…" });
    try {
      let txt:string;
      try { const r = await fetch(fileUrl, { signal:AbortSignal.timeout(8000) }); txt = await r.text(); }
      catch { txt = await fetchViaProxy(fileUrl); }
      setModal({ title: fileUrl.split("/").pop() ?? fileUrl, content: txt });
    } catch (e: unknown) { setModal({ title:"Erro", content:`❌ ${(e as Error)?.message}` }); }
  }, []);

  /* ── IA ───────────────────────────────────────────────────────────────── */
  const sendAI = useCallback(async (extraCtx?:string) => {
    const q = aiInput.trim(); if (!q) return;
    setAiLoad(true);
    const txt = extraCtx ? q + "\n\nContexto:\n```javascript\n" + extraCtx + "\n```" : q;
    const newHistory = [...aiMsg, { role:"user", text:txt }];
    setAiMsg(newHistory); setAiInput("");
    const thinking = { role:"bot", text:"⏳ Analisando…" };
    setAiMsg(m=>[...m, thinking]);
    try {
      const slots = loadAISlots();
      const slot = getActiveSlot(slots) ?? slots.find(s=>s.apiKey) ?? null;
      if (!slot) throw new Error("Nenhuma chave de IA configurada. Configure em IA → Configurações.");
      const messages = newHistory.map(m=>({ role: m.role==="user"?"user":"assistant" as "user"|"assistant", content:m.text }));
      const SYS = `Você é Jasmim, assistente jurídica do advogado Maikon Caldeira (OAB/MG 183712). Analise o conteúdo extraído de sites jurídicos. Explique scripts de cálculo, fórmulas, índices e lógica jurídica. Responda em português, objetivo e técnico.`;
      const res = await sendAIMessage(messages, slot, SYS);
      setAiMsg(m=>[...m.slice(0,-1), { role:"bot", text:res }]);
    } catch (e:unknown) {
      setAiMsg(m=>[...m.slice(0,-1), { role:"bot", text:`❌ ${(e as Error)?.message}` }]);
    } finally { setAiLoad(false); }
  }, [aiInput, aiMsg]);

  /* ── Downloads ────────────────────────────────────────────────────────── */
  const dlScripts = () => {
    if (!result) return;
    const c = result.scripts.map((s,i)=>`/* ═══ SCRIPT #${i+1} | ${(s.size/1024).toFixed(1)}KB ═══ */\n\n${s.full}`).join("\n\n\n");
    dlBlob(c, `scripts-${new URL(result.rootUrl).hostname}.js`, "text/javascript");
  };
  const dlHtml = () => {
    if (!result?.pages[0]) return;
    dlBlob(result.pages[0].html, `pagina-${new URL(result.rootUrl).hostname}.html`, "text/html");
  };
  const dlText = () => {
    if (!result) return;
    const all = result.pages.map(p=>`\n${"═".repeat(60)}\nPÁGINA: ${p.url}\n${"═".repeat(60)}\n\n${p.textContent}`).join("\n\n");
    dlBlob(all, `texto-${new URL(result.rootUrl).hostname}.txt`);
  };
  const dlReport = () => {
    if (!result) return;
    const jur = result.scripts.filter(s=>s.hc||s.hf);
    const lines = [
      "RELATÓRIO — EXTRATOR JURÍDICO",
      `Advogado: Maikon Caldeira — OAB/MG 183712`,
      `Data: ${new Date().toLocaleString("pt-BR")}`,
      `URL: ${result.rootUrl}`,
      `Páginas varridas: ${result.pages.length}`,
      "",
      "═══ RESUMO ═══",
      `Scripts inline: ${result.scripts.length} (jurídicos: ${jur.length})`,
      `Arquivos externos: ${result.assets.length}`,
      `Links: ${result.links.length}`,
      `Rotas API: ${result.apis.length}`,
      `Tecnologias: ${result.tech.join(", ")||"—"}`,
      "",
      "═══ SCRIPTS JURÍDICOS ═══",
      ...jur.map((s,i)=>[
        `\n--- Script #${s.i+1} (${(s.size/1024).toFixed(1)}KB) ---`,
        `Cálculo:${s.hc?"SIM":"não"} | Fórmula:${s.hf?"SIM":"não"} | AJAX:${s.ha?"SIM":"não"}`,
        s.full,
      ].join("\n")),
      "",
      "═══ TEXTO DAS PÁGINAS ═══",
      ...result.pages.map(p=>`\n[${p.url}]\n${p.textContent.slice(0,5000)}`),
    ];
    dlBlob(lines.join("\n"), `relatorio-${new URL(result.rootUrl).hostname}.txt`);
  };

  /* ── Dados filtrados ──────────────────────────────────────────────────── */
  const filtScripts = result?.scripts.filter(s=>
    scrFil==="all"  ? true :
    scrFil==="calc" ? s.hc :
    scrFil==="math" ? s.hf : s.ha
  ) ?? [];

  const filtLinks = result?.links.filter(l=>
    (!linkFil || l.url.toLowerCase().includes(linkFil.toLowerCase()) || l.text.toLowerCase().includes(linkFil.toLowerCase())) &&
    (!linkExt  || (linkExt==="int"&&!l.ext)||(linkExt==="ext"&&l.ext))
  ) ?? [];

  const filtAssets = result?.assets.filter(a=>
    (!assFil  || a.url.toLowerCase().includes(assFil.toLowerCase()) || a.name.toLowerCase().includes(assFil.toLowerCase())) &&
    (!assType || a.type===assType)
  ) ?? [];

  /* ── Render ───────────────────────────────────────────────────────────── */
  const inp: React.CSSProperties = { background:S.bg3, border:`1px solid ${S.bg4}`, borderRadius:S.rad, padding:"8px 12px", color:S.txt, fontSize:13, outline:"none", width:"100%" };
  const btn = (col:string, textCol="#0d1208"): React.CSSProperties => ({
    background:col, color:textCol, border:"none", borderRadius:S.rad,
    padding:"8px 14px", fontSize:13, fontWeight:600, cursor:"pointer",
    display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap",
  });
  const tabBtn = (active:boolean): React.CSSProperties => ({
    padding:"7px 14px", border:"none", borderRadius:S.rad,
    background:active?S.bg3:"transparent", color:active?S.txt:S.txt3,
    fontSize:12, fontWeight:600, cursor:"pointer",
  });

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", flexDirection:"column", background:S.bg, fontFamily:"system-ui,sans-serif" }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div style={{ background:S.bg2, borderBottom:`1px solid ${S.bg4}`, padding:"0 16px", height:52, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <button onClick={onBack} style={{ ...btn(S.bg3,S.txt2), border:`1px solid ${S.bg4}` }}>
          <ArrowLeft size={14}/> Voltar
        </button>
        <span style={{ fontSize:15, fontWeight:800, color:S.grn2 }}>🔎 Extrator Jurídico</span>
        <span style={{ fontSize:11, color:S.txt3 }}>Maikon Caldeira OAB/MG 183712</span>
        <div style={{ flex:1 }}/>
        {result && (
          <>
            <button onClick={dlReport} style={{ ...btn(S.bg3,S.txt2), border:`1px solid ${S.bg4}`, fontSize:11 }}><Download size={12}/> Relatório</button>
            <button onClick={dlHtml}   style={{ ...btn(S.bg3,S.txt2), border:`1px solid ${S.bg4}`, fontSize:11 }}><Download size={12}/> HTML</button>
            <button onClick={dlText}   style={{ ...btn(S.bg3,S.txt2), border:`1px solid ${S.bg4}`, fontSize:11 }}><Download size={12}/> Texto</button>
            <button onClick={dlScripts}style={{ ...btn(S.bg3,S.txt2), border:`1px solid ${S.bg4}`, fontSize:11 }}><Download size={12}/> Scripts</button>
            <button onClick={()=>setShowAI(!showAI)} style={{ ...btn(showAI?S.grn:S.bg3, showAI?"#0d1208":S.txt2), border:`1px solid ${S.bg4}`, fontSize:11 }}>🤖 IA</button>
          </>
        )}
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflow:"auto", padding:"16px 20px 24px" }}>

        {/* Barra de busca */}
        <div style={{ background:S.bg2, border:`1px solid ${S.bg4}`, borderRadius:S.rad*1.5, padding:16, marginBottom:14 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <input
              value={url} onChange={e=>setUrl(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!loading&&doExtract()}
              placeholder="https://www.tjmg.jus.br ou calculojuridico.com.br"
              style={{ ...inp, flex:1, minWidth:200 }}
            />
            <select value={depth} onChange={e=>setDepth(Number(e.target.value))} style={{ ...inp, width:180 }}>
              <option value={1}>📄 Só a página principal</option>
              <option value={2}>📑 + Subpáginas ({maxSub} páginas)</option>
              <option value={3}>🔍 Varredura profunda (sub-subpáginas)</option>
            </select>
            {depth >= 2 && (
              <select value={maxSub} onChange={e=>setMaxSub(Number(e.target.value))} style={{ ...inp, width:130 }}>
                {[5,10,15,20,30].map(n=><option key={n} value={n}>{n} subpáginas</option>)}
              </select>
            )}
            <button
              onClick={loading ? ()=>{ abortRef.current?.abort(); setLoading(false); } : doExtract}
              style={btn(loading?"#e06c75":S.grn)}
            >
              {loading ? <><X size={14}/> Cancelar</> : <><Search size={14}/> Extrair</>}
            </button>
          </div>

          {/* Atalhos */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:10 }}>
            {SHORTCUTS.map(s=>(
              <button key={s.url} onClick={()=>{ setUrl(s.url); }} style={{ padding:"4px 10px", borderRadius:14, border:`1px solid ${S.bg4}`, background:S.bg3, color:S.txt2, fontSize:11, cursor:"pointer" }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Status/Loading */}
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:12 }}>
              <div style={{ width:16, height:16, border:`2px solid ${S.bg4}`, borderTopColor:S.grn, borderRadius:"50%", animation:"spin .7s linear infinite" }}/>
              <span style={{ fontSize:12, color:S.txt2 }}>{loadMsg}</span>
            </div>
          )}
          {error && (
            <div style={{ background:"rgba(224,108,117,.1)", border:`1px solid ${S.red}`, borderRadius:S.rad, padding:"10px 14px", marginTop:12, fontSize:12, color:S.red }}>
              ⚠️ {error}<br/>
              <span style={{ color:S.txt3, fontSize:11 }}>Dica: verifique a URL, tente sem www, ou tente outro site. Sites com Cloudflare/CAPTCHA podem bloquear proxies.</span>
            </div>
          )}
        </div>

        {/* Resultados */}
        {result && (
          <>
            {/* Abas */}
            <div style={{ background:S.bg2, border:`1px solid ${S.bg4}`, borderRadius:S.rad*1.5, padding:"10px 14px", marginBottom:14, display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
              {(["overview","text","scripts","assets","links","apis"] as const).map(t=>{
                const labels: Record<string,string> = { overview:"📊 Visão Geral", text:"📝 Texto", scripts:`⚖ Scripts (${result.scripts.length})`, assets:`📁 Arquivos (${result.assets.length})`, links:`🔗 Links (${result.links.length})`, apis:`🌐 APIs (${result.apis.length})` };
                return <button key={t} onClick={()=>setTab(t)} style={tabBtn(tab===t)}>{labels[t]}</button>;
              })}
              <span style={{ flex:1 }}/>
              <span style={{ fontSize:11, color:S.txt3 }}>{result.pages.length} página{result.pages.length!==1?"s":""} varrida{result.pages.length!==1?"s":""}</span>
            </div>

            {/* ── OVERVIEW ───────────────────────────────────────────── */}
            {tab==="overview" && (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:10, marginBottom:16 }}>
                  {[
                    { n:result.pages.length,   l:"Páginas",       c:S.grn2 },
                    { n:result.scripts.length, l:"Scripts inline", c:S.gld2 },
                    { n:result.scripts.filter(s=>s.hc||s.hf).length, l:"⚖ Jurídico", c:S.gld2 },
                    { n:result.assets.length,  l:"Arquivos",       c:S.blu },
                    { n:result.apis.length,    l:"Rotas API",      c:S.pur },
                    { n:result.links.filter(l=>l.ext).length, l:"Links ext.", c:S.txt2 },
                  ].map((st,i)=>(
                    <div key={i} style={{ background:S.bg2, border:`1px solid ${S.bg4}`, borderRadius:S.rad, padding:"12px 10px", textAlign:"center" }}>
                      <div style={{ fontSize:30, fontWeight:900, fontFamily:"monospace", color:st.c }}>{st.n}</div>
                      <div style={{ fontSize:10, color:S.txt3, marginTop:3 }}>{st.l}</div>
                    </div>
                  ))}
                </div>

                {result.pages.map((pg, pi)=>(
                  <div key={pi} style={{ background:S.bg2, border:`1px solid ${S.bg4}`, borderRadius:S.rad, padding:14, marginBottom:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:700, fontSize:13, color:S.grn2 }}>📄 {pi===0?"Página Principal":`Subpágina ${pi}`}</span>
                      <Badge color="grn">{pg.scripts.length} scripts</Badge>
                      <Badge color="blu">{pg.assets.length} assets</Badge>
                      {pg.tech.map(t=><Badge key={t} color="pur">{t}</Badge>)}
                    </div>
                    <div style={{ fontSize:12, color:S.txt3, marginBottom:4 }}>
                      <a href={pg.url} target="_blank" rel="noreferrer" style={{ color:S.blu }}>{pg.url}</a>
                    </div>
                    {pg.meta.title && <div style={{ fontSize:13, color:S.txt, marginBottom:2 }}>🏷 {pg.meta.title}</div>}
                    {pg.meta.desc && <div style={{ fontSize:11, color:S.txt3 }}>{pg.meta.desc.slice(0,200)}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* ── TEXTO COMPLETO ─────────────────────────────────────── */}
            {tab==="text" && (
              <div>
                {result.pages.map((pg, pi)=>(
                  <div key={pi} style={{ background:S.bg2, border:`1px solid ${S.bg4}`, borderRadius:S.rad, marginBottom:14, overflow:"hidden" }}>
                    <div style={{ background:S.bg3, padding:"10px 14px", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${S.bg4}` }}>
                      <FileText size={14} color={S.grn2}/>
                      <span style={{ fontSize:12, fontWeight:700, color:S.txt, flex:1 }}>{pg.meta.title||pg.url}</span>
                      <CopyBtn text={pg.textContent}/>
                    </div>
                    <div style={{ padding:14, fontSize:13, color:S.txt2, lineHeight:1.7, whiteSpace:"pre-wrap", wordBreak:"break-word", maxHeight:500, overflowY:"auto" }}>
                      {pg.textContent || "(sem conteúdo de texto)"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── SCRIPTS ──────────────────────────────────────────── */}
            {tab==="scripts" && (
              <div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                  {(["all","calc","math","ajax"] as const).map(f=>{
                    const labels = { all:"Todos", calc:"⚖ Cálculo", math:"📐 Fórmula", ajax:"🌐 AJAX" };
                    return <button key={f} onClick={()=>setScrFil(f)} style={{ ...tabBtn(scrFil===f), border:`1px solid ${scrFil===f?S.grn:S.bg4}` }}>{labels[f]}</button>;
                  })}
                  <span style={{ fontSize:11, color:S.txt3, marginLeft:6, alignSelf:"center" }}>
                    {filtScripts.length} script{filtScripts.length!==1?"s":""} · {result.scripts.filter(s=>s.hc||s.hf).length} jurídico{result.scripts.filter(s=>s.hc||s.hf).length!==1?"s":""}
                  </span>
                </div>

                {filtScripts.length===0 && <div style={{ textAlign:"center", padding:32, color:S.txt3, fontSize:13 }}>Nenhum script com esse filtro</div>}
                {filtScripts.map(s=>(
                  <div key={s.i} style={{ background:S.bg2, border:`1px solid ${s.hc||s.hf?S.gld:S.bg4}`, borderRadius:S.rad, marginBottom:12, overflow:"hidden" }}>
                    <div style={{ background:S.bg3, padding:"9px 14px", display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", borderBottom:`1px solid ${S.bg4}` }}>
                      <Badge color="txt">#{s.i+1}</Badge>
                      {s.hc && <Badge color="gld">⚖ Cálculo</Badge>}
                      {s.hf && <Badge color="pur">📐 Fórmula</Badge>}
                      {s.ha && <Badge color="grn">🌐 AJAX</Badge>}
                      <Badge color="txt">{(s.size/1024).toFixed(1)} KB · {s.size.toLocaleString()} chars</Badge>
                      <div style={{ flex:1 }}/>
                      <CopyBtn text={s.full}/>
                      <button onClick={()=>setModal({ title:`Script #${s.i+1} — ${(s.size/1024).toFixed(1)}KB`, content:s.full })} style={{ ...btn(S.bg4,S.txt2), fontSize:11, padding:"4px 10px" }}>
                        <Code2 size={11}/> Ver completo
                      </button>
                      <button onClick={()=>{ setShowAI(true); setAiInput(`Analise este script e explique o que calcula, fórmulas e lógica:\n\`\`\`js\n${s.full.slice(0,3000)}\n\`\`\``); }} style={{ ...btn(S.grn), fontSize:11, padding:"4px 10px" }}>
                        🤖 Analisar
                      </button>
                    </div>
                    <pre style={{ padding:12, fontSize:11, fontFamily:"monospace", color:"#79c0ff", whiteSpace:"pre-wrap", wordBreak:"break-all", lineHeight:1.6, margin:0, maxHeight:200, overflowY:"auto", background:S.bg }}>
                      {s.full.slice(0, 1200)}{s.full.length>1200 ? `\n\n… [mais ${(s.full.length-1200).toLocaleString()} chars — clique "Ver completo"]` : ""}
                    </pre>
                  </div>
                ))}

                {/* JS externos */}
                {result.assets.filter(a=>a.type==="script").length>0 && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:S.txt3, textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>
                      Arquivos .js externos ({result.assets.filter(a=>a.type==="script").length})
                    </div>
                    <div style={{ border:`1px solid ${S.bg4}`, borderRadius:S.rad, overflow:"hidden" }}>
                      {result.assets.filter(a=>a.type==="script").map((a,i)=>(
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderBottom:`1px solid ${S.bg4}`, fontSize:12 }}>
                          <Badge color="blu">JS</Badge>
                          <span style={{ flex:1, color:S.txt3, fontFamily:"monospace", fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={a.url}>{a.name||a.url}</span>
                          <button onClick={()=>loadExternal(a.url)} style={{ ...btn(S.bg4,S.txt2), fontSize:11, padding:"3px 8px" }}>👁 Ver tudo</button>
                          <a href={a.url} target="_blank" rel="noreferrer"><button style={{ ...btn(S.bg4,S.txt2), fontSize:11, padding:"3px 8px" }}><ExternalLink size={10}/></button></a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ASSETS ──────────────────────────────────────────────── */}
            {tab==="assets" && (
              <div>
                <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                  <input placeholder="Filtrar por nome…" value={assFil} onChange={e=>setAssFil(e.target.value)} style={{ ...inp, flex:1, minWidth:150, fontSize:12, padding:"6px 10px" }}/>
                  <select value={assType} onChange={e=>setAssType(e.target.value)} style={{ ...inp, width:160, fontSize:12, padding:"6px 10px" }}>
                    <option value="">Todos os tipos</option>
                    <option value="script">Scripts JS</option>
                    <option value="stylesheet">CSS</option>
                    <option value="image">Imagens</option>
                    <option value="font">Fontes</option>
                  </select>
                </div>
                <div style={{ border:`1px solid ${S.bg4}`, borderRadius:S.rad, overflow:"hidden" }}>
                  {filtAssets.length===0 && <div style={{ textAlign:"center", padding:24, color:S.txt3, fontSize:12 }}>Nenhum arquivo</div>}
                  {filtAssets.map((a,i)=>{
                    const icons: Record<string,string> = { script:"📜", stylesheet:"🎨", image:"🖼", font:"🔤" };
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderBottom:`1px solid ${S.bg4}`, fontSize:12 }}>
                        <Badge color="blu">{icons[a.type]??""} {a.type}</Badge>
                        <span style={{ flex:1, color:S.txt3, fontFamily:"monospace", fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={a.url}>{a.name||a.url}</span>
                        {a.type==="script"&&<button onClick={()=>loadExternal(a.url)} style={{ ...btn(S.bg4,S.txt2), fontSize:11, padding:"3px 8px" }}>👁 Ver</button>}
                        <a href={a.url} target="_blank" rel="noreferrer"><button style={{ ...btn(S.bg4,S.txt2), fontSize:11, padding:"3px 8px" }}><ExternalLink size={10}/></button></a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── LINKS ──────────────────────────────────────────────── */}
            {tab==="links" && (
              <div>
                <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                  <input placeholder="Filtrar links…" value={linkFil} onChange={e=>setLinkFil(e.target.value)} style={{ ...inp, flex:1, minWidth:150, fontSize:12, padding:"6px 10px" }}/>
                  <select value={linkExt} onChange={e=>setLinkExt(e.target.value)} style={{ ...inp, width:150, fontSize:12, padding:"6px 10px" }}>
                    <option value="">Todos</option>
                    <option value="int">Internos</option>
                    <option value="ext">Externos</option>
                  </select>
                </div>
                <div style={{ border:`1px solid ${S.bg4}`, borderRadius:S.rad, overflow:"hidden" }}>
                  {filtLinks.length===0 && <div style={{ textAlign:"center", padding:24, color:S.txt3, fontSize:12 }}>Nenhum link</div>}
                  {filtLinks.map((l,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderBottom:`1px solid ${S.bg4}`, fontSize:12 }}>
                      <div style={{ flex:1, overflow:"hidden" }}>
                        <div style={{ fontWeight:600, color:S.txt, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.text}</div>
                        <a href={l.url} target="_blank" rel="noreferrer" style={{ color:S.blu, fontSize:10, fontFamily:"monospace", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.url}</a>
                      </div>
                      <Badge color={l.ext?"gld":"grn"}>{l.ext?"Externo":"Interno"}</Badge>
                      <button onClick={()=>{ setUrl(l.url); }} style={{ ...btn(S.bg4,S.txt2), fontSize:11, padding:"3px 8px" }} title="Extrair este link">
                        <Search size={10}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── APIS ──────────────────────────────────────────────── */}
            {tab==="apis" && (
              <div style={{ border:`1px solid ${S.bg4}`, borderRadius:S.rad, overflow:"hidden" }}>
                {result.apis.length===0 && <div style={{ textAlign:"center", padding:24, color:S.txt3, fontSize:12 }}>Nenhuma rota de API detectada</div>}
                {result.apis.map((a,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderBottom:`1px solid ${S.bg4}`, fontSize:12 }}>
                    <Badge color="pur">API</Badge>
                    <span style={{ flex:1, color:S.pur, fontFamily:"monospace", fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.path}</span>
                    <a href={a.url} target="_blank" rel="noreferrer"><button style={{ ...btn(S.bg4,S.txt2), fontSize:11, padding:"3px 8px" }}><ExternalLink size={10}/></button></a>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Painel IA ──────────────────────────────────────────────────── */}
      {showAI && (
        <div style={{ position:"fixed", bottom:16, right:16, width:"min(380px,96vw)", background:S.bg2, border:`1px solid ${S.bg4}`, borderRadius:S.rad*1.5, boxShadow:"0 8px 40px #0008", display:"flex", flexDirection:"column", maxHeight:520, zIndex:10000 }}>
          <div style={{ padding:"10px 14px", borderBottom:`1px solid ${S.bg4}`, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:S.grn2, flex:1 }}>🤖 Jasmim — Análise</span>
            <button onClick={()=>setAiMsg([])} style={{ ...btn(S.bg3,S.txt3), fontSize:11, padding:"3px 8px" }}>🗑</button>
            <button onClick={()=>setShowAI(false)} style={{ ...btn(S.bg3,S.txt3), fontSize:11, padding:"3px 8px" }}><X size={12}/></button>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:10, display:"flex", flexDirection:"column", gap:6 }}>
            {aiMsg.length===0 && <div style={{ fontSize:12, color:S.txt3, textAlign:"center", padding:16 }}>Cole uma URL e extraia um site, depois pergunte sobre os scripts ou conteúdo.</div>}
            {aiMsg.map((m,i)=>(
              <div key={i} style={{ padding:"8px 11px", borderRadius:S.rad, fontSize:12, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word",
                background: m.role==="user"?"rgba(95,173,60,.12)":S.bg3,
                border: `1px solid ${m.role==="user"?S.grn:S.bg4}` }}>
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ padding:8, borderTop:`1px solid ${S.bg4}` }}>
            <textarea
              value={aiInput} onChange={e=>setAiInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendAI();} }}
              placeholder="Analise os scripts, explique um cálculo… (Ctrl+Enter envia)"
              style={{ ...inp, minHeight:56, maxHeight:100, resize:"none", fontSize:12, padding:8 }}
            />
            <div style={{ display:"flex", gap:6, marginTop:6 }}>
              {result && <button onClick={()=>{ const jur=result.scripts.filter(s=>s.hc||s.hf); sendAI(jur.slice(0,3).map(s=>s.full.slice(0,2000)).join("\n\n")); }} style={{ ...btn(S.bg3,S.txt2), fontSize:11, padding:"5px 10px" }}>📋 +scripts</button>}
              <button onClick={()=>sendAI()} disabled={aiLoading} style={{ ...btn(S.grn), flex:1, fontSize:12, justifyContent:"center" }}>
                {aiLoading ? "⏳ Aguarde…" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal conteúdo completo 1─────────────────────────────────────── */}
      {modal && (
        <div onClick={()=>setModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:10001, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:S.bg2, border:`1px solid ${S.bg4}`, borderRadius:S.rad*1.5, width:"min(860px,96vw)", maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 12px 60px #000a" }}>
            <div style={{ padding:"10px 14px", borderBottom:`1px solid ${S.bg4}`, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:12, fontWeight:600, color:S.txt3, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{modal.title}</span>
              <CopyBtn text={modal.content}/>
              <button onClick={()=>dlBlob(modal.content, modal.title.replace(/[^a-z0-9]/gi,"_")+".txt")} style={{ ...btn(S.bg3,S.txt2), fontSize:11, padding:"4px 10px" }}><Download size={11}/> Baixar</button>
              <button onClick={()=>setModal(null)} style={{ ...btn(S.bg3,S.txt2), fontSize:11, padding:"4px 10px" }}><X size={11}/> Fechar</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:14 }}>
              <pre style={{ fontSize:11, fontFamily:"monospace", color:"#79c0ff", whiteSpace:"pre-wrap", wordBreak:"break-all", lineHeight:1.6, margin:0 }}>
                {modal.content}
              </pre>
            </div>
            <div style={{ padding:"8px 14px", borderTop:`1px solid ${S.bg4}`, fontSize:11, color:S.txt3 }}>
              {modal.content.length.toLocaleString()} caracteres · {modal.content.split("\n").length.toLocaleString()} linhas
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
