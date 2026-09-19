import { useState, useRef, useCallback } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, Home, X, Globe } from "lucide-react";

interface Props { onBack: () => void }

const FAVORITOS = [
  { label: "Google",   url: "https://www.google.com/search?igu=1" },
  { label: "TJMG",     url: "https://www.tjmg.jus.br" },
  { label: "STJ",      url: "https://www.stj.jus.br" },
  { label: "STF",      url: "https://www.stf.jus.br" },
  { label: "TRT-3",    url: "https://www.trt3.jus.br" },
  { label: "JusBrasil",url: "https://www.jusbrasil.com.br" },
  { label: "PJe",      url: "https://pje.trt3.jus.br" },
  { label: "YouTube",  url: "https://m.youtube.com" },
];

export default function InAppBrowser({ onBack }: Props) {
  const [url, setUrl]         = useState("https://www.google.com/search?igu=1");
  const [input, setInput]     = useState("https://www.google.com/search?igu=1");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const iframeRef             = useRef<HTMLIFrameElement>(null);

  const navigate = useCallback((target: string) => {
    let u = target.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) {
      // Se parece URL, adiciona https://; senão pesquisa no Google
      u = u.includes(".") && !u.includes(" ")
        ? "https://" + u
        : `https://www.google.com/search?q=${encodeURIComponent(u)}&igu=1`;
    }
    setError("");
    setLoading(true);
    setUrl(u);
    setInput(u);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") navigate(input);
  };

  const handleLoad = () => setLoading(false);
  const handleError = () => {
    setLoading(false);
    setError("Este site não permite exibição incorporada. Tente outro site.");
  };

  const goBack    = () => iframeRef.current?.contentWindow?.history.back();
  const goForward = () => iframeRef.current?.contentWindow?.history.forward();
  const reload    = () => { setLoading(true); setError(""); if (iframeRef.current) iframeRef.current.src = url; };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:"#0d1117", color:"#e6edf3" }}>

      {/* ── Barra de navegação ── */}
      <div style={{ background:"#161b22", borderBottom:"1px solid #30363d", padding:"8px 8px 6px", flexShrink:0 }}>
        {/* Linha 1: botões de nav + URL bar */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button onClick={onBack}
            style={{ background:"#21262d", border:"1px solid #30363d", color:"#e6edf3", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontWeight:700, fontSize:13, whiteSpace:"nowrap", flexShrink:0 }}>
            ← Voltar
          </button>
          <button onClick={goBack}    title="Voltar" style={navBtn}><ArrowLeft  size={16}/></button>
          <button onClick={goForward} title="Avançar" style={navBtn}><ArrowRight size={16}/></button>
          <button onClick={reload}    title="Recarregar" style={navBtn}>
            <RefreshCw size={14} style={loading ? { animation:"spin 0.8s linear infinite" } : {}}/>
          </button>

          {/* URL input */}
          <div style={{ flex:1, display:"flex", alignItems:"center", background:"#0d1117", border:"1px solid #30363d", borderRadius:20, padding:"4px 12px", gap:6 }}>
            <Globe size={12} style={{ color:"#58a6ff", flexShrink:0 }}/>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              style={{ flex:1, background:"transparent", border:"none", color:"#e6edf3", fontSize:12, outline:"none" }}
              placeholder="Digite URL ou pesquise no Google..."
            />
            {input && (
              <button onClick={() => setInput("")} style={{ background:"none", border:"none", color:"#8b949e", cursor:"pointer", padding:0 }}>
                <X size={12}/>
              </button>
            )}
          </div>

          <button onClick={() => navigate(input)}
            style={{ background:"#238636", border:"none", color:"#fff", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:13, fontWeight:700, flexShrink:0 }}>
            IR
          </button>
        </div>

        {/* Linha 2: favoritos */}
        <div style={{ display:"flex", gap:6, marginTop:6, overflowX:"auto", paddingBottom:2 }}>
          {FAVORITOS.map(f => (
            <button key={f.url} onClick={() => navigate(f.url)}
              style={{ background: url === f.url ? "#1f6feb" : "#21262d", border:"1px solid #30363d", color: url === f.url ? "#fff" : "#8b949e", borderRadius:12, padding:"3px 10px", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {error ? (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:24, textAlign:"center" }}>
          <Globe size={48} style={{ color:"#58a6ff", opacity:0.4 }}/>
          <p style={{ color:"#f85149", fontSize:14, fontWeight:600 }}>{error}</p>
          <p style={{ color:"#8b949e", fontSize:12 }}>Alguns sites bloqueiam a exibição incorporada por segurança.</p>
          <button onClick={() => navigate("https://www.google.com/search?q=" + encodeURIComponent(url.replace(/^https?:\/\//,"")) + "&igu=1")}
            style={{ background:"#238636", border:"none", color:"#fff", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontSize:13, fontWeight:700 }}>
            🔍 Pesquisar no Google
          </button>
          <button onClick={() => { setError(""); navigate("https://www.google.com/search?igu=1"); }}
            style={{ background:"#21262d", border:"1px solid #30363d", color:"#e6edf3", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:12 }}>
            🏠 Início
          </button>
        </div>
      ) : (
        <div style={{ position:"relative", flex:1 }}>
          {loading && (
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"linear-gradient(90deg,#1f6feb,#58a6ff)", zIndex:10, animation:"progress 1.5s ease infinite" }}/>
          )}
          <iframe
            ref={iframeRef}
            src={url}
            onLoad={handleLoad}
            onError={handleError}
            style={{ width:"100%", height:"100%", border:"none" }}
            allow="geolocation; microphone; camera"
            title="Navegador Interno"
          />
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progress { 0%{width:10%} 50%{width:70%} 100%{width:100%} }
      `}</style>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "#21262d", border: "1px solid #30363d", color: "#e6edf3",
  borderRadius: 8, padding: "6px 8px", cursor: "pointer", display:"flex", alignItems:"center", flexShrink:0,
};
