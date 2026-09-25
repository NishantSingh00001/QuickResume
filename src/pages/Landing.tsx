import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Icon, Logo } from "../components/ui";
import { Paper } from "../resume/Paper";
import { Gauge } from "../components/Gauge";
import { sampleResume } from "../../shared/sample";
import { SAMPLE_JD } from "../../shared/sampleJd";
import { analyzeJd, scoreResume } from "../../shared/ats";

const MARQUEE = ["Python", "System design", "React", "SQL", "Docker", "Machine learning", "REST APIs", "Leadership", "Kubernetes", "Data analysis", "TypeScript", "AWS", "Communication", "Java", "CI/CD", "Figma"];

const PARTS = [
  { pts: 40, label: "Keyword match", text: "Skills and tools from the job description, weighted: must-haves count more than nice-to-haves. Keywords backed by a bullet count more than a bare skills list." },
  { pts: 20, label: "Impact", text: "Bullets that start with an action verb and show a number: users, %, time saved, scale." },
  { pts: 15, label: "Completeness", text: "Contact details, links, summary, experience or projects, education and skills." },
  { pts: 10, label: "Role fit", text: "The job title, degree and experience the posting asks for." },
  { pts: 10, label: "Length & readability", text: "One page of tight bullets for early-career resumes." },
  { pts: 5, label: "Structure", text: "Standard headings and dates that ATS parsers recognise." },
];

const FAQ = [
  ["Is it free? Do I need an account?", "Yes, it's free, and there's no sign-up. Your resume is saved online with a private edit key that stays in your browser. You can copy a private link to keep editing on another device."],
  ["Does the AI make things up?", "It's told never to invent employers, tools or results. When a bullet needs a number it doesn't know, it leaves a highlighted placeholder like [X%] for you to fill in, and the ATS check reminds you until you do."],
  ["Will this get me past every ATS?", "No tool can promise that, and anyone who does is guessing. The score checks what applicant tracking systems and recruiters actually look for (keywords, clear structure and measurable results), and it shows exactly why you got each point."],
  ["What does the PDF look like to an ATS?", "The templates are single-column with real, selectable text and standard headings. No tables, text boxes or icons that parsers trip over. You can also copy the plain text for job portals that ask you to paste your resume."],
  ["Who can see my resume?", "Only you, unless you create a public link. You can turn the link off or delete the resume any time. Job descriptions you paste stay in your browser."],
];

