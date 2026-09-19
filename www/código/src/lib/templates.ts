export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: Record<string, string>;
}

export const templates: Template[] = [
  {
    id: "html-css-js",
    name: "HTML/CSS/JS",
    description: "Projeto web basico com HTML, CSS e JavaScript",
    icon: "globe",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meu Projeto</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <h1>Ola Mundo!</h1>
    <p>Edite este arquivo para comecar.</p>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
      "style.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #eee;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

#app {
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p {
  font-size: 1.2rem;
  color: #aaa;
}`,
      "script.js": `document.addEventListener('DOMContentLoaded', () => {
  console.log('Projeto carregado com sucesso!');
});`,
    },
  },
  {
    id: "react-app",
    name: "React App",
    description: "Aplicacao React com JSX",
    icon: "component",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="src/index.jsx"></script>
</body>
</html>`,
      "src/index.jsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
      "src/App.jsx": `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0f0f23',
      color: '#fff',
      fontFamily: 'system-ui'
    }}>
      <h1>React App</h1>
      <p>Contador: {count}</p>
      <button 
        onClick={() => setCount(c => c + 1)}
        style={{
          padding: '10px 24px',
          fontSize: '1rem',
          borderRadius: '8px',
          border: 'none',
          background: '#646cff',
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        Incrementar
      </button>
    </div>
  );
}`,
      "package.json": `{
  "name": "react-app",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}`,
    },
  },
  {
    id: "node-api",
    name: "Node.js API",
    description: "API REST com Express",
    icon: "server",
    files: {
      "index.js": `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let items = [
  { id: 1, name: 'Item 1', description: 'Primeiro item' },
  { id: 2, name: 'Item 2', description: 'Segundo item' },
];

app.get('/api/items', (req, res) => {
  res.json(items);
});

app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item nao encontrado' });
  res.json(item);
});

app.post('/api/items', (req, res) => {
  const item = {
    id: items.length + 1,
    name: req.body.name,
    description: req.body.description
  };
  items.push(item);
  res.status(201).json(item);
});

app.listen(PORT, () => {
  console.log(\`Servidor rodando na porta \${PORT}\`);
});`,
      "package.json": `{
  "name": "node-api",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "express": "^4.18.2"
  },
  "scripts": {
    "start": "node index.js"
  }
}`,
    },
  },
  {
    id: "python-flask",
    name: "Python Flask",
    description: "API web com Flask",
    icon: "code",
    files: {
      "app.py": `from flask import Flask, jsonify, request

app = Flask(__name__)

items = [
    {"id": 1, "name": "Item 1", "description": "Primeiro item"},
    {"id": 2, "name": "Item 2", "description": "Segundo item"},
]

@app.route("/")
def home():
    return jsonify({"message": "Bem-vindo a API Flask!"})

@app.route("/api/items")
def get_items():
    return jsonify(items)

@app.route("/api/items", methods=["POST"])
def create_item():
    data = request.get_json()
    item = {
        "id": len(items) + 1,
        "name": data.get("name"),
        "description": data.get("description"),
    }
    items.append(item)
    return jsonify(item), 201

if __name__ == "__main__":
    app.run(debug=True, port=5000)`,
      "requirements.txt": `flask==3.0.0`,
    },
  },
  {
    id: "typescript-node",
    name: "TypeScript Node",
    description: "Projeto TypeScript com Node.js",
    icon: "file-type",
    files: {
      "src/index.ts": `interface User {
  id: number;
  name: string;
  email: string;
}

const users: User[] = [
  { id: 1, name: "Joao", email: "joao@email.com" },
  { id: 2, name: "Maria", email: "maria@email.com" },
];

function findUser(id: number): User | undefined {
  return users.find(u => u.id === id);
}

function addUser(name: string, email: string): User {
  const newUser: User = {
    id: users.length + 1,
    name,
    email,
  };
  users.push(newUser);
  return newUser;
}

console.log("Usuarios:", users);
console.log("Buscar ID 1:", findUser(1));
console.log("Novo usuario:", addUser("Pedro", "pedro@email.com"));`,
      "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}`,
      "package.json": `{
  "name": "typescript-node",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}`,
    },
  },
  {
    id: "empty",
    name: "Projeto Vazio",
    description: "Comece do zero",
    icon: "folder-plus",
    files: {
      "README.md": `# Novo Projeto\n\nComece a criar seus arquivos aqui.`,
    },
  },
  {
    id: "pwa-app",
    name: "PWA Instalável",
    description: "App instalável no celular com suporte offline e manifest completo",
    icon: "globe",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#1a1f2e">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Meu App">
  <meta name="description" content="Meu aplicativo PWA instalavel">
  <title>Meu App</title>
  <link rel="manifest" href="manifest.json">
  <link rel="apple-touch-icon" href="icon-192.png">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="offline-bar" class="offline-bar hidden">
    📡 Sem conexão — modo offline ativo
  </div>

  <header class="header">
    <div class="logo">⚡ Meu App</div>
    <div id="status-dot" class="status-dot online" title="Online"></div>
  </header>

  <main class="main">
    <section class="hero">
      <div class="hero-icon">📱</div>
      <h1>Bem-vindo ao Meu App</h1>
      <p>Este app funciona offline e pode ser instalado no seu celular.</p>
      <button id="install-btn" class="btn btn-primary hidden">
        ⬇️ Instalar no Celular
      </button>
      <button id="refresh-btn" class="btn btn-outline">
        🔄 Recarregar
      </button>
    </section>

    <section class="cards">
      <div class="card">
        <span class="card-icon">📴</span>
        <h3>Funciona Offline</h3>
        <p>Acesse mesmo sem internet graças ao Service Worker.</p>
      </div>
      <div class="card">
        <span class="card-icon">📲</span>
        <h3>Instalável</h3>
        <p>Adicione à tela inicial do celular como um app nativo.</p>
      </div>
      <div class="card">
        <span class="card-icon">⚡</span>
        <h3>Rápido</h3>
        <p>Cache inteligente para carregamento instantâneo.</p>
      </div>
    </section>

    <section class="counter-section">
      <h2>Contador (salvo localmente)</h2>
      <div class="counter">
        <button class="counter-btn" id="dec">−</button>
        <span class="counter-value" id="count">0</span>
        <button class="counter-btn" id="inc">+</button>
      </div>
      <button class="btn btn-outline" id="reset">Resetar</button>
    </section>
  </main>

  <footer class="footer">
    <p>Feito com ❤️ · Instalado como PWA</p>
  </footer>

  <script src="app.js"></script>
</body>
</html>`,

      "style.css": `* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #0f1117;
  --surface: #1a1f2e;
  --card: #1e2540;
  --accent: #4f8ef7;
  --accent2: #7c5cbf;
  --text: #e8eaf0;
  --muted: #8892a4;
  --success: #34d399;
  --danger: #f87171;
  --radius: 16px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.offline-bar {
  background: var(--danger);
  color: white;
  text-align: center;
  padding: 8px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.3s;
}
.hidden { display: none !important; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--surface);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
}
.logo { font-size: 18px; font-weight: 700; color: var(--accent); }
.status-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  transition: background 0.3s;
}
.status-dot.online { background: var(--success); box-shadow: 0 0 6px var(--success); }
.status-dot.offline { background: var(--danger); }

