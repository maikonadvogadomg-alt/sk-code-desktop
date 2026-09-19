import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { createTerminalWss, attachTerminalWs } from "./lib/terminal";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

// WebSocket para terminal bash real
const terminalWss = createTerminalWss();
attachTerminalWs(terminalWss);

server.on("upgrade", (req, socket, head) => {
  const url = req.url ?? "";
  if (url === "/api/ws/terminal" || url.startsWith("/api/ws/terminal?")) {
    terminalWss.handleUpgrade(req, socket as any, head, (ws) => {
      terminalWss.emit("connection", ws, req);
    });
  } else {
    (socket as any).destroy();
  }
});

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
