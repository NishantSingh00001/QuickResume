// Gemini features: importing and drafting resumes, rewriting bullets, summaries,
// job-description keywords, tailoring, interview questions and answer feedback.

import { generate } from "./gemini.ts";
import { HttpError } from "./http.ts";
import { normalizeResume } from "../../shared/normalize.ts";
import { resumeToText } from "../../shared/text.ts";
import type { Resume } from "../../shared/types.ts";

const RULES = `You are QuickResume's resume assistant for students and early-career professionals, mostly in India.
Hard rules:
- Never invent employers, degrees, dates, tools or achievements. Only use facts the user gave you.
- Never invent numbers. When a metric would make a bullet stronger and you don't have one, write a placeholder in square brackets, e.g. "[X%]" or "[N users]", for the user to fill in.
- Bullets start with a strong past-tense action verb (present tense only for a current role), are one line to two lines (12–28 words), and show action + result.
- Plain text only: no markdown, no emojis, no first person ("I", "my").
- Use Indian English spelling conventions only if the input uses them; otherwise keep the user's spelling.`;

// ---------------------------------------------------------------- schemas (Gemini's OpenAPI subset)

const S = (properties: Record<string, unknown>, required?: string[]) => ({ type: "OBJECT", properties, ...(required ? { required } : {}) });
const STR = { type: "STRING" };
const STRS = { type: "ARRAY", items: STR };

const RESUME_SCHEMA = S({
  title: STR,
  targetRole: STR,
  basics: S({ name: STR, headline: STR, email: STR, phone: STR, location: STR, links: { type: "ARRAY", items: S({ label: STR, url: STR }) } }),
  summary: STR,
  sections: {
    type: "ARRAY",
    items: S({
      kind: { type: "STRING", enum: ["experience", "projects", "education", "skills", "list"] },
      title: STR,
      items: {
        type: "ARRAY",
        description: "experience: role, org, location, start, end, bullets. projects: name, link, tech, start, end, bullets. education: school, degree, location, start, end, score, details. list: text.",
        items: S({ role: STR, org: STR, name: STR, link: STR, tech: STR, school: STR, degree: STR, location: STR, start: STR, end: STR, score: STR, details: STR, text: STR, bullets: STRS }),
      },
      groups: { type: "ARRAY", description: "Only for kind = skills.", items: S({ name: STR, skills: STR }) },
    }, ["kind", "title"]),
  },
}, ["basics", "sections"]);

// ---------------------------------------------------------------- import / draft

export async function importResume(input: { text?: string; file?: { mimeType: string; data: string } }): Promise<{ resume: Resume; model: string }> {
  const { data, model } = await generate<unknown>({
    system: `${RULES}\nYou convert an existing resume into structured JSON. Copy the content faithfully: keep the user's wording for bullets (fix only obvious typos), keep every job, project, degree and skill, and keep dates as written (e.g. "Jan 2025", "2024", "Present"). Group skills into 2–5 named groups. Use section kind "list" for achievements, certifications, publications, activities and similar.`,
    prompt: input.file ? "Convert the attached resume to JSON." : `Convert this resume to JSON:\n\n${input.text}`,
    file: input.file,
    schema: RESUME_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 8192,
    deadlineMs: 55000,
  });
  return { resume: fromAi(data), model };
}

export interface DraftInput {
  name: string; email: string; phone: string; location: string; links: string;
  targetRole: string; education: string; experience: string; projects: string; skills: string; extras: string;
}

export async function draftResume(a: DraftInput): Promise<{ resume: Resume; model: string }> {
  const { data, model } = await generate<unknown>({
    system: `${RULES}\nYou write a complete one-page resume from rough notes. Turn notes into polished bullets (2–4 per role or project), write a 2–3 sentence summary aimed at the target role, and group skills. Order sections for an early-career candidate: Experience (if any), Projects, Education, Skills, then Achievements/Certifications if given. Skip sections with no information.`,
    prompt: `Target role: ${a.targetRole}
Name: ${a.name}
Email: ${a.email}
Phone: ${a.phone}
Location: ${a.location}
Links: ${a.links}

Education notes:
${a.education}

Work / internship notes:
${a.experience || "(none)"}

Project notes:
${a.projects || "(none)"}

Skills:
${a.skills}

Achievements, certifications, other:
${a.extras || "(none)"}`,
    schema: RESUME_SCHEMA,
    temperature: 0.5,
    maxOutputTokens: 8192,
    deadlineMs: 55000,
  });
  const resume = fromAi(data);
  resume.targetRole = resume.targetRole || a.targetRole;
  return { resume, model };
}

