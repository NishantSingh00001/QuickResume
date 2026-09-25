// The QuickResume API: one router for resumes, public links, ATS scoring and the AI features.

import type { Config, Context } from "@netlify/functions";
import { fail, HttpError, json, randomId, randomToken, readJson, sha256 } from "../lib/http.ts";
import { firstInWindow, getJSON, ipHash, loadOwned, rateLimit, store, update, type Stored } from "../lib/store.ts";
import { aiConfigured, modelChain } from "../lib/gemini.ts";
import * as ai from "../lib/ai.ts";
import { normalizeResume } from "../../shared/normalize.ts";
import { analyzeJd, scoreResume } from "../../shared/ats.ts";
import { bankQuestions } from "../../shared/questions.ts";
import { resumeToText } from "../../shared/text.ts";

type Handler = (req: Request, ctx: Context, params: Record<string, string>) => Promise<Response>;
const routes: { method: string; re: RegExp; fn: Handler }[] = [];
function route(method: string, path: string, fn: Handler) {
  const re = new RegExp(`^${path.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`);
  routes.push({ method, re, fn });
}

const now = () => new Date().toISOString();
const editKey = (req: Request) => req.headers.get("x-edit-key");
const MAX_JD = 12000;

async function aiGuard(ctx: Context, heavy = false) {
  if (!aiConfigured()) throw new HttpError(503, "AI isn't set up on this deployment yet.");
  const ip = await ipHash(ctx.ip);
  await rateLimit(`ai:${ip}`, 60, 3600);
  if (heavy) await rateLimit(`aiheavy:${ip}`, 12, 3600);
  await rateLimit("ai:all", 1500, 86400);
}

function jdOf(body: Record<string, unknown>): string {
  const jd = typeof body.jd === "string" ? body.jd : "";
  if (jd.length > MAX_JD) throw new HttpError(413, `Job descriptions can be up to ${MAX_JD.toLocaleString()} characters.`);
  return jd.trim();
}

// ---------------------------------------------------------------- resumes

route("POST", "/api/resumes", async (req, ctx) => {
  await rateLimit(`create:${await ipHash(ctx.ip)}`, 40, 3600);
  const body = await readJson(req);
  const resume = normalizeResume(body.resume);
  const key = randomToken();
  let id = "";
  for (let i = 0; i < 5 && !id; i++) {
    const candidate = randomId(10);
    const doc: Stored = { id: candidate, keyHash: await sha256(key), resume, createdAt: now(), updatedAt: now(), slug: null, views: 0 };
    const res = await store().setJSON(`r/${candidate}`, doc, { onlyIfNew: true });
    if (res.modified) id = candidate;
  }
  if (!id) throw new HttpError(503, "Couldn't create the resume. Please try again.");
  return json({ id, key, updatedAt: now() }, 201);
});

route("GET", "/api/resumes/:id", async (req, _ctx, p) => {
  const doc = await loadOwned(p.id, editKey(req));
  return json({ id: doc.id, resume: doc.resume, updatedAt: doc.updatedAt, createdAt: doc.createdAt, slug: doc.slug, views: doc.views });
});

route("PUT", "/api/resumes/:id", async (req, _ctx, p) => {
  const doc = await loadOwned(p.id, editKey(req));
  const body = await readJson(req, 300_000);
  const resume = normalizeResume(body.resume);
  const saved = await update<Stored>(`r/${doc.id}`, (cur) => (cur ? { ...cur, resume, updatedAt: now() } : undefined));
  if (!saved) throw new HttpError(410, "This resume was deleted.");
  return json({ updatedAt: saved.updatedAt });
});

route("DELETE", "/api/resumes/:id", async (req, _ctx, p) => {
  const doc = await loadOwned(p.id, editKey(req));
  if (doc.slug) await store().delete(`slug/${doc.slug}`);
  await store().delete(`r/${doc.id}`);
  return json({ deleted: true });
});

/** Titles and dates for the "My resumes" list (the browser sends the keys it has). */
route("POST", "/api/resumes/list", async (req) => {
  const body = await readJson<{ items?: { id: string; key: string }[] }>(req);
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 30);
  const out = await Promise.all(items.map(async ({ id, key }) => {
    try {
      const doc = await loadOwned(String(id), String(key));
      return { id: doc.id, title: doc.resume.title, name: doc.resume.basics.name, updatedAt: doc.updatedAt, slug: doc.slug, views: doc.views, template: doc.resume.settings.template };
    } catch (e) {
      return { id, gone: (e as HttpError).status === 410 };
    }
  }));
  return json({ resumes: out });
});

