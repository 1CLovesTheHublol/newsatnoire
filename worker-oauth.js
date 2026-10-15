// News At Noire — Cloudflare Worker "noire-oauth"
// 1) GitHub OAuth broker for Decap CMS (/auth, /callback)
// 2) Writers' Desk: invite-only essay publishing by email (/writer/*)
// 3) Public essay API for the site (/essays, /essay)
//
// Paste this WHOLE file into the worker's "Edit code" editor, then Deploy.
// Settings > Variables and Secrets:
//   Secrets: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET   (CMS login, already set)
//            GITHUB_TOKEN     fine-grained token, repo newsatnoire, Contents: Read and write
//            RESEND_API_KEY   from resend.com (sends the sign-in codes)
//            SESSION_SECRET   any long random string
//   Text:    ALLOWED_EMAILS   comma-separated, optional names: "jane@x.com:Jane Doe, sam@y.com"
//            MAIL_FROM        e.g. "News At Noire <desk@newsatnoire.com>"
//            REQUIRE_REVIEW   "true" to hold new essays as drafts until you publish them in /admin
// Bindings > KV namespace: WRITER_KV

const OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const OAUTH_TOKEN = "https://github.com/login/oauth/access_token";
const REPO = "1CLovesTheHublol/newsatnoire";
const BRANCH = "main";
const DIR = "content/essays";
const SITE = "https://www.newsatnoire.com";
const CATEGORIES = ["Essays", "Politics", "History", "Culture", "Economics", "Literature"];