export default function Landing() {
  const demo = useMemo(() => {
    const r = sampleResume();
    const report = scoreResume(r, analyzeJd(SAMPLE_JD));
    return { r, report, missing: report.keywords.filter((k) => !k.found).map((k) => k.term) };
  }, []);

  return (
    <>
      <nav className="nav nav--yellow">
        <Logo />
        <div className="nav__links">
          <a href="#features" className="hide-sm">Features</a>
          <a href="#score" className="hide-sm">How scoring works</a>
          <Link to="/start" className="btn btn--ink btn--sm">Build my resume</Link>
        </div>
      </nav>

      <header className="hero">
        <div className="hero__in">
          <div>
            <motion.span className="tag" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>Free · No sign-up · Powered by Gemini</motion.span>
            <motion.h1 className="hero__title" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.9, 0.25, 1] }}>
              Get past the bots. Land the <em>interview.</em>
            </motion.h1>
            <motion.p className="hero__sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
              QuickResume writes and sharpens your resume with Gemini, shows you exactly how an applicant tracking system reads it against any job description, and helps you practise the interview.
            </motion.p>
            <motion.div className="hero__cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}>
              <Link to="/start" className="btn btn--ink btn--lg">Build my resume <Icon name="arrow" /></Link>
              <Link to="/start?mode=check" className="btn btn--white btn--lg"><Icon name="target" /> Check my ATS score</Link>
            </motion.div>
            <div className="hero__proof">
              <span><Icon name="check" size={15} /> ATS-safe templates</span>
              <span><Icon name="check" size={15} /> A score you can check</span>
              <span><Icon name="check" size={15} /> PDF with real text</span>
            </div>
          </div>

          <div className="hero__art" aria-hidden="true">
            <div className="paper-stack">
              <motion.div className="paper paper--back" initial={{ rotate: 12, opacity: 0 }} animate={{ rotate: 6, opacity: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 120, damping: 14 }} />
              <motion.div className="paper paper--mid" initial={{ rotate: -10, opacity: 0 }} animate={{ rotate: -4, opacity: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 120, damping: 14 }} />
              <motion.div className="paper" initial={{ y: 60, opacity: 0, rotate: 3 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ delay: 0.4, type: "spring", stiffness: 110, damping: 15 }} whileHover={{ rotate: -1.5, scale: 1.02 }}>
                <Paper resume={demo.r} width={400} />
              </motion.div>
            </div>
            <Floating className="sticker" style={{ bottom: "20%", left: "-5%", background: "#fff" }} delay={0.8}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Gauge value={demo.report.total} size={46} stroke={6} /> <span>ATS score<br /><small className="mono">vs. a real job post</small></span></span>
            </Floating>
            <Floating className="sticker hide-mobile" style={{ top: "44%", right: "-4%", background: "var(--sky)" }} delay={1}>
              <Icon name="spark" size={15} /> Bullet rewritten by Gemini
            </Floating>
            <Floating className="sticker hide-mobile" style={{ top: "3%", right: "0%", background: "var(--orange-2)" }} delay={1.2}>
              Missing: <b>{demo.missing.slice(0, 2).join(", ")}</b>
            </Floating>
            <Floating className="sticker" style={{ bottom: "4%", right: "6%", background: "var(--yellow)", rotate: "4deg" }} delay={1.4}>
              1 page ✓
            </Floating>
          </div>
        </div>
      </header>

      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">{[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}</div>
      </div>

      <section className="section" id="features">
        <span className="eyebrow">What it does</span>
        <h2 className="h2">Three jobs. One tab.</h2>
        <p className="lead">Most resume builders stop at a pretty template. QuickResume helps with the three things that decide whether you get the call.</p>
        <div className="features">
          <Feature color="var(--yellow)" icon="pen" title="Write it with Gemini" text="Upload your old resume, or just type rough notes. Gemini turns them into sharp, honest bullets, and rewrites any bullet in one click: stronger, shorter or with numbers.">
            <div className="feature__demo">
              <div className="muted" style={{ textDecoration: "line-through", fontSize: "0.8rem" }}>Worked on the backend of the college app</div>
              <div style={{ marginTop: 6, fontWeight: 600 }}>Built REST APIs in Node.js for the college events app, serving <span className="ph-mark">[N]</span> students each semester</div>
            </div>
          </Feature>
          <Feature color="var(--sky)" icon="target" title="See what the ATS sees" text="Paste any job description. You get a score out of 100 with every point explained: which keywords you're missing, which bullets have no numbers, and what to fix first.">
            <div className="feature__demo">
              <div className="kw">
                {demo.report.keywords.slice(0, 6).map((k) => <span key={k.term} className={`chip ${k.found ? (k.where === "skills" ? "chip--skills" : "chip--hit") : `chip--miss ${k.required ? "req" : ""}`}`}>{k.found ? "✓" : "+"} {k.term}</span>)}
              </div>
            </div>
          </Feature>
          <Feature color="var(--lilac)" icon="mic" title="Practise the interview" text="Get the questions an interviewer would ask about your projects and this role. Type an answer and get a score, what worked and a stronger version to learn from.">
            <div className="feature__demo">
              <b>“Walk me through QueueLite. Why Redis?”</b>
              <div className="row small" style={{ marginTop: 6 }}><span className="kind project">project</span><span className="muted">Your answer: 8/10 · add a metric</span></div>
            </div>
          </Feature>
        </div>
      </section>

      <section className="section" id="score" style={{ paddingTop: 0 }}>
        <div className="how">
          <div>
            <span className="eyebrow">How scoring works</span>
            <h2 className="h2">An ATS score you can actually check.</h2>
            <p className="lead">Many "ATS checkers" give you a number and a paywall. QuickResume's score is plain rules, run in your browser, updated as you type, and every point is explained. Gemini can read the job description too, but the score never depends on it.</p>
            <div className="row" style={{ marginTop: 26 }}>
              <Link to="/start?mode=check" className="btn btn--lg"><Icon name="target" /> Score my resume</Link>
            </div>
          </div>
          <div className="how__parts">
            {PARTS.map((p, i) => (
              <motion.div key={p.label} className="how__part" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: i * 0.06, type: "spring", stiffness: 200, damping: 22 }}>
                <div className="how__pts">{p.pts}<small>POINTS</small></div>
                <div><b>{p.label}</b><span>{p.text}</span></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <span className="eyebrow">Questions</span>
        <h2 className="h2">Good to know.</h2>
        <div className="faq">
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </section>

      <div className="cta-band">
        <div className="section" style={{ paddingBlock: 56 }}>
          <h2 className="h2" style={{ margin: 0, color: "#fff" }}>Your next application<br />deserves a better resume.</h2>
          <Link to="/start" className="btn btn--lg">Start now, it's free <Icon name="arrow" /></Link>
        </div>
      </div>

      <footer className="footer">
        <span>Built by <a href="https://nishant-singhaa0240274.netlify.app" target="_blank" rel="noreferrer">Nishant Singh</a> · <a href="https://github.com/NishantSingh00001/quickresume" target="_blank" rel="noreferrer">Source on GitHub</a></span>
        <span className="mono">React · TypeScript · Netlify Functions · Blobs · Gemini</span>
      </footer>
    </>
  );
}

function Feature({ color, icon, title, text, children }: { color: string; icon: string; title: string; text: string; children: ReactNode }) {
  return (
    <motion.article className="card feature" style={{ background: color }} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ type: "spring", stiffness: 160, damping: 20 }}>
      <span className="option__icon"><Icon name={icon} size={24} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </motion.article>
  );
}

function Floating({ children, className, style, delay }: { children: ReactNode; className: string; style: CSSProperties & { rotate?: string }; delay: number }) {
  const { rotate, ...rest } = style;
  return (
    <motion.div className={className} style={{ ...rest, rotate: rotate || 0 }}
      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
      transition={{ opacity: { delay }, scale: { delay, type: "spring", stiffness: 300, damping: 14 }, y: { delay: delay + 0.4, duration: 4 + delay, repeat: Infinity, ease: "easeInOut" } }}
      whileHover={{ scale: 1.08, rotate: -3 }}>
      {children}
    </motion.div>
  );
}
