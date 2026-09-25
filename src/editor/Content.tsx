import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import type { Draft } from "immer";
import { Icon, useAi } from "../components/ui";
import { edit, getEditor, useEditor } from "../lib/editor";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { AutoTextarea, BulletList, Text } from "./fields";
import {
  newEducation, newExperience, newProject, newSection, uid, SECTION_LABELS,
  type EducationItem, type ExperienceItem, type ProjectItem, type Resume, type Section, type SectionKind,
} from "../../shared/types";

const collapsed = new Set<string>();

function secDraft<K extends SectionKind>(d: Draft<Resume>, id: string, kind: K) {
  const s = d.sections.find((x) => x.id === id);
  return s && s.kind === kind ? (s as Draft<Extract<Section, { kind: K }>>) : null;
}

export default function Content() {
  const resume = useEditor((s) => s.resume);
  return (
    <div>
      <Basics />
      <Summary />
      <Reorder.Group axis="y" values={resume.sections} onReorder={(order) => edit((d) => { d.sections = order as Draft<Section>[]; }, "order")} as="div">
        {resume.sections.map((s) => <SectionCard key={s.id} s={s} />)}
      </Reorder.Group>
      <AddSection />
    </div>
  );
}

// ---------------------------------------------------------------- basics & summary

function Basics() {
  const b = useEditor((s) => s.resume.basics);
  const role = useEditor((s) => s.resume.targetRole);
  const [open, setOpen] = useState(true);
  const set = (k: keyof Omit<typeof b, "links">) => (v: string) => edit((d) => { d.basics[k] = v; }, `basics:${k}`);
  return (
    <div className="sec" id="el-basics">
      <div className="sec__head">
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"}><span className={`chev ${open ? "open" : ""}`}><Icon name="chev" /></span></button>
        <div className="sec__title"><b style={{ fontStretch: "110%", fontWeight: 850 }}>Contact & headline</b></div>
      </div>
      <Collapse open={open}>
        <div className="sec__body">
          <div className="grid2" style={{ marginTop: 12 }}>
            <Text label="Full name" value={b.name} onChange={set("name")} placeholder="Ananya Rao" />
            <Text label="Headline" value={b.headline} onChange={set("headline")} placeholder="Software Engineer · Backend" />
            <Text label="Email" type="email" value={b.email} onChange={set("email")} />
            <Text label="Phone" value={b.phone} onChange={set("phone")} />
            <Text label="City" value={b.location} onChange={set("location")} />
            <Text label="Target role" value={role} onChange={(v) => edit((d) => { d.targetRole = v; }, "role")} placeholder="Used by the AI and the ATS title check" />
          </div>
          <div className="field"><span>Links</span></div>
          {b.links.map((l, i) => (
            <div key={l.id} className="row" style={{ marginBottom: 8, flexWrap: "nowrap" }}>
              <input className="input" style={{ width: 120, flex: "none" }} value={l.label} placeholder="Label" aria-label="Link label" onChange={(e) => edit((d) => { d.basics.links[i].label = e.target.value; }, `link:${l.id}:l`)} />
              <input className="input" value={l.url} placeholder="linkedin.com/in/you" aria-label="Link URL" onChange={(e) => edit((d) => { d.basics.links[i].url = e.target.value; }, `link:${l.id}:u`)} />
              <button className="icon-btn danger" aria-label="Remove link" onClick={() => edit((d) => { d.basics.links.splice(i, 1); })}><Icon name="x" size={16} /></button>
            </div>
          ))}
          {b.links.length < 5 && <button className="btn btn--xs btn--white" onClick={() => edit((d) => { d.basics.links.push({ id: uid("k"), label: "Portfolio", url: "" }); })}><Icon name="plus" size={14} /> Add link</button>}
        </div>
      </Collapse>
    </div>
  );
}

