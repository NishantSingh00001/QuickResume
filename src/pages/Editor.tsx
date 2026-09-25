import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, Logo, Modal } from "../components/ui";
import { edit, flashTarget, loadResume, redo, saveNow, setPublish, undo, useEditor, getEditor } from "../lib/editor";
import { forgetKey, saveKey } from "../lib/keys";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { printResume } from "../lib/print";
import { Paper } from "../resume/Paper";
import { ResumeView } from "../resume/ResumeView";
import { AtsContext, focusTarget } from "../editor/context";
import Content from "../editor/Content";
import Design from "../editor/Design";
import Ats from "../editor/Ats";
import Interview from "../editor/Interview";
import { analyzeJd, scoreResume, scoreLabel, type Tip } from "../../shared/ats";
import { resumeToText } from "../../shared/text";

type Tab = "content" | "design" | "ats" | "interview";
type View = Tab | "preview";

export default function Editor() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const status = useEditor((s) => s.status);
  const error = useEditor((s) => s.error);
  const errorStatus = useEditor((s) => s.errorStatus);

  // A private edit link carries the key in the URL hash (#k=…), which never reaches the server.
  useLayoutEffect(() => {
    const m = location.hash.match(/k=([A-Za-z0-9_-]{16,})/);
    if (m) { saveKey(id, m[1]); history.replaceState(null, "", location.pathname + location.search); }
    loadResume(id);
  }, [id]);

  const initialTab = (params.get("tab") as Tab) || "content";
  const [view, setView] = useState<View>(initialTab);
  useEffect(() => { if (params.get("tab")) { params.delete("tab"); setParams(params, { replace: true }); } }, [params, setParams]);

  if (status === "error") {
    return (
      <>
        <nav className="nav"><Logo /></nav>
        <div className="section center">
          <p className="eyebrow">{errorStatus === 401 ? "No edit key" : errorStatus === 410 ? "Not found" : "Error"}</p>
          <h1 className="h2">{errorStatus === 410 ? "This resume doesn't exist any more." : "Can't open this resume here."}</h1>
          <p className="lead" style={{ margin: "0 auto 24px" }}>{error}</p>
          <Link className="btn btn--lg" to="/start">Start a new resume</Link>
        </div>
      </>
    );
  }
  if (status !== "ready") return <div className="empty" style={{ paddingTop: 140 }}><span className="spinner" /></div>;
  return <Workspace view={view} setView={setView} />;
}

