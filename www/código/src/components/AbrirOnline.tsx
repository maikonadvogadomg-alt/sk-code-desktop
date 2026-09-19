import { useState } from "react";
import { ExternalLink, Terminal, Globe, GitBranch, Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";

interface Props {
  files: Record<string, string>;
  projectName: string;
  onBack: () => void;
}

// ── Abre projeto no StackBlitz via POST (sem login) ──────────────────────
function openStackBlitz(files: Record<string, string>, name: string) {
  const form = document.createElement("form");
  form.method  = "POST";
  form.action  = "https://stackblitz.com/run";
  form.target  = "_blank";
  form.style.display = "none";

  const addInput = (n: string, v: string) => {
    const i = document.createElement("input");
    i.type  = "hidden";
    i.name  = n;
    i.value = v;
    form.appendChild(i);
  };

  addInput("project[title]",       name);
  addInput("project[description]", `Projeto: ${name} — aberto pelo SK Code Editor`);
  addInput("project[template]",    "node");

  // Enviar arquivos (máx ~200kb total para o POST)
  let totalSize = 0;
  const MAX = 180_000;
  for (const [path, content] of Object.entries(files)) {
    if (totalSize + content.length > MAX) break;
    addInput(`project[files][${path}]`, content);
    totalSize += content.length;
  }

  // Garantir que haja package.json
  if (!files["package.json"]) {
    addInput(`project[files][package.json]`, JSON.stringify({
      name: name.toLowerCase().replace(/\s+/g, "-"),
      version: "1.0.0",
      scripts: { start: "node index.js" },
    }, null, 2));
  }

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

// ── Abre no Glitch (sem login — cria remix público) ──────────────────────
function openGlitch(files: Record<string, string>, name: string) {
  // Glitch aceita importar de GitHub — mas sem login o mais fácil é StackBlitz
  // Usamos StackBlitz como fallback para "sem login"
  openStackBlitz(files, name);
}

export default function AbrirOnline({ files, projectName, onBack }: Props) {
  const [status, setStatus] = useState<{ msg: string; ok?: boolean } | null>(null);
  const fileCount = Object.keys(files).length;

  const handleStackBlitz = () => {
    try {
      setStatus({ msg: "Abrindo no StackBlitz..." });
      openStackBlitz(files, projectName);
      setTimeout(() => setStatus({ msg: "✓ Projeto enviado para o StackBlitz! Verifique a nova aba.", ok: true }), 800);
    } catch (e: any) {
      setStatus({ msg: `Erro: ${e.message}` });
    }
  };

  const handleCodeSandbox = () => {
    try {
      setStatus({ msg: "Abrindo no CodeSandbox..." });
      // CodeSandbox API: define via URL parameter (pequenos projetos)
      const entry = files["index.js"] || files["index.ts"] || files["src/index.js"] || "";
      const pkg = files["package.json"] || '{"name":"projeto","version":"1.0.0"}';
      const params = {
        files: {} as Record<string, { content: string }>,
      };
      for (const [p, c] of Object.entries(files)) {
        params.files[p] = { content: c };
      }
      const json = JSON.stringify(params);
      // CodeSandbox aceita JSON comprimido via query param
      const encoded = btoa(unescape(encodeURIComponent(json)));
      const url = `https://codesandbox.io/api/v1/sandboxes/define?parameters=${encoded}&query=/%3Ffile=/index.js`;
      window.open(url.length < 8000 ? url : "https://codesandbox.io/s/vanilla", "_blank");
      setTimeout(() => setStatus({ msg: "✓ Projeto enviado para o CodeSandbox! Verifique a nova aba.", ok: true }), 800);
    } catch {
      // Fallback simples
      window.open("https://codesandbox.io", "_blank");
      setStatus({ msg: "✓ CodeSandbox aberto. Importe seu projeto lá.", ok: true });
    }
  };

  const totalKb = Math.round(
    Object.values(files).reduce((s, c) => s + c.length, 0) / 1024
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:"#0d1117", color:"#e6edf3" }}>
      {/* Header */}
      <div style={{ background:"#161b22", borderBottom:"1px solid #30363d", padding:"12px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <button onClick={onBack}
          style={{ background:"#21262d", border:"1px solid #30363d", color:"#e6edf3", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontWeight:700, fontSize:13 }}>
          ← Voltar
        </button>
        <Globe size={18} style={{ color:"#58a6ff" }}/>
        <span style={{ fontWeight:700, fontSize:15 }}>Abrir Projeto Online</span>
        <span style={{ fontSize:11, color:"#8b949e", marginLeft:"auto" }}>{fileCount} arquivos · {totalKb} KB</span>
      </div>

      {/* Conteúdo */}
      <div style={{ flex:1, overflowY:"auto", padding:"20px 16px", display:"flex", flexDirection:"column", gap:16 }}>

        {/* Alerta */}
        <div style={{ background:"#1c2714", border:"1px solid #2ea043", borderRadius:12, padding:"12px 14px", display:"flex", gap:10, alignItems:"flex-start" }}>
          <Zap size={16} style={{ color:"#2ea043", flexShrink:0, marginTop:1 }}/>
          <div>
            <p style={{ fontSize:13, fontWeight:700, color:"#2ea043", marginBottom:4 }}>Terminal online para instalar bibliotecas</p>
            <p style={{ fontSize:12, color:"#8b949e", lineHeight:1.5 }}>
              Use estas opções quando o terminal do app não funcionar. O projeto é enviado para um IDE online onde você pode rodar <code style={{background:"#21262d",padding:"1px 5px",borderRadius:4}}>npm install</code> normalmente.
            </p>
          </div>
        </div>

        {/* Opção 1 — StackBlitz (sem login) */}
        <div style={{ background:"#161b22", border:"1px solid #1f6feb", borderRadius:14, overflow:"hidden" }}>
          <div style={{ background:"#1f6feb15", padding:"12px 14px 10px", borderBottom:"1px solid #1f6feb30" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <Terminal size={16} style={{ color:"#58a6ff" }}/>
              <span style={{ fontWeight:800, fontSize:14, color:"#58a6ff" }}>StackBlitz</span>
              <span style={{ background:"#2ea04320", color:"#2ea043", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, border:"1px solid #2ea04340" }}>SEM LOGIN</span>
            </div>
            <p style={{ fontSize:11, color:"#8b949e", lineHeight:1.5 }}>
              Abre o projeto diretamente no browser. Terminal completo, instala pacotes npm, sem precisar criar conta.
            </p>
          </div>
          <div style={{ padding:"12px 14px" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:6, fontSize:12, color:"#8b949e", marginBottom:12 }}>
              <span>✅ Sem login necessário</span>
              <span>✅ Terminal com npm install</span>
              <span>✅ Node.js, React, HTML/CSS/JS</span>
              <span>✅ Edita e roda online</span>
            </div>
            <button onClick={handleStackBlitz}
              style={{ width:"100%", background:"#1f6feb", border:"none", color:"#fff", borderRadius:10, padding:"12px", cursor:"pointer", fontWeight:700, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <ExternalLink size={15}/>
              Abrir no StackBlitz (sem login)
            </button>
          </div>
        </div>

        {/* Opção 2 — CodeSandbox */}
        <div style={{ background:"#161b22", border:"1px solid #30363d", borderRadius:14, overflow:"hidden" }}>
          <div style={{ background:"#21262d", padding:"12px 14px 10px", borderBottom:"1px solid #30363d" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <Globe size={16} style={{ color:"#e6edf3" }}/>
              <span style={{ fontWeight:800, fontSize:14, color:"#e6edf3" }}>CodeSandbox</span>
              <span style={{ background:"#21262d", color:"#8b949e", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, border:"1px solid #30363d" }}>CONTA OPCIONAL</span>
            </div>
            <p style={{ fontSize:11, color:"#8b949e", lineHeight:1.5 }}>
              IDE online popular. Para projetos pequenos abre sem login.
            </p>
          </div>
          <div style={{ padding:"12px 14px" }}>
            <button onClick={handleCodeSandbox}
              style={{ width:"100%", background:"#21262d", border:"1px solid #30363d", color:"#e6edf3", borderRadius:10, padding:"12px", cursor:"pointer", fontWeight:700, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <ExternalLink size={15}/>
              Abrir no CodeSandbox
            </button>
          </div>
        </div>

        {/* Opção 3 — GitHub Codespace */}
        <div style={{ background:"#161b22", border:"1px solid #30363d", borderRadius:14, overflow:"hidden" }}>
          <div style={{ background:"#21262d", padding:"12px 14px 10px", borderBottom:"1px solid #30363d" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <GitBranch size={16} style={{ color:"#2ea043" }}/>
              <span style={{ fontWeight:800, fontSize:14, color:"#e6edf3" }}>GitHub Codespace</span>
              <span style={{ background:"#f8514920", color:"#f85149", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, border:"1px solid #f8514940" }}>PRECISA DE LOGIN</span>
            </div>
            <p style={{ fontSize:11, color:"#8b949e", lineHeight:1.5 }}>
              Primeiro envie o projeto para o GitHub (botão GitHub na barra lateral), depois abra o Codespace direto do repositório.
            </p>
          </div>
          <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
            <p style={{ fontSize:11, color:"#8b949e" }}>
              Após enviar para o GitHub, use o painel GitHub desta tela → escolha o repositório → clique em "Abrir Codespace".
            </p>
            <button onClick={() => window.open("https://github.com/codespaces", "_blank")}
              style={{ width:"100%", background:"#21262d", border:"1px solid #30363d", color:"#e6edf3", borderRadius:10, padding:"10px", cursor:"pointer", fontWeight:600, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <ExternalLink size={14}/>
              Abrir GitHub Codespace →
            </button>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div style={{ background: status.ok ? "#2ea04315" : "#f8514915", border:`1px solid ${status.ok?"#2ea04340":"#f8514940"}`, borderRadius:10, padding:"12px 14px", display:"flex", gap:8, alignItems:"flex-start" }}>
            {status.ok
              ? <CheckCircle2 size={14} style={{ color:"#2ea043", flexShrink:0, marginTop:1 }}/>
              : <AlertCircle  size={14} style={{ color:"#f85149", flexShrink:0, marginTop:1 }}/>}
            <span style={{ fontSize:13, color: status.ok ? "#2ea043" : "#f85149", lineHeight:1.5 }}>{status.msg}</span>
          </div>
        )}

        {/* Dica */}
        <div style={{ background:"#161b22", border:"1px solid #30363d", borderRadius:10, padding:"12px 14px" }}>
          <p style={{ fontSize:11, fontWeight:700, color:"#8b949e", marginBottom:6 }}>💡 Como instalar bibliotecas no StackBlitz</p>
          <div style={{ fontSize:11, color:"#8b949e", lineHeight:1.8 }}>
            <p>1. Clique em <strong style={{color:"#e6edf3"}}>"Abrir no StackBlitz"</strong> acima</p>
            <p>2. No terminal que aparecer, digite:</p>
            <code style={{ display:"block", background:"#21262d", borderRadius:6, padding:"6px 10px", margin:"4px 0", color:"#79c0ff" }}>npm install nome-da-biblioteca</code>
            <p>3. O projeto fica salvo online, você pode editar e baixar</p>
          </div>
        </div>
      </div>
    </div>
  );
}
