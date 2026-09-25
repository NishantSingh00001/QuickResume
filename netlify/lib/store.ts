// Netlify Blobs storage: resumes, public links, view counts and rate limits.
//
// Keys
//   r/<id>          { id, keyHash, resume, createdAt, updatedAt, slug?, views }
//   slug/<slug>     { id }  claimed with onlyIfNew, so two resumes can't share a link
//   limit/<k>/<t>   request count for the rate-limit window starting at epoch second t

import { getStore } from "@netlify/blobs";
import { HttpError, sha256 } from "./http.ts";
import type { Resume } from "../../shared/types.ts";

export interface Stored {
  id: string;
  keyHash: string;
  resume: Resume;
  createdAt: string;
  updatedAt: string;
  slug: string | null;
  views: number;
  lastViewAt?: string;
}

export const store = () => getStore({ name: "quickresume", consistency: "strong" });

export async function getJSON<T>(key: string): Promise<T | null> {
  return (await store().get(key, { type: "json" })) as T | null;
}

/** Read-modify-write with an ETag check, retried on conflicts. Return undefined to skip writing. */
export async function update<T>(key: string, fn: (current: T | null) => T | undefined, tries = 6): Promise<T | null> {
  const s = store();
  for (let i = 0; i < tries; i++) {
    const cur = await s.getWithMetadata(key, { type: "json" });
    const next = fn(cur ? (cur.data as T) : null);
    if (next === undefined) return cur ? (cur.data as T) : null;
    const res = cur?.etag
      ? await s.setJSON(key, next, { onlyIfMatch: cur.etag })
      : cur
        ? await s.setJSON(key, next) // local sandbox: no ETags, last write wins
        : await s.setJSON(key, next, { onlyIfNew: true });
    if (res.modified) return next;
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 60));
  }
  throw new HttpError(503, "Busy right now. Please try again.");
}

export async function loadOwned(id: string, key: string | null): Promise<Stored> {
  if (!/^[a-z0-9]{10}$/.test(id)) throw new HttpError(400, "That resume link isn't valid.");
  const doc = await getJSON<Stored>(`r/${id}`);
  if (!doc) throw new HttpError(410, "This resume was deleted or never existed.");
  if (!key || (await sha256(key)) !== doc.keyHash) throw new HttpError(401, "This browser doesn't have the edit key for that resume.");
  return doc;
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<void> {
  const start = Math.floor(Date.now() / 1000 / windowSec) * windowSec; // window start (epoch seconds), used by the cleanup job
  const k = `limit/${key.replace(/[^a-zA-Z0-9:_-]/g, "")}/${start}`;
  let over = false;
  await update<number>(k, (n) => {
    const v = n || 0;
    if (v >= limit) { over = true; return undefined; }
    return v + 1;
  });
  if (over) throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
}

export async function ipHash(ip: string | undefined): Promise<string> {
  return (await sha256(`qr:${ip || "unknown"}`)).slice(0, 16);
}

/** Count something at most once per window, without throwing (used for view counts). */
export async function firstInWindow(key: string, windowSec: number): Promise<boolean> {
  const start = Math.floor(Date.now() / 1000 / windowSec) * windowSec;
  const res = await store().setJSON(`limit/${key.replace(/[^a-zA-Z0-9:_-]/g, "")}/${start}`, 1, { onlyIfNew: true });
  return res.modified;
}
