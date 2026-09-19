# 📱 Manual Completo — Como Transformar o SK Code Editor em APK

> Feito especialmente para você. Siga passo a passo, sem pular nada.

---

## O QUE É O CAPACITOR?

O **Capacitor** é uma ferramenta invisível que funciona como um "empacotador".
Ele pega o seu app (SK Code Editor, ou qualquer outro app web) e envolve ele
numa casca de app Android. O resultado é um arquivo **.APK** — igual ao que
você baixa fora da loja. O app continua sendo o seu, com o mesmo visual e
tudo funcionando. O Capacitor só faz o "pacote".

---

## PARTE 1 — INSTALAR AS FERRAMENTAS NO SEU COMPUTADOR

Você vai precisar instalar **3 coisas** no computador. Faça uma de cada vez.

---

### PASSO 1 — Instalar o Node.js

O Node.js é o motor que roda os comandos de construção do app.

1. Acesse: **https://nodejs.org**
2. Clique no botão verde grande que diz **"LTS" (recomendado)**
3. Baixe e instale normalmente (next, next, finish)
4. Após instalar, abra o **Prompt de Comando** (aperte Win+R, digite `cmd`, Enter)
5. Digite: `node --version` e aperte Enter
6. Se aparecer algo como `v20.x.x` está pronto ✅

---

### PASSO 2 — Instalar o Java JDK 17

O Java é necessário para construir o APK Android.

1. Acesse: **https://adoptium.net**
2. Escolha: **Temurin 17 (LTS)**
3. Baixe o instalador para Windows (.msi) e instale normalmente
4. Após instalar, no Prompt de Comando, digite: `java -version`
5. Se aparecer `openjdk version "17.x.x"` está pronto ✅

---

### PASSO 3 — Instalar o Android Studio

O Android Studio tem as ferramentas para construir o APK.

1. Acesse: **https://developer.android.com/studio**
2. Clique em **Download Android Studio**
3. Instale normalmente (pode demorar, é grande ~1GB)
4. Ao abrir pela primeira vez:
   - Clique em **Next** em tudo
   - Aceite as licenças quando pedir
   - Deixe instalar os componentes (pode demorar)
5. Quando terminar, o Android Studio está pronto ✅

**Configurar a variável ANDROID_HOME:**
1. No Android Studio, vá em: `File → Settings → Appearance → System Settings → Android SDK`
2. Copie o caminho que aparece em "Android SDK Location" (ex: `C:\Users\SEUNOME\AppData\Local\Android\Sdk`)
3. Aperte Win+R, digite `sysdm.cpl`, Enter
4. Aba **Avançado** → **Variáveis de Ambiente**
5. Em "Variáveis do Sistema", clique **Novo**:
   - Nome: `ANDROID_HOME`
   - Valor: cole o caminho que copiou
6. Clique OK em tudo
7. Feche e reabra o Prompt de Comando

---

## PARTE 2 — BAIXAR O PROJETO DO REPLIT

### PASSO 4 — Baixar o código do SK Code Editor

