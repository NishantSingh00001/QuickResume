import { useSyncExternalStore } from "react";

export interface Toast { id: number; text: string; kind: "info" | "error" }
let toasts: Toast[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let n = 0;

export function toast(text: string, kind: Toast["kind"] = "info") {
  const id = ++n;
  toasts = [...toasts, { id, text, kind }].slice(-3);
  emit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, kind === "error" ? 5000 : 2600);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => toasts);
}
