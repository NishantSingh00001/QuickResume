// The ATS engine: reads a job description, then scores a resume against it.
// Everything here is deterministic and runs in the browser (live, as you type) and on the server.
// Gemini can add keywords the dictionary doesn't know; the scoring itself never depends on AI.

import { findSkills, mentions, SKILL_BY_NAME, type SkillCategory } from "./skills.ts";
import { checkBullet, type BulletCheck } from "./verbs.ts";
import type { Resume, Section } from "./types.ts";

export interface Keyword {
  term: string;
  weight: number; // 1 = required, 0.6 = nice to have, 0.4 = soft skill
  required: boolean;
  category: SkillCategory | "domain";
  count: number; // mentions in the job description
  source: "dictionary" | "phrase" | "ai";
}

export interface JdAnalysis {
  title: string;
  keywords: Keyword[];
  years: number | null;
  degree: string | null;
  words: number;
}

export interface KeywordResult extends Keyword {
  found: boolean;
  where: "experience" | "summary" | "skills" | "other" | null;
}

export interface Part { id: string; label: string; score: number; max: number; note: string }

export interface Tip {
  level: "high" | "medium" | "low";
  text: string;
  sectionId?: string;
  itemId?: string;
  bulletId?: string;
}

export interface AtsReport {
  total: number;
  hasJd: boolean;
  parts: Part[];
  keywords: KeywordResult[];
  tips: Tip[];
  stats: { words: number; bullets: number; withNumbers: number; withVerbs: number; weak: number };
}

// ---------------------------------------------------------------- job descriptions

const PREFERRED = /\b(nice[\s-]to[\s-]have|good[\s-]to[\s-]have|preferred|bonus|a plus|is a plus|desirable|optional|ideally|familiarity with)\b/i;
const HEADING = /^(\W*)(about|responsibilities|what you('| wi)ll do|what we('| a)re looking for|requirements|qualifications|must[\s-]have|skills|nice to have|preferred|bonus|benefits|perks|who you are|you have|you are|the role|job description|role|eligibility)\b.{0,40}$/i;
const ROLE_WORDS = /\b(engineer|developer|analyst|scientist|intern|designer|architect|consultant|specialist|manager|lead|sde|programmer|administrator|associate|trainee)\b/i;

const STOP = new Set(`a an and are as at be by for from has have in is it its of on or our that the their this to we will with you your
who what when where which while about into across over under within without using use used able ability etc including such other
work working team teams role job candidate candidates experience years year strong good great excellent knowledge understanding skills skill
plus must should would can could may might also well new build building develop developing help across based high level`.split(/\s+/));

const SENIORITY = new Set(["senior", "junior", "sr", "jr", "lead", "principal", "staff", "associate", "i", "ii", "iii", "iv", "entry", "level", "graduate", "fresher", "new", "grad", "trainee", "intern", "remote", "hybrid", "full", "time", "fulltime", "part"]);

