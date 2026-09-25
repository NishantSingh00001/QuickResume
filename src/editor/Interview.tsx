import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, useAi } from "../components/ui";
import { getEditor, useEditor } from "../lib/editor";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import type { Question } from "../../shared/questions";

interface Feedback { score: number; verdict: string; strengths: string[]; improve: string[]; better: string }
interface Saved { questions: Question[]; answers: Record<string, string>; feedback: Record<string, Feedback>; at: number; ai: boolean }

const load = (id: string): Saved | null => { try { return JSON.parse(localStorage.getItem(`qr.iv.${id}`) || "null"); } catch { return null; } };
const persist = (id: string, s: Saved) => { try { localStorage.setItem(`qr.iv.${id}`, JSON.stringify(s)); } catch { /* ignore */ } };

export default function Interview() {
  const id = useEditor((s) => s.id);
  const jd = useEditor((s) => s.jd);
  const { ai } = useAi();
  const [data, setData] = useState<Saved | null>(() => load(id));
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [forId, setForId] = useState(id);
  if (forId !== id) { setForId(id); setData(load(id)); }
  useEffect(() => { if (data) persist(id, data); }, [id, data]);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await api<{ questions: Question[]; model: string | null }>("/api/ai/interview", { body: { resume: getEditor().resume, jd, count: 10 } });
      setData({ questions: r.questions, answers: {}, feedback: {}, at: Date.now(), ai: Boolean(r.model) });
      setOpen(r.questions[0]?.id || null);
    } catch (e) { toast((e as Error).message, "error"); } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="box box--lilac">
        <b style={{ fontSize: "1.05rem" }}>Practise the interview</b>
        <p className="small" style={{ margin: "6px 0 12px" }}>
          {ai ? "Gemini writes the questions an interviewer would ask about your projects, skills and " : "Questions picked for the skills on your resume and "}
          {jd ? "this job description." : "target role. Paste a job description in the ATS tab for sharper questions."}
          {ai && " Type an answer to any question and get a score, what worked and a stronger version."}
        </p>
        <button className="btn btn--sm btn--ink" onClick={generate} disabled={loading}>
          {loading ? <><span className="spinner" style={{ borderTopColor: "#fff", width: 14, height: 14 }} /> Writing questions…</> : data ? "New set of questions" : "Generate questions"}
        </button>
      </div>

      {data?.questions.map((q, i) => (
        <QuestionCard key={q.id} n={i + 1} q={q} open={open === q.id} onToggle={() => setOpen(open === q.id ? null : q.id)} ai={ai}
          answer={data.answers[q.id] || ""} feedback={data.feedback[q.id]}
          setAnswer={(a) => setData((d) => (d ? { ...d, answers: { ...d.answers, [q.id]: a } } : d))}
          setFeedback={(f) => setData((d) => (d ? { ...d, feedback: { ...d.feedback, [q.id]: f } } : d))} />
      ))}
      {data && !data.ai && ai && <p className="hint">These came from the built-in question bank.</p>}
    </div>
  );
}

function QuestionCard({ n, q, open, onToggle, ai, answer, feedback, setAnswer, setFeedback }: {
  n: number; q: Question; open: boolean; onToggle: () => void; ai: boolean; answer: string; feedback?: Feedback;
  setAnswer: (a: string) => void; setFeedback: (f: Feedback) => void;
}) {
  const [loading, setLoading] = useState(false);
  const check = async () => {
    setLoading(true);
    try {
      const { resume, jd } = getEditor();
      setFeedback(await api<Feedback>("/api/ai/feedback", { body: { question: q.question, answer, resume, jd } }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setLoading(false); }
  };
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  return (
    <div className={`qcard ${open ? "open" : ""}`}>
      <button className="qcard__head" onClick={onToggle} aria-expanded={open}>
        <span className="qcard__num">{n}</span>
        <span>{q.question}<br /><span className={`kind ${q.kind}`} style={{ display: "inline-block", marginTop: 6 }}>{q.kind}</span>{feedback && <span className="kind" style={{ marginLeft: 6, background: "var(--yellow)" }}>{feedback.score}/10</span>}</span>
        <span className={`chev ${open ? "open" : ""}`}><Icon name="chev" /></span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div className="qcard__body">
              {q.why && <p style={{ margin: "0 0 6px" }}><b>Why they ask: </b>{q.why}</p>}
              {q.tips.length > 0 && <ul>{q.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
              <label className="field">
                <span>Your answer {words ? `· ${words} words` : ""}</span>
                <textarea className="textarea" rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={q.kind === "behavioral" ? "Situation → task → what you did → result (with a number if you can)…" : "Answer as you would out loud…"} />
              </label>
              {ai ? (
                <button className="btn btn--sm btn--lilac" onClick={check} disabled={loading || words < 8}>{loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Reviewing…</> : <><Icon name="spark" size={14} /> Get feedback</>}</button>
              ) : <p className="hint">Answer feedback needs the AI to be switched on.</p>}
              {feedback && (
                <motion.div className="fb" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="fb__score">{feedback.score}<small>/ 10 · {feedback.verdict}</small></div>
                  {feedback.strengths.length > 0 && <><b className="small">What worked</b><ul>{feedback.strengths.map((s) => <li key={s}>{s}</li>)}</ul></>}
                  {feedback.improve.length > 0 && <><b className="small">Make it better</b><ul>{feedback.improve.map((s) => <li key={s}>{s}</li>)}</ul></>}
                  {feedback.better && <><b className="small">A stronger answer</b><p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{feedback.better}</p></>}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