1. No Replit, clique nos **3 pontinhos** (menu) no projeto SK Code Editor
2. Clique em **Download as zip**
3. Salve o arquivo em algum lugar fácil (ex: `C:\Projetos\`)
4. Extraia o ZIP (clique com botão direito → Extrair aqui)
5. Dentro da pasta extraída, navegue até: `artifacts/code-editor`
6. Copie esta pasta para `C:\Projetos\sk-code-editor`

---

## PARTE 3 — PREPARAR O PROJETO

Abra o **Prompt de Comando** e navegue até a pasta do projeto:

```
cd C:\Projetos\sk-code-editor
```

### PASSO 5 — Instalar as dependências

```
npm install
```

Aguarde terminar (pode demorar alguns minutos na primeira vez).

---

### PASSO 6 — Construir o app para produção

```
npm run build:web
```

Isso cria uma pasta chamada `dist` com o app pronto.

---

### PASSO 7 — Adicionar a plataforma Android

```
npx cap add android
```

Isso cria uma pasta `android` dentro do projeto com toda a estrutura do app Android.

---

### PASSO 8 — Sincronizar o app com o Android

```
npx cap sync android
```

Isso copia o seu app pronto para dentro da estrutura Android.

---

## PARTE 4 — GERAR O APK

### PASSO 9 — Abrir no Android Studio

```
npx cap open android
```

O Android Studio vai abrir com o projeto do seu app.

**Aguarde carregar** — na primeira vez ele vai baixar algumas dependências extras.
Você vai ver uma barra de progresso no canto inferior direito. Espere terminar.

---

### PASSO 10 — Gerar o APK

1. No Android Studio, clique no menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Aguarde a construção (aparece uma barra de progresso)
3. Quando terminar, vai aparecer uma notificação no canto inferior direito dizendo **"APK(s) generated"**
4. Clique em **"locate"** na notificação para abrir a pasta onde o APK foi salvo
5. O arquivo estará em: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## PARTE 5 — INSTALAR O APK NO CELULAR

### PASSO 11 — Ativar instalação de apps externos no celular

No celular Android:

1. Vá em **Configurações**
2. Procure por **Segurança** ou **Privacidade**
3. Ative **"Fontes desconhecidas"** ou **"Instalar apps desconhecidos"**

> Em celulares mais novos (Android 8+) essa permissão aparece por aplicativo.
> Quando você tentar instalar, o Android pergunta automaticamente se quer permitir.

---

### PASSO 12 — Transferir o APK para o celular

Você pode fazer de três formas:

**Opção A — Cabo USB:**
1. Conecte o celular no computador com o cabo
2. No celular, selecione **"Transferir arquivos"**
3. Copie o arquivo `app-debug.apk` para o celular
4. No celular, abra o gerenciador de arquivos e toque no APK para instalar

**Opção B — WhatsApp/Telegram:**
1. Envie o arquivo `app-debug.apk` para você mesmo no WhatsApp ou Telegram
2. No celular, baixe o arquivo
3. Toque nele para instalar

**Opção C — Google Drive:**
1. Faça upload do `app-debug.apk` no Google Drive
2. No celular, abra o Drive e baixe o arquivo
3. Toque nele para instalar

---

### PASSO 13 — Instalar

1. Toque no arquivo APK no celular
2. Aparece uma tela perguntando se quer instalar — toque **Instalar**
3. Aguarde alguns segundos
4. Toque **Abrir** — o SK Code Editor vai abrir no celular ✅

---

## PARA OS OUTROS APPS

Para transformar qualquer outro app web em APK, o processo é **exatamente o mesmo**.
A diferença é só o nome e o ID do app. Quando for fazer outro app:

1. Baixe a pasta do app do Replit
2. Edite o arquivo `capacitor.config.ts` e mude:
   - `appId`: coloque um ID único (ex: `com.seuapp.juridico`)
   - `appName`: coloque o nome do app
3. Siga os passos 5 ao 13 normalmente

---

## SE DER ERRO

| Erro | Solução |
|------|---------|
| `node não reconhecido` | Reinstale o Node.js e reinicie o computador |
| `java não reconhecido` | Reinstale o Java JDK 17 e reinicie o computador |
| `SDK not found` | Configure a variável ANDROID_HOME (Passo 3) |
| `build failed` | No Android Studio: `File → Invalidate Caches → Invalidate and Restart` |
| `Gradle sync failed` | Aguarde o Android Studio baixar os arquivos (pode ser lento na 1ª vez) |

---

## RESUMO DOS COMANDOS

```bash
# 1. Entrar na pasta
cd C:\Projetos\sk-code-editor

# 2. Instalar dependências
npm install

# 3. Construir o app
npm run build:web

# 4. Adicionar Android (só na primeira vez)
npx cap add android

# 5. Sincronizar
npx cap sync android

# 6. Abrir Android Studio
npx cap open android

# No Android Studio: Build → Build APK(s)
```

---

Qualquer dúvida, volta aqui no Replit e me pergunta. Faço isso com quantos apps você quiser. 💪
