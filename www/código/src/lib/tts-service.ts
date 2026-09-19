export interface TTSConfig {
  enabled: boolean;
  lang: string;
  rate: number;
  pitch: number;
  voiceName: string;
}

const DEFAULT_CONFIG: TTSConfig = {
  enabled: true,
  lang: "pt-BR",
  rate: 1.15,
  pitch: 0.95,
  voiceName: "",
};

const PT_BR_VOICE_PRIORITY = [
  "francisca",
  "francisc",
  "luciana",
  "google português do brasil",
  "google português",
  "google pt",
  "portuguese brazil",
  "brazil",
  "pt-br",
  "pt_br",
];

export function loadTTSConfig(): TTSConfig {
  try {
    const saved = localStorage.getItem("tts-config");
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_CONFIG;
}

export function saveTTSConfig(config: TTSConfig) {
  localStorage.setItem("tts-config", JSON.stringify(config));
}

export function getAvailableVoices(lang: string): SpeechSynthesisVoice[] {
  if (!window.speechSynthesis) return [];
  const langBase = lang.split("-")[0].toLowerCase();
  return window.speechSynthesis
    .getVoices()
    .filter(v =>
      v.lang.toLowerCase().startsWith(langBase) ||
      v.lang.toLowerCase() === lang.toLowerCase()
    );
}

function selectBestVoice(voices: SpeechSynthesisVoice[], config: TTSConfig): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  if (config.voiceName) {
    const byName = voices.find(v => v.name === config.voiceName);
    if (byName) return byName;
  }
  for (const keyword of PT_BR_VOICE_PRIORITY) {
    const found = voices.find(v =>
      v.name.toLowerCase().includes(keyword) ||
      v.lang.toLowerCase().includes(keyword)
    );
    if (found) return found;
  }
  return voices[0] || null;
}

/**
 * Limpa markdown e código para fala natural.
 * Remove: blocos de código, inline code, URLs, cabeçalhos, negrito/itálico,
 * linhas separadoras, marcadores de lista, nomes de arquivo isolados.
 * Mantém frases conversacionais mesmo com parênteses ou pontuação.
 */
