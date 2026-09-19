"use strict";
var http  = require("http");
var os    = require("os");
var cp    = require("child_process");
var buf   = require("buffer");

// Incluir assets embutidos
var EMBEDDED = require("./server_assets.js");

var MIME = {
  "html":"text/html; charset=utf-8",
  "js":"application/javascript; charset=utf-8",
  "css":"text/css; charset=utf-8",
  "json":"application/json",
  "svg":"image/svg+xml",
  "png":"image/png",
  "jpg":"image/jpeg","jpeg":"image/jpeg",
  "ico":"image/x-icon"
};

var PORT = 18633;

function serve(req, res) {
  var url = (req.url || "/").split("?")[0];
  var key = url === "/" ? "index.html" : url.replace(/^\//, "");
  var b64  = EMBEDDED[key] || EMBEDDED["index.html"];
  if (!b64) { res.writeHead(404); res.end("not found"); return; }
  var ext  = key.lastIndexOf(".") > -1 ? key.slice(key.lastIndexOf(".")+1).toLowerCase() : "";
  var mime = MIME[ext] || "application/octet-stream";
  var data = buf.Buffer.from(b64, "base64");
  res.writeHead(200, {"Content-Type": mime, "Cache-Control":"no-store", "Content-Length": data.length});
  res.end(data);
}

var server = http.createServer(serve);
server.on("error", function(e) {
  if (e.code === "EADDRINUSE") {
    console.log("\n  [ERRO] Porta " + PORT + " ja esta em uso.");
    console.log("  Feche a outra janela do SK Code Editor e tente novamente.\n");
  } else {
    console.log("\n  [ERRO] " + e.message + "\n");
  }
  console.log("  Pressione ENTER para fechar...");
  process.stdin.resume();
  process.stdin.on("data", function(){ process.exit(1); });
});

server.listen(PORT, "127.0.0.1", function() {
  var url = "http://127.0.0.1:" + PORT;
  console.log("  ╔════════════════════════════════╗");
  console.log("  ║    SK Code Editor Desktop      ║");
  console.log("  ╚════════════════════════════════╝");
  console.log("  Rodando em: " + url);
  console.log("  Mantenha esta janela aberta.");
  console.log("  Para fechar: Ctrl+C ou feche esta janela.\n");

  var platform = os.platform();
  var cmd;
  if (platform === "win32") {
    cmd = "start \"\" \"" + url + "\"";
  } else if (platform === "darwin") {
    cmd = "open \"" + url + "\"";
  } else {
    cmd = "xdg-open \"" + url + "\"";
  }
  cp.exec(cmd, function(err) {
    if (err) {
      console.log("  NAO foi possivel abrir o navegador automaticamente.");
      console.log("  Abra manualmente: " + url + "\n");
    }
  });
});
