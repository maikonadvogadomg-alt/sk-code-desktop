import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

function buildSystemPrompt(action?: string, effortLevel?: number, verbosity?: string, customPrompt?: string): string {
  if (customPrompt) return customPrompt;

  const esforco = effortLevel === 3 ? "Seja extremamente detalhado e exhaustivo." : effortLevel === 1 ? "Seja conciso e direto ao ponto." : "Equilibre completude e objetividade.";
  const verb = verbosity === "longa" ? "Resposta longa e completa." : "Resposta objetiva.";

  const base = `Você é um assistente jurídico especializado no direito brasileiro (OAB, TJMG, TRT, STJ, STF, CLT, CC, CPC, CP).
Responda SEMPRE em português brasileiro. Seja técnico, preciso e completo.
Nunca invente fatos, leis, números de processos ou jurisprudências.
${esforco} ${verb}
Formatação: parágrafos estruturados, • para listas, aspas para citações legais.`;

  const prompts: Record<string, string> = {
    resumir: `${base}\n\nTAREFA: Faça um RESUMO COMPLETO e estruturado do documento jurídico. Inclua: partes envolvidas, pedidos principais, fundamentos legais, e pontos relevantes.`,
    revisar: `${base}\n\nTAREFA: REVISE o documento jurídico. Aponte erros gramaticais, problemas de fundamentação, inconsistências, pontos fracos, e sugira melhorias específicas.`,
    refinar: `${base}\n\nTAREFA: REESCREVA e REFINE o documento jurídico mantendo todos os fatos e pedidos originais. Melhore clareza, estrutura e argumentação. Mantenha linguagem técnica.`,
    simplificar: `${base}\n\nTAREFA: Traduza o documento jurídico para linguagem acessível a leigos. Explique os termos técnicos, o que está sendo pedido, e o que pode acontecer.`,
    minuta: `${base}\n\nTAREFA: Crie uma MINUTA completa e profissional. Inclua: qualificação das partes, dos fatos, do direito (com fundamentação legal), dos pedidos, e do fecho com local/data/assinatura. Siga padrão forense brasileiro.`,
    analisar: `${base}\n\nTAREFA: ANALISE profundamente o documento. Identifique: pontos fortes e fracos da argumentação, riscos processuais, jurisprudência aplicável (apenas real), estratégia recomendada, e probabilidade de êxito.`,
    "modo-estrito": `${base}\n\nTAREFA: CORRIJA apenas erros de português, pontuação e estilo. NÃO altere conteúdo, argumentos ou estrutura. Entregue o texto corrigido na íntegra.`,
    "modo-redacao": `${base}\n\nTAREFA: MELHORE a redação jurídica. Reestruture parágrafos para maior impacto, fortaleça a argumentação sem inventar fatos. Entregue o documento completo reescrito.`,
    "modo-interativo": `${base}\n\nTAREFA: ANALISE o documento e APONTE O QUE ESTÁ FALTANDO. Faça perguntas específicas sobre informações ausentes que prejudicam a peça. Liste os pontos que precisam ser completados.`,
  };

  return prompts[action || ""] || `${base}\n\nTAREFA: Analise e responda sobre o seguinte texto jurídico de forma completa e detalhada.`;
}

async function streamAI(
  apiKey: string,
  baseUrl: string,
  modelName: string,
  systemPrompt: string,
  userText: string,
  res: Response,
) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      stream: true,
      max_tokens: 16000,
      temperature: 0.3,
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => upstream.statusText);
    res.write(`data: ${JSON.stringify({ error: `Erro da IA (${upstream.status}): ${errText.slice(0, 400)}` })}\n\n`);
    res.end();
    return;
  }

  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
      } catch {}
    }
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

router.post("/ai/process", async (req: Request, res: Response) => {
  const {
    text, model, action, customKey, customUrl, customModel,
    perplexityKey, effortLevel, verbosity, customPrompt,
  } = req.body as Record<string, string>;

  let apiKey = customKey || "";
  let baseUrl = (customUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  let modelName = customModel || "gpt-4o-mini";

  if (model === "perplexity" && perplexityKey) {
    apiKey = perplexityKey;
    baseUrl = "https://api.perplexity.ai";
    modelName = "sonar-pro";
  }

  if (!apiKey) {
    res.status(400).json({ error: "Chave de API não configurada. Configure em Configurações." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const systemPrompt = buildSystemPrompt(action, Number(effortLevel), verbosity, customPrompt);

  try {
    await streamAI(apiKey, baseUrl, modelName, systemPrompt, text || "", res);
  } catch (e) {
    logger.error(e, "ai/process error");
    try {
      res.write(`data: ${JSON.stringify({ error: String(e) })}\n\n`);
      res.end();
    } catch {}
  }
});

router.post("/code-assistant", async (req: Request, res: Response) => {
  const { message, history = [], apiKey: key, apiUrl, apiModel } = req.body as {
    message: string;
    history: Array<{ role: string; content: string }>;
    apiKey?: string;
    apiUrl?: string;
    apiModel?: string;
  };

  const apiKey = key || "";
  const baseUrl = (apiUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const modelName = apiModel || "gpt-4o-mini";

  if (!apiKey) {
    res.status(400).json({ error: "Chave de API não configurada." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const systemPrompt = `Você é um assistente jurídico especializado no direito brasileiro. Responda em português de forma clara, técnica e objetiva. Nunca invente jurisprudências ou leis.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: modelName, messages, stream: true, max_tokens: 8000, temperature: 0.3 }),
    });

    if (!upstream.ok) {
      const err = await upstream.text().catch(() => upstream.statusText);
      res.write(`data: ${JSON.stringify({ text: `❌ Erro da IA (${upstream.status}): ${err.slice(0, 300)}` })}\n\n`);
      res.end();
      return;
    }

    const reader = upstream.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const d = line.slice(6).trim();
        if (d === "[DONE]") continue;
        try {
          const p = JSON.parse(d);
          const c = p.choices?.[0]?.delta?.content;
          if (c) res.write(`data: ${JSON.stringify({ text: c })}\n\n`);
        } catch {}
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    logger.error(e, "code-assistant error");
    try { res.write(`data: ${JSON.stringify({ text: `❌ ${String(e)}` })}\n\n`); res.end(); } catch {}
  }
});

export default router;
