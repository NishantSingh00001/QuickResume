import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ResumeView } from "./ResumeView";
import type { Resume } from "../../shared/types";

const MM = 96 / 25.4;
export const PAGE = {
  a4: { w: 210 * MM, h: 297 * MM, my: 12 * MM },
  letter: { w: 8.5 * 96, h: 11 * 96, my: 0.5 * 96 },
};

/** Measures how many printed pages the resume will take. */
export function usePages(ref: RefObject<HTMLElement>, resume: Resume): number {
  const [pages, setPages] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const p = PAGE[resume.settings.paper];
      let bottom = 0;
      for (const c of Array.from(el.children) as HTMLElement[]) bottom = Math.max(bottom, c.offsetTop + c.offsetHeight);
      const content = bottom - p.my;
      setPages(Math.max(1, Math.ceil((content - 2) / (p.h - 2 * p.my))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [ref, resume]);
  return pages;
}

interface Props {
  resume: Resume;
  width: number; // on-screen width in px
  placeholders?: boolean;
  breaks?: boolean;
  onPages?: (n: number) => void;
  className?: string;
}

/** A resume page scaled to a given width (thumbnails, previews). */
export function Paper({ resume, width, placeholders, breaks, onPages, className = "" }: Props) {
  const ref = useRef<HTMLElement>(null);
  const p = PAGE[resume.settings.paper];
  const scale = width / p.w;
  const [h, setH] = useState(p.h);
  const pages = usePages(ref, resume);
  useLayoutEffect(() => { onPages?.(pages); }, [pages, onPages]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    setH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  const lines = breaks ? Array.from({ length: pages - 1 }, (_, i) => p.my + (i + 1) * (p.h - 2 * p.my)) : [];
  return (
    <div className={`paper-view ${className}`} style={{ width, height: h * scale, position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: p.w, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <ResumeView ref={ref} resume={resume} placeholders={placeholders} />
        {lines.map((y, i) => (
          <div key={i} className="page-break" style={{ top: y }}>
            <span>Page {i + 2}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
