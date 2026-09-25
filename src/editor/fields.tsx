import { useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { Draft } from "immer";
import { Icon, useAi } from "../components/ui";
import { edit } from "../lib/editor";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { useAts } from "./context";
import { checkBullet } from "../../shared/verbs";
import { uid, type Bullet, type Resume } from "../../shared/types";

/** A textarea that grows with its content. */
function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 4}px`;
}

export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { if (ref.current) fitHeight(ref.current); }, [props.value]);
  // Re-fit when the width changes (panel resized, fonts loaded, tools shown).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== width) { width = el.clientWidth; fitHeight(el); } });
    ro.observe(el);
    document.fonts?.ready.then(() => fitHeight(el)).catch(() => {});
    return () => ro.disconnect();
  }, []);
  return <textarea ref={ref} rows={1} {...props} className={`textarea ${props.className || ""}`} />;
}

export function Text({ label, value, onChange, placeholder, type = "text", wide }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; wide?: boolean }) {
  return (
    <label className="field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <span>{label}</span>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// ---------------------------------------------------------------- bullets

type Items = { id: string; bullets: Bullet[] }[];

function bulletsOf(d: Draft<Resume>, sectionId: string, itemId: string): Draft<Bullet>[] | null {
  const s = d.sections.find((x) => x.id === sectionId);
  if (!s || (s.kind !== "experience" && s.kind !== "projects")) return null;
  const item = (s.items as Draft<Items>).find((i) => i.id === itemId);
  return item ? item.bullets : null;
}

function focusBullet(id: string, end = true) {
  const el = document.getElementById(`b-${id}`) as HTMLTextAreaElement | null;
  if (!el) return;
  el.focus();
  if (end) el.setSelectionRange(el.value.length, el.value.length);
}

function dotFor(text: string): { cls: string; title: string } {
  if (!text.trim()) return { cls: "", title: "Empty bullet" };
  const c = checkBullet(text);
  if (c.weak) return { cls: "weak", title: `Starts with “${c.weak}”: lead with what you did.` };
  if (c.verb && c.hasNumber) return { cls: "good", title: "Strong: action verb and a number." };
  if (c.verb) return { cls: "ok", title: "Good verb. Add a number to show impact." };
  if (c.hasNumber) return { cls: "ok", title: "Has a number. Start with an action verb." };
  return { cls: "weak", title: "Start with an action verb and add a result." };
}

const MODES: [string, string][] = [["improve", "Stronger"], ["quantify", "Add impact"], ["shorten", "Shorter"], ["keywords", "Use job keywords"]];

export function BulletList({ sectionId, itemId, bullets, context }: { sectionId: string; itemId: string; bullets: Bullet[]; context: string }) {
  const { ai } = useAi();
  const ats = useAts();
  const [pop, setPop] = useState<{ id: string; mode: string; loading: boolean; options: string[] } | null>(null);

  const update = (fn: (list: Draft<Bullet>[]) => void, group = "") => edit((d) => { const list = bulletsOf(d, sectionId, itemId); if (list) fn(list); }, group);
  const setText = (id: string, text: string) => update((l) => { const b = l.find((x) => x.id === id); if (b) b.text = text.replace(/\n/g, " "); }, `b:${id}`);
  // Render synchronously before moving focus, so fast typing lands in the right bullet.
  const add = (after?: string) => {
    const nb = { id: uid("b"), text: "" };
    flushSync(() => update((l) => { const i = after ? l.findIndex((x) => x.id === after) : l.length - 1; l.splice(i + 1, 0, nb); }));
    focusBullet(nb.id);
  };
  const remove = (id: string) => {
    const i = bullets.findIndex((b) => b.id === id);
    flushSync(() => update((l) => { const j = l.findIndex((x) => x.id === id); if (j >= 0) l.splice(j, 1); if (!l.length) l.push({ id: uid("b"), text: "" }); }));
    if (i > 0) focusBullet(bullets[i - 1].id);
  };
  const move = (id: string, dir: -1 | 1) => update((l) => { const i = l.findIndex((x) => x.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; });

  const suggest = async (b: Bullet, mode: string) => {
    if (b.text.trim().length < 4) return toast("Write a rough version first, then let Gemini polish it.", "error");
    setPop({ id: b.id, mode, loading: true, options: [] });
    try {
      const r = await api<{ options: string[] }>("/api/ai/bullet", { body: { text: b.text, mode, context, keywords: ats?.missing.slice(0, 10) || [] } });
      setPop((p) => (p && p.id === b.id ? { ...p, loading: false, options: r.options } : p));
    } catch (e) {
      toast((e as Error).message, "error");
      setPop(null);
    }
  };

  return (
    <div className="bullets">
      {bullets.map((b, i) => {
        const dot = dotFor(b.text);
        const hasPh = /\[[^\]]+\]/.test(b.text);
        return (
          <div key={b.id} id={`el-${b.id}`}>
            <div className="bullet">
              <span className={`bullet__dot ${dot.cls}`} title={dot.title} />
              <AutoTextarea id={`b-${b.id}`} value={b.text} placeholder={i === 0 ? "Built … using … which led to … (a number helps)" : "Another result…"} aria-label="Bullet point"
                onChange={(e) => setText(b.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(b.id); }
                  if (e.key === "Backspace" && !b.text && bullets.length > 1) { e.preventDefault(); remove(b.id); }
                  if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); flushSync(() => move(b.id, e.key === "ArrowUp" ? -1 : 1)); focusBullet(b.id, false); }
                }} />
              <div className="bullet__tools">
                {ai && <button className="icon-btn" title="Rewrite with Gemini" aria-label="Rewrite with Gemini" onClick={() => (pop?.id === b.id ? setPop(null) : setPop({ id: b.id, mode: "", loading: false, options: [] }))} style={pop?.id === b.id ? { background: "var(--sky)" } : undefined}><Icon name="spark" size={16} /></button>}
                <button className="icon-btn danger" title="Delete bullet" aria-label="Delete bullet" onClick={() => remove(b.id)}><Icon name="x" size={16} /></button>
              </div>
            </div>
            {hasPh && <div className="ph-warn">Replace the [placeholder] with your real number.</div>}
            <AnimatePresence>
              {pop?.id === b.id && (
                <motion.div className="ai-pop" initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                  <div className="ai-pop__modes">
                    {MODES.map(([m, label]) => <button key={m} className={`btn btn--xs ${pop.mode === m ? "btn--ink" : "btn--white"}`} disabled={pop.loading || (m === "keywords" && !ats?.missing.length)} onClick={() => suggest(b, m)}>{label}</button>)}
                    <span className="spacer" />
                    <button className="icon-btn" onClick={() => setPop(null)} aria-label="Close"><Icon name="x" size={15} /></button>
                  </div>
                  {pop.loading && <div className="row small muted"><span className="spinner" /> Gemini is writing 3 options…</div>}
                  {!pop.loading && !pop.options.length && <div className="small muted">Pick how you'd like it rewritten. Nothing changes until you choose an option.</div>}
                  {pop.options.map((o) => (
                    <button key={o} className="ai-pop__opt" onClick={() => { setText(b.id, o); setPop(null); toast("Bullet updated. Undo with Ctrl+Z."); }}>
                      {o.split(/(\[[^\]]+\])/g).map((part, k) => (k % 2 ? <mark key={k} className="ph-mark">{part}</mark> : part))}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      <button className="add-dashed" onClick={() => add()}><Icon name="plus" size={15} /> Add bullet</button>
    </div>
  );
}
