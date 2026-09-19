export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Remove qualquer char fora do ASCII imprimivel (0x20-0x7E) da chave */
function safeKey(key: string): string {
  return key.replace(/[^\x20-\x7E]/g, "").trim();
}

export interface AIConfig {
  provider: string;
  apiKey: string;
  model: string;
}

export interface AIKeySlot {
  id: number;
  name: string;
  provider: "openai" | "anthropic" | "google" | "custom";
  apiKey: string;
  model: string;
  baseUrl: string;
  active: boolean;
}

// ─── Limites máximos por provedor ────────────────────────────────────────────
// Cada provedor tem seu teto de tokens de saída. Usamos o máximo suportado.
const PROVIDER_MAX_TOKENS: Record<string, number> = {
  openai:    16384,  // gpt-4o / gpt-4o-mini suportam até 16384
  anthropic: 32768,  // Claude 3+ suporta até 64k, mas 32k é seguro
  google:    32768,  // Gemini 2.0 Flash suporta 8192 por padrão, mas 1.5 Pro vai até 64k
  custom:    16384,  // padrão para provedores desconhecidos
  builtin:   16384,  // IA embutida (proxy do servidor)
};

const DEFAULT_TEMPERATURE = 0.7;
const MAX_HISTORY_MESSAGES = 80;
const FETCH_TIMEOUT_MS = 900_000; // 15 minutos

const DEFAULT_SLOTS: AIKeySlot[] = [
  { id: 1, name: "Slot 1", provider: "openai",    apiKey: "", model: "gpt-4o-mini",            baseUrl: "", active: false },
  { id: 2, name: "Slot 2", provider: "anthropic", apiKey: "", model: "claude-haiku-4-20250514", baseUrl: "", active: false },
  { id: 3, name: "Slot 3", provider: "google",    apiKey: "", model: "gemini-2.0-flash",        baseUrl: "", active: false },
  { id: 4, name: "Slot 4", provider: "custom",    apiKey: "", model: "",                        baseUrl: "https://openrouter.ai/api/v1", active: false },
];

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err.name === "AbortError")
      throw new Error("Tempo esgotado (15min). Tente novamente com menos contexto ou pacotes.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function loadAISlots(): AIKeySlot[] {
  try {
    const saved = localStorage.getItem("ai-key-slots");
    if (saved) {
      const parsed: AIKeySlot[] = JSON.parse(saved);
      return parsed.map((s, i) => ({
        ...s,
        baseUrl: s.baseUrl || DEFAULT_SLOTS[i]?.baseUrl || "",
      }));
    }
  } catch {}
  return DEFAULT_SLOTS;
}

export function saveAISlots(slots: AIKeySlot[]) {
  localStorage.setItem("ai-key-slots", JSON.stringify(slots));
}

export function getActiveSlot(slots: AIKeySlot[]): AIKeySlot | undefined {
  return slots.find((s) => s.active && s.apiKey);
}

export function detectProviderFromKey(
  key: string
): { provider: AIKeySlot["provider"]; model: string; baseUrl: string } | null {
  const k = key.trim();
  if (!k) return null;
  if (k.startsWith("sk-ant-"))
    return { provider: "anthropic", model: "claude-haiku-4-20250514", baseUrl: "" };
  if (k.startsWith("AIza") || k.startsWith("ya29."))
    return { provider: "google", model: "gemini-2.0-flash", baseUrl: "" };
  if (k.startsWith("sk-or-"))
    return { provider: "custom", model: "anthropic/claude-haiku", baseUrl: "https://openrouter.ai/api/v1" };
  if (k.startsWith("gsk_"))
    return { provider: "custom", model: "llama-3.3-70b-versatile", baseUrl: "https://api.groq.com/openai/v1" };
  if (k.startsWith("xai-"))
    return { provider: "custom", model: "grok-3-mini", baseUrl: "https://api.x.ai/v1" };
  if (k.startsWith("sk-"))
    return { provider: "openai", model: "gpt-4o-mini", baseUrl: "" };
  if (k.length > 20)
    return { provider: "custom", model: "", baseUrl: "" };
  return null;
}

// ─── Chamada principal (sem streaming) ───────────────────────────────────────
export async function sendAIMessage(
  messages: AIMessage[],
  slot: AIKeySlot,
  systemPrompt: string
): Promise<string> {
  const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
  const fullMessages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentMessages,
  ];

  if (slot.provider === "anthropic") return callAnthropic(fullMessages, slot);
  if (slot.provider === "google") return callGemini(fullMessages, slot);
  return callOpenAICompatible(fullMessages, slot); // openai + custom
}