function Workspace({ view, setView }: { view: View; setView: (v: View) => void }) {
  const resume = useEditor((s) => s.resume);
  const jd = useEditor((s) => s.jd);
  const aiKeywords = useEditor((s) => s.aiKeywords);
  const aiFor = useEditor((s) => s.aiKeywordsFor);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const [share, setShare] = useState(false);
  const [pages, setPages] = useState(1);
  const tab: Tab = view === "preview" ? "content" : view;

  // Live ATS score, recomputed as you type (deferred so typing stays smooth).
  const deferred = useDeferredValue(resume);
  const jdAnalysis = useMemo(() => (jd.trim().length >= 40 ? analyzeJd(jd, aiFor === jd && aiKeywords ? aiKeywords : []) : null), [jd, aiKeywords, aiFor]);
  const report = useMemo(() => scoreResume(deferred, jdAnalysis), [deferred, jdAnalysis]);
  const ats = useMemo(() => ({ report, missing: report.keywords.filter((k) => !k.found).map((k) => k.term) }), [report]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
      else if (k === "s") { e.preventDefault(); saveNow(); toast("Saved"); }
      else if (k === "p") { e.preventDefault(); printResume(getEditor().resume); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goTo = useCallback((t: Tip) => {
    const target = t.bulletId || t.itemId || t.sectionId;
    if (!target) return;
    setView("content");
    flashTarget(target);
    setTimeout(() => focusTarget(target), 260);
  }, [setView]);

  const tone = scoreLabel(report.total).tone;

  return (
    <AtsContext.Provider value={ats}>
      <div className="editor">
        <header className="topbar">
          <Link to="/start" className="logo" aria-label="All resumes" title="All resumes"><span className="logo__mark"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" fill="#ffd43b" /><path d="m9.5 13.5 2 2 3.5-4" fill="none" stroke="#0e0e0e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span></Link>
          <div className="topbar__title">
            <input value={resume.title} onChange={(e) => edit((d) => { d.title = e.target.value; }, "title")} aria-label="Resume name (only you see this)" title="Resume name (only you see this)" />
            <SaveBadge />
          </div>
          <div className="topbar__actions">
            <button className="icon-btn hide-sm" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Icon name="undo" /></button>
            <button className="icon-btn hide-sm" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Icon name="redo" /></button>
            <button className="btn btn--sm btn--white" onClick={() => setShare(true)}><Icon name="share" size={16} /><span className="hide-sm">Share</span></button>
            <button className="btn btn--sm" onClick={() => printResume(resume)} title="Download PDF (Ctrl+P)"><Icon name="download" size={16} /> PDF</button>
          </div>
        </header>

        <div className="workspace" data-view={view}>
          <aside className="side">
            <nav className="tabs" role="tablist">
              <TabBtn on={tab === "content"} onClick={() => setView("content")} icon="pen">Content</TabBtn>
              <TabBtn on={tab === "design"} onClick={() => setView("design")} icon="palette">Design</TabBtn>
              <TabBtn on={tab === "ats"} onClick={() => setView("ats")} icon="target">ATS score <span className="dot" style={{ background: tone === "great" ? "var(--green)" : tone === "low" ? "var(--red)" : "var(--ink)" }}>{report.total}</span></TabBtn>
              <TabBtn on={tab === "interview"} onClick={() => setView("interview")} icon="mic">Interview</TabBtn>
            </nav>
            <div className="side__body">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }}>
                  {tab === "content" && <Content />}
                  {tab === "design" && <Design />}
                  {tab === "ats" && <Ats goTo={goTo} />}
                  {tab === "interview" && <Interview />}
                </motion.div>
              </AnimatePresence>
            </div>
          </aside>
          <Stage pages={pages} setPages={setPages} />
        </div>

        <nav className="mobile-nav" aria-label="Editor sections">
          {([["content", "Edit"], ["design", "Design"], ["preview", "Preview"], ["ats", `ATS ${report.total}`], ["interview", "Prep"]] as [View, string][]).map(([v, label]) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{label}</button>
          ))}
        </nav>
      </div>
      <ShareModal open={share} onClose={() => setShare(false)} />
      {createPortal(<div className="print-only"><ResumeView resume={resume} /></div>, document.body)}
    </AtsContext.Provider>
  );
}

function TabBtn({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: string; children: ReactNode }) {
  return <button className={`tab ${on ? "on" : ""}`} role="tab" aria-selected={on} onClick={onClick}><Icon name={icon} size={16} />{children}</button>;
}

function SaveBadge() {
  const save = useEditor((s) => s.save);
  const text = save === "saved" ? "Saved" : save === "saving" ? "Saving…" : save === "dirty" ? "Unsaved" : "Not saved, retrying";
  return <span className={`save ${save === "saving" || save === "dirty" ? "saving" : save === "error" ? "error" : ""}`} title={text}><i /><span>{text}</span></span>;
}

function Stage({ pages, setPages }: { pages: number; setPages: (n: number) => void }) {
  const resume = useEditor((s) => s.resume);
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(640);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.max(280, Math.min(820, el.clientWidth - 48))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const width = Math.round(fit * zoom);
  return (
    <section className="stage" ref={wrap} aria-label="Live preview">
      <div className="stage__bar">
        <span className={`pages-note ${pages > 1 ? "warn" : ""}`}>{pages === 1 ? "1 page ✓" : `${pages} pages`}</span>
        <span className="muted small hide-sm" style={{ flex: 1, textAlign: "center" }}>{pages > 1 ? "Early-career resumes work best on one page." : "Live preview · exactly what the PDF prints"}</span>
        <div className="zoom">
          <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">+</button>
        </div>
      </div>
      <div className="stage__pages">
        <div className="sheet"><Paper resume={resume} width={width} placeholders breaks onPages={setPages} /></div>
      </div>
    </section>
  );
}

function ShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const id = useEditor((s) => s.id);
  const key = useEditor((s) => s.key);
  const slug = useEditor((s) => s.slug);
  const views = useEditor((s) => s.views);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const navigate = useNavigate();
  const origin = location.origin;
  const publicUrl = slug ? `${origin}/r/${slug}` : "";
  const editUrl = `${origin}/edit/${id}#k=${key}`;
  const copy = (text: string, what: string) => navigator.clipboard?.writeText(text).then(() => toast(`${what} copied`), () => toast("Couldn't copy. Select and copy it manually.", "error"));

  const publish = async (on: boolean) => {
    setBusy(true);
    try {
      await saveNow();
      const r = await api<{ slug: string | null }>(`/api/resumes/${id}/publish`, { method: on ? "POST" : "DELETE", key });
      setPublish(r.slug);
      if (r.slug) copy(`${origin}/r/${r.slug}`, "Public link");
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const download = () => {
    const r = getEditor().resume;
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(r.basics.name || "resume").replace(/\s+/g, "_")}.quickresume.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const remove = async () => {
    try {
      await api(`/api/resumes/${id}`, { method: "DELETE", key });
      forgetKey(id);
      toast("Resume deleted");
      navigate("/start");
    } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <Modal open={open} onClose={onClose} label="Share and export">
      <div className="row"><h3>Share & export</h3><span className="spacer" /><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>

      <h4 className="h4" style={{ marginTop: 10 }}>Public link</h4>
      {slug ? (
        <>
          <p className="small muted" style={{ margin: 0 }}>Anyone with this link can view and download your resume. Viewed {views} time{views === 1 ? "" : "s"}.</p>
          <div className="copy-row"><input className="input" readOnly value={publicUrl} onFocus={(e) => e.target.select()} /><button className="btn btn--sm" onClick={() => copy(publicUrl, "Public link")}><Icon name="copy" size={15} /></button></div>
          <div className="row"><a className="btn btn--xs btn--white" href={publicUrl} target="_blank" rel="noreferrer">Open</a><button className="btn btn--xs btn--ghost" disabled={busy} onClick={() => publish(false)}>Stop sharing</button></div>
        </>
      ) : (
        <>
          <p className="small muted" style={{ margin: "0 0 10px" }}>Get a link to put in emails, LinkedIn or a portfolio. It always shows your latest version.</p>
          <button className="btn btn--sm" disabled={busy} onClick={() => publish(true)}><Icon name="link" size={15} /> Create public link</button>
        </>
      )}

      <h4 className="h4">Private edit link</h4>
      <p className="small muted" style={{ margin: 0 }}>Open this on another device to keep editing. Anyone with it can edit, so don't share it.</p>
      <div className="copy-row"><input className="input" readOnly value={editUrl} onFocus={(e) => e.target.select()} /><button className="btn btn--sm btn--white" onClick={() => copy(editUrl, "Edit link")}><Icon name="copy" size={15} /></button></div>

      <h4 className="h4">Export</h4>
      <div className="row">
        <button className="btn btn--xs" onClick={() => { onClose(); setTimeout(() => printResume(getEditor().resume), 250); }}><Icon name="download" size={14} /> PDF</button>
        <button className="btn btn--xs btn--white" onClick={() => copy(resumeToText(getEditor().resume), "Plain text")}><Icon name="copy" size={14} /> Copy plain text</button>
        <button className="btn btn--xs btn--white" onClick={download}><Icon name="file" size={14} /> Backup (.json)</button>
      </div>
      <p className="hint">Plain text is handy for job portals that ask you to paste your resume.</p>

      <h4 className="h4">Danger zone</h4>
      {confirmDel
        ? <div className="row"><button className="btn btn--xs" style={{ background: "var(--red)", color: "#fff" }} onClick={remove}>Yes, delete it for good</button><button className="btn btn--xs btn--ghost" onClick={() => setConfirmDel(false)}>Cancel</button></div>
        : <button className="btn btn--xs btn--ghost" onClick={() => setConfirmDel(true)}><Icon name="trash" size={14} /> Delete this resume</button>}
    </Modal>
  );
}
