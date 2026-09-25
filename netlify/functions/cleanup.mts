// Daily housekeeping: removes expired rate-limit counters and resumes that
// were never published and haven't been opened in 180 days.

import type { Config } from "@netlify/functions";
import { store, type Stored } from "../lib/store.ts";

export default async () => {
  const s = store();
  const nowSec = Date.now() / 1000;
  let limits = 0, resumes = 0;

  const { blobs: limitBlobs } = await s.list({ prefix: "limit/" });
  for (const b of limitBlobs) {
    const start = Number(b.key.split("/").pop());
    if (Number.isFinite(start) && start < nowSec - 2 * 86400) { await s.delete(b.key); limits++; }
  }

  const cutoff = Date.now() - 180 * 86400 * 1000;
  const { blobs: docs } = await s.list({ prefix: "r/" });
  for (const b of docs) {
    const doc = (await s.get(b.key, { type: "json" })) as Stored | null;
    if (doc && !doc.slug && Date.parse(doc.updatedAt) < cutoff) { await s.delete(b.key); resumes++; }
  }
  console.log(`cleanup: removed ${limits} rate-limit counters and ${resumes} stale resumes`);
};

export const config: Config = { schedule: "@daily" };