// Modelos de fallback por prefixo de chave — tenta em ordem até um funcionar
const KEY_FALLBACK_MODELS: Record<string, { baseUrl: string; models: string[] }> = {
  "gsk_": {
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
      "llama-3.2-3b-preview",
      "llama3-8b-8192",
      "mixtral-8x7b-32768",
      "llama-3.3-70b-versatile",
      "llama3-70b-8192",
    ],
  },
  "sk-or-": {
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["openai/gpt-4o-mini", "meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free"],
  },
};

function getFallbackConfig(apiKey: string): { baseUrl: string; models: string[] } | null {
  for (const [prefix, cfg] of Object.entries(KEY_FALLBACK_MODELS)) {
    if (apiKey.startsWith(prefix)) return cfg;
  }
  return null;
}

// ─── OpenAI e compatíveis (Groq, OpenRouter, xAI, Together, Mistral, Ollama) ─
async function callOpenAICompatible(messages: AIMessage[], slot: AIKeySlot): Promise<string> {
  const cleanedKey = safeKey(slot.apiKey);
  const fallback = getFallbackConfig(cleanedKey);

  const baseUrl = fallback?.baseUrl
    ?? (slot.provider === "custom" && slot.baseUrl ? slot.baseUrl.replace(/\/$/, "") : "https://api.openai.com/v1");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cleanedKey}`,
    "HTTP-Referer": "https://sk-code-editor.app",
    "X-Title": "SK Code Editor - Jasmim",
  };

  const maxTokens = PROVIDER_MAX_TOKENS[slot.provider] ?? 16384;
  const modelsToTry = fallback
    ? (slot.model && !fallback.models.includes(slot.model)
        ? [slot.model, ...fallback.models]
        : fallback.models)
    : [slot.model || "gpt-4o-mini"];

  let lastError = "";
  for (const model of modelsToTry) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: maxTokens,
          temperature: DEFAULT_TEMPERATURE,
        }),
      });

      if (res.status === 403 || res.status === 404) {
        const err = await res.text();
        lastError = `${res.status}: ${err.slice(0, 200)}`;
        continue; // tenta próximo modelo
      }

      if (!res.ok) {
        const error = await res.text();
        let msg = error.slice(0, 400);
        try { const j = JSON.parse(error); msg = j.error?.message ?? msg; } catch {}
        throw new Error(`Erro ${slot.provider} ${res.status}: ${msg}`);
      }

      // Salva o modelo que funcionou para próximas chamadas
      if (slot.model !== model) { slot.model = model; }

      const data = await res.json() as { choices: { message: { content: string } }[] };
      return data.choices?.[0]?.message?.content || "Sem resposta";
    } catch (e: any) {
      if (e.message?.includes("non ISO-8859-1") || e.message?.includes("fetch")) throw e;
      lastError = e.message;
      if (modelsToTry.length === 1) throw e;
    }
  }

  throw new Error(`Nenhum modelo disponível. Último erro: ${lastError}`);
}

// ─── Anthropic Claude ─────────────────────────────────────────────────────────
async function callAnthropic(messages: AIMessage[], slot: AIKeySlot): Promise<string> {
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": safeKey(slot.apiKey),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: slot.model || "claude-haiku-4-20250514",
      max_tokens: PROVIDER_MAX_TOKENS.anthropic,
      system: systemMsg,
      messages: chatMessages,
      temperature: DEFAULT_TEMPERATURE,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    let msg = error.slice(0, 400);
    try { const j = JSON.parse(error); msg = j.error?.message ?? msg; } catch {}
    throw new Error(`Erro Anthropic ${res.status}: ${msg}`);
  }

  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content?.[0]?.text || "Sem resposta";
}

// ─── Google Gemini (API nativa) ───────────────────────────────────────────────
async function callGemini(messages: AIMessage[], slot: AIKeySlot): Promise<string> {
  const model = slot.model || "gemini-2.0-flash";
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const chatMessages = messages.filter((m) => m.role !== "system");

  const contents = chatMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${slot.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemMsg }] },
        contents,
        generationConfig: {
          maxOutputTokens: PROVIDER_MAX_TOKENS.google,
          temperature: DEFAULT_TEMPERATURE,
          candidateCount: 1,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    let msg = error.slice(0, 400);
    try { const j = JSON.parse(error); msg = j.error?.message ?? msg; } catch {}
    throw new Error(`Erro Gemini ${res.status}: ${msg}`);
  }

  const data = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta";
}

// ─── IA embutida — usa qualquer slot configurado (sem servidor Replit) ────────
export async function sendBuiltinAI(
  messages: AIMessage[],
  systemPrompt: string
): Promise<string> {
  // Tenta usar qualquer slot ativo salvo no localStorage
  const slots = loadAISlots();
  const active = getActiveSlot(slots)
    ?? slots.find(s => s.apiKey)   // qualquer slot com chave
    ?? null;

  if (active) {
    return sendAIMessage(messages, active, systemPrompt);
  }

  // Nenhuma chave configurada — instrução ao usuário
  throw new Error(
    "Nenhuma chave de IA configurada. Abra o painel IA (🤖) → Configurações → " +
    "adicione uma chave gratuita (ex: Groq gsk_... em groq.com/keys)."
  );
}

// ─── Streaming helpers ────────────────────────────────────────────────────────

/**
 * Retorna true se o slot suporta streaming via SSE no lado do cliente.
 * Anthropic streaming requer CORS especial; usamos a chamada normal no non-streaming path.
 * Google pode usar o endpoint OpenAI-compatible para streaming.
 */
export function slotCanStream(slot: AIKeySlot | undefined, useBuiltin: boolean): boolean {
  if (useBuiltin || !slot) return false;
  if (slot.provider === "anthropic") return false; // usa chamada direta sem stream
  return true;
}

/** Retorna a URL de streaming para o slot */
export function getStreamUrl(slot: AIKeySlot): string {
  if (slot.provider === "google") {
    return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  }
  if (slot.provider === "openai") {
    return "https://api.openai.com/v1/chat/completions";
  }
  const base = (slot.baseUrl || "").replace(/\/chat\/completions\/?$/, "");
  return `${base}/chat/completions`;
}

/** Headers para chamada de streaming */
export function getStreamHeaders(slot: AIKeySlot): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${safeKey(slot.apiKey)}`,
    "HTTP-Referer": "https://sk-code-editor.app",
    "X-Title": "SK Code Editor - Jasmim",
  };
}

