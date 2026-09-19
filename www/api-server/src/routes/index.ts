import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter from "./health";
import ghProxyRouter from "./ghProxy";
import aiProcessRouter from "./aiProcess";
import siteExtractRouter from "./siteExtract";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ghProxyRouter);
router.use(aiProcessRouter);
router.use(siteExtractRouter);

// Configuração do terminal — o SK Code Editor busca essa rota
// para descobrir a URL do WebSocket do terminal
router.get("/config", (_req: Request, res: Response) => {
  const host = _req.headers["x-forwarded-host"] ?? _req.headers["host"] ?? "localhost";
  const proto = _req.headers["x-forwarded-proto"] ?? "http";
  const wsProto = String(proto) === "https" ? "wss" : "ws";
  res.json({
    terminalWsUrl: `${wsProto}://${host}/api/ws/terminal`,
    version: "2.0",
  });
});

export default router;
