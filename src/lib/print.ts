// "Download PDF" uses the browser's print-to-PDF: real, selectable text that ATS parsers can read.
import type { Resume } from "../../shared/types";

export function printResume(resume: Resume) {
  const style = document.createElement("style");
  const size = resume.settings.paper === "letter" ? "letter" : "A4";
  const margin = resume.settings.paper === "letter" ? "0.5in 0.6in" : "12mm 14mm";
  style.textContent = `@page { size: ${size}; margin: ${margin}; }`;
  document.head.appendChild(style);
  const title = document.title;
  const name = (resume.basics.name || "Resume").trim().replace(/\s+/g, "_").replace(/[^\w-]/g, "");
  document.title = `${name}_Resume`;
  const restore = () => { document.title = title; style.remove(); window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
  setTimeout(restore, 60_000);
}