export function cleanForSpeech(rawText: string, maxChars = 1200): string {
  let text = rawText;

  // 1. Remove blocos de código (```...```)
  text = text.replace(/```[\s\S]*?```/g, "");

  // 2. Remove inline code (`...`) — substitui por conteúdo sem backtick
  text = text.replace(/`([^`\n]{1,60})`/g, "$1");
  text = text.replace(/`[^`\n]+`/g, "");

  // 3. Remove cabeçalhos markdown (# Título → Título)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 4. Remove negrito e itálico (**texto** → texto, *texto* → texto)
  text = text.replace(/\*{2,3}([^*\n]+)\*{2,3}/g, "$1");
  text = text.replace(/\*([^*\n]+)\*/g, "$1");
  text = text.replace(/_{2}([^_\n]+)_{2}/g, "$1");

  // 5. Remove URLs
  text = text.replace(/https?:\/\/\S+/g, "");

  // 6. Filtra linha a linha — remove ruído técnico óbvio
  const lines = text.split("\n").filter(line => {
    const t = line.trim();
    if (!t) return false;
    // Linhas separadoras (---, ===, ___...)
    if (/^[-─—=*_]{3,}$/.test(t)) return false;
    // Nomes de arquivo isolados (ex: EditorLayout.tsx, src/lib/utils.ts)
    if (/^[\w\-./\\]+\.(ts|tsx|js|jsx|py|json|css|html|md|sh|env|toml|yaml|yml|lock)$/.test(t)) return false;
    // Linhas que são CLARAMENTE só código (começam com palavras-chave de código)
    if (/^(import\s|export\s|const\s|let\s|var\s|function\s|class\s|return\s|if\s*\(|for\s*\(|while\s*\(|async\s|await\s)/.test(t)) return false;
    // Linhas que são só símbolos
    if (/^[{}[\]();,.<>|&^%$@!=+\-*/\\]+$/.test(t)) return false;
    return true;
  });

  // 7. Remove marcadores de lista no início
  text = lines.join(" ")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "");

  // 8. Limpa espaços múltiplos
  text = text.replace(/\s+/g, " ").trim();

  // 9. Trunca em limite de caracteres na fronteira de frase
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf(".", maxChars);
  return cut > 50 ? text.slice(0, cut + 1) : text.slice(0, maxChars);
}

// ─── Motor de fala em chunks — resolve o bug do Chrome que para após 15s ────

let currentChunks: string[] = [];
let chunkIndex = 0;
let currentVoice: SpeechSynthesisVoice | null = null;
let currentConfig: TTSConfig | null = null;
let onDoneCallback: (() => void) | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

function startKeepalive() {
  if (keepaliveTimer) return;
  keepaliveTimer = setInterval(() => {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, 5000);
}

function stopKeepalive() {
  if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
}

/**
 * Divide texto em sentenças de até maxLen chars para evitar o bug do Chrome.
 */
function splitIntoChunks(text: string, maxLen = 220): string[] {
  const chunks: string[] = [];
  // Divide em sentenças usando pontuação final
  const sentences = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [text];
  let current = "";
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if ((current + " " + trimmed).trim().length <= maxLen) {
      current = (current + " " + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      // Sentença maior que maxLen? Divide por vírgulas
      if (trimmed.length > maxLen) {
        const parts = trimmed.match(/[^,;]+[,;]?/g) || [trimmed];
        let sub = "";
        for (const part of parts) {
          if ((sub + " " + part).trim().length <= maxLen) {
            sub = (sub + " " + part).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = part.trim();
          }
        }
        if (sub) current = sub;
        else current = "";
      } else {
        current = trimmed;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(c => c.trim().length > 0);
}

function speakChunk(index: number) {
  if (!window.speechSynthesis || !currentConfig) return;
  if (index >= currentChunks.length) {
    stopKeepalive();
    const cb = onDoneCallback;
    onDoneCallback = null;
    cb?.();
    return;
  }

  const text = currentChunks[index];
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = currentConfig.lang;
  utterance.rate = currentConfig.rate;
  utterance.pitch = currentConfig.pitch;
  if (currentVoice) utterance.voice = currentVoice;

  utterance.onend = () => {
    speakChunk(index + 1);
  };
  utterance.onerror = (e) => {
    // Tenta próximo chunk mesmo com erro
    if (e.error !== "interrupted") {
      speakChunk(index + 1);
    } else {
      stopKeepalive();
      const cb = onDoneCallback;
      onDoneCallback = null;
      cb?.();
    }
  };

  window.speechSynthesis.speak(utterance);
  startKeepalive();
}

function doSpeak(text: string, config: TTSConfig, onDone?: () => void) {
  if (!window.speechSynthesis || !text.trim()) {
    onDone?.();
    return;
  }

  window.speechSynthesis.cancel();
  stopKeepalive();

  const voices = window.speechSynthesis.getVoices();
  currentVoice = selectBestVoice(voices, config);
  currentConfig = config;
  currentChunks = splitIntoChunks(text);
  chunkIndex = 0;
  onDoneCallback = onDone || null;

  // Pequeno delay para garantir que o cancel() foi processado
  setTimeout(() => speakChunk(0), 120);
}

export function speak(text: string, config: TTSConfig, onDone?: () => void): void {
  if (!config.enabled || !window.speechSynthesis || !text.trim()) {
    onDone?.();
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    doSpeak(text, config, onDone);
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak(text, config, onDone);
    };
    window.speechSynthesis.getVoices();
  }
}

export function stopSpeaking() {
  stopKeepalive();
  onDoneCallback = null;
  currentChunks = [];
  window.speechSynthesis?.cancel();
}

export function startSpeechRecognition(
  lang: string,
  onResult: (text: string) => void,
  onEnd: () => void
): { stop: () => void } | null {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onend = onEnd;
  recognition.onerror = () => onEnd();
  recognition.start();

  return { stop: () => recognition.stop() };
}
