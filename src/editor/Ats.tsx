import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Draft } from "immer";
import { Icon, useAi } from "../components/ui";
import { Gauge } from "../components/Gauge";
import { edit, getEditor, setAiKeywords, setJd, useEditor } from "../lib/editor";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { useAts } from "./context";
import { SAMPLE_JD } from "../../shared/sampleJd";
import { uid, type Resume, type Section } from "../../shared/types";
import type { KeywordResult, Tip } from "../../shared/ats";

interface Tailored { summary: string; bullets: { id: string; text: string; why: string }[]; skills: string[]; ask: string[] }

function addSkill(d: Draft<Resume>, term: string) {
  let s = d.sections.find((x) => x.kind === "skills" && !x.hidden) as Draft<Extract<Section, { kind: "skills" }>> | undefined;
  if (!s) {
    s = { id: uid("s"), kind: "skills", title: "Skills", groups: [] };
    d.sections.push(s as Draft<Section>);
  }
  let g = s.groups.find((x) => /tool|other|additional/i.test(x.name)) || s.groups[s.groups.length - 1];
  if (!g) { g = { id: uid("g"), name: "Other", skills: "" }; s.groups.push(g); }
  g.skills = g.skills.trim() ? `${g.skills.replace(/[,\s]+$/, "")}, ${term}` : term;
}

function findBullet(r: Resume, id: string): string | null {
  for (const s of r.sections) if (s.kind === "experience" || s.kind === "projects") for (const i of s.items) for (const b of i.bullets) if (b.id === id) return b.text;
  return null;
}