// ---------------------------------------------------------------- public links

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);

route("POST", "/api/resumes/:id/publish", async (req, _ctx, p) => {
  const doc = await loadOwned(p.id, editKey(req));
  if (doc.slug) return json({ slug: doc.slug });
  const base = slugify(doc.resume.basics.name) || "resume";
  let slug = "";
  for (let i = 0; i < 6 && !slug; i++) {
    const candidate = `${base}-${randomId(4)}`;
    const res = await store().setJSON(`slug/${candidate}`, { id: doc.id }, { onlyIfNew: true });
    if (res.modified) slug = candidate;
  }
  if (!slug) throw new HttpError(503, "Couldn't create a link. Please try again.");
  await update<Stored>(`r/${doc.id}`, (cur) => (cur ? { ...cur, slug } : undefined));
  return json({ slug }, 201);
});

route("DELETE", "/api/resumes/:id/publish", async (req, _ctx, p) => {
  const doc = await loadOwned(p.id, editKey(req));
  if (doc.slug) await store().delete(`slug/${doc.slug}`);
  await update<Stored>(`r/${doc.id}`, (cur) => (cur ? { ...cur, slug: null } : undefined));
  return json({ slug: null });
});

route("GET", "/api/public/:slug", async (_req, ctx, p) => {
  if (!/^[a-z0-9-]{3,40}$/.test(p.slug)) throw new HttpError(400, "That link isn't valid.");
  const ref = await getJSON<{ id: string }>(`slug/${p.slug}`);
  const doc = ref && (await getJSON<Stored>(`r/${ref.id}`));
  if (!doc || doc.slug !== p.slug) throw new HttpError(410, "This resume isn't shared any more.");
  let views = doc.views;
  // One view per visitor every 6 hours.
  if (await firstInWindow(`view:${p.slug}:${await ipHash(ctx.ip)}`, 6 * 3600)) {
    const saved = await update<Stored>(`r/${doc.id}`, (cur) => (cur ? { ...cur, views: (cur.views || 0) + 1, lastViewAt: now() } : undefined)).catch(() => null);
    views = saved?.views ?? views + 1;
  }
  return json({ resume: doc.resume, updatedAt: doc.updatedAt, views }, 200, { "cache-control": "no-store" });
});

// ---------------------------------------------------------------- ATS (public API)

route("POST", "/api/ats", async (req, ctx) => {
  await rateLimit(`ats:${await ipHash(ctx.ip)}`, 120, 3600);
  const body = await readJson(req, 300_000);
  const resume = normalizeResume(body.resume);
  const jdText = jdOf(body);
  let extra: { term: string; required: boolean }[] = [];
  let model: string | null = null;
  if (jdText && body.ai === true && aiConfigured()) {
    await aiGuard(ctx);
    const k = await ai.jdKeywords(jdText);
    extra = k.keywords;
    model = k.model;
  }
  const jd = jdText ? analyzeJd(jdText, extra) : null;
  return json({ report: scoreResume(resume, jd), jd, model });
});

// ---------------------------------------------------------------- AI

route("POST", "/api/ai/import", async (req, ctx) => {
  await aiGuard(ctx, true);
  const body = await readJson<{ text?: string; file?: { mimeType?: string; data?: string } }>(req, 5_600_000);
  if (body.file) {
    const mimeType = String(body.file.mimeType || "");
    const data = String(body.file.data || "");
    if (!/^(application\/pdf|image\/(png|jpeg|webp)|text\/plain)$/.test(mimeType)) throw new HttpError(400, "Upload a PDF, an image or a text file.");
    if (!/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 200))) throw new HttpError(400, "The file didn't upload correctly.");
    if (data.length > 5_500_000) throw new HttpError(413, "Files can be up to 4 MB.");
    return json(await ai.importResume({ file: { mimeType, data } }));
  }
  const text = String(body.text || "").trim();
  if (text.length < 80) throw new HttpError(400, "Paste the full text of your resume (at least a few lines).");
  return json(await ai.importResume({ text: text.slice(0, 20000) }));
});