.main { flex: 1; padding: 24px 20px; max-width: 500px; margin: 0 auto; width: 100%; }

.hero {
  text-align: center;
  padding: 40px 0 32px;
}
.hero-icon { font-size: 64px; margin-bottom: 16px; }
.hero h1 { font-size: 24px; font-weight: 800; margin-bottom: 12px; line-height: 1.2; }
.hero p { color: var(--muted); font-size: 15px; margin-bottom: 24px; line-height: 1.6; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 50px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  margin: 6px;
}
.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: white;
}
.btn-primary:active { transform: scale(0.96); }
.btn-outline {
  background: transparent;
  border: 1.5px solid rgba(255,255,255,0.15);
  color: var(--muted);
}
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }

.cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 32px;
}
.card {
  background: var(--card);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.card-icon { font-size: 28px; }
.card h3 { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.card p { font-size: 13px; color: var(--muted); line-height: 1.5; }

.counter-section {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 24px;
  text-align: center;
  border: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 16px;
}
.counter-section h2 { font-size: 16px; margin-bottom: 20px; color: var(--muted); }
.counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 20px;
}
.counter-btn {
  width: 52px; height: 52px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.1);
  background: var(--card);
  color: white;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s;
}
.counter-btn:active { transform: scale(0.9); background: var(--accent); border-color: var(--accent); }
.counter-value {
  font-size: 52px;
  font-weight: 800;
  min-width: 80px;
  color: var(--accent);
}

.footer {
  text-align: center;
  padding: 20px;
  color: var(--muted);
  font-size: 12px;
  border-top: 1px solid rgba(255,255,255,0.04);
}`,

      "app.js": `// ─── PWA Install Prompt ───────────────────────
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('hidden');
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('Instalação:', outcome);
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  console.log('App instalado com sucesso!');
  installBtn.classList.add('hidden');
});

// ─── Offline / Online detection ───────────────
const offlineBar = document.getElementById('offline-bar');
const statusDot  = document.getElementById('status-dot');

function updateStatus() {
  const online = navigator.onLine;
  offlineBar.classList.toggle('hidden', online);
  statusDot.className = 'status-dot ' + (online ? 'online' : 'offline');
  statusDot.title = online ? 'Online' : 'Offline';
}
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);
updateStatus();

