// Plain-text versions of a resume: for prompts, copy-to-clipboard and the .txt export.

import type { Resume } from "./types.ts";

const range = (a: string, b: string) => [a, b].filter((x) => x.trim()).join(" – ");

export function resumeToText(r: Resume, opts: { ids?: boolean } = {}): string {
  const out: string[] = [];
  const b = r.basics;
  if (b.name) out.push(b.name.toUpperCase());
  if (b.headline) out.push(b.headline);
  const contact = [b.email, b.phone, b.location, ...b.links.map((l) => l.url)].filter((x) => x.trim());
  if (contact.length) out.push(contact.join(" | "));
  if (r.summary.trim()) out.push("", "SUMMARY", r.summary.trim());
  for (const s of r.sections) {
    if (s.hidden) continue;
    out.push("", s.title.toUpperCase());
    if (s.kind === "experience" || s.kind === "projects") {
      for (const it of s.items) {
        const head = "role" in it
          ? [it.role, it.org, it.location].filter(Boolean).join(", ")
          : [it.name, it.tech && `(${it.tech})`, it.link].filter(Boolean).join(" ");
        const dates = range(it.start, it.end);
        if (head || dates) out.push(`${head}${dates ? `  [${dates}]` : ""}`);
        for (const bl of it.bullets) if (bl.text.trim()) out.push(`${opts.ids ? `{${bl.id}} ` : ""}- ${bl.text.trim()}`);
      }
    } else if (s.kind === "education") {
      for (const it of s.items) {
        out.push([it.degree, it.school, it.location].filter(Boolean).join(", ") + (range(it.start, it.end) ? `  [${range(it.start, it.end)}]` : ""));
        if (it.score) out.push(`  ${it.score}`);
        if (it.details) out.push(`  ${it.details}`);
      }
    } else if (s.kind === "skills") {
      for (const g of s.groups) if (g.skills.trim()) out.push(`${g.name ? `${g.name}: ` : ""}${g.skills}`);
    } else {
      for (const it of s.items) if (it.text.trim()) out.push(`- ${it.text}`);
    }
  }
  return out.join("\n").trim();
}
