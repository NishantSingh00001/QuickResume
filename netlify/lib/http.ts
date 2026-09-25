// Response helpers shared by the API.
//
// Status codes: 401 = wrong or missing edit key, 410 = resume deleted or never existed.
// We avoid 403/404 on purpose: the Netlify dev server treats those as "static file
// missing" and retries the URL with ".html" appended.

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export const fail = (status: number, message: string) => json({ error: message }, status);

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

export function env(name: string): string | undefined {
  try {
    if (typeof Netlify !== "undefined" && Netlify?.env) return Netlify.env.get(name) || undefined;
  } catch { /* fall through */ }
  try {
    return process.env[name];
  } catch {
    return undefined;
  }
}

/** Read a JSON body, refusing anything larger than maxBytes. */
export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 200_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "That request is too large.");
  try {
    const data = JSON.parse(text || "{}");
    if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error();
    return data as T;
  } catch {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomId(len = 10): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => alphabet[b % alphabet.length]).join("");
}
