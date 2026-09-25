import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Icon, Logo } from "../components/ui";
import { api } from "../lib/api";
import { printResume } from "../lib/print";
import { Paper } from "../resume/Paper";
import { ResumeView } from "../resume/ResumeView";
import type { Resume } from "../../shared/types";

export default function PublicResume() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<{ resume: Resume; updatedAt: string; views: number } | null>(null);
  const [error, setError] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    api<{ resume: Resume; updatedAt: string; views: number }>(`/api/public/${slug}`)
      .then((r) => { setData(r); document.title = `${r.resume.basics.name || "Resume"} · Resume`; })
      .catch((e) => setError(e.message));
  }, [slug]);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.min(820, el.clientWidth - 32)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  if (error) {
    return (
      <>
        <nav className="nav"><Logo /></nav>
        <div className="section center">
          <h1 className="h2">This resume isn't available.</h1>
          <p className="lead" style={{ margin: "0 auto 24px" }}>{error}</p>
          <Link className="btn btn--lg" to="/">Make your own on QuickResume</Link>
        </div>
      </>
    );
  }
  if (!data) return <div className="empty" style={{ paddingTop: 140 }}><span className="spinner" /></div>;
  const b = data.resume.basics;
  return (
    <div className="public">
      <div className="public__bar">
        <div>
          <b style={{ fontSize: "1.1rem", fontStretch: "112%" }}>{b.name || "Resume"}</b>
          <div className="mono small">{b.headline || data.resume.targetRole} · updated {new Date(data.updatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</div>
        </div>
        <div className="row">
          {b.email && <a className="btn btn--sm btn--white" href={`mailto:${b.email}`}>Email {b.name.split(" ")[0] || "them"}</a>}
          <button className="btn btn--sm btn--ink" onClick={() => printResume(data.resume)}><Icon name="download" size={16} /> Download PDF</button>
        </div>
      </div>
      <div className="public__stage" ref={wrap}>
        <motion.div className="sheet" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 18 }}>
          <Paper resume={data.resume} width={width} />
        </motion.div>
        <p className="center small muted" style={{ marginTop: 22 }}>Made with <Link to="/">QuickResume</Link> · build yours free</p>
      </div>
      {createPortal(<div className="print-only"><ResumeView resume={data.resume} /></div>, document.body)}
    </div>
  );
}
