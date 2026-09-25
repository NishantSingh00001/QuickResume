import { createContext, forwardRef, useContext, type CSSProperties, type ReactNode } from "react";
import type { Resume, Section } from "../../shared/types";
import "./fonts";
import "./resume.css";

const range = (a: string, b: string) => [a, b].map((x) => x.trim()).filter(Boolean).join(" – ");
const href = (url: string) => (/^https?:\/\//i.test(url) ? url : /@/.test(url) ? `mailto:${url}` : `https://${url}`);
const display = (url: string) => url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

/** Highlights [placeholders] the AI left for the user to fill in (the highlight isn't printed). */
const Mark = createContext(false);
function T({ children }: { children: string }): ReactNode {
  const mark = useContext(Mark);
  if (!mark || !children.includes("[")) return children;
  return children.split(/(\[[^\]]{1,40}\])/g).map((part, i) => (i % 2 ? <mark key={i} className="rv__ph">{part}</mark> : part));
}

function Item({ title, date, sub, children }: { title: ReactNode; date: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rv__item">
      <div className="rv__row"><div>{title}</div>{date && <span className="rv__date">{date}</span>}</div>
      {sub && <div className="rv__sub">{sub}</div>}
      {children}
    </div>
  );
}

function Bullets({ list }: { list: { id: string; text: string }[] }) {
  const items = list.filter((b) => b.text.trim());
  if (!items.length) return null;
  return <ul>{items.map((b) => <li key={b.id}><T>{b.text.trim()}</T></li>)}</ul>;
}

function SectionView({ s, placeholders }: { s: Section; placeholders: boolean }) {
  let body: ReactNode = null;
  switch (s.kind) {
    case "experience": {
      const items = s.items.filter((i) => i.role || i.org || i.bullets.some((b) => b.text.trim()));
      if (!items.length) return placeholders ? <Empty title={s.title} /> : null;
      body = items.map((i) => (
        <Item key={i.id} date={range(i.start, i.end)}
          title={<><span className="rv__role"><T>{i.role}</T></span>{i.role && i.org ? ", " : ""}<span className="rv__org"><T>{i.org}</T></span></>}
          sub={i.location || undefined}>
          <Bullets list={i.bullets} />
        </Item>
      ));
      break;
    }
    case "projects": {
      const items = s.items.filter((i) => i.name || i.bullets.some((b) => b.text.trim()));
      if (!items.length) return placeholders ? <Empty title={s.title} /> : null;
      body = items.map((i) => (
        <Item key={i.id} date={range(i.start, i.end)}
          title={<>
            <span className="rv__role"><T>{i.name}</T></span>
            {i.tech && <span className="rv__tech"> | {i.tech}</span>}
            {i.link && <span className="rv__tech"> | <a href={href(i.link)}>{display(i.link)}</a></span>}
          </>}>
          <Bullets list={i.bullets} />
        </Item>
      ));
      break;
    }
    case "education": {
      const items = s.items.filter((i) => i.school || i.degree);
      if (!items.length) return placeholders ? <Empty title={s.title} /> : null;
      body = items.map((i) => (
        <Item key={i.id} date={range(i.start, i.end)}
          title={<><span className="rv__role">{i.degree}</span>{i.degree && i.school ? ", " : ""}<span className="rv__org">{i.school}</span></>}
          sub={[i.location, i.score].filter(Boolean).join(" · ") || undefined}>
          {i.details && <p className="rv__details">{i.details}</p>}
        </Item>
      ));
      break;
    }
    case "skills": {
      const groups = s.groups.filter((g) => g.skills.trim());
      if (!groups.length) return placeholders ? <Empty title={s.title} /> : null;
      body = groups.map((g) => (
        <p key={g.id} className="rv__skill">{g.name && <b>{g.name}: </b>}<span>{g.skills}</span></p>
      ));
      break;
    }
    case "list": {
      const items = s.items.filter((i) => i.text.trim());
      if (!items.length) return placeholders ? <Empty title={s.title} /> : null;
      body = <ul>{items.map((i) => <li key={i.id}><T>{i.text}</T></li>)}</ul>;
      break;
    }
  }
  return (
    <section className="rv__sec">
      <h2 className="rv__h">{s.title}</h2>
      {body}
    </section>
  );
}

function Empty({ title }: { title: string }) {
  return (
    <section className="rv__sec">
      <h2 className="rv__h">{title}</h2>
      <p className="rv__empty">Add something to this section and it appears here.</p>
    </section>
  );
}

interface Props { resume: Resume; placeholders?: boolean; className?: string }

/** Renders the resume. `placeholders` (the editor preview) shows empty sections and highlights [placeholders]. */
export const ResumeView = forwardRef<HTMLElement, Props>(function ResumeView({ resume, placeholders = false, className = "" }, ref) {
  const { basics: b, settings } = resume;
  const contact = [
    b.email && <a href={`mailto:${b.email}`}>{b.email}</a>,
    b.phone && <span>{b.phone}</span>,
    b.location && <span>{b.location}</span>,
    ...b.links.filter((l) => l.url.trim()).map((l) => <a href={href(l.url)}>{display(l.url)}</a>),
  ].filter(Boolean);
  const style = { "--accent": settings.accent, "--fs": settings.fontScale, "--sp": settings.spacing } as CSSProperties;
  return (
    <Mark.Provider value={placeholders}>
    <article ref={ref} className={`rv rv--${settings.template} ${settings.paper === "letter" ? "letter" : ""} ${className}`} style={style}>
      <header className="rv__head">
        <h1 className="rv__name">{b.name || (placeholders ? "Your Name" : "")}</h1>
        {b.headline && <p className="rv__headline"><T>{b.headline}</T></p>}
        {contact.length > 0 && <p className="rv__contact">{contact.map((c, i) => <span key={i}>{c}</span>)}</p>}
      </header>
      {resume.summary.trim() && (
        <section className="rv__sec">
          <h2 className="rv__h">Summary</h2>
          <p className="rv__summary"><T>{resume.summary.trim()}</T></p>
        </section>
      )}
      {resume.sections.filter((s) => !s.hidden).map((s) => <SectionView key={s.id} s={s} placeholders={placeholders} />)}
    </article>
    </Mark.Provider>
  );
});