// ─── Service Worker ───────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(r => console.log('[SW] Registrado:', r.scope))
    .catch(e => console.warn('[SW] Erro:', e));
}

// ─── Contador com localStorage ────────────────
let count = parseInt(localStorage.getItem('pwa-count') || '0');
const display = document.getElementById('count');

function updateCount(n) {
  count = n;
  display.textContent = count;
  localStorage.setItem('pwa-count', count);
}

document.getElementById('inc')?.addEventListener('click', () => updateCount(count + 1));
document.getElementById('dec')?.addEventListener('click', () => updateCount(count - 1));
document.getElementById('reset')?.addEventListener('click', () => updateCount(0));
document.getElementById('refresh-btn')?.addEventListener('click', () => location.reload());

updateCount(count);`,

      "sw.js": `// Service Worker — Cache Offline
const CACHE = 'meu-app-v1';
const FILES = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.status === 200) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
    ).catch(() => caches.match('./index.html'))
  );
});`,

      "manifest.json": `{
  "name": "Meu App",
  "short_name": "MeuApp",
  "description": "Aplicativo PWA instalavel",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0f1117",
  "theme_color": "#1a1f2e",
  "lang": "pt-BR",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}`,

      "icon-192.png": "",

      "README.md": `# Meu App — PWA Instalável

## O que é PWA?

Progressive Web App (PWA) é um site que pode ser **instalado como aplicativo** no celular ou desktop, funcionando **offline** e com ícone na tela inicial.

## Como rodar localmente

Abra o \`index.html\` no Preview (botão ▶) ou use um servidor local:
\`\`\`bash
npx serve .
# Acesse http://localhost:3000
\`\`\`

## Como publicar GRÁTIS 🚀

### Opção 1 — Netlify (mais fácil)
1. Acesse [netlify.com](https://netlify.com) e crie conta grátis
2. Clique em **"Add new site" → "Deploy manually"**
3. Baixe este projeto como ZIP (menu ··· → Exportar ZIP)
4. Arraste a pasta descompactada para o Netlify
5. Pronto! URL gerada automaticamente (ex: \`meuapp.netlify.app\`)

### Opção 2 — Vercel
1. Acesse [vercel.com](https://vercel.com) → crie conta com GitHub
2. Faça upload dos arquivos ou conecte repositório
3. Deploy automático com HTTPS

### Opção 3 — GitHub Pages (grátis com repositório público)
1. Crie um repositório no [github.com](https://github.com)
2. Faça upload dos arquivos
3. Settings → Pages → Source: "main" branch
4. URL: \`seuusuario.github.io/nome-do-repo\`

### Opção 4 — Cloudflare Pages
1. Acesse [pages.cloudflare.com](https://pages.cloudflare.com)
2. Upload direto ou conecte GitHub
3. Domínio customizado grátis (\`meuapp.pages.dev\`)

## Após publicar

Acesse pelo celular via HTTPS e o Chrome vai mostrar:
**"Adicionar à tela inicial"** — toque e o app vira um ícone!

## Estrutura
\`\`\`
index.html    ← Página principal
style.css     ← Estilos
app.js        ← Lógica do app + install prompt + offline
sw.js         ← Service Worker (cache offline)
manifest.json ← Metadados do PWA (nome, ícone, cor)
\`\`\`
`,
    },
  },

  {
    id: "canvas-art",
    name: "Animação Canvas",
    description: "Arte interativa com partículas e geometria — reage ao toque e mouse",
    icon: "globe",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Universo de Partículas</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; }
    canvas { display: block; }
    #ui {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      z-index: 10;
    }
    button {
      padding: 10px 18px;
      border-radius: 50px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: 13px;
      cursor: pointer;
      backdrop-filter: blur(10px);
      transition: all 0.2s;
    }
    button:active { transform: scale(0.94); background: rgba(255,255,255,0.1); }
    #info {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.4);
      font-family: monospace;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="info">Toque ou mova o mouse</div>
  <canvas id="c"></canvas>
  <div id="ui">
    <button onclick="changeMode()">🎨 Modo</button>
    <button onclick="burst()">💥 Burst</button>
    <button onclick="clear()">🗑️ Limpar</button>
  </div>
  <script src="sketch.js"></script>
</body>
</html>`,

      "sketch.js": `const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let W = canvas.width  = window.innerWidth;
let H = canvas.height = window.innerHeight;
let mx = W/2, my = H/2;
let particles = [];
let frame = 0;
let mode = 0; // 0=universe 1=web 2=flower 3=matrix

