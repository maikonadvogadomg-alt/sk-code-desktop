/**
 * Scanner de Dependências — embutido no SK Code Editor
 * Importa APK · ZIP · qualquer arquivo pelo seletor ou drag-and-drop
 * Detecta referências indesejadas (sem CORS, 100% local)
 */
import { useState, useRef, useCallback } from "react";
import { ArrowLeft, Upload, Search, Copy, CheckCheck, Trash2, Github } from "lucide-react";
import JSZip from "jszip";

interface Props { onBack: () => void }

// Padrões construídos em runtime — resistente a otimização do minificador
const _p = String.fromCharCode(114,101,112,108,105,116); // "replit" via charCodes
const PATS: Array<{ re: RegExp; lb: string }> = [
  { re: new RegExp(_p + "\\.com",    "gi"), lb: "url-plataforma" },
  { re: new RegExp("repl\\.it",      "gi"), lb: "url-plataforma-antiga" },
  { re: new RegExp(_p.toUpperCase() + "_", "g"),  lb: "var-plataforma" },
  { re: new RegExp("REPL_ID",        "g"),  lb: "var-id-plataforma" },
  { re: new RegExp("REPL_SLUG",      "g"),  lb: "var-slug-plataforma" },
  { re: new RegExp("REPL_OWNER",     "g"),  lb: "var-owner-plataforma" },
  { re: new RegExp("@" + _p + "/",   "gi"), lb: "pacote-externo" },
  { re: /vite-plugin-runtime-error-modal/gi,  lb: "plugin-error-externo" },
  { re: /vite-plugin-cartographer/gi,         lb: "plugin-cartographer-externo" },
  { re: /vite-plugin-dev-banner/gi,           lb: "plugin-banner-externo" },
  { re: new RegExp("\\." + _p + "\\b", "gi"), lb: "config-plataforma" },
  { re: new RegExp(_p + "\\.app",    "gi"), lb: "dominio-hospedagem" },
  { re: new RegExp(_p + "-dev\\.com","gi"), lb: "dominio-dev-externo" },
  { re: new RegExp("pid1\\." + _p,   "gi"), lb: "processo-plataforma" },
];

const SKIP_EXT = new Set(["png","jpg","jpeg","gif","webp","ico","woff","woff2","ttf","eot","otf","mp3","mp4","webm","ogg","bin","class","dex"]);

interface Hit  { ln: number; txt: string; labels: string[] }
interface Arq  { nome: string; status: "sujo"|"limpo"|"bin"|"skip"|"err"; hits: Hit[] }

const S = {
  bg: "#0a0f1e", bg2: "#0d1626", bg3: "#111827", bg4: "#1e2d45",
  blue: "#38bdf8", blue2: "#0284c7",
  red: "#ef4444", green: "#22c55e",
  txt: "#e2e8f0", txt2: "#94a3b8", txt3: "#475569",
  rad: 10,
} as const;

function scanText(text: string): Hit[] {
  const hits: Hit[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const found: string[] = [];
    PATS.forEach(p => { p.re.lastIndex = 0; if (p.re.test(line)) { found.push(p.lb); p.re.lastIndex = 0; } });
    if (found.length) hits.push({ ln: i + 1, txt: line.trim().slice(0, 300), labels: found });
  });
  return hits;
}

async function processarArquivos(arquivos: { nome: string; conteudo: ArrayBuffer | string }[]): Promise<Arq[]> {
  const result: Arq[] = [];
  for (const arq of arquivos) {
    const ext = arq.nome.split(".").pop()?.toLowerCase() ?? "";
    if (SKIP_EXT.has(ext) || arq.nome.includes("META-INF/CERT")) {
      result.push({ nome: arq.nome, status: "skip", hits: [] });
      continue;
    }
    try {
      let texto: string;
      if (arq.conteudo instanceof ArrayBuffer) {
        texto = new TextDecoder("utf-8", { fatal: false }).decode(arq.conteudo);
      } else {
        texto = arq.conteudo;
      }
      if (texto.includes("\x00") && !["txt","json","xml","html","htm","js","ts","jsx","tsx","css"].includes(ext)) {
        result.push({ nome: arq.nome, status: "bin", hits: [] });
        continue;
      }
      const hits = scanText(texto);
      result.push({ nome: arq.nome, status: hits.length > 0 ? "sujo" : "limpo", hits });
    } catch {
      result.push({ nome: arq.nome, status: "err", hits: [] });
    }
  }
  return result;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      style={{ display:"flex", alignItems:"center", gap:4, background:S.bg4, border:`1px solid #2d3f55`, borderRadius:6, padding:"4px 10px", color:S.txt2, fontSize:11, cursor:"pointer" }}
    >
      {copied ? <><CheckCheck size={11} color={S.green}/> Copiado!</> : <><Copy size={11}/> Copiar</>}
    </button>
  );
}