/** Corpo da requisição de streaming */
export function getStreamBody(
  slot: AIKeySlot,
  messages: { role: string; content: string }[],
  systemPrompt: string
): string {
  return JSON.stringify({
    model: slot.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
    max_tokens: PROVIDER_MAX_TOKENS[slot.provider] ?? 16384,
    temperature: DEFAULT_TEMPERATURE,
  });
}

// ─── Testes ───────────────────────────────────────────────────────────────────
export async function testBuiltinAI(): Promise<{ ok: boolean; msg: string }> {
  try {
    const result = await sendBuiltinAI(
      [{ role: "user", content: "Responda apenas: OK" }],
      "Responda apenas 'OK' e nada mais."
    );
    return { ok: true, msg: `✅ Funcionando! Resposta: "${result.slice(0, 60)}"` };
  } catch (err: any) {
    return { ok: false, msg: `❌ ${err.message}` };
  }
}

export async function testAISlot(slot: AIKeySlot): Promise<{ ok: boolean; msg: string }> {
  try {
    const result = await sendAIMessage(
      [{ role: "user", content: "Responda apenas: OK" }],
      slot,
      "Você é um assistente. Responda apenas 'OK' e nada mais."
    );
    return { ok: true, msg: `✅ Funcionando! Resposta: "${result.slice(0, 60)}"` };
  } catch (err: any) {
    return { ok: false, msg: `❌ ${err.message}` };
  }
}

// ─── ParsedBlock ──────────────────────────────────────────────────────────────
export interface ParsedBlock {
  type: "text" | "code" | "command" | "file";
  content: string;
  filePath?: string;
  language?: string;
  label?: string;
}

export function parseAIResponse(response: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let remaining = response;

  while (remaining.length > 0) {
    const fileMatch = remaining.match(/```filepath:([^\n]+)\n([\s\S]*?)```/);
    const cmdMatch  = remaining.match(/```(?:bash|shell|sh|cmd|command)\n([\s\S]*?)```/);
    const codeMatch = remaining.match(/```(\w*)\n([\s\S]*?)```/);

    const firstFile = fileMatch ? remaining.indexOf(fileMatch[0]) : Infinity;
    const firstCmd  = cmdMatch  ? remaining.indexOf(cmdMatch[0])  : Infinity;
    const firstCode = codeMatch ? remaining.indexOf(codeMatch[0]) : Infinity;
    const first = Math.min(firstFile, firstCmd, firstCode);

    if (first === Infinity) {
      if (remaining.trim()) blocks.push({ type: "text", content: remaining });
      break;
    }

    if (first > 0) {
      const text = remaining.slice(0, first);
      if (text.trim()) blocks.push({ type: "text", content: text });
    }

    if (firstFile <= firstCmd && firstFile <= firstCode && fileMatch) {
      blocks.push({ type: "file", content: fileMatch[2].trim(), filePath: fileMatch[1].trim() });
      remaining = remaining.slice(firstFile + fileMatch[0].length);
    } else if (firstCmd <= firstCode && cmdMatch) {
      blocks.push({ type: "command", content: cmdMatch[1].trim() });
      remaining = remaining.slice(firstCmd + cmdMatch[0].length);
    } else if (codeMatch) {
      blocks.push({ type: "code", content: codeMatch[2].trim(), language: codeMatch[1] || "plaintext" });
      remaining = remaining.slice(firstCode + codeMatch[0].length);
    } else {
      break;
    }
  }

  return blocks;
}