function fromAi(data: unknown): Resume {
  const r = normalizeResume(data);
  if (resumeToText(r).length < 40) throw new HttpError(422, "Couldn't find resume content in that. Try pasting the text instead.");
  // Gemini doesn't give ids: make sure every link is labelled.
  r.basics.links = r.basics.links.filter((l) => l.url).map((l) => ({ ...l, label: l.label || guessLabel(l.url) }));
  return r;
}

const guessLabel = (url: string) => (/linkedin/i.test(url) ? "LinkedIn" : /github/i.test(url) ? "GitHub" : /leetcode/i.test(url) ? "LeetCode" : "Website");

// ---------------------------------------------------------------- small rewrites

export type BulletMode = "improve" | "quantify" | "shorten" | "keywords";

export async function rewriteBullet(o: { text: string; mode: BulletMode; context: string; keywords: string[] }) {
  const how: Record<BulletMode, string> = {
    improve: "Make it stronger: a clear action verb, what was built or done, and the result or impact.",
    quantify: "Add measurable impact. Keep any numbers the user gave; where a number is needed but unknown, use a [placeholder] like [X%] or [N users].",
    shorten: "Make it tighter: 12–20 words, same facts.",
    keywords: `Naturally work in these job keywords if (and only if) the bullet is plausibly about them: ${o.keywords.join(", ") || "(none given)"}. Don't claim tools the bullet doesn't imply.`,
  };
  const { data, model } = await generate<{ options: string[] }>({
    system: `${RULES}\nYou rewrite one resume bullet. ${how[o.mode]}`,
    prompt: `Context (role or project): ${o.context || "unknown"}\nBullet: ${o.text}\n\nGive 3 alternative rewrites.`,
    schema: S({ options: STRS }, ["options"]),
    temperature: 0.8,
    maxOutputTokens: 1200,
    deadlineMs: 25000,
  });
  return { options: clean(data?.options, 3, 300), model };
}

export async function writeSummary(o: { resume: Resume; jd: string }) {
  const { data, model } = await generate<{ options: string[] }>({
    system: `${RULES}\nYou write the 2–3 sentence professional summary at the top of a resume. Lead with who they are and their strongest proof point from the resume, then what they're looking for. 35–65 words. No clichés like "passionate", "hard-working" or "go-getter".`,
    prompt: `Resume:\n${resumeToText(o.resume)}\n\n${o.jd ? `Target job description:\n${o.jd.slice(0, 5000)}` : `Target role: ${o.resume.targetRole || "not specified"}`}\n\nWrite 3 different summaries.`,
    schema: S({ options: STRS }, ["options"]),
    temperature: 0.8,
    maxOutputTokens: 1500,
    deadlineMs: 25000,
  });
  return { options: clean(data?.options, 3, 700), model };
}

// ---------------------------------------------------------------- job descriptions

export async function jdKeywords(jd: string) {
  const { data, model } = await generate<{ title: string; keywords: { term: string; required: boolean }[] }>({
    system: "You read job descriptions like an applicant tracking system. Extract the job title and the skills, tools, technologies, domains and qualifications a recruiter would search for. Use short canonical names (e.g. \"PostgreSQL\", \"CI/CD\", \"Stakeholder management\"). Mark required = true for must-haves and false for nice-to-haves. Skip generic words like \"experience\" or \"team\".",
    prompt: jd.slice(0, 8000),
    schema: S({ title: STR, keywords: { type: "ARRAY", items: S({ term: STR, required: { type: "BOOLEAN" } }, ["term", "required"]) } }, ["title", "keywords"]),
    temperature: 0.1,
    maxOutputTokens: 2000,
    deadlineMs: 25000,
  });
  const keywords = (data?.keywords || []).filter((k) => k && typeof k.term === "string" && k.term.trim()).slice(0, 40).map((k) => ({ term: k.term.trim().slice(0, 40), required: Boolean(k.required) }));
  return { title: String(data?.title || "").slice(0, 80), keywords, model };
}

