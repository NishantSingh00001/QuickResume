// Strong action verbs (past and present tense) and weak openers for resume bullets.

const STRONG = `accelerated achieved added analyzed architected automated benchmarked boosted built championed cleaned coached collaborated
compiled composed configured consolidated containerized converted coordinated created cut debugged decreased defined delivered deployed
designed developed diagnosed digitized directed documented doubled drove eliminated enabled engineered enhanced established evaluated
executed expanded experimented extended extracted facilitated fixed forecast formulated founded generated grew guided halved hardened
identified implemented improved increased initiated instrumented integrated introduced invented launched led lowered maintained managed
mapped measured mentored merged migrated minimized modeled modernized monitored negotiated optimized orchestrated organized overhauled
owned parallelized partnered pioneered planned presented prioritized produced profiled programmed prototyped published raised rebuilt
reduced refactored reorganized replaced resolved restructured revamped reviewed rewrote saved scaled scheduled scraped secured shipped
shortened simplified slashed solved spearheaded standardized streamlined strengthened structured supervised tested trained transformed
translated trimmed tripled troubleshot tuned unified upgraded validated visualized won wrote
assembled authored automated captured coded crafted curated customized drafted earned edited enforced exceeded finalized hosted
illustrated influenced inspected interviewed lectured logged moved operated performed ported prepared processed proposed provisioned
queried recorded recruited redesigned refined released repaired reported represented researched routed served sourced sped
sponsored surveyed synthesized taught tracked transitioned volunteered wired`;

export const ACTION_VERBS = new Set(STRONG.split(/\s+/).filter(Boolean));

// Present-tense forms ("Build", "Design") are fine for current roles.
const PRESENT: Record<string, string> = {};
for (const v of ACTION_VERBS) {
  const base = v.endsWith("ied") ? v.slice(0, -3) + "y" : v.endsWith("ed") ? v.slice(0, -2) : v;
  PRESENT[base] = v;
  if (/([bdgmnprt])\1$/.test(base)) { const single = base.slice(0, -1); PRESENT[single] = v; PRESENT[single + "s"] = v; } // planned → plan
  PRESENT[base + "e"] = v;
  PRESENT[base + "s"] = v;
  PRESENT[base + "es"] = v;
}
const IRREGULAR: Record<string, string> = { build: "built", builds: "built", lead: "led", leads: "led", write: "wrote", writes: "wrote", cut: "cut", cuts: "cut", grow: "grew", grows: "grew", win: "won", ship: "shipped", ships: "shipped", own: "owned", run: "ran", ran: "ran", runs: "ran", drive: "drove", drives: "drove", set: "set", teach: "taught", taught: "taught" };

export const WEAK_OPENERS = [
  "responsible for", "worked on", "working on", "helped", "helping", "assisted", "was part of", "part of", "involved in", "participated in",
  "tasked with", "duties included", "in charge of", "handled", "did", "made", "tried",
];

export interface BulletCheck {
  words: number;
  hasNumber: boolean;
  verb: string | null; // the strong verb it starts with
  weak: string | null; // the weak opener it starts with
}

const NUMBER = /(\d|%|₹|\$|\b(one|two|three|four|five|six|seven|eight|nine|ten|twice|double|half|dozens|hundreds|thousands|millions)\b)/i;

export function checkBullet(text: string): BulletCheck {
  const t = text.trim().replace(/^[-•*▪◦]\s*/, "");
  const words = t ? t.split(/\s+/).length : 0;
  const lower = t.toLowerCase();
  const first = lower.split(/[\s,;:]+/)[0]?.replace(/[^a-z-]/g, "") || "";
  const weak = WEAK_OPENERS.find((w) => lower.startsWith(w + " ") || lower === w) || null;
  let verb: string | null = null;
  if (!weak) {
    if (ACTION_VERBS.has(first)) verb = first;
    else if (PRESENT[first]) verb = PRESENT[first];
    else if (IRREGULAR[first]) verb = IRREGULAR[first];
  }
  // Placeholders like [X%] don't count as real numbers.
  const withoutPlaceholders = t.replace(/\[[^\]]*\]\s*%?/g, "");
  return { words, hasNumber: NUMBER.test(withoutPlaceholders), verb, weak };
}
