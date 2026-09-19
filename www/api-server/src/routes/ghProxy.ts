import { Router, type IRouter } from "express";
import { Readable } from "stream";

const router: IRouter = Router();
const GH = "https://api.github.com";

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "APKBuilder-Proxy/1.0",
  };
  if (token) h["Authorization"] = `token ${token}`;
  return h;
}

/* GET /api/gh-proxy/zipball?owner=X&repo=Y&branch=Z&token=T
   Faz streaming direto — sem buffer na memória, suporta repos enormes */
router.get("/gh-proxy/zipball", async (req, res) => {
  const { owner, repo, branch, token } = req.query as Record<string, string>;

  if (!owner || !repo) {
    res.status(400).json({ error: "owner e repo são obrigatórios" });
    return;
  }

  const br = branch || "main";
  const hdrs = ghHeaders(token || undefined);

  const candidates = [
    `${GH}/repos/${owner}/${repo}/zipball/${br}`,
    ...(br === "main" ? [`${GH}/repos/${owner}/${repo}/zipball/master`] : []),
  ];

  for (const url of candidates) {
    let upstream: Response;
    try {
      upstream = await fetch(url, { headers: hdrs, redirect: "follow" });
    } catch {
      continue;
    }

    if (!upstream.ok || !upstream.body) continue;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Transfer-Encoding", "chunked");

    // Streaming — nenhum byte fica em memória no servidor
    try {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const ok = res.write(value);
        if (!ok) await new Promise(r => res.once("drain", r));
      }
      res.end();
    } catch {
      if (!res.headersSent) res.status(502).json({ error: "Erro durante streaming do ZIP" });
    }
    return;
  }

  res.status(502).json({
    error: `Não foi possível baixar ${owner}/${repo}. Verifique se o repositório existe e é público (ou se o token tem acesso).`,
  });
});

/* GET /api/gh-proxy/repo?owner=X&repo=Y&token=T */
router.get("/gh-proxy/repo", async (req, res) => {
  const { owner, repo, token } = req.query as Record<string, string>;
  if (!owner || !repo) {
    res.status(400).json({ error: "owner e repo são obrigatórios" });
    return;
  }
  try {
    const r = await fetch(`${GH}/repos/${owner}/${repo}`, {
      headers: ghHeaders(token || undefined),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

export { Readable }; // evita warning de import não usado
export default router;
