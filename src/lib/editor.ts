// Editor state: the resume being edited, undo/redo, and debounced autosave to the API.

import { useSyncExternalStore } from "react";
import { produce, type Draft } from "immer";
import { api, ApiError } from "./api";
import { getJd, getKey, setJd as storeJd } from "./keys";
import { toast } from "./toast";
import { emptyResume, type Resume } from "../../shared/types";

export type SaveState = "saved" | "dirty" | "saving" | "error";

export interface EditorState {
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  errorStatus: number;
  id: string;
  key: string | null;
  resume: Resume;
  save: SaveState;
  savedAt: string | null;
  slug: string | null;
  views: number;
  jd: string;
  aiKeywords: { term: string; required: boolean }[] | null;
  aiKeywordsFor: string;
  past: Resume[];
  future: Resume[];
  flash: { target: string; at: number } | null;
}

const initial: EditorState = {
  status: "idle", error: "", errorStatus: 0, id: "", key: null, resume: emptyResume(), save: "saved", savedAt: null, slug: null, views: 0,
  jd: "", aiKeywords: null, aiKeywordsFor: "", past: [], future: [], flash: null,
};

let state = initial;
const subs = new Set<() => void>();
function set(patch: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  subs.forEach((f) => f());
}
export const getEditor = () => state;
export function useEditor<T>(sel: (s: EditorState) => T): T {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => sel(state));
}

// ---------------------------------------------------------------- loading

export async function loadResume(id: string) {
  if (state.id === id && state.status === "ready") return;
  const key = getKey(id);
  set({ ...initial, status: "loading", id, key, jd: getJd(id) });
  if (!key) {
    set({ status: "error", errorStatus: 401, error: "This browser doesn't have the edit key for this resume. Open it with your private edit link." });
    return;
  }
  try {
    const r = await api<{ resume: Resume; updatedAt: string; slug: string | null; views: number }>(`/api/resumes/${id}`, { key });
    if (state.id !== id) return;
    set({ status: "ready", resume: r.resume, savedAt: r.updatedAt, slug: r.slug, views: r.views, save: "saved" });
  } catch (e) {
    const err = e as ApiError;
    set({ status: "error", errorStatus: err.status, error: err.message });
  }
}

// ---------------------------------------------------------------- editing

let lastPush = 0;
let lastGroup = "";

/** Change the resume. Edits in the same field within a second are merged into one undo step. */
export function edit(recipe: (d: Draft<Resume>) => void, group = "") {
  const before = state.resume;
  const after = produce(before, recipe);
  if (after === before) return;
  const t = Date.now();
  const merge = group && group === lastGroup && t - lastPush < 1000;
  lastPush = t;
  lastGroup = group;
  set((s) => ({ resume: after, past: merge ? s.past : [...s.past.slice(-60), before], future: [], save: "dirty" }));
  scheduleSave();
}

/** Replace the whole resume (imports, AI tailoring). One undo step. */
export function replaceResume(next: Resume) {
  lastGroup = "";
  set((s) => ({ resume: next, past: [...s.past.slice(-60), s.resume], future: [], save: "dirty" }));
  scheduleSave();
}

export function undo() {
  const prev = state.past[state.past.length - 1];
  if (!prev) return;
  lastGroup = "";
  set((s) => ({ resume: prev, past: s.past.slice(0, -1), future: [s.resume, ...s.future].slice(0, 60), save: "dirty" }));
  scheduleSave();
}

export function redo() {
  const next = state.future[0];
  if (!next) return;
  lastGroup = "";
  set((s) => ({ resume: next, future: s.future.slice(1), past: [...s.past, s.resume], save: "dirty" }));
  scheduleSave();
}

// ---------------------------------------------------------------- autosave

let timer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<void> | null = null;

function scheduleSave(delay = 900) {
  clearTimeout(timer);
  timer = setTimeout(saveNow, delay);
}

export async function saveNow(): Promise<void> {
  clearTimeout(timer);
  if (inflight) { await inflight; if (state.save !== "dirty") return; }
  if (state.save !== "dirty" && state.save !== "error") return;
  const { id, key, resume } = state;
  if (!id || !key) return;
  set({ save: "saving" });
  inflight = (async () => {
    try {
      const r = await api<{ updatedAt: string }>(`/api/resumes/${id}`, { method: "PUT", key, body: { resume } });
      if (state.id !== id) return;
      // Something changed while we were saving: keep it dirty and save again.
      if (state.resume !== resume) { set({ savedAt: r.updatedAt, save: "dirty" }); scheduleSave(400); }
      else set({ savedAt: r.updatedAt, save: "saved" });
    } catch (e) {
      const err = e as ApiError;
      set({ save: "error" });
      if (err.status === 401 || err.status === 410) toast(err.message, "error");
      else scheduleSave(5000);
    }
  })();
  await inflight;
  inflight = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (state.save === "dirty" || state.save === "saving") { saveNow(); e.preventDefault(); e.returnValue = ""; }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state.save === "dirty") saveNow(); });
}

// ---------------------------------------------------------------- misc

export function setJd(jd: string) {
  set({ jd });
  storeJd(state.id, jd);
}
export const setAiKeywords = (list: { term: string; required: boolean }[] | null, forJd: string) => set({ aiKeywords: list, aiKeywordsFor: forJd });
export const setPublish = (slug: string | null) => set({ slug });
export const flashTarget = (target: string) => set({ flash: { target, at: Date.now() } });
export const resetEditor = () => set(initial);