export default function Ats({ goTo }: { goTo: (tip: Tip) => void }) {
  const ats = useAts();
  const jd = useEditor((s) => s.jd);
  const aiFor = useEditor((s) => s.aiKeywordsFor);
  const aiKw = useEditor((s) => s.aiKeywords);
  const { ai } = useAi();
  const [reading, setReading] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [tailored, setTailored] = useState<Tailored | null>(null);
  const [used, setUsed] = useState<Set<string>>(new Set());
  if (!ats) return null;
  const { report } = ats;

  const readWithAi = async () => {
    setReading(true);
    try {
      const r = await api<{ keywords: { term: string; required: boolean }[] }>("/api/ai/keywords", { body: { jd } });
      setAiKeywords(r.keywords, jd);
      toast(`Gemini read the job description: ${r.keywords.length} keywords.`);
    } catch (e) { toast((e as Error).message, "error"); } finally { setReading(false); }
  };

  const tailor = async () => {
    setTailoring(true);
    setUsed(new Set());
    try {
      setTailored(await api<Tailored>("/api/ai/tailor", { body: { resume: getEditor().resume, jd } }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setTailoring(false); }
  };
  const markUsed = (k: string) => setUsed((u) => new Set(u).add(k));

  const missing = report.keywords.filter((k) => !k.found);
  const skillsOnly = report.keywords.filter((k) => k.where === "skills");
  const found = report.keywords.filter((k) => k.found && k.where !== "skills");
  const aiActive = Boolean(aiKw && aiFor === jd);

  return (
    <div>
      <div className="jd field" style={{ marginBottom: 14 }}>
        <span className="row" style={{ justifyContent: "space-between" }}>Job description <span className="mono" style={{ fontWeight: 500 }}>{jd.length.toLocaleString()} chars</span></span>
        <textarea className="textarea" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job post: title, responsibilities and requirements." aria-label="Job description" />
        <div className="row">
          {!jd && <button className="btn btn--xs btn--white" onClick={() => setJd(SAMPLE_JD)}>Try an example job</button>}
          {jd && ai && (aiActive
            ? <span className="tag tag--ai"><Icon name="spark" size={12} /> Gemini keywords on</span>
            : <button className="btn btn--xs btn--sky" onClick={readWithAi} disabled={reading || jd.length < 60}>{reading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Icon name="spark" size={14} />} Read it with Gemini too</button>)}
          {jd && <button className="btn btn--xs btn--ghost" onClick={() => { setJd(""); setTailored(null); }}>Clear</button>}
        </div>
      </div>

      <div className="card score-card">
        <Gauge value={report.total} label />
        <div className="parts">
          {report.parts.map((p) => (
            <div key={p.id}>
              <div className="part__top">{p.label}<span>{p.score}/{p.max}</span></div>
              <div className="bar"><i style={{ transform: `scaleX(${p.score / p.max})`, background: p.score / p.max >= 0.8 ? "var(--green)" : p.score / p.max >= 0.5 ? "var(--yellow)" : "var(--orange)" }} /></div>
              <div className="part__note">{p.note}</div>
            </div>
          ))}
        </div>
      </div>
      {!report.hasJd && <div className="notice"><Icon name="target" /> This is a general resume health score. Paste a job description to see your keyword match for a specific role.</div>}

      {report.hasJd && (
        <>
          <h3 className="h4">Keywords <span className="mono">{report.keywords.filter((k) => k.found).length}/{report.keywords.length}</span></h3>
          <div className="legend"><span><i style={{ background: "var(--green-2)" }} />in your bullets</span><span><i style={{ background: "var(--yellow-2)" }} />only in skills</span><span><i style={{ background: "var(--orange-2)", borderColor: "var(--orange)" }} />missing, required</span><span><i style={{ background: "#fff", borderStyle: "dashed" }} />missing, nice to have</span></div>
          {missing.length > 0 && <p className="hint" style={{ marginTop: 0 }}>Click a missing keyword to add it to your skills. Only add what you've really used.</p>}
          <div className="kw">
            {missing.map((k) => <KeywordChip key={k.term} k={k} onAdd={() => { edit((d) => addSkill(d, k.term)); toast(`Added “${k.term}” to Skills. Now show it in a bullet too.`); }} />)}
            {skillsOnly.map((k) => <KeywordChip key={k.term} k={k} />)}
            {found.map((k) => <KeywordChip key={k.term} k={k} />)}
          </div>
        </>
      )}

      {report.tips.length > 0 && (
        <>
          <h3 className="h4">Fix these first</h3>
          <div className="tips">
            {report.tips.map((t, i) => (
              <motion.button key={`${t.text}-${i}`} className="tip" data-go={t.bulletId || t.itemId || t.sectionId ? "1" : "0"} onClick={() => (t.bulletId || t.itemId || t.sectionId) && goTo(t)} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <span className={`tip__lvl ${t.level}`}>{t.level}</span>
                <span>{t.text}</span>
              </motion.button>
            ))}
          </div>
        </>
      )}

      {ai && report.hasJd && (
        <div className="box box--sky" style={{ marginTop: 18 }}>
          <div className="row"><b style={{ fontSize: "1.05rem" }}>Tailor to this job</b><span className="spacer" /><span className="tag tag--ai"><Icon name="spark" size={12} /> Gemini</span></div>
          <p className="small" style={{ margin: "6px 0 10px" }}>Gemini suggests a new summary and rewrites the bullets where your real experience matches this job, using its vocabulary. You approve each change.</p>
          <button className="btn btn--sm btn--ink" onClick={tailor} disabled={tailoring}>{tailoring ? <><span className="spinner" style={{ borderTopColor: "#fff", width: 14, height: 14 }} /> Tailoring…</> : tailored ? "Suggest again" : "Suggest changes"}</button>
          <AnimatePresence>
            {tailored && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {tailored.summary && (
                  <div className={`sugg ${used.has("summary") ? "done" : ""}`}>
                    <div className="sec__kind">New summary</div>
                    <div className="sugg__new">{tailored.summary}</div>
                    <div className="sugg__act">
                      <button className="btn btn--xs" disabled={used.has("summary")} onClick={() => { edit((d) => { d.summary = tailored.summary; }); markUsed("summary"); }}>{used.has("summary") ? "Used ✓" : "Use this"}</button>
                    </div>
                  </div>
                )}
                {tailored.bullets.map((b) => {
                  const old = findBullet(getEditor().resume, b.id);
                  if (old === null) return null;
                  return (
                    <div key={b.id} className={`sugg ${used.has(b.id) ? "done" : ""}`}>
                      <div className="sugg__old">{old}</div>
                      <div className="sugg__new">{b.text}</div>
                      {b.why && <div className="sugg__why">{b.why}</div>}
                      <div className="sugg__act">
                        <button className="btn btn--xs" disabled={used.has(b.id)} onClick={() => { edit((d) => { for (const s of d.sections) if (s.kind === "experience" || s.kind === "projects") for (const i of s.items) for (const x of i.bullets) if (x.id === b.id) x.text = b.text; }); markUsed(b.id); }}>{used.has(b.id) ? "Used ✓" : "Use this"}</button>
                        <button className="btn btn--xs btn--ghost" onClick={() => goTo({ level: "low", text: "", bulletId: b.id })}>Show me</button>
                      </div>
                    </div>
                  );
                })}
                {tailored.skills.length > 0 && (
                  <div className="sugg">
                    <div className="sec__kind">Proven in your bullets but missing from Skills</div>
                    <div className="kw" style={{ marginTop: 6 }}>
                      {tailored.skills.map((sk) => <button key={sk} className="chip" disabled={used.has(`sk:${sk}`)} onClick={() => { edit((d) => addSkill(d, sk)); markUsed(`sk:${sk}`); }}>{used.has(`sk:${sk}`) ? "✓" : "+"} {sk}</button>)}
                    </div>
                  </div>
                )}
                {tailored.ask.length > 0 && (
                  <div className="sugg">
                    <div className="sec__kind">Worth asking yourself</div>
                    <ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{tailored.ask.map((q) => <li key={q}>{q}</li>)}</ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function KeywordChip({ k, onAdd }: { k: KeywordResult; onAdd?: () => void }) {
  const cls = k.found ? (k.where === "skills" ? "chip--skills" : "chip--hit") : `chip--miss ${k.required ? "req" : ""}`;
  const title = k.found ? `Found in your ${k.where}` : `${k.required ? "Required" : "Nice to have"} · mentioned ${k.count}× · click to add to Skills`;
  const body = <>{k.found ? "✓" : "+"} {k.term}{k.count > 1 && <small>×{k.count}</small>}{k.source === "ai" && <small>✦</small>}</>;
  return onAdd ? <button className={`chip ${cls}`} title={title} onClick={onAdd}>{body}</button> : <span className={`chip ${cls}`} title={title}>{body}</span>;
}
