#!/usr/bin/env node
"use strict";
const http  = require("http");
const fs    = require("fs");
const path  = require("path");
const os    = require("os");
const { exec } = require("child_process");

const PORT  = 18633;

// Quando rodando como .exe gerado por pkg, os assets ficam ao lado do executável
const EXE_DIR  = path.dirname(process.execPath);
const SELF_DIR = __dirname;

function resolveAsset(rel) {
  // Tenta ao lado do .exe primeiro, depois ao lado do script
  const candidates = [
    path.join(EXE_DIR, "app", rel),
    path.join(SELF_DIR, "app", rel),
    path.join(SELF_DIR, "..", "dist-apk", rel),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js"  : "application/javascript; charset=utf-8",
  ".css" : "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg" : "image/svg+xml",
  ".png" : "image/png",
  ".jpg" : "image/jpeg",
  ".ico" : "image/x-icon",
  ".woff2":"font/woff2",
  ".woff": "font/woff",
  ".ttf" : "font/ttf",
};

const server = http.createServer((req, res) => {
  let url = req.url.split("?")[0];
  if (url === "/" || url === "") url = "/index.html";

  // Remove leading slash
  const rel = url.replace(/^\//, "");
  const filePath = resolveAsset(rel);

  if (!filePath) {
    // SPA fallback — serve index.html
    const idx = resolveAsset("index.html");
    if (idx) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(idx));
    } else {
      res.writeHead(404);
      res.end("SK Code Editor: arquivo nao encontrado. Verifique se a pasta 'app' esta ao lado do executavel.");
    }
    return;
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  res.end(fs.readFileSync(filePath));
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`\n  SK Code Editor rodando em: ${url}\n`);

  // Abrir navegador automaticamente
  let cmd;
  switch (os.platform()) {
    case "win32":  cmd = `start "" "${url}"`; break;
    case "darwin": cmd = `open "${url}"`;     break;
    default:       cmd = `xdg-open "${url}"`; break;
  }
  exec(cmd, (err) => {
    if (err) console.log("  Abra manualmente:", url);
  });

  console.log("  Pressione Ctrl+C para fechar o editor.\n");
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n  Porta ${PORT} ja em uso. Feche a outra instancia e tente novamente.\n`);
  } else {
    console.error("\n  Erro ao iniciar servidor:", e.message, "\n");
  }
  process.exit(1);
});