// ---------- helpers ----------
const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = (s) => b64url(enc.encode(s));
const fromB64url = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
function b64utf8(s) { const bytes = enc.encode(s); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
async function sha256(s) { return b64url(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
async function hmac(secret, s) { const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(s))); }
function allowList(env) {
  const m = new Map();
  (env.ALLOWED_EMAILS || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => { const [e, ...n] = x.split(":"); m.set(e.trim().toLowerCase(), n.join(":").trim()); });
  return m;
}
function corsHeaders(req) {
  const o = req.headers.get("Origin") || "";
  const ok = /^https:\/\/(www\.)?newsatnoire\.com$/.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o);
  return { "Access-Control-Allow-Origin": ok ? o : SITE, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Vary": "Origin" };
}
const json = (req, data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders(req), ...extra } });
const gh = (env, path, init = {}) => fetch(`https://api.github.com/repos/${REPO}/${path}`, { ...init, headers: { "Authorization": `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github+json", "User-Agent": "newsatnoire-desk", ...(init.headers || {}) } });

function slugify(s) { return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "essay"; }
function parseFront(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/); if (!m) return { meta: {}, body: md };
  const meta = {}; const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/); if (!kv) continue;
    let [, k, v] = kv;
    if (/^[>|][-+]?$/.test(v)) { const buf = []; while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) buf.push(lines[++i].trim()); v = buf.join(v[0] === ">" ? " " : "\n"); }
    else if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch (e) { v = v.slice(1, -1); } }
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    else if (v === "true" || v === "false") v = v === "true";
    meta[k] = v;
  }
  return { meta, body: m[2] };
}
async function session(req, env) {
  const t = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/, ""); const [p, sig] = t.split(".");
  if (!p || !sig || sig !== await hmac(env.SESSION_SECRET, p)) return null;
  let s; try { s = JSON.parse(fromB64url(p)); } catch (e) { return null; }
  if (!s.exp || s.exp < Date.now()) return null;
  const allow = allowList(env); if (!allow.has(s.e)) return null; // access removed = signed out
  return { email: s.e, name: s.n || allow.get(s.e) || "" };
}
async function cached(req, key, ttl, make) {
  const cache = caches.default; const ck = new Request(key);
  const hit = await cache.match(ck); if (hit) { const r = new Response(hit.body, hit); Object.entries(corsHeaders(req)).forEach(([k, v]) => r.headers.set(k, v)); return r; }
  const data = await make(); const res = json(req, data, data && data.error ? 404 : 200, { "Cache-Control": `public, max-age=${ttl}` });
  if (!(data && data.error)) await cache.put(ck, res.clone()); return res;
}

// ---------- OAuth (Decap CMS) ----------
function renderResult(status, content) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
  (function(){function r(e){window.opener.postMessage('authorization:github:${status}:${JSON.stringify(content)}',e.origin);window.removeEventListener("message",r,false);}
  window.addEventListener("message",r,false);window.opener.postMessage("authorizing:github","*");})();
</script></body></html>`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url); const { pathname } = url;
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

    if (pathname === "/auth") {
      const a = new URL(OAUTH_AUTHORIZE);
      a.searchParams.set("client_id", env.GITHUB_CLIENT_ID); a.searchParams.set("redirect_uri", `${url.origin}/callback`);
      a.searchParams.set("scope", url.searchParams.get("scope") || "repo,user"); a.searchParams.set("state", crypto.randomUUID());
      return Response.redirect(a.toString(), 302);
    }
    if (pathname === "/callback") {
      const code = url.searchParams.get("code"); if (!code) return new Response("Missing code", { status: 400 });
      const r = await fetch(OAUTH_TOKEN, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "newsatnoire-oauth" }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }) });
      const d = await r.json();
      const html = d.error || !d.access_token ? renderResult("error", { message: d.error || "no token" }) : renderResult("success", { token: d.access_token, provider: "github" });
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // ---------- Writers' Desk ----------
    if (pathname === "/writer/request-code" && req.method === "POST") {
      const { email = "" } = await req.json().catch(() => ({})); const e = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return json(req, { error: "Enter a valid email address." }, 400);
      const allow = allowList(env);
      if (allow.has(e)) {
        const rk = `rl:${e}`; const n = +(await env.WRITER_KV.get(rk)) || 0;
        if (n >= 5) return json(req, { error: "Too many codes requested. Try again in 15 minutes." }, 429);
        await env.WRITER_KV.put(rk, String(n + 1), { expirationTtl: 900 });
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
        await env.WRITER_KV.put(`code:${e}`, JSON.stringify({ h: await sha256(code + e), tries: 0 }), { expirationTtl: 600 });
        await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: env.MAIL_FROM || "News At Noire <onboarding@resend.dev>", to: [e], subject: `Your News At Noire sign-in code: ${code}`,
            text: `Your sign-in code for the News At Noire Writers' Desk is ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.`,
            html: `<div style="font-family:Georgia,serif;background:#F4F1EA;padding:32px;color:#1A1A1A"><div style="font-size:22px">News At <em style="color:#6E1423">Noire</em></div><p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#6E1423;margin:24px 0 8px">The Writers' Desk</p><p style="font-size:16px">Your sign-in code:</p><p style="font-size:40px;letter-spacing:.2em;margin:8px 0 16px">${code}</p><p style="font-family:Arial,sans-serif;font-size:13px;color:#6b6256">It expires in 10 minutes. If you didn't ask for it, ignore this email.</p></div>`
          })
        });
      }
      // Same answer either way, so the list of invited emails can't be guessed.
      return json(req, { ok: true });
    }

    if (pathname === "/writer/verify" && req.method === "POST") {
      const { email = "", code = "" } = await req.json().catch(() => ({})); const e = String(email).trim().toLowerCase();
      const key = `code:${e}`; const rec = JSON.parse((await env.WRITER_KV.get(key)) || "null");
      if (!rec) return json(req, { error: "That code has expired. Request a new one." }, 400);
      if (rec.h !== await sha256(String(code).trim() + e)) {
        rec.tries++; if (rec.tries >= 5) { await env.WRITER_KV.delete(key); return json(req, { error: "Too many attempts. Request a new code." }, 429); }
        await env.WRITER_KV.put(key, JSON.stringify(rec), { expirationTtl: 600 }); return json(req, { error: "That code isn't right." }, 400);
      }
      await env.WRITER_KV.delete(key);
      const allow = allowList(env); if (!allow.has(e)) return json(req, { error: "This email doesn't have access." }, 403);
      const p = b64urlStr(JSON.stringify({ e, n: allow.get(e) || "", exp: Date.now() + 1000 * 60 * 60 * 24 * 14 }));
      return json(req, { token: `${p}.${await hmac(env.SESSION_SECRET, p)}`, email: e, name: allow.get(e) || "" });
    }

    if (pathname === "/writer/me") {
      const s = await session(req, env); return s ? json(req, s) : json(req, { error: "Signed out" }, 401);
    }

    if (pathname === "/writer/submit" && req.method === "POST") {
      const s = await session(req, env); if (!s) return json(req, { error: "Your session has ended. Sign in again." }, 401);
      const b = await req.json().catch(() => ({}));
      const title = String(b.title || "").trim(), body = String(b.body || "").trim();
      const summary = String(b.summary || "").trim().slice(0, 400), author = String(b.author || s.name || "").trim().slice(0, 120);
      const category = CATEGORIES.includes(b.category) ? b.category : "Essays";
      if (!title || title.length > 200) return json(req, { error: "Add a title (under 200 characters)." }, 400);
      if (body.length < 50) return json(req, { error: "The essay is too short to publish." }, 400);
      if (body.length > 300000) return json(req, { error: "The essay is too long for one piece." }, 400);
      const draft = env.REQUIRE_REVIEW === "true";
      const date = new Date().toISOString();
      const base = `${date.slice(0, 10)}-${slugify(title)}`; let slug = base;
      for (let i = 2; (await gh(env, `contents/${DIR}/${slug}.md?ref=${BRANCH}`)).status === 200; i++) slug = `${base}-${i}`;
      const md = `---\ntitle: ${JSON.stringify(title)}\ndate: ${JSON.stringify(date)}\nauthor: ${JSON.stringify(author)}\ncategory: ${JSON.stringify(category)}\nsummary: ${JSON.stringify(summary)}\ndraft: ${draft}\nsubmitted_by: ${JSON.stringify(await sha256(s.email))}\n---\n\n${body}\n`;
      const r = await gh(env, `contents/${DIR}/${slug}.md`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `${draft ? "Submit" : "Publish"} essay: ${title} (Writers' Desk)`, content: b64utf8(md), branch: BRANCH }) });
      if (!r.ok) return json(req, { error: "Couldn't save to the repository. Try again in a minute." }, 502);
      await caches.default.delete(new Request(`${url.origin}/essays`));
      return json(req, { ok: true, slug, draft, url: `${SITE}/essay.html?e=${slug}` });
    }

    // ---------- Public essay API ----------
    if (pathname === "/essays" && req.method === "GET") {
      return cached(req, `${url.origin}/essays`, 120, async () => {
        const r = await gh(env, `contents/${DIR}?ref=${BRANCH}`); if (!r.ok) return [];
        const files = (await r.json()).filter((f) => f.type === "file" && f.name.endsWith(".md"));
        const items = await Promise.all(files.map(async (f) => {
          const raw = await (await gh(env, `contents/${DIR}/${f.name}?ref=${BRANCH}`, { headers: { "Accept": "application/vnd.github.raw" } })).text();
          const { meta, body } = parseFront(raw); if (meta.draft === true) return null;
          return { slug: f.name.replace(/\.md$/, ""), title: meta.title || f.name, summary: meta.summary || "", author: meta.author || "", category: meta.category || "Essays", date: meta.date || "", words: body.split(/\s+/).length };
        }));
        return items.filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      });
    }
    if (pathname === "/essay" && req.method === "GET") {
      const slug = url.searchParams.get("e") || ""; if (!/^[a-z0-9-]{1,120}$/.test(slug)) return json(req, { error: "Not found" }, 404);
      return cached(req, `${url.origin}/essay?e=${slug}`, 120, async () => {
        const r = await gh(env, `contents/${DIR}/${slug}.md?ref=${BRANCH}`, { headers: { "Accept": "application/vnd.github.raw" } });
        if (!r.ok) return { error: "Not found" };
        const { meta, body } = parseFront(await r.text()); if (meta.draft === true) return { error: "Not found" };
        delete meta.submitted_by; return { slug, meta, body };
      });
    }

    return new Response("News At Noire worker is running.", { headers: { "Content-Type": "text/plain" } });
  },
};
