// Edit keys live only in this browser. Whoever has the key can edit the resume.

const KEY = "qr.keys";

type Keys = Record<string, { key: string; at: number }>;

function read(): Keys {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}
function write(k: Keys) {
  try { localStorage.setItem(KEY, JSON.stringify(k)); } catch { /* storage full or blocked */ }
}

export function saveKey(id: string, key: string) {
  const k = read();
  k[id] = { key, at: Date.now() };
  write(k);
}
export const getKey = (id: string): string | null => read()[id]?.key || null;
export function forgetKey(id: string) {
  const k = read();
  delete k[id];
  write(k);
}
export const allKeys = () => Object.entries(read()).sort((a, b) => b[1].at - a[1].at).map(([id, v]) => ({ id, key: v.key }));

// Job descriptions are kept per resume in this browser only.
export const getJd = (id: string) => { try { return localStorage.getItem(`qr.jd.${id}`) || ""; } catch { return ""; } };
export const setJd = (id: string, jd: string) => { try { jd ? localStorage.setItem(`qr.jd.${id}`, jd) : localStorage.removeItem(`qr.jd.${id}`); } catch { /* ignore */ } };
