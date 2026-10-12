/**
 * Live Indian Law Search via the Indian Kanoon API (https://api.indiankanoon.org).
 *
 * Optional: enabled only when INDIAN_KANOON_API_TOKEN is set in .env.
 * Without the token every function returns [] and LexAgent runs on the local FAISS index only.
 * Every Indian Kanoon call is billed, so document fetches are cached in memory.
 */

const API_BASE = "https://api.indiankanoon.org";
const REQUEST_TIMEOUT_MS = 15000;

const LIVE_MAX_QUERIES = 3;

// Read lazily: server.js calls dotenv.config() after ESM imports are evaluated.
const envNumber = (name, fallback) => Number(process.env[name]) || fallback;
const docsPerQuery = () => envNumber("LIVE_DOCS_PER_QUERY", 2);
const maxSections = () => envNumber("LIVE_MAX_SECTIONS", 4);
const maxContentChars = () => envNumber("LIVE_MAX_CONTENT_CHARS", 2500);

const docCache = new Map();

function getToken() {
  return (process.env.INDIAN_KANOON_API_TOKEN || "").trim();
}

export function isLiveEnabled() {
  return Boolean(getToken());
}

async function kanoonPost(pathAndQuery) {
  const res = await fetch(`${API_BASE}${pathAndQuery}`, {
    method: "POST",
    headers: { Authorization: `Token ${getToken()}`, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!res.ok) {
    throw new Error(`Indian Kanoon ${pathAndQuery.split("?")[0]} returned HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Strips Indian Kanoon HTML into clean plain text.
 */
export function htmlToText(html = "") {
  return String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|pre|h\d|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Parses titles like "Section 2(7) in The Consumer Protection Act, 2019".
 */
export function parseLawTitle(title = "") {
  const clean = htmlToText(title);
  const match = clean.match(/^\s*(Section|Article|Rule|Order|Regulation)\s+([\w().\-]+)\s+in\s+(?:The\s+)?(.+)$/i);
  if (match) {
    return { section: `${match[1]} ${match[2]}`, act: match[3].trim() };
  }
  return { section: "", act: clean };
}

async function fetchDocText(tid) {
  if (docCache.has(tid)) return docCache.get(tid);
  const promise = kanoonPost(`/doc/${tid}/`).then((doc) => {
    let text = htmlToText(doc.doc || "");
    if (text.length > maxContentChars()) {
      text = `${text.slice(0, maxContentChars())}…`;
    }
    return text;
  });
  docCache.set(tid, promise);
  promise.catch(() => docCache.delete(tid));
  return promise;
}

async function searchOneQuery(query) {
  const formInput = `${query} doctypes: laws`;
  const result = await kanoonPost(`/search/?formInput=${encodeURIComponent(formInput)}&pagenum=0`);
  const docs = (result.docs || []).slice(0, docsPerQuery());

  return Promise.all(
    docs.map(async (d, rank) => {
      const { section, act } = parseLawTitle(d.title);
      const text = await fetchDocText(d.tid);
      return {
        source_type: "STATUTE",
        source: "live",
        id: `ik_${d.tid}`,
        title: htmlToText(d.title),
        section: section || "Full Text",
        act,
        docsource: d.docsource || "",
        text: text || htmlToText(d.headline || ""),
        authority_level: 1,
        final_score: Number(Math.max(0, 0.95 - rank * 0.1).toFixed(4)),
        source_url: `https://indiankanoon.org/doc/${d.tid}/`,
        verified: true
      };
    })
  );
}

/**
 * Runs live Indian Kanoon searches for each query in parallel.
 * Dedupes by document id (keeping the best score) and caps at LIVE_MAX_SECTIONS (default 4).
 *
 * @param {string[]} queries Search queries (raw question, legal issues, ...)
 * @returns {Promise<object[]>} Sections in the same shape as hybridRetriever statutory_sections
 */
export async function searchLiveLaws(queries = []) {
  if (!isLiveEnabled()) return [];

  const cleanQueries = [...new Set(queries.map((q) => String(q || "").trim()).filter(Boolean))].slice(0, LIVE_MAX_QUERIES);
  if (cleanQueries.length === 0) return [];

  const settled = await Promise.allSettled(cleanQueries.map(searchOneQuery));
  const byId = new Map();
  settled.forEach((r) => {
    if (r.status === "rejected") {
      console.warn("⚠️ Indian Kanoon live search failed:", r.reason?.message || r.reason);
      return;
    }
    r.value.forEach((sec) => {
      const existing = byId.get(sec.id);
      if (!existing || sec.final_score > existing.final_score) byId.set(sec.id, sec);
    });
  });

  return [...byId.values()]
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, maxSections());
}
