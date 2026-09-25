import { createContext, useContext } from "react";
import type { AtsReport } from "../../shared/ats";

export interface AtsCtx { report: AtsReport; missing: string[] }
export const AtsContext = createContext<AtsCtx | null>(null);
export const useAts = () => useContext(AtsContext);

/** Scroll to and highlight an element in the editor (used by ATS tips). */
export function focusTarget(target: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(`el-${target}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
    const input = el.querySelector("textarea, input") as HTMLElement | null;
    setTimeout(() => input?.focus({ preventScroll: true }), 350);
  });
}
