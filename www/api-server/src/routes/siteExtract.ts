import { Router, type Request, type Response } from "express";
import { ExtractSiteBody, ProxyFetchQueryParams } from "@workspace/api-zod";

const router = Router();

interface SitePage {
  url: string;
  title: string;
  statusCode: number;
  description: string | null;
  canonical: string | null;
}

interface SiteAsset {
  url: string;
  type: "script" | "stylesheet" | "image" | "font" | "video" | "audio" | "document" | "other";
  size: number | null;
  mimeType: string | null;
}

interface SiteLink {
  url: string;
  text: string;
  isExternal: boolean;
}

interface SiteMeta {
  title: string;
  description: string | null;
  generator: string | null;
  charset: string | null;
  viewport: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  canonical: string | null;
  lang: string | null;
}

interface ApiEndpoint {
  url: string;
  method: string;
  pattern: string | null;
}

interface InlineScript {
  index: number;
  preview: string;
  fullContent: string;
  size: number;
  hasCalculo: boolean;
  hasFormula: boolean;
  hasAjax: boolean;
}

interface ExtractResult {
  rootUrl: string;
  crawledAt: string;
  pages: SitePage[];
  assets: SiteAsset[];
  links: SiteLink[];
  meta: SiteMeta;
  apiEndpoints: ApiEndpoint[];
  techStack: string[];
  inlineScripts: InlineScript[];
  rawHtml: string;
}