export async function tailor(o: { resume: Resume; jd: string; missing: string[] }) {
  const { data, model } = await generate<{ summary: string; bullets: { id: string; text: string; why: string }[]; skills: string[]; ask: string[] }>({
    system: `${RULES}\nYou tailor a resume to one job description without lying. Rewrite the summary for this job. Suggest rewrites for at most 6 bullets where the candidate's real work matches the job: keep the facts, use the job's vocabulary. Bullet ids are in curly braces; return them exactly. "skills" lists job keywords the resume already proves (in bullets or projects) but doesn't list in skills. "ask" lists up to 4 short questions about missing keywords the candidate might have used but didn't mention.`,
    prompt: `Job description:\n${o.jd.slice(0, 6000)}\n\nKeywords the resume is missing: ${o.missing.join(", ") || "(none)"}\n\nResume (bullet ids in braces):\n${resumeToText(o.resume, { ids: true })}`,
    schema: S({
      summary: STR,
      bullets: { type: "ARRAY", items: S({ id: STR, text: STR, why: STR }, ["id", "text", "why"]) },
      skills: STRS,
      ask: STRS,
    }, ["summary", "bullets", "skills", "ask"]),
    temperature: 0.5,
    maxOutputTokens: 4000,
    deadlineMs: 45000,
  });
  const ids = new Set(o.resume.sections.flatMap((s) => (s.kind === "experience" || s.kind === "projects" ? s.items.flatMap((i) => i.bullets.map((b) => b.id)) : [])));
  return {
    summary: String(data?.summary || "").trim().slice(0, 900),
    bullets: (data?.bullets || []).filter((b) => b && ids.has(String(b.id).replace(/[{}]/g, "")) && b.text).slice(0, 6).map((b) => ({ id: String(b.id).replace(/[{}]/g, ""), text: String(b.text).trim().slice(0, 400), why: String(b.why || "").slice(0, 200) })),
    skills: clean(data?.skills, 10, 40),
    ask: clean(data?.ask, 4, 200),
    model,
  };
}

// ---------------------------------------------------------------- interviews

export async function interviewQuestions(o: { resume: Resume; jd: string; count: number }) {
  const { data, model } = await generate<{ questions: { kind: string; question: string; why: string; tips: string[] }[] }>({
    system: `You are an experienced interviewer at a top tech company in India, preparing a candidate. Write realistic questions this interviewer would actually ask THIS candidate: technical questions on the skills in the job description and resume, deep-dive questions on their specific projects and internships (name them), role-specific scenario questions, and 2–3 behavioural questions. For each: why the interviewer asks it, and 2–3 short tips for a strong answer.`,
    prompt: `${o.jd ? `Job description:\n${o.jd.slice(0, 5000)}\n\n` : ""}Resume:\n${resumeToText(o.resume)}\n\nWrite ${o.count} questions, mixing kinds: technical, project, role, behavioral.`,
    schema: S({ questions: { type: "ARRAY", items: S({ kind: { type: "STRING", enum: ["technical", "project", "role", "behavioral"] }, question: STR, why: STR, tips: STRS }, ["kind", "question", "why", "tips"]) } }, ["questions"]),
    temperature: 0.8,
    maxOutputTokens: 5000,
    deadlineMs: 45000,
  });
  const kinds = new Set(["technical", "project", "role", "behavioral"]);
  const questions = (data?.questions || []).filter((q) => q && q.question).slice(0, o.count).map((q, i) => ({
    id: `ai${i + 1}`,
    kind: (kinds.has(q.kind) ? q.kind : "technical") as "technical" | "project" | "role" | "behavioral",
    question: String(q.question).slice(0, 400),
    why: String(q.why || "").slice(0, 300),
    tips: clean(q.tips, 3, 200),
  }));
  return { questions, model };
}

export async function answerFeedback(o: { question: string; answer: string; resume: Resume; jd: string }) {
  const { data, model } = await generate<{ score: number; verdict: string; strengths: string[]; improve: string[]; better: string }>({
    system: `You are a fair, encouraging interview coach. Score the candidate's answer from 1 to 10 against what a strong answer for an early-career candidate looks like (for behavioural questions, check STAR structure and a concrete result; for technical ones, correctness and clarity). Give a one-line verdict, 1–3 strengths, 1–3 specific improvements, and a stronger version of their answer that uses only facts from their answer and resume (use [placeholders] for missing facts). Plain text.`,
    prompt: `Question: ${o.question}\n\nCandidate's answer:\n${o.answer}\n\nTheir resume, for context:\n${resumeToText(o.resume).slice(0, 4000)}${o.jd ? `\n\nJob description:\n${o.jd.slice(0, 2500)}` : ""}`,
    schema: S({ score: { type: "INTEGER" }, verdict: STR, strengths: STRS, improve: STRS, better: STR }, ["score", "verdict", "strengths", "improve", "better"]),
    temperature: 0.4,
    maxOutputTokens: 2500,
    deadlineMs: 35000,
  });
  return {
    score: Math.max(1, Math.min(10, Math.round(Number(data?.score) || 5))),
    verdict: String(data?.verdict || "").slice(0, 200),
    strengths: clean(data?.strengths, 3, 240),
    improve: clean(data?.improve, 3, 240),
    better: String(data?.better || "").slice(0, 1800),
    model,
  };
}

function clean(list: unknown, max: number, len: number): string[] {
  return (Array.isArray(list) ? list : []).map((x) => String(x ?? "").replace(/\*\*/g, "").trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, len));
}