const MODES = ['🌌 Universo', '🕸️ Teia', '🌸 Flor', '💻 Matrix'];
const PALETTES = [
  ['#4fc3f7','#e040fb','#80deea','#fff176','#f48fb1'],
  ['#69f0ae','#40c4ff','#ea80fc','#ffffff'],
  ['#ff80ab','#ff6d00','#ffd740','#69f0ae','#e040fb'],
  ['#00e676','#76ff03','#18ffff'],
];

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y;
    this.vx = vx || (Math.random()-0.5)*4;
    this.vy = vy || (Math.random()-0.5)*4;
    this.color = color || PALETTES[mode][Math.floor(Math.random()*PALETTES[mode].length)];
    this.life = life || Math.random()*120+60;
    this.maxLife = this.life;
    this.size = size || Math.random()*3+1;
    this.angle = Math.random()*Math.PI*2;
    this.spin = (Math.random()-0.5)*0.1;
  }
  update() {
    const alpha = this.life / this.maxLife;
    // Attraction to cursor
    const dx = mx - this.x;
    const dy = my - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 200) {
      this.vx += dx/dist * 0.08;
      this.vy += dy/dist * 0.08;
    }
    this.vx *= 0.97;
    this.vy *= 0.97;
    this.x += this.vx;
    this.y += this.vy;
    this.angle += this.spin;
    this.life--;
    // Bounce edges
    if (this.x < 0 || this.x > W) this.vx *= -0.8;
    if (this.y < 0 || this.y > H) this.vy *= -0.8;
    return this.life > 0;
  }
  draw() {
    const alpha = Math.pow(this.life / this.maxLife, 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (mode === 2) {
      // Flor: pétala
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size*2, this.size*0.8, 0, 0, Math.PI*2);
      ctx.fill();
    } else if (mode === 3) {
      // Matrix: caractere
      ctx.fillStyle = this.color;
      ctx.font = \`\${this.size*5}px monospace\`;
      ctx.fillText(String.fromCharCode(0x30A0 + Math.floor(this.life/4)%96), 0, 0);
    } else {
      // Círculo com glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawConnections() {
  const near = particles.slice(0, 80);
  for (let i = 0; i < near.length; i++) {
    for (let j = i+1; j < near.length; j++) {
      const dx = near[i].x - near[j].x;
      const dy = near[i].y - near[j].y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 80) {
        const alpha = (1 - d/80) * 0.3 * (near[i].life/near[i].maxLife);
        ctx.strokeStyle = near[i].color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(near[i].x, near[i].y);
        ctx.lineTo(near[j].x, near[j].y);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function spawnAtCursor(n = 3) {
  const palette = PALETTES[mode];
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 0.5;
    const color = palette[Math.floor(Math.random()*palette.length)];
    if (mode === 1) { // Teia — slow
      particles.push(new Particle(mx, my, Math.cos(angle)*speed*0.4, Math.sin(angle)*speed*0.4, color, 200, 2));
    } else if (mode === 2) { // Flor
      particles.push(new Particle(mx, my, Math.cos(angle)*speed, Math.sin(angle)*speed*0.3, color, 150, 4));
    } else {
      particles.push(new Particle(mx, my, Math.cos(angle)*speed, Math.sin(angle)*speed, color));
    }
  }
  if (particles.length > 500) particles.splice(0, 10);
}

function burst() {
  for (let i = 0; i < 80; i++) {
    const angle = (i / 80) * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    const color = PALETTES[mode][i % PALETTES[mode].length];
    particles.push(new Particle(mx, my, Math.cos(angle)*speed, Math.sin(angle)*speed, color, 180, Math.random()*4+1));
  }
}

function changeMode() {
  mode = (mode + 1) % MODES.length;
  particles = [];
  document.getElementById('info').textContent = MODES[mode];
  setTimeout(() => { document.getElementById('info').textContent = 'Toque ou mova o mouse'; }, 2000);
}

function clear() { particles = []; }

function animate() {
  requestAnimationFrame(animate);
  frame++;
  // Fade trail
  ctx.fillStyle = mode === 3 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, W, H);

  // Auto-spawn
  if (frame % 3 === 0) spawnAtCursor(2);

  // Background geometry
  if (mode === 0 && frame % 60 === 0) {
    // Random star burst
    const rx = Math.random()*W, ry = Math.random()*H;
    const r = Math.random()*50+20;
    const color = PALETTES[0][Math.floor(Math.random()*PALETTES[0].length)];
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  if (mode === 1) drawConnections();

  particles = particles.filter(p => { p.update(); p.draw(); return p.life > 0; });

  // Cursor glow
  const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
  const col = PALETTES[mode][0];
  grad.addColorStop(0, col + '20');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(mx, my, 60, 0, Math.PI*2);
  ctx.fill();
}

// Events
function updateMouse(e) {
  if (e.touches) {
    mx = e.touches[0].clientX;
    my = e.touches[0].clientY;
  } else {
    mx = e.clientX;
    my = e.clientY;
  }
}
window.addEventListener('mousemove', e => { updateMouse(e); spawnAtCursor(1); });
window.addEventListener('touchmove', e => { e.preventDefault(); updateMouse(e); spawnAtCursor(3); }, { passive: false });
window.addEventListener('click', burst);
window.addEventListener('touchstart', e => { updateMouse(e); burst(); });

animate();`,
    },
  },

  {
    id: "landing-page",
    name: "Landing Page",
    description: "Página de apresentação profissional para mostrar a clientes",
    icon: "globe",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Transformamos sua ideia em realidade digital">
  <title>Studio Digital — Criamos para o futuro</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- NAV -->
  <nav class="nav" id="nav">
    <div class="nav-inner">
      <a href="#" class="nav-logo">⚡ Studio</a>
      <div class="nav-links">
        <a href="#servicos">Serviços</a>
        <a href="#portfolio">Portfólio</a>
        <a href="#contato">Contato</a>
      </div>
      <a href="#contato" class="btn-nav">Falar Agora</a>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero" id="inicio">
    <div class="hero-bg">
      <div class="blob blob1"></div>
      <div class="blob blob2"></div>
      <div class="blob blob3"></div>
    </div>
    <div class="hero-content">
      <span class="badge">🚀 Transformação Digital</span>
      <h1>Criamos experiências <span class="gradient-text">digitais incríveis</span></h1>
      <p>Sites, apps e sistemas que convertem visitantes em clientes. Design moderno, código limpo, resultados reais.</p>
      <div class="hero-btns">
        <a href="#contato" class="btn btn-primary">Começar Projeto</a>
        <a href="#portfolio" class="btn btn-ghost">Ver Trabalhos →</a>
      </div>
      <div class="hero-stats">
        <div class="stat"><strong>120+</strong><span>Projetos</span></div>
        <div class="stat-div"></div>
        <div class="stat"><strong>98%</strong><span>Satisfação</span></div>
        <div class="stat-div"></div>
        <div class="stat"><strong>5★</strong><span>Avaliação</span></div>
      </div>
    </div>
  </section>

  <!-- SERVIÇOS -->
  <section class="section" id="servicos">
    <div class="container">
      <div class="section-header">
        <span class="tag">O que fazemos</span>
        <h2>Soluções completas<br>para o seu negócio</h2>
      </div>
      <div class="services-grid">
        <div class="service-card">
          <div class="service-icon">🌐</div>
          <h3>Sites & Landing Pages</h3>
          <p>Sites responsivos e otimizados que carregam rápido e convertem visitantes em clientes.</p>
          <ul><li>✓ Design moderno</li><li>✓ Mobile-first</li><li>✓ SEO otimizado</li></ul>
        </div>
        <div class="service-card featured">
          <div class="service-badge">Mais popular</div>
          <div class="service-icon">📱</div>
          <h3>Aplicativos PWA</h3>
          <p>Apps instaláveis no celular sem precisar de App Store. Funciona offline com visual nativo.</p>
          <ul><li>✓ Instalável no celular</li><li>✓ Funciona offline</li><li>✓ Push notifications</li></ul>
        </div>
        <div class="service-card">
          <div class="service-icon">⚙️</div>
          <h3>Sistemas & APIs</h3>
          <p>Back-end robusto com APIs REST, banco de dados e autenticação segura.</p>
          <ul><li>✓ Node.js / Python</li><li>✓ PostgreSQL / MongoDB</li><li>✓ Deploy na nuvem</li></ul>
        </div>
      </div>
    </div>
  </section>

  <!-- PORTFOLIO -->
  <section class="section section-dark" id="portfolio">
    <div class="container">
      <div class="section-header">
        <span class="tag">Portfólio</span>
        <h2>Projetos que entregamos</h2>
      </div>
      <div class="portfolio-grid">
        <div class="portfolio-card" style="--c:#6366f1">
          <div class="portfolio-visual">🛒</div>
          <h4>E-commerce Premium</h4>
          <p>Loja virtual completa com pagamento, estoque e painel admin.</p>
          <span class="tech-tag">React</span><span class="tech-tag">Node.js</span><span class="tech-tag">Stripe</span>
        </div>
        <div class="portfolio-card" style="--c:#10b981">
          <div class="portfolio-visual">📊</div>
          <h4>Dashboard Analytics</h4>
          <p>Painel de métricas em tempo real com gráficos e relatórios.</p>
          <span class="tech-tag">Vue</span><span class="tech-tag">Python</span><span class="tech-tag">PostgreSQL</span>
        </div>
        <div class="portfolio-card" style="--c:#f59e0b">
          <div class="portfolio-visual">🏥</div>
          <h4>App de Agendamento</h4>
          <p>Sistema de agendamentos para clínica com notificações automáticas.</p>
          <span class="tech-tag">PWA</span><span class="tech-tag">Firebase</span><span class="tech-tag">WhatsApp API</span>
        </div>
      </div>
    </div>
  </section>

  <!-- CONTATO -->
  <section class="section" id="contato">
    <div class="container">
      <div class="contact-box">
        <div class="contact-info">
          <span class="tag">Vamos conversar</span>
          <h2>Pronto para começar seu projeto?</h2>
          <p>Respondo em até 24 horas. Orçamento gratuito e sem compromisso.</p>
          <div class="contact-links">
            <a href="https://wa.me/5511999999999" class="contact-link">💬 WhatsApp</a>
            <a href="mailto:contato@studio.com" class="contact-link">✉️ E-mail</a>
            <a href="https://instagram.com" class="contact-link">📸 Instagram</a>
          </div>
        </div>
        <form class="contact-form" onsubmit="sendForm(event)">
          <input type="text" placeholder="Seu nome" required>
          <input type="email" placeholder="E-mail" required>
          <select>
            <option value="">Tipo de projeto</option>
            <option>Site / Landing Page</option>
            <option>Aplicativo PWA</option>
            <option>Sistema / API</option>
            <option>Outro</option>
          </select>
          <textarea placeholder="Descreva seu projeto..." rows="4" required></textarea>
          <button type="submit" class="btn btn-primary">Enviar Mensagem ✉️</button>
          <p id="form-msg" class="form-msg hidden">✅ Mensagem enviada! Em breve te respondo.</p>
        </form>
      </div>
    </div>
  </section>

  <footer class="footer">
    <p>© 2025 Studio Digital · Feito com ❤️ no Brasil</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>`,

      "style.css": `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #050810;
  --surface: #0d1117;
  --card: #111827;
  --border: rgba(255,255,255,0.07);
  --text: #f1f5f9;
  --muted: #94a3b8;
  --accent: #6366f1;
  --accent2: #8b5cf6;
  --green: #10b981;
  --radius: 20px;
}