function Summary() {
  const summary = useEditor((s) => s.resume.summary);
  const { ai } = useAi();
  const [open, setOpen] = useState(true);
  const [opts, setOpts] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const write = async () => {
    setLoading(true);
    try {
      const { resume, jd } = getEditor();
      const r = await api<{ options: string[] }>("/api/ai/summary", { body: { resume, jd } });
      setOpts(r.options);
    } catch (e) { toast((e as Error).message, "error"); } finally { setLoading(false); }
  };
  const words = summary.trim() ? summary.trim().split(/\s+/).length : 0;
  return (
    <div className="sec" id="el-summary">
      <div className="sec__head">
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"}><span className={`chev ${open ? "open" : ""}`}><Icon name="chev" /></span></button>
        <div className="sec__title"><b style={{ fontStretch: "110%", fontWeight: 850 }}>Summary</b><span className="sec__kind">{words} words</span></div>
        {ai && <button className="btn btn--xs btn--sky" onClick={write} disabled={loading}>{loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Icon name="spark" size={14} />} Write with Gemini</button>}
      </div>
      <Collapse open={open}>
        <div className="sec__body" style={{ paddingTop: 12 }}>
          <AutoTextarea value={summary} placeholder="2–3 sentences: who you are, your strongest proof point, what you're looking for." onChange={(e) => edit((d) => { d.summary = e.target.value; }, "summary")} style={{ minHeight: 84 }} />
          <AnimatePresence>
            {opts && (
              <motion.div className="ai-pop" style={{ marginLeft: 0 }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="row"><b className="small">Pick one (you can edit it after)</b><span className="spacer" /><button className="icon-btn" onClick={() => setOpts(null)} aria-label="Close"><Icon name="x" size={15} /></button></div>
                {opts.map((o) => <button key={o} className="ai-pop__opt" onClick={() => { edit((d) => { d.summary = o; }); setOpts(null); toast("Summary updated. Undo with Ctrl+Z."); }}>{o}</button>)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Collapse>
    </div>
  );
}

// ---------------------------------------------------------------- sections

function SectionCard({ s }: { s: Section }) {
  const controls = useDragControls();
  const [open, setOpen] = useState(!collapsed.has(s.id));
  const [confirmDel, setConfirmDel] = useState(false);
  const flash = useEditor((st) => st.flash);
  useEffect(() => { if (open) collapsed.delete(s.id); else collapsed.add(s.id); }, [open, s.id]);
  // ATS tips can point into a collapsed section: open it first.
  useEffect(() => {
    if (!flash) return;
    if (flash.target === s.id || ("items" in s && s.items.some((i) => i.id === flash.target || ("bullets" in i && i.bullets.some((b) => b.id === flash.target))))) setOpen(true);
  }, [flash, s]);
  useEffect(() => { if (!confirmDel) return; const t = setTimeout(() => setConfirmDel(false), 3000); return () => clearTimeout(t); }, [confirmDel]);

  return (
    <Reorder.Item value={s} as="div" dragListener={false} dragControls={controls} className={`sec ${s.hidden ? "hidden-sec" : ""}`} id={`el-${s.id}`} whileDrag={{ scale: 1.02, boxShadow: "7px 7px 0 #0e0e0e" }}>
      <div className="sec__head">
        <button className="icon-btn grip" onPointerDown={(e) => controls.start(e)} aria-label="Drag to reorder" title="Drag to reorder"><Icon name="grip" /></button>
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"}><span className={`chev ${open ? "open" : ""}`}><Icon name="chev" /></span></button>
        <div className="sec__title">
          <input value={s.title} aria-label="Section title" onChange={(e) => edit((d) => { const x = d.sections.find((y) => y.id === s.id); if (x) x.title = e.target.value; }, `title:${s.id}`)} />
        </div>
        <button className="icon-btn" title={s.hidden ? "Show on resume" : "Hide from resume"} aria-label={s.hidden ? "Show section" : "Hide section"} onClick={() => edit((d) => { const x = d.sections.find((y) => y.id === s.id); if (x) x.hidden = !x.hidden || undefined; })}><Icon name={s.hidden ? "eyeOff" : "eye"} size={17} /></button>
        {confirmDel
          ? <button className="btn btn--xs" style={{ background: "var(--red)", color: "#fff" }} onClick={() => edit((d) => { d.sections = d.sections.filter((y) => y.id !== s.id); })}>Delete?</button>
          : <button className="icon-btn danger" title="Delete section" aria-label="Delete section" onClick={() => setConfirmDel(true)}><Icon name="trash" size={17} /></button>}
      </div>
      <Collapse open={open}>
        <div className="sec__body">
          {s.kind === "experience" && <Experience s={s} />}
          {s.kind === "projects" && <Projects s={s} />}
          {s.kind === "education" && <Education s={s} />}
          {s.kind === "skills" && <Skills s={s} />}
          {s.kind === "list" && <List s={s} />}
        </div>
      </Collapse>
    </Reorder.Item>
  );
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.9, 0.25, 1] }} style={{ overflow: "hidden" }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type AnyItem = ExperienceItem | ProjectItem | EducationItem;

function ItemShell({ sectionId, item, index, count, title, children }: { sectionId: string; item: AnyItem; index: number; count: number; title: string; children: ReactNode }) {
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { if (!confirmDel) return; const t = setTimeout(() => setConfirmDel(false), 3000); return () => clearTimeout(t); }, [confirmDel]);
  const mutate = (fn: (items: Draft<AnyItem>[]) => void) => edit((d) => { const s = d.sections.find((x) => x.id === sectionId); if (s && "items" in s) fn(s.items as Draft<AnyItem>[]); });
  const move = (dir: -1 | 1) => mutate((items) => { const j = index + dir; if (j < 0 || j >= items.length) return; [items[index], items[j]] = [items[j], items[index]]; });
  return (
    <motion.div layout="position" className="item" id={`el-${item.id}`} transition={{ type: "spring", stiffness: 500, damping: 40 }}>
      <div className="item__bar">
        <b>{title || "New entry"}</b>
        <button className="icon-btn" aria-label="Move up" disabled={index === 0} onClick={() => move(-1)}><Icon name="up" size={16} /></button>
        <button className="icon-btn" aria-label="Move down" disabled={index === count - 1} onClick={() => move(1)}><Icon name="down" size={16} /></button>
        {confirmDel
          ? <button className="btn btn--xs" style={{ background: "var(--red)", color: "#fff" }} onClick={() => mutate((items) => { items.splice(index, 1); })}>Delete?</button>
          : <button className="icon-btn danger" aria-label="Delete entry" onClick={() => setConfirmDel(true)}><Icon name="trash" size={16} /></button>}
      </div>
      {children}
    </motion.div>
  );
}

function Experience({ s }: { s: Extract<Section, { kind: "experience" }> }) {
  const set = (id: string, k: keyof Omit<ExperienceItem, "id" | "bullets">) => (v: string) => edit((d) => { const it = secDraft(d, s.id, "experience")?.items.find((i) => i.id === id); if (it) it[k] = v; }, `${id}:${k}`);
  return (
    <>
      {s.items.map((it, i) => (
        <ItemShell key={it.id} sectionId={s.id} item={it} index={i} count={s.items.length} title={[it.role, it.org].filter(Boolean).join(" · ")}>
          <div className="grid2">
            <Text label="Role" value={it.role} onChange={set(it.id, "role")} placeholder="Software Engineering Intern" />
            <Text label="Company" value={it.org} onChange={set(it.id, "org")} placeholder="Company name" />
          </div>
          <div className="grid3">
            <Text label="Start" value={it.start} onChange={set(it.id, "start")} placeholder="Jan 2026" />
            <Text label="End" value={it.end} onChange={set(it.id, "end")} placeholder="Present" />
            <Text label="Location" value={it.location} onChange={set(it.id, "location")} placeholder="Remote" />
          </div>
          <BulletList sectionId={s.id} itemId={it.id} bullets={it.bullets} context={`${it.role} at ${it.org}`} />
        </ItemShell>
      ))}
      <div className="add-row"><button className="btn btn--xs btn--white" onClick={() => edit((d) => { secDraft(d, s.id, "experience")?.items.push(newExperience()); })}><Icon name="plus" size={14} /> Add role</button></div>
    </>
  );
}

function Projects({ s }: { s: Extract<Section, { kind: "projects" }> }) {
  const set = (id: string, k: keyof Omit<ProjectItem, "id" | "bullets">) => (v: string) => edit((d) => { const it = secDraft(d, s.id, "projects")?.items.find((i) => i.id === id); if (it) it[k] = v; }, `${id}:${k}`);
  return (
    <>
      {s.items.map((it, i) => (
        <ItemShell key={it.id} sectionId={s.id} item={it} index={i} count={s.items.length} title={it.name}>
          <div className="grid2">
            <Text label="Project name" value={it.name} onChange={set(it.id, "name")} />
            <Text label="Tech stack" value={it.tech} onChange={set(it.id, "tech")} placeholder="React, Node.js, MongoDB" />
          </div>
          <div className="grid3">
            <Text label="Link" value={it.link} onChange={set(it.id, "link")} placeholder="github.com/…" />
            <Text label="Start" value={it.start} onChange={set(it.id, "start")} placeholder="2025" />
            <Text label="End" value={it.end} onChange={set(it.id, "end")} />
          </div>
          <BulletList sectionId={s.id} itemId={it.id} bullets={it.bullets} context={`project ${it.name} (${it.tech})`} />
        </ItemShell>
      ))}
      <div className="add-row"><button className="btn btn--xs btn--white" onClick={() => edit((d) => { secDraft(d, s.id, "projects")?.items.push(newProject()); })}><Icon name="plus" size={14} /> Add project</button></div>
    </>
  );
}

function Education({ s }: { s: Extract<Section, { kind: "education" }> }) {
  const set = (id: string, k: keyof Omit<EducationItem, "id">) => (v: string) => edit((d) => { const it = secDraft(d, s.id, "education")?.items.find((i) => i.id === id); if (it) it[k] = v; }, `${id}:${k}`);
  return (
    <>
      {s.items.map((it, i) => (
        <ItemShell key={it.id} sectionId={s.id} item={it} index={i} count={s.items.length} title={it.school}>
          <div className="grid2">
            <Text label="Degree" value={it.degree} onChange={set(it.id, "degree")} placeholder="B.E. Computer Engineering" />
            <Text label="School / college" value={it.school} onChange={set(it.id, "school")} />
          </div>
          <div className="grid3">
            <Text label="Start" value={it.start} onChange={set(it.id, "start")} placeholder="2022" />
            <Text label="End" value={it.end} onChange={set(it.id, "end")} placeholder="2026" />
            <Text label="Score" value={it.score} onChange={set(it.id, "score")} placeholder="CGPA 8.2 / 10" />
          </div>
          <Text label="Location" value={it.location} onChange={set(it.id, "location")} />
          <label className="field"><span>Details</span><AutoTextarea value={it.details} placeholder="Relevant coursework, honours, thesis…" onChange={(e) => set(it.id, "details")(e.target.value)} style={{ minHeight: 42 }} /></label>
        </ItemShell>
      ))}
      <div className="add-row"><button className="btn btn--xs btn--white" onClick={() => edit((d) => { secDraft(d, s.id, "education")?.items.push(newEducation()); })}><Icon name="plus" size={14} /> Add education</button></div>
    </>
  );
}

function Skills({ s }: { s: Extract<Section, { kind: "skills" }> }) {
  const set = (id: string, k: "name" | "skills") => (v: string) => edit((d) => { const g = secDraft(d, s.id, "skills")?.groups.find((x) => x.id === id); if (g) g[k] = v; }, `${id}:${k}`);
  return (
    <>
      <p className="hint" style={{ marginTop: 10 }}>Separate skills with commas. Only list what you could talk about in an interview.</p>
      {s.groups.map((g) => (
        <div key={g.id} id={`el-${g.id}`} className="row" style={{ marginBottom: 8, alignItems: "flex-start", flexWrap: "nowrap" }}>
          <input className="input" style={{ width: 130, flex: "none" }} value={g.name} placeholder="Group" aria-label="Skill group name" onChange={(e) => set(g.id, "name")(e.target.value)} />
          <AutoTextarea value={g.skills} placeholder="Python, SQL, React…" aria-label="Skills" onChange={(e) => set(g.id, "skills")(e.target.value.replace(/\n/g, " "))} style={{ minHeight: 42 }} />
          <button className="icon-btn danger" aria-label="Remove group" onClick={() => edit((d) => { const x = secDraft(d, s.id, "skills"); if (x) x.groups = x.groups.filter((y) => y.id !== g.id); })}><Icon name="x" size={16} /></button>
        </div>
      ))}
      <button className="btn btn--xs btn--white" onClick={() => edit((d) => { secDraft(d, s.id, "skills")?.groups.push({ id: uid("g"), name: "", skills: "" }); })}><Icon name="plus" size={14} /> Add group</button>
    </>
  );
}

function List({ s }: { s: Extract<Section, { kind: "list" }> }) {
  return (
    <div style={{ marginTop: 12 }}>
      {s.items.map((it) => (
        <div key={it.id} id={`el-${it.id}`} className="row" style={{ marginBottom: 8, alignItems: "flex-start", flexWrap: "nowrap" }}>
          <AutoTextarea value={it.text} placeholder="One line per achievement or certificate" onChange={(e) => edit((d) => { const x = secDraft(d, s.id, "list")?.items.find((y) => y.id === it.id); if (x) x.text = e.target.value.replace(/\n/g, " "); }, `${it.id}:t`)} style={{ minHeight: 42 }} />
          <button className="icon-btn danger" aria-label="Remove line" onClick={() => edit((d) => { const x = secDraft(d, s.id, "list"); if (x) x.items = x.items.filter((y) => y.id !== it.id); })}><Icon name="x" size={16} /></button>
        </div>
      ))}
      <button className="btn btn--xs btn--white" onClick={() => edit((d) => { secDraft(d, s.id, "list")?.items.push({ id: uid("l"), text: "" }); })}><Icon name="plus" size={14} /> Add line</button>
    </div>
  );
}

const PRESETS: [SectionKind, string][] = [["experience", "Experience"], ["projects", "Projects"], ["education", "Education"], ["skills", "Skills"], ["list", "Achievements"], ["list", "Certifications"], ["list", "Leadership & activities"]];

function AddSection() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 4 }}>
      {!open ? (
        <button className="add-dashed" style={{ height: 48 }} onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Add a section</button>
      ) : (
        <div className="box">
          <div className="row" style={{ marginBottom: 8 }}><b>Add a section</b><span className="spacer" /><button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" size={16} /></button></div>
          <div className="row">
            {PRESETS.map(([kind, title]) => (
              <button key={title} className="btn btn--xs btn--white" title={SECTION_LABELS[kind]} onClick={() => { const sec = newSection(kind, title); edit((d) => { d.sections.push(sec as Draft<Section>); }); setOpen(false); setTimeout(() => document.getElementById(`el-${sec.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80); }}>{title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
