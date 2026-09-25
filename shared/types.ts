// The resume document. Shared by the editor, the templates, the ATS engine and the API.

export type TemplateId = "classic" | "modern" | "technical";
export type Paper = "a4" | "letter";

export interface Link { id: string; label: string; url: string }
export interface Bullet { id: string; text: string }

export interface Basics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: Link[];
}

export interface ExperienceItem { id: string; role: string; org: string; location: string; start: string; end: string; bullets: Bullet[] }
export interface ProjectItem { id: string; name: string; link: string; tech: string; start: string; end: string; bullets: Bullet[] }
export interface EducationItem { id: string; school: string; degree: string; location: string; start: string; end: string; score: string; details: string }
export interface SkillGroup { id: string; name: string; skills: string }
export interface ListItem { id: string; text: string }

interface SectionBase { id: string; title: string; hidden?: boolean }
export interface ExperienceSection extends SectionBase { kind: "experience"; items: ExperienceItem[] }
export interface ProjectsSection extends SectionBase { kind: "projects"; items: ProjectItem[] }
export interface EducationSection extends SectionBase { kind: "education"; items: EducationItem[] }
export interface SkillsSection extends SectionBase { kind: "skills"; groups: SkillGroup[] }
export interface ListSection extends SectionBase { kind: "list"; items: ListItem[] }
export type Section = ExperienceSection | ProjectsSection | EducationSection | SkillsSection | ListSection;
export type SectionKind = Section["kind"];

export interface Settings {
  template: TemplateId;
  accent: string;
  fontScale: number; // 0.9 .. 1.1
  spacing: number; // 0.85 .. 1.15
  paper: Paper;
}

export interface Resume {
  version: 1;
  title: string; // shown in "My resumes", not on the page
  targetRole: string;
  basics: Basics;
  summary: string;
  sections: Section[];
  settings: Settings;
}

export const ACCENTS = ["#1f2937", "#1d4ed8", "#0f766e", "#b45309", "#9f1239", "#6d28d9"];

export function uid(prefix = ""): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return prefix + Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 9);
}

export const bullets = (...texts: string[]): Bullet[] => texts.map((text) => ({ id: uid("b"), text }));

export function newSection(kind: SectionKind, title?: string): Section {
  const id = uid("s");
  switch (kind) {
    case "experience": return { id, kind, title: title || "Experience", items: [newExperience()] };
    case "projects": return { id, kind, title: title || "Projects", items: [newProject()] };
    case "education": return { id, kind, title: title || "Education", items: [newEducation()] };
    case "skills": return { id, kind, title: title || "Skills", groups: [{ id: uid("g"), name: "Languages", skills: "" }] };
    case "list": return { id, kind, title: title || "Achievements", items: [{ id: uid("l"), text: "" }] };
  }
}

export const newExperience = (): ExperienceItem => ({ id: uid("e"), role: "", org: "", location: "", start: "", end: "", bullets: bullets("") });
export const newProject = (): ProjectItem => ({ id: uid("p"), name: "", link: "", tech: "", start: "", end: "", bullets: bullets("") });
export const newEducation = (): EducationItem => ({ id: uid("d"), school: "", degree: "", location: "", start: "", end: "", score: "", details: "" });

export function emptyResume(): Resume {
  return {
    version: 1,
    title: "Untitled resume",
    targetRole: "",
    basics: { name: "", headline: "", email: "", phone: "", location: "", links: [{ id: uid("k"), label: "LinkedIn", url: "" }, { id: uid("k"), label: "GitHub", url: "" }] },
    summary: "",
    sections: [newSection("experience"), newSection("projects"), newSection("education"), newSection("skills")],
    settings: { template: "modern", accent: ACCENTS[1], fontScale: 1, spacing: 1, paper: "a4" },
  };
}

export const SECTION_LABELS: Record<SectionKind, string> = {
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  list: "List (achievements, certifications…)",
};