html { scroll-behavior: smooth; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; }

/* NAV */
.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 16px 0; transition: background 0.3s; }
.nav.scrolled { background: rgba(5,8,16,0.9); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
.nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 32px; }
.nav-logo { font-size: 20px; font-weight: 800; color: var(--text); text-decoration: none; }
.nav-links { display: flex; gap: 24px; flex: 1; }
.nav-links a { color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
.nav-links a:hover { color: var(--text); }
.btn-nav { padding: 9px 20px; background: var(--accent); color: white; border-radius: 50px; text-decoration: none; font-size: 13px; font-weight: 600; white-space: nowrap; }

/* HERO */
.hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; position: relative; overflow: hidden; padding: 120px 24px 80px; }
.hero-bg { position: absolute; inset: 0; pointer-events: none; }
.blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; animation: float 8s ease-in-out infinite; }
.blob1 { width: 600px; height: 600px; background: var(--accent); top: -200px; left: -200px; }
.blob2 { width: 500px; height: 500px; background: var(--accent2); bottom: -100px; right: -100px; animation-delay: -3s; }
.blob3 { width: 400px; height: 400px; background: var(--green); top: 50%; left: 50%; transform: translate(-50%,-50%); animation-delay: -6s; }
@keyframes float { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-30px) scale(1.05); } 66% { transform: translate(-20px,20px) scale(0.95); } }

