// Turns any JSON (from the browser, storage or Gemini) into a valid Resume with sane limits.

import { ACCENTS, emptyResume, uid, type Bullet, type Resume, type Section, type SectionKind, type TemplateId } from "./types.ts";

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown, max = 200): string => (typeof x === "string" ? x : typeof x === "number" ? String(x) : "").replace(/\s+/g, (m) => (m.includes("\n") ? "\n" : " ")).trim().slice(0, max);
const arr = (x: unknown, max: number): unknown[] => (Array.isArray(x) ? x.slice(0, max) : []);
const id = (x: unknown, prefix: string): string => (typeof x === "string" && /^[a-z0-9]{2,24}$/i.test(x) ? x : uid(prefix));
const num = (x: unknown, lo: number, hi: number, dflt: number): number => (typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt);

const TEMPLATES: TemplateId[] = ["classic", "modern", "technical"];
const KINDS: SectionKind[] = ["experience", "projects", "education", "skills", "list"];

function bulletsOf(x: unknown): Bullet[] {
  const list = arr(x, 12).map((b) => (typeof b === "string" ? { id: uid("b"), text: str(b, 400) } : isObj(b) ? { id: id(b.id, "b"), text: str(b.text, 400) } : null)).filter(Boolean) as Bullet[];
  return list.length ? list : [{ id: uid("b"), text: "" }];
}

function section(x: unknown): Section | null {
  if (!isObj(x)) return null;
  const kind = KINDS.includes(x.kind as SectionKind) ? (x.kind as SectionKind) : null;
  if (!kind) return null;
  const base = { id: id(x.id, "s"), title: str(x.title, 60) || kind[0].toUpperCase() + kind.slice(1), hidden: x.hidden === true ? true : undefined };
  const items = arr(x.items, 20).filter(isObj);
  switch (kind) {
    case "experience":
      return { ...base, kind, items: items.map((i) => ({ id: id(i.id, "e"), role: str(i.role, 100), org: str(i.org, 100), location: str(i.location, 60), start: str(i.start, 20), end: str(i.end, 20), bullets: bulletsOf(i.bullets) })) };
    case "projects":
      return { ...base, kind, items: items.map((i) => ({ id: id(i.id, "p"), name: str(i.name, 100), link: str(i.link, 200), tech: str(i.tech, 160), start: str(i.start, 20), end: str(i.end, 20), bullets: bulletsOf(i.bullets) })) };
    case "education":
      return { ...base, kind, items: items.map((i) => ({ id: id(i.id, "d"), school: str(i.school, 120), degree: str(i.degree, 140), location: str(i.location, 60), start: str(i.start, 20), end: str(i.end, 20), score: str(i.score, 40), details: str(i.details, 300) })) };
    case "skills":
      return { ...base, kind, groups: arr(x.groups, 12).filter(isObj).map((g) => ({ id: id(g.id, "g"), name: str(g.name, 40), skills: Array.isArray(g.skills) ? g.skills.map((s) => str(s, 60)).filter(Boolean).join(", ").slice(0, 400) : str(g.skills, 400) })) };
    case "list":
      return { ...base, kind, items: items.map((i) => ({ id: id(i.id, "l"), text: str(i.text, 300) })) };
  }
}

export function normalizeResume(input: unknown): Resume {
  const base = emptyResume();
  if (!isObj(input)) return base;
  const b = isObj(input.basics) ? input.basics : {};
  const s = isObj(input.settings) ? input.settings : {};
  const sections = arr(input.sections, 12).map(section).filter(Boolean) as Section[];
  const accent = typeof s.accent === "string" && /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : ACCENTS[1];
  return {
    version: 1,
    title: str(input.title, 80) || str(b.name, 60) || base.title,
    targetRole: str(input.targetRole, 80),
    basics: {
      name: str(b.name, 80),
      headline: str(b.headline, 120),
      email: str(b.email, 120),
      phone: str(b.phone, 40),
      location: str(b.location, 80),
      links: arr(b.links, 5).filter(isObj).map((l) => ({ id: id(l.id, "k"), label: str(l.label, 30), url: str(l.url, 200) })),
    },
    summary: str(input.summary, 900),
    sections: sections.length ? sections : base.sections,
    settings: {
      template: TEMPLATES.includes(s.template as TemplateId) ? (s.template as TemplateId) : "modern",
      accent,
      fontScale: num(s.fontScale, 0.85, 1.15, 1),
      spacing: num(s.spacing, 0.8, 1.2, 1),
      paper: s.paper === "letter" ? "letter" : "a4",
    },
  };
}