const TECH_SIGNATURES: Record<string, RegExp[]> = {
  React: [/react(?:\.min)?\.js/, /react-dom/, /__REACT_/, /"react"/, /data-reactroot/],
  "Next.js": [/__NEXT_DATA__/, /\/_next\/static/, /next\/dist/],
  "Vue.js": [/vue(?:\.min)?\.js/, /vue-router/, /__vue_/],
  "Nuxt.js": [/nuxt/, /__NUXT__/],
  Angular: [/angular(?:\.min)?\.js/, /ng-version/, /zone\.js/],
  Svelte: [/svelte/, /\.svelte-kit/],
  jQuery: [/jquery(?:\.min)?\.js/, /jquery\.com/],
  Bootstrap: [/bootstrap(?:\.min)?\.css/, /bootstrap(?:\.min)?\.js/],
  Tailwind: [/tailwind(?:css)?(?:\.min)?\.css/, /tailwindcss/],
  WordPress: [/wp-content/, /wp-includes/, /xmlrpc\.php/],
  Shopify: [/cdn\.shopify\.com/, /shopify\.com\/s\//, /Shopify\.theme/],
  Wix: [/wix\.com/, /wixstatic\.com/],
  Webflow: [/webflow\.com/, /\.webflow\./],
  Gatsby: [/gatsby/, /gatsby-image/, /___gatsby/],
  Vite: [/\/@vite\//, /vite\.config/, /import\.meta\.hot/],
  Framer: [/framer\.com/, /framerusercontent\.com/],
  Stripe: [/js\.stripe\.com/, /Stripe\(/],
  "Google Analytics": [/google-analytics\.com\/analytics/, /gtag\(/],
  "Google Tag Manager": [/googletagmanager\.com\/gtm/],
  "ASP.NET": [/__VIEWSTATE/, /aspnetForm/, /\.aspx/],
  "JSF/PrimeFaces": [/PrimeFaces/, /javax\.faces/, /jsf\.js/],
  PHP: [/\.php/, /PHPSESSID/],
};

function detectTechStack(html: string, assetUrls: string[]): string[] {
  const allContent = html + " " + assetUrls.join(" ");
  const found: string[] = [];
  for (const [tech, patterns] of Object.entries(TECH_SIGNATURES)) {
    if (patterns.some((p) => p.test(allContent))) {
      found.push(tech);
    }
  }
  return found;
}

function classifyAsset(url: string, mimeType?: string): SiteAsset["type"] {
  const ext = url.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeType?.toLowerCase() ?? "";

  if (["js", "mjs", "cjs"].includes(ext) || mime.includes("javascript")) return "script";
  if (["css"].includes(ext) || mime.includes("css")) return "stylesheet";
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "ico"].includes(ext) || mime.includes("image")) return "image";
  if (["woff", "woff2", "ttf", "otf", "eot"].includes(ext) || mime.includes("font")) return "font";
  if (["mp4", "webm", "ogg", "mov", "avi"].includes(ext) || mime.includes("video")) return "video";
  if (["mp3", "wav", "flac", "aac"].includes(ext) || mime.includes("audio")) return "audio";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "document";
  return "other";
}

function extractApiEndpoints(html: string, baseUrl: string): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const seen = new Set<string>();

  const apiPatterns = [
    /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /axios\s*\.\s*(?:get|post|put|patch|delete|head)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /\$\.(?:ajax|get|post)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /XMLHttpRequest[\s\S]*?\.open\s*\(\s*['"`]([A-Z]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
    /['"`](\/api\/[^'"`\s?#]+)['"`]/g,
    /['"`](\/v\d+\/[^'"`\s?#]+)['"`]/g,
    /url\s*:\s*['"`]([^'"`]{5,})['"`]/g,
    /action\s*=\s*['"]([^'"]+\.(?:php|aspx|jsp|do|action)[^'"]*)['"]/g,
  ];

  const methodMap: Record<string, string> = {
    get: "GET", post: "POST", put: "PUT", patch: "PATCH", delete: "DELETE", head: "HEAD",
  };

  for (const pattern of apiPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      try {
        let url = m[2] ?? m[1];
        if (!url) continue;
        if (url.startsWith("/")) url = new URL(url, baseUrl).toString();
        if (!url.startsWith("http")) continue;
        const parsed = new URL(url);
        const key = parsed.pathname;
        if (seen.has(key)) continue;
        seen.add(key);
        const methodMatch = m[0].match(/\.(get|post|put|patch|delete|head)\s*\(/i);
        const method = methodMatch ? methodMap[methodMatch[1].toLowerCase()] ?? "GET" : "GET";
        endpoints.push({ url, method, pattern: key });
      } catch {
      }
    }
  }
  return endpoints.slice(0, 100);
}

function extractInlineScripts(html: string): InlineScript[] {
  const scripts: InlineScript[] = [];
  const pattern = /<script(?![^>]+src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = pattern.exec(html)) !== null) {
    const content = m[1]?.trim() ?? "";
    if (!content || content.length < 20) continue;

    const lower = content.toLowerCase();
    const hasCalculo = /calc[uú]|c[aá]lculo|c[aó]mputo|remuner|salário|salario|benef[ií]cio|previdenci|inss|fator\s*previd|tempo\s*contribui|aposentad|pensão|pensao|correção\s*monet|juros|rmc|rma|coeficiente/i.test(content);
    const hasFormula = /Math\.|function\s+calc|=\s*[\d.]+\s*[\*\/\+\-]|parseFloat|parseInt|\.toFixed\(|formula|f[oó]rmula/i.test(content);
    const hasAjax = /fetch\s*\(|XMLHttpRequest|\.ajax\s*\(|axios\./i.test(content);

    scripts.push({
      index: idx++,
      preview: content.slice(0, 300),
      fullContent: content,
      size: content.length,
      hasCalculo,
      hasFormula,
      hasAjax,
    });
  }

  return scripts;
}

async function fetchPage(url: string): Promise<{ html: string; statusCode: number; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    });
    const contentType = resp.headers.get("content-type") ?? "";
    const html = await resp.text();
    return { html, statusCode: resp.status, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

function parseMeta(html: string, baseUrl: string): SiteMeta {
  const get = (pattern: RegExp) => {
    const m = html.match(pattern);
    return m ? m[1]?.trim() ?? null : null;
  };

  return {
    title: get(/<title[^>]*>([^<]*)<\/title>/i) ?? "",
    description:
      get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ??
      get(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i),
    generator:
      get(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i) ??
      get(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']generator["']/i),
    charset:
      get(/<meta[^>]+charset=["']?([a-zA-Z0-9-]+)["']?/i) ??
      get(/<meta[^>]+http-equiv=["']Content-Type["'][^>]+content=["'][^;]*;\s*charset=([^"'\s]*)["']/i),
    viewport:
      get(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']*)["']/i) ??
      get(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']viewport["']/i),
    ogTitle:
      get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ??
      get(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i),
    ogImage:
      get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i) ??
      get(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i),
    canonical:
      get(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) ??
      get(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i),
    lang: get(/<html[^>]+lang=["']([^"']*)["']/i),
  };
}

function extractLinks(html: string, baseUrl: string): SiteLink[] {
  const base = new URL(baseUrl);
  const links: SiteLink[] = [];
  const seen = new Set<string>();
  const pattern = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    try {
      const href = m[1].trim();
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      const absolute = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      const linkHost = new URL(absolute).hostname;
      const text = (m[2] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      links.push({ url: absolute, text: text.slice(0, 100), isExternal: linkHost !== base.hostname });
    } catch {
    }
  }
  return links.slice(0, 200);
}

function extractAssets(html: string, baseUrl: string): SiteAsset[] {
  const assets: SiteAsset[] = [];
  const seen = new Set<string>();

  const patterns: Array<[RegExp, SiteAsset["type"]]> = [
    [/<script[^>]+src=["']([^"']+)["']/gi, "script"],
    [/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi, "stylesheet"],
    [/<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi, "stylesheet"],
    [/<img[^>]+src=["']([^"']+)["']/gi, "image"],
    [/<source[^>]+src=["']([^"']+)["']/gi, "other"],
    [/<link[^>]+rel=["'](?:preload|prefetch)["'][^>]+href=["']([^"']+)["'][^>]+as=["']font["']/gi, "font"],
    [/url\(['"]?([^'")\s]+\.(?:woff2?|ttf|otf|eot))['"]?\)/gi, "font"],
  ];

  for (const [pattern, type] of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      try {
        const src = m[1].trim();
        if (!src || src.startsWith("data:")) continue;
        const absolute = src.startsWith("http") ? src : new URL(src, baseUrl).toString();
        if (seen.has(absolute)) continue;
        seen.add(absolute);
        assets.push({ url: absolute, type, size: null, mimeType: null });
      } catch {
      }
    }
  }
  return assets.slice(0, 300);
}

function extractSameOriginLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const urls: string[] = [];
  const seen = new Set<string>();
  const pattern = /href=["']([^"'#?][^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    try {
      const href = m[1].trim();
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
      const absolute = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
      const parsed = new URL(absolute);
      if (parsed.hostname !== base.hostname) continue;
      const normalized = parsed.origin + parsed.pathname;
      if (seen.has(normalized) || normalized === baseUrl.split("?")[0]) continue;
      seen.add(normalized);
      urls.push(normalized);
    } catch {
    }
  }
  return urls.slice(0, 20);
}

router.post("/site-extract", async (req: Request, res: Response) => {
  const parsed = ExtractSiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { url: rawUrl, depth = 1 } = parsed.data;

  let rootUrl: string;
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    rootUrl = u.toString();
  } catch {
    res.status(400).json({ error: "URL inválida" });
    return;
  }

  try {
    const { html: rootHtml, statusCode } = await fetchPage(rootUrl);

    const rootMeta = parseMeta(rootHtml, rootUrl);
    const rootAssets = extractAssets(rootHtml, rootUrl);
    const rootLinks = extractLinks(rootHtml, rootUrl);
    const apiEndpoints = extractApiEndpoints(rootHtml, rootUrl);
    const inlineScripts = extractInlineScripts(rootHtml);

    const pages: SitePage[] = [
      {
        url: rootUrl,
        title: rootMeta.title,
        statusCode,
        description: rootMeta.description,
        canonical: rootMeta.canonical,
      },
    ];

    const allAssets: SiteAsset[] = [...rootAssets];
    const assetSeen = new Set(rootAssets.map((a) => a.url));

    if (depth > 1) {
      const subUrls = extractSameOriginLinks(rootHtml, rootUrl).slice(0, depth === 2 ? 5 : 10);
      await Promise.all(
        subUrls.map(async (subUrl) => {
          try {
            const { html, statusCode: sc } = await fetchPage(subUrl);
            const meta = parseMeta(html, subUrl);
            pages.push({ url: subUrl, title: meta.title, statusCode: sc, description: meta.description, canonical: meta.canonical });
            const subAssets = extractAssets(html, subUrl);
            for (const a of subAssets) {
              if (!assetSeen.has(a.url)) {
                assetSeen.add(a.url);
                allAssets.push(a);
              }
            }
            const subApis = extractApiEndpoints(html, subUrl);
            const seen = new Set(apiEndpoints.map((e) => e.url));
            for (const e of subApis) {
              if (!seen.has(e.url)) {
                seen.add(e.url);
                apiEndpoints.push(e);
              }
            }
            const subScripts = extractInlineScripts(html);
            for (const s of subScripts) {
              if (!inlineScripts.some(is => is.preview === s.preview)) {
                inlineScripts.push({ ...s, index: inlineScripts.length });
              }
            }
          } catch {
          }
        }),
      );
    }

    const techStack = detectTechStack(rootHtml, allAssets.map((a) => a.url));

    const result: ExtractResult = {
      rootUrl,
      crawledAt: new Date().toISOString(),
      pages,
      assets: allAssets,
      links: rootLinks,
      meta: rootMeta,
      apiEndpoints,
      techStack,
      inlineScripts,
      rawHtml: rootHtml.slice(0, 200_000),
    };

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar URL";
    req.log.error({ err, url: rootUrl }, "Site extraction failed");
    res.status(422).json({ error: `Não foi possível acessar a URL: ${message}` });
  }
});

router.get("/site-extract/proxy", async (req: Request, res: Response) => {
  const parsed = ProxyFetchQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parâmetro url é obrigatório" });
    return;
  }

  const { url, type = "html" } = parsed.data;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let resp: Response;
    try {
      resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
      }) as unknown as Response;
    } finally {
      clearTimeout(timeout);
    }

    const fetchResp = resp as unknown as globalThis.Response;
    const contentType = fetchResp.headers.get("content-type") ?? "";
    const content = await fetchResp.text();

    res.json({ content: content.slice(0, 1_000_000), statusCode: fetchResp.status, contentType });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao buscar URL";
    res.status(422).json({ error: message });
  }
});

export default router;
