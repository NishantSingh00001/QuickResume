import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Busy, Icon, Logo, Modal, useAi } from "../components/ui";
import { api, fileToBase64 } from "../lib/api";
import { allKeys, forgetKey, saveKey, setJd } from "../lib/keys";
import { toast } from "../lib/toast";
import { sampleResume } from "../../shared/sample";
import { SAMPLE_JD } from "../../shared/sampleJd";
import { emptyResume, type Resume } from "../../shared/types";

type Mode = "import" | "draft" | "example";

async function create(resume: Resume): Promise<string> {
  const r = await api<{ id: string; key: string }>("/api/resumes", { body: { resume } });
  saveKey(r.id, r.key);
  return r.id;
}

export default function Start() {
  const [params] = useSearchParams();
  const { ai, loaded } = useAi();
  const [mode, setMode] = useState<Mode>("import");
  const [busy, setBusy] = useState<{ title: string; text?: string } | null>(null);
  const navigate = useNavigate();
  const check = params.get("mode") === "check";

  useEffect(() => { if (loaded && !ai) setMode("example"); }, [loaded, ai]);

  const open = async (resume: Resume, jd = "") => {
    const id = await create(resume);
    if (jd.trim()) setJd(id, jd.trim());
    navigate(`/edit/${id}${jd.trim() ? "?tab=ats" : ""}`);
  };

  return (
    <>
      <nav className="nav">
        <Logo />
        <div className="nav__links"><Link to="/">Home</Link></div>
      </nav>
      <main className="start">
        <span className="eyebrow">{check ? "ATS check" : "New resume"}</span>
        <h1 className="start__title">{check ? "Let's see how your resume scores." : "How do you want to start?"}</h1>
        <p className="lead">{check ? "Import your resume and paste the job description. You'll get a score out of 100, the keywords you're missing and what to fix first." : "Everything saves automatically. You can change templates, colours and every word later."}</p>

        <div className="options" role="tablist">
          <Option on={mode === "import"} disabled={loaded && !ai} icon="upload" title="Import my resume" text="Upload a PDF or paste the text. Gemini turns it into an editable resume, keeping your wording." onClick={() => setMode("import")} />
          <Option on={mode === "draft"} disabled={loaded && !ai} icon="spark" title="Write it with AI" text="No resume yet? Answer a few questions in rough notes and Gemini drafts a complete first version." onClick={() => setMode("draft")} />
          <Option on={mode === "example"} icon="bolt" title="Example or blank" text="Start from a complete example resume to see how it works, or from an empty page." onClick={() => setMode("example")} />
        </div>
        {loaded && !ai && <div className="notice"><Icon name="spark" /> AI features aren't switched on for this deployment, so importing and drafting are unavailable. The editor, templates and ATS score all work.</div>}

        <AnimatePresence mode="wait">
          <motion.div key={mode} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {mode === "import" && <ImportPanel check={check} setBusy={setBusy} open={open} />}
            {mode === "draft" && <DraftPanel setBusy={setBusy} open={open} />}
            {mode === "example" && (
              <div className="card panel-lg">
                <div className="row">
                  <button className="btn btn--lg" onClick={() => open(sampleResume(), check ? SAMPLE_JD : "").catch((e) => toast(e.message, "error"))}><Icon name="file" /> Open the example resume</button>
                  <button className="btn btn--white btn--lg" onClick={() => open(emptyResume()).catch((e) => toast(e.message, "error"))}><Icon name="plus" /> Start blank</button>
                </div>
                <p className="hint" style={{ marginTop: 14 }}>The example is a fictional new-grad backend engineer. It comes with a sample job description so you can try the ATS check and interview practice straight away.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <MyResumes />
      </main>
      <AnimatePresence>{busy && <Busy title={busy.title} text={busy.text} />}</AnimatePresence>
    </>
  );
}

function Option({ on, disabled, icon, title, text, onClick }: { on: boolean; disabled?: boolean; icon: string; title: string; text: string; onClick: () => void }) {
  return (
    <button className={`card option ${on ? "on" : ""}`} role="tab" aria-selected={on} onClick={onClick} disabled={disabled} style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
      <span className="option__icon"><Icon name={icon} size={24} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {disabled && <span className="tag" style={{ alignSelf: "flex-start", marginTop: "auto" }}>Needs AI</span>}
    </button>
  );
}

type BusySetter = (b: { title: string; text?: string } | null) => void;

function ImportPanel({ check, setBusy, open }: { check: boolean; setBusy: BusySetter; open: (r: Resume, jd?: string) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [jd, setJdText] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) return toast("Files can be up to 4 MB.", "error");
    if (!/pdf|png|jpe?g|webp|text\/plain/.test(f.type)) return toast("Upload a PDF, an image of your resume, or a .txt file.", "error");
    setFile(f);
  };

  const go = async () => {
    setBusy({ title: "Reading your resume", text: "Gemini is pulling out every job, project and skill. This takes 10–30 seconds." });
    try {
      const body = file ? { file: { mimeType: file.type, data: await fileToBase64(file) } } : { text };
      const r = await api<{ resume: Resume }>("/api/ai/import", { body });
      await open(r.resume, jd);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(null);
    }
  };

  return (
    <div className="card panel-lg">
      <div className={`dropzone ${over ? "over" : ""}`} onClick={() => input.current?.click()} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
        <input ref={input} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/*,text/plain" onChange={(e) => pick(e.target.files?.[0])} />
        {file ? (
          <div className="row" style={{ justifyContent: "center" }}>
            <Icon name="file" size={26} /><b>{file.name}</b><span className="muted small">{(file.size / 1024).toFixed(0)} KB</span>
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setFile(null); }} aria-label="Remove file"><Icon name="x" /></button>
          </div>
        ) : (
          <>
            <Icon name="upload" size={30} />
            <div><b>Drop your resume here</b> or click to choose</div>
            <div className="muted small">PDF, image or text · up to 4 MB</div>
          </>
        )}
      </div>
      {!file && (
        <>
          <div className="or">OR PASTE IT</div>
          <textarea className="textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the text of your resume, or your LinkedIn profile's About and Experience sections…" />
        </>
      )}
      <label className="field" style={{ marginTop: 18 }}>
        <span>Job description {check ? "" : "(optional)"}</span>
        <textarea className="textarea" rows={check ? 6 : 3} value={jd} onChange={(e) => setJdText(e.target.value)} placeholder="Paste the job you're applying for to get your ATS score straight away." />
      </label>
      <div className="row">
        <button className="btn btn--ink btn--lg" disabled={!file && text.trim().length < 80} onClick={go}><Icon name="spark" /> Import with Gemini</button>
        {check && !jd && <button className="btn btn--ghost btn--sm" onClick={() => setJdText(SAMPLE_JD)}>Use an example job description</button>}
      </div>
    </div>
  );
}

const DRAFT_FIELDS: [keyof DraftForm, string, string, number?][] = [
  ["education", "Education", "B.E. Computer Engineering, XYZ Institute, Mumbai, 2022–2026, CGPA 7.9. Relevant courses: DBMS, OS, ML", 3],
  ["experience", "Internships and work (rough notes are fine)", "Web dev intern at ABC Labs, Jun–Aug 2025: made the admin dashboard in React, fixed bugs, wrote APIs in Node for reports…", 4],
  ["projects", "Projects", "Chat app with Socket.IO + MongoDB, ~200 users in college. Movie recommender in Python using collaborative filtering…", 4],
  ["skills", "Skills", "Python, Java, React, Node.js, MongoDB, SQL, Git, Docker", 2],
  ["extras", "Achievements, certifications, activities", "Top 10 in college hackathon, AWS Cloud Practitioner, GDSC core team", 2],
];

interface DraftForm { name: string; email: string; phone: string; location: string; links: string; targetRole: string; education: string; experience: string; projects: string; skills: string; extras: string }

function DraftPanel({ setBusy, open }: { setBusy: BusySetter; open: (r: Resume, jd?: string) => Promise<void> }) {
  const [f, setF] = useState<DraftForm>({ name: "", email: "", phone: "", location: "", links: "", targetRole: "", education: "", experience: "", projects: "", skills: "", extras: "" });
  const bind = (k: keyof DraftForm) => ({ value: f[k], onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value })) });
  const ready = f.name.trim() && f.targetRole.trim() && (f.education + f.experience + f.projects).trim().length >= 30;
  const go = async () => {
    setBusy({ title: "Writing your first draft", text: "Gemini is turning your notes into bullets. Anything it can't know, like numbers, becomes a [placeholder] for you to fill in." });
    try {
      const r = await api<{ resume: Resume }>("/api/ai/draft", { body: f });
      await open(r.resume);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(null);
    }
  };
  return (
    <div className="card panel-lg">
      <div className="grid2">
        <label className="field"><span>Full name *</span><input className="input" {...bind("name")} placeholder="Priya Sharma" autoComplete="name" /></label>
        <label className="field"><span>Target role *</span><input className="input" {...bind("targetRole")} placeholder="Software Engineer, Data Analyst…" /></label>
        <label className="field"><span>Email</span><input className="input" {...bind("email")} type="email" autoComplete="email" /></label>
        <label className="field"><span>Phone</span><input className="input" {...bind("phone")} autoComplete="tel" /></label>
        <label className="field"><span>City</span><input className="input" {...bind("location")} placeholder="Pune, India" /></label>
        <label className="field"><span>Links</span><input className="input" {...bind("links")} placeholder="linkedin.com/in/…, github.com/…" /></label>
      </div>
      {DRAFT_FIELDS.map(([k, label, ph, rows]) => (
        <label key={k} className="field"><span>{label}</span><textarea className="textarea" rows={rows} {...bind(k)} placeholder={ph} /></label>
      ))}
      <button className="btn btn--ink btn--lg" disabled={!ready} onClick={go}><Icon name="spark" /> Draft my resume</button>
      {!ready && <p className="hint">Add your name, the role you want, and a few lines about your education, work or projects.</p>}
    </div>
  );
}

interface Mine { id: string; title?: string; name?: string; updatedAt?: string; slug?: string | null; views?: number; gone?: boolean }

function MyResumes() {
  const [list, setList] = useState<Mine[] | null>(null);
  const [del, setDel] = useState<Mine | null>(null);
  useEffect(() => {
    const items = allKeys();
    if (!items.length) { setList([]); return; }
    api<{ resumes: Mine[] }>("/api/resumes/list", { body: { items } })
      .then((r) => {
        r.resumes.filter((x) => x.gone).forEach((x) => forgetKey(x.id));
        setList(r.resumes.filter((x) => !x.gone && x.title !== undefined));
      })
      .catch(() => setList([]));
  }, []);
  if (!list || !list.length) return null;
  const remove = async (m: Mine) => {
    const key = allKeys().find((k) => k.id === m.id)?.key;
    try {
      await api(`/api/resumes/${m.id}`, { method: "DELETE", key });
      forgetKey(m.id);
      setList((l) => (l || []).filter((x) => x.id !== m.id));
      toast("Resume deleted");
    } catch (e) { toast((e as Error).message, "error"); }
    setDel(null);
  };
  return (
    <section style={{ marginTop: 48 }}>
      <h2 className="h4" style={{ fontSize: "0.85rem" }}>Your resumes in this browser</h2>
      <div className="mine">
        {list.map((m) => (
          <div key={m.id} className="card mine__item">
            <Link to={`/edit/${m.id}`} style={{ textDecoration: "none" }}><b>{m.title || m.name || "Untitled resume"}</b></Link>
            <span className="mine__meta">Edited {m.updatedAt ? new Date(m.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "–"}{m.slug ? ` · shared · ${m.views} views` : ""}</span>
            <div className="row" style={{ marginTop: 6 }}>
              <Link to={`/edit/${m.id}`} className="btn btn--sm">Open</Link>
              <button className="btn btn--sm btn--ghost" onClick={() => setDel(m)}><Icon name="trash" size={16} /> Delete</button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={Boolean(del)} onClose={() => setDel(null)} label="Delete resume">
        <h3>Delete “{del?.title}”?</h3>
        <p className="muted">This removes it from our servers, including any public link. It can't be undone.</p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" style={{ background: "var(--red)", color: "#fff" }} onClick={() => del && remove(del)}>Delete for good</button>
          <button className="btn btn--white" onClick={() => setDel(null)}>Cancel</button>
        </div>
      </Modal>
    </section>
  );
}
