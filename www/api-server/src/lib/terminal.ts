import { spawn, type ChildProcess } from "child_process";
import { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger";
import { Duplex } from "stream";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min sem actividade → fecha

export function attachTerminalWs(
  wss: WebSocketServer,
) {
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ url: req.url }, "[terminal] nova sessão WebSocket");

    let proc: ChildProcess | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        ws.send("\r\n\x1b[33m[Sessão encerrada por inactividade (30 min)]\x1b[0m\r\n");
        ws.close();
      }, IDLE_TIMEOUT_MS);
    };

    // Inicia bash via `script` para ter PTY real (cores, progresso, etc.)
    proc = spawn(
      "script",
      ["-q", "-c", "bash", "/dev/null"],
      {
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          LANG: "C.UTF-8",
          LC_ALL: "C.UTF-8",
          FORCE_COLOR: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    resetIdle();

    proc.stdout?.on("data", (data: Buffer) => {
      resetIdle();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data, { binary: true });
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      resetIdle();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data, { binary: true });
      }
    });

    proc.on("exit", (code) => {
      logger.info({ code }, "[terminal] processo bash encerrado");
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`\r\n\x1b[90m[Processo encerrado (código ${code ?? "?"})]\x1b[0m\r\n`);
        ws.close();
      }
    });

    proc.on("error", (err) => {
      logger.error({ err }, "[terminal] erro no processo");
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`\r\n\x1b[31m[Erro interno: ${err.message}]\x1b[0m\r\n`);
        ws.close();
      }
    });

    ws.on("message", (data: Buffer | string) => {
      resetIdle();
      if (!proc || proc.killed) return;

      if (typeof data === "string") {
        try {
          const msg = JSON.parse(data);
          if (msg.type === "resize") {
            // xterm.js envia resize; `script` não suporta diretamente, ignorar
            return;
          }
        } catch {
          // não é JSON — trata como input de texto
        }
        proc.stdin?.write(data);
      } else {
        proc.stdin?.write(data);
      }
    });

    ws.on("close", () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (proc && !proc.killed) {
        proc.kill("SIGTERM");
        setTimeout(() => { if (proc && !proc.killed) proc.kill("SIGKILL"); }, 2000);
      }
      logger.info("[terminal] WebSocket fechado");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "[terminal] erro WebSocket");
    });
  });
}

export function createTerminalWss(): WebSocketServer {
  return new WebSocketServer({ noServer: true });
}