export function analyzeJd(jd: string, extra: { term: string; required?: boolean }[] = []): JdAnalysis {
  const text = jd.replace(/\r/g, "").trim();
  const lines = text.split("\n");

  // Mark which lines sit under a "nice to have" heading.
  let preferredBlock = false;
  const preferredLine: boolean[] = lines.map((line) => {
    const l = line.trim();
    if (HEADING.test(l) || (l.endsWith(":") && l.length < 60)) preferredBlock = PREFERRED.test(l);
    return preferredBlock || PREFERRED.test(l);
  });

  const keywords: Keyword[] = [];
  const found = findSkills(text, "jd");
  for (const { skill, count } of found.values()) {
    // Required if any mention is on a line that isn't marked "nice to have".
    const required = lines.some((line, i) => !preferredLine[i] && skill.strict.some((re) => { re.lastIndex = 0; return re.test(line); }));
    const soft = skill.category === "soft";
    keywords.push({ term: skill.name, weight: soft ? 0.4 : required ? 1 : 0.6, required: required && !soft, category: skill.category, count, source: "dictionary" });
  }

  // Domain phrases the dictionary doesn't know: two-word phrases that appear at least twice.
  const words = text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").split(/\s+/).filter(Boolean);
  const pairs = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i].replace(/\.$/, ""), b = words[i + 1].replace(/\.$/, "");
    if (a.length < 3 || b.length < 3 || STOP.has(a) || STOP.has(b) || /^\d/.test(a) || /^\d/.test(b)) continue;
    const key = `${a} ${b}`;
    pairs.set(key, (pairs.get(key) || 0) + 1);
  }
  const known = new Set(keywords.map((k) => k.term.toLowerCase()));
  const phrases = [...pairs.entries()]
    .filter(([p, n]) => n >= 2 && !known.has(p) && !findSkills(p, "resume").size && !ROLE_WORDS.test(p))
    .sort((x, y) => y[1] - x[1])
    .slice(0, 6);
  for (const [term, count] of phrases) keywords.push({ term, weight: 0.5, required: false, category: "domain", count, source: "phrase" });

  // Keywords suggested by Gemini (merged, never duplicated).
  for (const e of extra) {
    const term = e.term.trim();
    if (!term || term.length > 40) continue;
    const skill = findSkills(term, "resume").values().next().value?.skill;
    const name = skill?.name || term;
    const existing = keywords.find((k) => k.term.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (e.required && existing.category !== "soft") { existing.required = true; existing.weight = 1; }
      continue;
    }
    const soft = skill?.category === "soft";
    keywords.push({ term: name, weight: soft ? 0.4 : e.required ? 1 : 0.6, required: Boolean(e.required) && !soft, category: skill?.category || "domain", count: 1, source: "ai" });
  }

  keywords.sort((a, b) => b.weight - a.weight || b.count - a.count || a.term.localeCompare(b.term));

  const yearsMatch = text.match(/(\d{1,2})\s*\+?\s*(?:[-–to]+\s*\d{1,2}\s*)?(?:years?|yrs?)\b/i);
  const DEGREE = /\b(bachelor'?s?|master'?s?|b\.?\s?e\b|b\.?\s?tech|m\.?\s?tech|b\.?\s?sc|m\.?\s?sc|mca|bca|ph\.?\s?d|degree)\b/i;
  const degreeLine = lines.find((l) => DEGREE.test(l));
  return { title: guessTitle(lines), keywords, years: yearsMatch ? Number(yearsMatch[1]) : null, degree: degreeLine ? degreeLine.replace(/^[\s\-•*]+/, "").trim().slice(0, 90) : null, words: words.length };
}

