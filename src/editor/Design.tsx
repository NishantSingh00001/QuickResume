import { useMemo } from "react";
import { Icon } from "../components/ui";
import { edit, useEditor } from "../lib/editor";
import { Paper } from "../resume/Paper";
import { ACCENTS, type TemplateId } from "../../shared/types";

const TEMPLATES: { id: TemplateId; name: string; note: string }[] = [
  { id: "modern", name: "Modern", note: "Inter · coloured headings" },
  { id: "classic", name: "Classic", note: "Serif · centred header" },
  { id: "technical", name: "Technical", note: "Plex · compact, mono details" },
];

export default function Design() {
  const resume = useEditor((s) => s.resume);
  const st = resume.settings;
  const set = <K extends keyof typeof st>(k: K, v: (typeof st)[K], group = "") => edit((d) => { d.settings[k] = v; }, group);
  // Thumbnails show the user's own resume in each template.
  const thumbs = useMemo(() => TEMPLATES.map((t) => ({ ...t, resume: { ...resume, settings: { ...resume.settings, template: t.id } } })), [resume]);
  return (
    <div>
      <h3 className="h4" style={{ marginTop: 0 }}>Template</h3>
      <div className="thumbs">
        {thumbs.map((t) => (
          <button key={t.id} className={`thumb ${st.template === t.id ? "on" : ""}`} onClick={() => set("template", t.id)} aria-pressed={st.template === t.id}>
            <div className="thumb__img"><Paper resume={t.resume} width={150} /></div>
            <div className="thumb__name">{t.name}<div className="muted" style={{ fontSize: "0.68rem", fontWeight: 500 }}>{t.note}</div></div>
          </button>
        ))}
      </div>
      <p className="hint">All three are single-column with real text and standard headings, so ATS parsers read them the same way.</p>

      <h3 className="h4">Accent colour</h3>
      <div className="swatches">
        {ACCENTS.map((c) => <button key={c} className={`swatch ${st.accent === c ? "on" : ""}`} style={{ background: c }} onClick={() => set("accent", c)} aria-label={`Accent ${c}`} />)}
        <label className={`swatch ${!ACCENTS.includes(st.accent) ? "on" : ""}`} style={{ background: `conic-gradient(red, yellow, lime, cyan, blue, magenta, red)`, position: "relative" }} title="Custom colour">
          <input type="color" value={st.accent} onChange={(e) => set("accent", e.target.value, "accent")} style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer" }} aria-label="Custom accent colour" />
        </label>
      </div>

      <h3 className="h4">Text size <span className="mono">{Math.round(st.fontScale * 100)}%</span></h3>
      <input className="range" type="range" min={0.88} max={1.12} step={0.02} value={st.fontScale} onChange={(e) => set("fontScale", Number(e.target.value), "fs")} aria-label="Text size" />
      <h3 className="h4">Spacing <span className="mono">{Math.round(st.spacing * 100)}%</span></h3>
      <input className="range" type="range" min={0.8} max={1.2} step={0.05} value={st.spacing} onChange={(e) => set("spacing", Number(e.target.value), "sp")} aria-label="Spacing" />
      <p className="hint">Going over one page? Lower the spacing or text size a little before cutting content.</p>

      <h3 className="h4">Paper</h3>
      <div className="seg">
        <button className={st.paper === "a4" ? "on" : ""} onClick={() => set("paper", "a4")}>A4 (India, Europe)</button>
        <button className={st.paper === "letter" ? "on" : ""} onClick={() => set("paper", "letter")}>US Letter</button>
      </div>

      <h3 className="h4">Section order</h3>
      <div className="order">
        {resume.sections.map((s, i) => (
          <div key={s.id} className="order__row" style={s.hidden ? { opacity: 0.55 } : undefined}>
            <b>{s.title}</b>
            <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => edit((d) => { [d.sections[i - 1], d.sections[i]] = [d.sections[i], d.sections[i - 1]]; })}><Icon name="up" size={16} /></button>
            <button className="icon-btn" aria-label="Move down" disabled={i === resume.sections.length - 1} onClick={() => edit((d) => { [d.sections[i + 1], d.sections[i]] = [d.sections[i], d.sections[i + 1]]; })}><Icon name="down" size={16} /></button>
            <button className="icon-btn" aria-label={s.hidden ? "Show" : "Hide"} onClick={() => edit((d) => { d.sections[i].hidden = !d.sections[i].hidden || undefined; })}><Icon name={s.hidden ? "eyeOff" : "eye"} size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