.hero-content { position: relative; max-width: 700px; }
.badge { display: inline-block; padding: 6px 16px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); border-radius: 50px; font-size: 13px; color: #a5b4fc; font-weight: 600; margin-bottom: 24px; }
.hero h1 { font-size: clamp(32px, 5vw, 64px); font-weight: 900; line-height: 1.1; margin-bottom: 20px; }
.gradient-text { background: linear-gradient(135deg, var(--accent), var(--accent2), var(--green)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero p { font-size: 18px; color: var(--muted); max-width: 500px; margin: 0 auto 32px; line-height: 1.7; }
.hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }

.btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 50px; font-size: 15px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; transition: all 0.2s; }
.btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; box-shadow: 0 4px 20px rgba(99,102,241,0.4); }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(99,102,241,0.5); }
.btn-ghost { background: transparent; border: 1.5px solid var(--border); color: var(--muted); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.hero-stats { display: flex; align-items: center; justify-content: center; gap: 24px; }
.stat { text-align: center; } .stat strong { display: block; font-size: 28px; font-weight: 900; color: var(--text); }
.stat span { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
.stat-div { width: 1px; height: 40px; background: var(--border); }

/* SECTIONS */
.section { padding: 100px 0; }
.section-dark { background: var(--surface); }
.container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
.section-header { text-align: center; margin-bottom: 56px; }
.tag { display: inline-block; padding: 4px 14px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 50px; font-size: 12px; color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
.section-header h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; line-height: 1.2; }

/* SERVICES */
.services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.service-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 32px; position: relative; transition: all 0.3s; }
.service-card:hover { border-color: rgba(99,102,241,0.3); transform: translateY(-4px); }
.service-card.featured { border-color: rgba(99,102,241,0.4); background: linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.05)); }
.service-badge { position: absolute; top: -12px; left: 24px; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 50px; }
.service-icon { font-size: 40px; margin-bottom: 16px; }
.service-card h3 { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
.service-card p { color: var(--muted); font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
.service-card ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.service-card li { font-size: 13px; color: var(--muted); }

/* PORTFOLIO */
.portfolio-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.portfolio-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; transition: all 0.3s; border-top: 3px solid var(--c, var(--accent)); }
.portfolio-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
.portfolio-visual { font-size: 40px; margin-bottom: 16px; }
.portfolio-card h4 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.portfolio-card p { color: var(--muted); font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
.tech-tag { display: inline-block; padding: 3px 10px; border-radius: 50px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); font-size: 11px; color: var(--muted); margin: 2px; }

/* CONTACT */
.contact-box { display: grid; grid-template-columns: 1fr 1.2fr; gap: 60px; align-items: center; }
.contact-info h2 { font-size: clamp(24px, 3vw, 36px); font-weight: 800; margin: 12px 0 16px; line-height: 1.2; }
.contact-info p { color: var(--muted); font-size: 16px; line-height: 1.7; margin-bottom: 28px; }
.contact-links { display: flex; flex-direction: column; gap: 12px; }
.contact-link { display: inline-flex; align-items: center; gap: 10px; padding: 12px 20px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; color: var(--text); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; }
.contact-link:hover { border-color: var(--accent); color: var(--accent); }
.contact-form { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 32px; display: flex; flex-direction: column; gap: 12px; }
.contact-form input, .contact-form select, .contact-form textarea { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; color: var(--text); font-size: 14px; outline: none; transition: border 0.2s; font-family: inherit; }
.contact-form input:focus, .contact-form select:focus, .contact-form textarea:focus { border-color: var(--accent); }
.contact-form select option { background: var(--surface); }
.form-msg { font-size: 13px; color: var(--green); text-align: center; }

/* FOOTER */
.footer { text-align: center; padding: 32px 24px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--border); }