function guessTitle(lines: string[]): string {
  for (const raw of lines.slice(0, 6)) {
    const l = raw.replace(/^(job title|title|role|position)\s*[:\-–]\s*/i, "").trim();
    if (l && l.length <= 70 && ROLE_WORDS.test(l) && !/[.!?]$/.test(l)) return l.replace(/\s+[|–—-]\s+.*$/, "").trim();
  }
  const all = lines.join(" ");
  const m = all.match(/(?:hiring|looking for|seeking|join us as|role of|position of)\s+(?:an?\s+)?([A-Za-z/+#. ]{3,60}?(?:engineer|developer|analyst|scientist|intern|designer|architect|consultant|specialist|manager|programmer))/i);
  return m ? m[1].trim() : "";
}

// ---------------------------------------------------------------- resumes

interface BulletRef { sectionId: string; itemId: string; bulletId: string; text: string; check: BulletCheck }

function visible(r: Resume): Section[] {
  return r.sections.filter((s) => !s.hidden);
}

export function resumeParts(r: Resume) {
  const experience: string[] = [], skills: string[] = [], other: string[] = [];
  const bulletsOut: BulletRef[] = [];
  for (const s of visible(r)) {
    if (s.kind === "experience" || s.kind === "projects") {
      for (const it of s.items) {
        const head = "role" in it ? `${it.role} ${it.org}` : `${it.name} ${it.tech}`;
        experience.push(head);
        for (const b of it.bullets) {
          if (!b.text.trim()) continue;
          experience.push(b.text);
          bulletsOut.push({ sectionId: s.id, itemId: it.id, bulletId: b.id, text: b.text, check: checkBullet(b.text) });
        }
      }
    } else if (s.kind === "skills") {
      for (const g of s.groups) skills.push(`${g.name}: ${g.skills}`);
    } else if (s.kind === "education") {
      for (const it of s.items) other.push(`${it.degree} ${it.school} ${it.details}`);
    } else {
      for (const it of s.items) other.push(it.text);
    }
  }
  const summary = `${r.basics.headline}\n${r.targetRole}\n${r.summary}`;
  const all = [r.basics.name, summary, ...experience, ...skills, ...other].join("\n");
  return { experience: experience.join("\n"), skills: skills.join("\n"), summary, other: other.join("\n"), all, bullets: bulletsOut };
}

function filled(s: Section): boolean {
  switch (s.kind) {
    case "experience": return s.items.some((i) => i.role.trim() || i.org.trim() || i.bullets.some((x) => x.text.trim()));
    case "projects": return s.items.some((i) => i.name.trim() || i.bullets.some((x) => x.text.trim()));
    case "education": return s.items.some((i) => i.school.trim() || i.degree.trim());
    case "skills": return s.groups.some((g) => g.skills.trim());
    case "list": return s.items.some((i) => i.text.trim());
  }
}

const STANDARD_TITLES = /^(experience|work experience|professional experience|employment|internships?|work history|education|skills|technical skills|core skills|projects|personal projects|academic projects|achievements|awards|certifications?|publications|leadership|activities|extracurriculars?|volunteering|summary|profile)$/i;
const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

export function scoreResume(r: Resume, jd: JdAnalysis | null): AtsReport {
  const p = resumeParts(r);
  const tips: Tip[] = [];
  const parts: Part[] = [];
  const b = r.basics;

  // 1. Keywords (40)
  let keywords: KeywordResult[] = [];
  if (jd && jd.keywords.length) {
    let got = 0, total = 0;
    keywords = jd.keywords.map((k) => {
      const inExp = mentions(p.experience, k.term) > 0;
      const inSummary = mentions(p.summary, k.term) > 0;
      const inSkills = mentions(p.skills, k.term) > 0;
      const inOther = mentions(p.other, k.term) > 0;
      const where = inExp ? "experience" : inSummary ? "summary" : inSkills ? "skills" : inOther ? "other" : null;
      const credit = where === "experience" || where === "summary" ? 1 : where ? 0.75 : 0;
      got += credit * k.weight;
      total += k.weight;
      return { ...k, found: Boolean(where), where };
    });
    const coverage = total ? got / total : 0;
    const missingReq = keywords.filter((k) => !k.found && k.required);
    const onlySkills = keywords.filter((k) => k.where === "skills" && k.required);
    parts.push({ id: "keywords", label: "Keyword match", score: round1(40 * coverage), max: 40, note: `${keywords.filter((k) => k.found).length} of ${keywords.length} keywords found${missingReq.length ? `, ${missingReq.length} required missing` : ""}` });
    const skillsSection = visible(r).find((s) => s.kind === "skills");
    for (const k of missingReq.slice(0, 5)) tips.push({ level: "high", text: `Add “${k.term}” if you've used it. The job description mentions it${k.count > 1 ? ` ${k.count} times` : ""}.`, sectionId: skillsSection?.id });
    for (const k of onlySkills.slice(0, 3)) tips.push({ level: "medium", text: `“${k.term}” is only in your skills list. Show it in a project or experience bullet, where recruiters look for proof.` });
  }

  // 2. Role fit (10)
  if (jd) {
    let s = 0;
    const notes: string[] = [];
    // Ignore levels and codes like "(SDE-1)" or "L2" when matching the title.
    const titleWords = jd.title.toLowerCase().replace(/\([^)]*\)/g, " ").split(/[^a-z0-9+#]+/).filter((w) => w.length > 1 && !SENIORITY.has(w) && !STOP.has(w) && !/^(sde|l\d|\d+)$/.test(w));
    const roleText = `${p.summary}\n${p.experience}`.toLowerCase();
    if (titleWords.length) {
      const hit = titleWords.filter((w) => roleText.includes(w)).length / titleWords.length;
      s += 6 * hit;
      notes.push(hit >= 0.99 ? "title matches" : hit > 0 ? "title partly matches" : "title not mentioned");
      if (hit < 0.99) tips.push({ level: "high", text: `Use the job title “${jd.title}” in your headline or summary so the ATS files you under the right role.` });
    } else s += 6;
    const eduItems = visible(r).filter((x) => x.kind === "education").flatMap((x) => (x.kind === "education" ? x.items : []));
    if (!jd.degree || eduItems.some((e) => e.degree.trim())) s += 2;
    else tips.push({ level: "medium", text: `The job asks for “${jd.degree}”. Add your degree to Education.` });
    const expItems = visible(r).filter((x) => x.kind === "experience").flatMap((x) => (x.kind === "experience" ? x.items : []));
    if (!jd.years || expItems.every((e) => e.start.trim())) s += 2;
    else tips.push({ level: "low", text: `The job mentions ${jd.years}+ years of experience. Add start and end dates to every role so it's easy to count.` });
    if (jd.years) notes.push(`asks for ${jd.years}+ yrs`);
    parts.push({ id: "role", label: "Role fit", score: round1(s), max: 10, note: notes.join(" · ") || "title and requirements" });
  }

  // 3. Impact (20)
  const bl = p.bullets;
  const withNumbers = bl.filter((x) => x.check.hasNumber).length;
  const withVerbs = bl.filter((x) => x.check.verb).length;
  const weak = bl.filter((x) => x.check.weak);
  {
    const n = Math.max(1, bl.length);
    const s = bl.length ? 10 * clamp(withNumbers / n / 0.5) + 7 * clamp(withVerbs / n / 0.8) + Math.max(0, 3 - weak.length) : 0;
    parts.push({ id: "impact", label: "Impact", score: round1(s), max: 20, note: bl.length ? `${withNumbers}/${bl.length} bullets have numbers · ${withVerbs}/${bl.length} start with an action verb` : "no bullets yet" });
    for (const x of weak.slice(0, 3)) tips.push({ level: "high", text: `Start with what you did, not “${x.check.weak}”: “${x.text.slice(0, 60)}${x.text.length > 60 ? "…" : ""}”`, sectionId: x.sectionId, itemId: x.itemId, bulletId: x.bulletId });
    const noNum = bl.filter((x) => !x.check.hasNumber && !x.check.weak);
    if (bl.length && withNumbers / n < 0.5) {
      for (const x of noNum.slice(0, 2)) tips.push({ level: "medium", text: `Add a number (users, %, time saved, scale) to: “${x.text.slice(0, 60)}${x.text.length > 60 ? "…" : ""}”`, sectionId: x.sectionId, itemId: x.itemId, bulletId: x.bulletId });
    }
    if (/\[[^\]]+\]/.test(p.all)) tips.push({ level: "high", text: "Fill in the [placeholders] the AI left for your real numbers before you send this resume." });
  }

  // 4. Completeness (15)
  {
    const sec = visible(r);
    const hasKind = (k: Section["kind"]) => sec.some((s) => s.kind === k && filled(s));
    const checks: [boolean, number, string][] = [
      [Boolean(b.name.trim()), 1, "your name"],
      [/\S+@\S+\.\S+/.test(b.email), 2, "an email address"],
      [b.phone.replace(/\D/g, "").length >= 8, 2, "a phone number"],
      [Boolean(b.location.trim()), 1, "your city"],
      [b.links.some((l) => l.url.trim()), 2, "a LinkedIn or GitHub link"],
      [countWords(r.summary) >= 12, 2, "a short summary"],
      [hasKind("experience") || hasKind("projects"), 3, "experience or projects"],
      [hasKind("education"), 1, "education"],
      [hasKind("skills"), 1, "a skills section"],
    ];
    const s = checks.reduce((a, [ok, w]) => a + (ok ? w : 0), 0);
    const missing = checks.filter(([ok]) => !ok).map(([, , label]) => label);
    parts.push({ id: "complete", label: "Completeness", score: s, max: 15, note: missing.length ? `missing ${missing.slice(0, 3).join(", ")}` : "all the essentials" });
    if (missing.length) tips.push({ level: missing.some((m) => /email|phone|name/.test(m)) ? "high" : "medium", text: `Add ${missing.join(", ")}.` });
  }

  // 5. Length and readability (10)
  const words = countWords(p.all);
  {
    let s = 0;
    s += words >= 250 && words <= 750 ? 4 : words >= 180 && words <= 950 ? 2.5 : words > 0 ? 1 : 0;
    const okLen = bl.filter((x) => x.check.words >= 8 && x.check.words <= 32).length;
    s += bl.length ? 3 * (okLen / bl.length) : 0;
    const sw = countWords(r.summary);
    s += sw >= 25 && sw <= 90 ? 2 : sw > 0 ? 1 : 0;
    const long = bl.filter((x) => x.check.words > 40);
    s += long.length ? 0 : 1;
    parts.push({ id: "length", label: "Length & readability", score: round1(s), max: 10, note: `${words} words${words > 750 ? " (long for one page)" : words < 250 ? " (a bit thin)" : ""}` });
    if (words > 900) tips.push({ level: "medium", text: `At ${words} words this is likely over a page. For under 3 years of experience, keep it to one page.` });
    if (words && words < 180) tips.push({ level: "medium", text: "Your resume is short. Add projects, coursework or achievements with specific results." });
    for (const x of long.slice(0, 2)) tips.push({ level: "low", text: `Split or trim this ${x.check.words}-word bullet: “${x.text.slice(0, 50)}…”`, sectionId: x.sectionId, itemId: x.itemId, bulletId: x.bulletId });
  }

  // 6. Structure (5)
  {
    const sec = visible(r);
    const standard = sec.filter((s) => STANDARD_TITLES.test(s.title.trim())).length;
    const dated: { start: string; end: string }[] = sec.flatMap((s): { start: string; end: string }[] => (s.kind === "experience" || s.kind === "education" ? s.items : []));
    const withDates = dated.filter((i) => i.start.trim() || i.end.trim()).length;
    const s = (sec.length ? 3 * (standard / sec.length) : 0) + (dated.length ? 2 * (withDates / dated.length) : 2);
    parts.push({ id: "structure", label: "Structure", score: round1(s), max: 5, note: standard === sec.length ? "standard section titles" : "some unusual section titles" });
    for (const x of sec.filter((s) => !STANDARD_TITLES.test(s.title.trim())).slice(0, 2)) tips.push({ level: "low", text: `ATS parsers look for standard headings. Consider renaming “${x.title}” (e.g. Experience, Projects, Skills).`, sectionId: x.id });
  }

  const raw = parts.reduce((a, x) => a + x.score, 0);
  const max = parts.reduce((a, x) => a + x.max, 0);
  const total = Math.round((raw / max) * 100);
  const order = { high: 0, medium: 1, low: 2 };
  tips.sort((a, c) => order[a.level] - order[c.level]);
  return { total, hasJd: Boolean(jd), parts, keywords, tips: tips.slice(0, 12), stats: { words, bullets: bl.length, withNumbers, withVerbs, weak: weak.length } };
}

export function scoreLabel(total: number): { label: string; tone: "great" | "good" | "fair" | "low" } {
  if (total >= 85) return { label: "Excellent", tone: "great" };
  if (total >= 70) return { label: "Good", tone: "good" };
  if (total >= 50) return { label: "Needs work", tone: "fair" };
  return { label: "Weak", tone: "low" };
}

export function isKnownSkill(term: string): boolean {
  return SKILL_BY_NAME.has(term.toLowerCase());
}