route("POST", "/api/ai/draft", async (req, ctx) => {
  await aiGuard(ctx, true);
  const b = await readJson(req, 60_000);
  const f = (k: string, max = 3000) => String(b[k] ?? "").slice(0, max);
  const input: ai.DraftInput = { name: f("name", 80), email: f("email", 120), phone: f("phone", 40), location: f("location", 80), links: f("links", 300), targetRole: f("targetRole", 80), education: f("education"), experience: f("experience"), projects: f("projects"), skills: f("skills", 1000), extras: f("extras", 1500) };
  if (!input.name.trim() || !input.targetRole.trim()) throw new HttpError(400, "Add at least your name and the role you're targeting.");
  if ((input.education + input.experience + input.projects).trim().length < 30) throw new HttpError(400, "Tell me a little about your education, work or projects first.");
  return json(await ai.draftResume(input));
});

route("POST", "/api/ai/bullet", async (req, ctx) => {
  await aiGuard(ctx);
  const b = await readJson(req, 20_000);
  const text = String(b.text || "").trim().slice(0, 500);
  if (text.length < 4) throw new HttpError(400, "Write a rough version of the bullet first.");
  const mode = (["improve", "quantify", "shorten", "keywords"].includes(String(b.mode)) ? b.mode : "improve") as ai.BulletMode;
  const keywords = (Array.isArray(b.keywords) ? b.keywords : []).map((k) => String(k).slice(0, 40)).slice(0, 12);
  return json(await ai.rewriteBullet({ text, mode, context: String(b.context || "").slice(0, 200), keywords }));
});

route("POST", "/api/ai/summary", async (req, ctx) => {
  await aiGuard(ctx);
  const b = await readJson(req, 300_000);
  return json(await ai.writeSummary({ resume: normalizeResume(b.resume), jd: jdOf(b) }));
});

route("POST", "/api/ai/keywords", async (req, ctx) => {
  await aiGuard(ctx);
  const b = await readJson(req, 60_000);
  const jd = jdOf(b);
  if (jd.length < 60) throw new HttpError(400, "Paste the full job description.");
  return json(await ai.jdKeywords(jd));
});

route("POST", "/api/ai/tailor", async (req, ctx) => {
  await aiGuard(ctx, true);
  const b = await readJson(req, 300_000);
  const resume = normalizeResume(b.resume);
  const jd = jdOf(b);
  if (jd.length < 60) throw new HttpError(400, "Paste the full job description first.");
  const missing = scoreResume(resume, analyzeJd(jd)).keywords.filter((k) => !k.found).map((k) => k.term).slice(0, 15);
  return json(await ai.tailor({ resume, jd, missing }));
});

route("POST", "/api/ai/interview", async (req, ctx) => {
  const b = await readJson(req, 300_000);
  const resume = normalizeResume(b.resume);
  const jd = jdOf(b);
  const count = Math.max(4, Math.min(12, Number(b.count) || 10));
  if (!aiConfigured()) return json({ questions: bankQuestions(resumeToText(resume), jd, count), model: null });
  await aiGuard(ctx);
  return json(await ai.interviewQuestions({ resume, jd, count }));
});

route("POST", "/api/ai/feedback", async (req, ctx) => {
  await aiGuard(ctx);
  const b = await readJson(req, 300_000);
  const question = String(b.question || "").trim().slice(0, 500);
  const answer = String(b.answer || "").trim().slice(0, 4000);
  if (!question || answer.split(/\s+/).length < 8) throw new HttpError(400, "Write a fuller answer first (at least a couple of sentences).");
  return json(await ai.answerFeedback({ question, answer, resume: normalizeResume(b.resume), jd: jdOf(b) }));
});

// ---------------------------------------------------------------- health

route("GET", "/api/health", async () => {
  let storage = "ok";
  try { await store().get("cfg/health"); } catch { storage = "unavailable"; }
  return json({ ok: storage === "ok", storage, ai: aiConfigured() ? { enabled: true, model: modelChain()[0] } : { enabled: false }, time: now() });
});

export default async (req: Request, context: Context) => {
  try {
    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    for (const r of routes) {
      const m = r.re.exec(path);
      if (m && r.method === req.method) return await r.fn(req, context, (m.groups || {}) as Record<string, string>);
    }
    return routes.some((r) => r.re.test(path)) ? fail(405, "Method not allowed.") : fail(400, `Unknown API route: ${path}`);
  } catch (err) {
    const status = (err as HttpError).status || 500;
    if (status >= 500) console.error(err);
    return fail(status, status >= 500 && !(err instanceof HttpError) ? "Something went wrong on the server. Please try again." : (err as Error).message);
  }
};

export const config: Config = { path: "/api/*" };

