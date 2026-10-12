/**
 * Locates and extracts a ~500 character statutory snippet surrounding a cited section in the retrieved context.
 * 
 * @param {string} sectionRef e.g. "Section 2(10)"
 * @param {string} retrievedContext The raw concatenated retrieved context
 * @returns {string|null} Surrounding text snippet or null if not found
 */
export function findRetrievedTextForSection(sectionRef, retrievedContext = "") {
  if (!sectionRef || !retrievedContext || typeof retrievedContext !== "string") {
    return null;
  }

  // Sanitize sectionRef for regex search (e.g. Section 2(10) -> Section\s*2\s*\(10\))
  const cleanRef = sectionRef.trim().replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\s+/g, "\\s*");
  const regex = new RegExp(cleanRef, "i");

  const match = regex.exec(retrievedContext);
  if (!match) {
    // Try matching main section number (e.g. "Section 2" if "Section 2(10)" not explicitly tagged)
    const mainSecMatch = sectionRef.match(/Section\s+\d+/i);
    if (mainSecMatch) {
      const mainRef = mainSecMatch[0].replace(/\s+/g, "\\s*");
      const fallbackRegex = new RegExp(mainRef, "i");
      const fallbackMatch = fallbackRegex.exec(retrievedContext);
      if (fallbackMatch) {
        const matchIndex = fallbackMatch.index;
        const start = Math.max(0, matchIndex - 100);
        const end = Math.min(retrievedContext.length, matchIndex + 400);
        return retrievedContext.substring(start, end).trim();
      }
    }
    return null;
  }

  const matchIndex = match.index;
  const start = Math.max(0, matchIndex - 100);
  const end = Math.min(retrievedContext.length, matchIndex + 400);

  return retrievedContext.substring(start, end).trim();
}