export default function Scanner({ onBack }: Props) {
  const [resultados, setResultados] = useState<Arq[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [fonte, setFonte] = useState("");
  const [filtro, setFiltro] = useState<"todos"|"sujos"|"limpos">("todos");
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<"arquivo"|"github">("arquivo");
  const [ghUrl, setGhUrl] = useState("");
  const [ghBranch, setGhBranch] = useState("main");
  const [ghToken, setGhToken] = useState("");
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const IS_APK = typeof window !== "undefined" && window.location.protocol === "file:";

  const rodarScan = useCallback(async (arquivos: { nome: string; conteudo: ArrayBuffer | string }[], nomeFonte: string) => {
    setLoading(true); setResultados([]); setFonte(nomeFonte); setProgresso(5);
    try {
      const res = await processarArquivos(arquivos);
      setResultados(res);
    } finally {
      setLoading(false); setProgresso(0);
    }
  }, []);

  const importarArquivo = useCallback(async (file: File) => {
    setLoadMsg(`Lendo ${file.name}…`);
    setLoading(true); setProgresso(10);
    const nome = file.name.toLowerCase();
    const isZip = nome.endsWith(".apk") || nome.endsWith(".zip") || nome.endsWith(".jar") || nome.endsWith(".aab") || nome.endsWith(".aar");
    try {
      const arquivos: { nome: string; conteudo: ArrayBuffer | string }[] = [];
      if (isZip) {
        setLoadMsg("Extraindo arquivo…");
        const buf = await file.arrayBuffer();
        setProgresso(30);
        const zip = await JSZip.loadAsync(buf);
        const nomes = Object.keys(zip.files).filter(n => !zip.files[n].dir);
        setLoadMsg(`${nomes.length} arquivos — escaneando…`);
        let i = 0;
        for (const n of nomes) {
          const dados = await zip.files[n].async("arraybuffer");
          arquivos.push({ nome: n, conteudo: dados });
          i++;
          setProgresso(30 + Math.round((i / nomes.length) * 60));
        }
      } else {
        const texto = await file.text();
        arquivos.push({ nome: file.name, conteudo: texto });
      }
      await rodarScan(arquivos, file.name);
    } catch (e: unknown) {
      alert("Erro: " + (e as Error)?.message);
    } finally {
      setLoading(false); setProgresso(0);
    }
  }, [rodarScan]);

  const importarGitHub = useCallback(async () => {
    const url = ghUrl.trim().replace(/\/$/, "").replace(/\.git$/, "");
    const branch = ghBranch.trim() || "main";
    const m = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!m) { alert("URL inválida. Use: https://github.com/usuario/repositorio"); return; }
    const [, owner, repo] = m;
    setLoading(true); setLoadMsg(`Baixando ${owner}/${repo}@${branch}…`); setProgresso(10);
    try {
      const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;
      const hdrs: HeadersInit = ghToken ? { Authorization: `token ${ghToken}` } : {};
      let resp: Response;
      try {
        resp = await fetch(zipUrl, { headers: hdrs, signal: AbortSignal.timeout(60_000) });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      } catch {
        setLoadMsg("Tentando via proxy…");
        const px = `https://api.allorigins.win/raw?url=${encodeURIComponent(zipUrl)}`;
        resp = await fetch(px, { signal: AbortSignal.timeout(60_000) });
        if (!resp.ok) throw new Error(`Proxy retornou ${resp.status}`);
      }
      setProgresso(50); setLoadMsg("Extraindo…");
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const nomes = Object.keys(zip.files).filter(n => !zip.files[n].dir);
      const prefix = (nomes[0]?.split("/")[0] ?? "") + "/";
      setLoadMsg(`${nomes.length} arquivos — escaneando…`);
      const arquivos: { nome: string; conteudo: ArrayBuffer | string }[] = [];
      let i = 0;
      for (const n of nomes) {
        const rel = n.startsWith(prefix) ? n.slice(prefix.length) : n;
        if (!rel) continue;
        const dados = await zip.files[n].async("arraybuffer");
        arquivos.push({ nome: rel, conteudo: dados });
        i++;
        setProgresso(50 + Math.round((i / nomes.length) * 40));
      }
      await rodarScan(arquivos, `${owner}/${repo}`);
    } catch (e: unknown) {
      alert("Erro: " + (e as Error)?.message);
    } finally {
      setLoading(false); setProgresso(0); setLoadMsg("");
    }
  }, [ghUrl, ghBranch, ghToken, rodarScan]);

  const toggleAberto = (i: number) => setAbertos(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  const sujos  = resultados.filter(r => r.status === "sujo");
  const limpos = resultados.filter(r => r.status === "limpo");
  const itens  = filtro === "sujos" ? sujos : filtro === "limpos" ? limpos : resultados;
  const sorted = [...itens].sort((a, b) => a.status === "sujo" ? -1 : b.status === "sujo" ? 1 : 0);

  const gerarRelatorio = () => {
    let txt = `=== SCANNER DE DEPENDÊNCIAS ===\n${new Date().toLocaleString("pt-BR")}\nFonte: ${fonte}\n\n`;
    txt += `Total: ${resultados.length} | Com refs: ${sujos.length} | Limpos: ${limpos.length}\n\n`;
    if (sujos.length) {
      txt += "ARQUIVOS COM REFERÊNCIAS:\n";
      sujos.forEach(r => { txt += `\n► ${r.nome}\n`; r.hits.forEach(h => { txt += `  L${h.ln}: ${h.txt}\n`; }); });
    }
    txt += "\nLIMPOS:\n";
    limpos.forEach(r => { txt += `  ✓ ${r.nome}\n`; });
    return txt;
  };

  const inp: React.CSSProperties = { width:"100%", background:S.bg3, border:`1px solid ${S.bg4}`, borderRadius:8, padding:"9px 12px", color:S.txt, fontSize:13, outline:"none", marginBottom:8 };
  const btn = (col: string, fg = S.txt): React.CSSProperties => ({ background:col, color:fg, border:"none", borderRadius:8, padding:"9px 14px", fontSize:13, fontWeight:700, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 });

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", flexDirection:"column", background:S.bg, fontFamily:"system-ui,sans-serif", overflow:"hidden" }}>

      {/* Cabeçalho */}
      <div style={{ background:S.bg2, borderBottom:`1px solid ${S.bg4}`, padding:"0 16px", height:52, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <button onClick={onBack} style={{ ...btn(S.bg3, S.txt2), border:`1px solid ${S.bg4}`, fontSize:12 }}>
          <ArrowLeft size={13}/> Voltar
        </button>
        <span style={{ fontSize:15, fontWeight:800, color:S.blue }}>🔍 Scanner de Dependências</span>
        <span style={{ fontSize:11, color:S.txt3 }}>Maikon Caldeira OAB/MG 183712</span>
      </div>

      {/* Abas */}
      <div style={{ display:"flex", gap:4, padding:"10px 16px 0", background:S.bg2, flexShrink:0 }}>
        {(["arquivo","github"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"7px 16px", border:"none", borderRadius:"8px 8px 0 0", background: tab===t ? S.bg3 : "transparent", color: tab===t ? S.blue : S.txt3, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {t === "arquivo" ? "📁 Arquivo" : <><Github size={12}/> GitHub</>}
          </button>
        ))}
      </div>

      {/* Corpo rolável */}
      <div style={{ flex:1, overflowY:"auto", padding:16 }}>

        {/* ABA ARQUIVO */}
        {tab === "arquivo" && (
          <div style={{ background:S.bg3, border:`1px solid ${S.bg4}`, borderRadius:S.rad, padding:16, marginBottom:12 }}>
            <div
              style={{ border:`2px dashed ${over ? S.blue : S.bg4}`, borderRadius:12, padding:"36px 16px", textAlign:"center", cursor:"pointer", background: over ? "#0a2040" : S.bg2, transition:"all .15s" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) importarArquivo(f); }}
            >
              <div style={{ fontSize:"2.5rem" }}>📦</div>
              <p style={{ color:S.txt, fontWeight:700, marginTop:8 }}>Toque aqui ou arraste o arquivo</p>
              <p style={{ color:S.txt3, fontSize:12, marginTop:4 }}>APK · ZIP · HTML · JS · JSON · TXT · qualquer arquivo</p>
              <p style={{ color:"#2d3f55", fontSize:11, marginTop:6 }}>100% local — nada sai do celular</p>
            </div>
            <input ref={fileRef} type="file" style={{ display:"none" }} onChange={e => { const f = e.target.files?.[0]; if (f) importarArquivo(f); e.target.value = ""; }} />
          </div>
        )}

        {/* ABA GITHUB */}
        {tab === "github" && (
          <div style={{ background:S.bg3, border:`1px solid ${S.bg4}`, borderRadius:S.rad, padding:16, marginBottom:12 }}>
            <label style={{ display:"block", fontSize:12, color:S.txt2, marginBottom:4 }}>URL do repositório</label>
            <input style={inp} value={ghUrl} onChange={e => setGhUrl(e.target.value)} placeholder="https://github.com/usuario/repositorio" />
            <label style={{ display:"block", fontSize:12, color:S.txt2, marginBottom:4 }}>Branch</label>
            <input style={inp} value={ghBranch} onChange={e => setGhBranch(e.target.value)} placeholder="main" />
            <label style={{ display:"block", fontSize:12, color:S.txt2, marginBottom:4 }}>Token (opcional — repos privados)</label>
            <input style={inp} type="password" value={ghToken} onChange={e => setGhToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" />
            <button onClick={importarGitHub} disabled={loading} style={{ ...btn(S.blue2), width:"100%", justifyContent:"center", opacity: loading ? 0.5 : 1 }}>
              <Search size={14}/> Baixar e Escanear
            </button>
            {IS_APK && <p style={{ fontSize:11, color:S.txt3, marginTop:8 }}>No APK: acesso direto sem proxy.</p>}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ background:S.bg3, border:`1px solid ${S.bg4}`, borderRadius:S.rad, padding:14, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <div style={{ width:16, height:16, border:`2px solid ${S.blue}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
              <span style={{ fontSize:13, color:S.blue }}>{loadMsg || "Processando…"}</span>
            </div>
            {progresso > 0 && (
              <div style={{ background:S.bg4, borderRadius:4, height:6, overflow:"hidden" }}>
                <div style={{ width:`${progresso}%`, height:"100%", background:S.blue, borderRadius:4, transition:"width .3s" }}/>
              </div>
            )}
          </div>
        )}

        {/* Resultados */}
        {resultados.length > 0 && !loading && (
          <>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
              {[["sujos", sujos.length, S.red, "Com refs"],["limpos", limpos.length, S.green, "Limpos"],["todos", resultados.length, S.blue, "Total"]].map(([k, n, c, l]) => (
                <div key={k as string} style={{ background:S.bg3, border:`1px solid ${k===filtro ? c : S.bg4}`, borderRadius:S.rad, padding:"10px 8px", textAlign:"center", cursor:"pointer" }} onClick={() => setFiltro(k as typeof filtro)}>
                  <div style={{ fontSize:"1.6rem", fontWeight:900, color:c as string }}>{n as number}</div>
                  <div style={{ fontSize:11, color:S.txt3, marginTop:2 }}>{l as string}</div>
                </div>
              ))}
            </div>

            {/* Ações */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              <CopyBtn text={gerarRelatorio()} />
              <button onClick={() => setResultados([])} style={{ ...btn(S.bg3, S.txt2), border:`1px solid ${S.bg4}`, fontSize:11 }}>
                <Trash2 size={11}/> Limpar
              </button>
            </div>

            {/* Lista */}
            {sorted.map((r, i) => {
              const isOpen = abertos.has(i);
              const cor = r.status === "sujo" ? S.red : r.status === "limpo" ? S.green : S.txt3;
              return (
                <div key={i} style={{ background:S.bg2, border:`1px solid ${r.status==="sujo" ? "#7f1d1d" : r.status==="limpo" ? "#052e16" : S.bg4}`, borderRadius:8, marginBottom:6, overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", cursor: r.hits.length ? "pointer" : "default" }} onClick={() => r.hits.length && toggleAberto(i)}>
                    <span style={{ fontSize:10, fontWeight:700, color:cor, background: r.status==="sujo"?"#7f1d1d22": r.status==="limpo"?"#05ff4422":"transparent", border:`1px solid ${cor}55`, borderRadius:99, padding:"1px 8px", whiteSpace:"nowrap" }}>
                      {r.status === "sujo" ? `🔴 ${r.hits.length} ref(s)` : r.status === "limpo" ? "🟢 Limpo" : "⬜ Skip"}
                    </span>
                    <span style={{ flex:1, fontSize:12, fontFamily:"monospace", color:S.txt2, wordBreak:"break-all" }}>{r.nome}</span>
                    {r.hits.length > 0 && <span style={{ fontSize:10, color:S.txt3 }}>{isOpen ? "▲" : "▼"}</span>}
                  </div>
                  {isOpen && r.hits.length > 0 && (
                    <div style={{ borderTop:`1px solid ${S.bg4}`, padding:"8px 12px" }}>
                      {r.hits.slice(0, 25).map((h, j) => (
                        <div key={j} style={{ fontSize:11, fontFamily:"monospace", background:"#1a0a0a", borderRadius:4, padding:"3px 8px", marginBottom:3, color:"#fca5a5", wordBreak:"break-all" }}>
                          <span style={{ color:S.txt3 }}>L{h.ln}: </span>{h.txt}
                        </div>
                      ))}
                      {r.hits.length > 25 && <div style={{ fontSize:11, color:S.txt3, padding:"2px 8px" }}>…e mais {r.hits.length - 25} ocorrências</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {!loading && resultados.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 16px", color:S.txt3, fontSize:13 }}>
            <Upload size={32} style={{ margin:"0 auto 12px", opacity:.3 }}/>
            <p>Selecione um arquivo para escanear</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