@media (max-width: 768px) {
  .nav-links { display: none; }
  .contact-box { grid-template-columns: 1fr; }
  .blob { display: none; }
}`,

      "script.js": `// Nav scroll effect
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
});

// Form submit
function sendForm(e) {
  e.preventDefault();
  const msg = document.getElementById('form-msg');
  msg.classList.remove('hidden');
  e.target.reset();
  setTimeout(() => msg.classList.add('hidden'), 5000);
}

// Reveal on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(el => {
    if (el.isIntersecting) {
      el.target.style.opacity = '1';
      el.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.service-card, .portfolio-card, .contact-box').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});`,
    },
  },
  {
    id: "fullstack-neon",
    name: "Projeto Profissional Full-Stack + Neon DB",
    description: "API REST Express + PostgreSQL Neon + JWT Auth + VCS pronto (gitignore, README, .env.example)",
    icon: "server",
    files: {
      "package.json": JSON.stringify({
        name: "meu-projeto",
        version: "1.0.0",
        description: "Projeto Full-Stack profissional com Neon DB",
        main: "src/index.js",
        scripts: {
          start: "node src/index.js",
          dev: "nodemon src/index.js",
          migrate: "node db/migrate.js",
          test: "jest"
        },
        dependencies: {
          express: "^4.18.2",
          cors: "^2.8.5",
          dotenv: "^16.3.1",
          "@neondatabase/serverless": "^0.9.5",
          bcryptjs: "^2.4.3",
          jsonwebtoken: "^9.0.2",
          helmet: "^7.1.0",
          "express-rate-limit": "^7.1.5"
        },
        devDependencies: {
          nodemon: "^3.0.2"
        }
      }, null, 2),
      ".env.example": `# =================================================
# VARIAVEIS DE AMBIENTE — NUNCA COMMITE O .env REAL
# Copie este arquivo: cp .env.example .env
# Preencha com seus valores reais
# =================================================

# Banco de dados Neon (https://neon.tech — gratuito)
DATABASE_URL=postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/meudb?sslmode=require

# Servidor
PORT=3000
NODE_ENV=development

# Segurança JWT (gere uma chave aleatória forte)
JWT_SECRET=substitua-por-chave-secreta-forte-de-32-chars-min
JWT_EXPIRES_IN=7d

# CORS — domínios permitidos (separe por virgula)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173`,
      ".gitignore": `# Dependencias
node_modules/
.pnp
.pnp.js
__pycache__/
*.py[cod]
venv/

# Variaveis de ambiente (NUNCA suba .env real)
.env
.env.local
.env.*.local

# Build
dist/
build/
.next/
out/
.cache/

# Banco de dados local
*.db
*.sqlite
*.sqlite3

# Sistema operacional
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Logs
*.log
npm-debug.log*

# Testes
coverage/
.nyc_output/

# Arquivos pesados
*.mp4
*.mov
*.zip
*.tar.gz`,
      "README.md": `# Meu Projeto Full-Stack

> API REST profissional com autenticação JWT e banco PostgreSQL (Neon)

## Stack
- **Backend**: Node.js + Express
- **Banco de dados**: PostgreSQL via Neon DB (serverless, gratuito)
- **Autenticação**: JWT (JSON Web Tokens)
- **Segurança**: Helmet, CORS, Rate Limiting

## Setup Rápido

\`\`\`bash
# 1. Clone o repositório
git clone <sua-url>
cd meu-projeto

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com seu DATABASE_URL do Neon

# 4. Inicialize o banco de dados
npm run migrate

# 5. Inicie o servidor
npm run dev
\`\`\`

## Variáveis de Ambiente
Veja [.env.example](.env.example) para a lista completa.

## Rotas da API

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/register | Criar conta |
| POST | /api/auth/login | Fazer login |

### Usuários (protegido)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/usuarios/perfil | Meu perfil |

## Deploy

### Railway (recomendado)
1. \`git push\` para GitHub
2. Importe o repo em [railway.app](https://railway.app)
3. Configure \`DATABASE_URL\` nas variáveis de ambiente

### Render
1. \`git push\` para GitHub
2. Crie Web Service em [render.com](https://render.com)
3. Build: \`npm install\` | Start: \`npm start\`

## Enviando para GitHub
\`\`\`bash
git init
git add .
git commit -m "Projeto inicial"
git remote add origin <url-do-seu-repo>
git push -u origin main
\`\`\`
`,
      "src/index.js": `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initDb } = require('../db/neon');
const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');

const app = express();
const PORT = process.env.PORT || 3000;

// Segurança
app.use(helmet());
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // max 100 requests por IP
  message: { erro: 'Muitas requisições. Tente novamente em 15 minutos.' }
}));
app.use(express.json({ limit: '10mb' }));

// Rotas
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);

// Erro 404
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Erro global
app.use((err, req, res, next) => {
  console.error('Erro:', err.message);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// Inicia servidor
async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(\`✅ Servidor rodando na porta \${PORT}\`);
      console.log(\`🌐 Health check: http://localhost:\${PORT}/api/health\`);
    });
  } catch (err) {
    console.error('❌ Falha ao iniciar:', err.message);
    process.exit(1);
  }
}

start();`,
      "src/routes/auth.js": `const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('../../db/neon');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'Senha deve ter no mínimo 6 caracteres' });
    }
    const [existente] = await sql\`SELECT id FROM usuarios WHERE email = \${email}\`;
    if (existente) {
      return res.status(409).json({ erro: 'E-mail já cadastrado' });
    }
    const senhaHash = await bcrypt.hash(senha, 12);
    const [usuario] = await sql\`
      INSERT INTO usuarios (nome, email, senha_hash)
      VALUES (\${nome}, \${email}, \${senhaHash})
      RETURNING id, nome, email, criado_em
    \`;
    const token = jwt.sign({ id: usuario.id, email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
    res.status(201).json({ mensagem: 'Conta criada com sucesso!', token, usuario });
  } catch (err) {
    console.error('Erro no registro:', err.message);
    res.status(500).json({ erro: 'Erro ao criar conta' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }
    const [usuario] = await sql\`SELECT * FROM usuarios WHERE email = \${email}\`;
    if (!usuario) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    const token = jwt.sign({ id: usuario.id, email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
    res.json({
      mensagem: 'Login realizado com sucesso!',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    });
  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

module.exports = router;`,
      "src/routes/usuarios.js": `const express = require('express');
const { autenticar } = require('../middleware/auth');
const { sql } = require('../../db/neon');

const router = express.Router();

// GET /api/usuarios/perfil (protegido)
router.get('/perfil', autenticar, async (req, res) => {
  try {
    const [usuario] = await sql\`
      SELECT id, nome, email, criado_em FROM usuarios WHERE id = \${req.usuario.id}
    \`;
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json({ usuario });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar perfil' });
  }
});

module.exports = router;`,
      "src/middleware/auth.js": `const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação não fornecido' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

module.exports = { autenticar };`,
      "db/neon.js": `const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurado! Crie o arquivo .env');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function initDb() {
  await sql\`
    CREATE TABLE IF NOT EXISTS usuarios (
      id        SERIAL PRIMARY KEY,
      nome      VARCHAR(255) NOT NULL,
      email     VARCHAR(255) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  \`;
  console.log('✅ Banco de dados Neon pronto!');
}

module.exports = { sql, initDb };`,
      "db/migrate.js": `require('dotenv').config();
const { initDb } = require('./neon');

console.log('🔄 Iniciando migração do banco de dados...');
initDb()
  .then(() => {
    console.log('✅ Migração concluída com sucesso!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Falha na migração:', err.message);
    process.exit(1);
  });`,
    },
  },
];
