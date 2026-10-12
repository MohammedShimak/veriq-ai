/**
 * Converts a string into a clean, deterministic slug for doc_id generation.
 * @param {string} str 
 * @returns {string}
 */
export function slugify(str = "") {
  if (!str || typeof str !== "string") return "unknown";
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "_")
    .replace(/^-+|-+$/g, "");
}

/**
 * Cleans and normalizes text string by collapsing excessive whitespace.
 * @param {string} str 
 * @returns {string}
 */
export function cleanText(str = "") {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
