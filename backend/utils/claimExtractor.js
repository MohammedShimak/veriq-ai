/**
 * Recursively extracts all string values from an object or array.
 * @param {object|Array|string} obj 
 * @returns {string[]}
 */
function collectAllStrings(obj) {
  let strings = [];
  if (!obj) return strings;

  if (typeof obj === "string") {
    strings.push(obj);
  } else if (Array.isArray(obj)) {
    obj.forEach((item) => {
      strings = strings.concat(collectAllStrings(item));
    });
  } else if (typeof obj === "object") {
    Object.keys(obj).forEach((key) => {
      strings = strings.concat(collectAllStrings(obj[key]));
    });
  }
  return strings;
}

/**
 * Extracts claim sentences containing legal section references from an agent output object.
 * 
 * @param {object} agentOutput 
 * @returns {Array<{sentence: string, citedSections: string[]}>}
 */
export function extractClaimSentences(agentOutput) {
  if (!agentOutput || typeof agentOutput !== "object") return [];

  const rawTexts = collectAllStrings(agentOutput);
  const claimMap = new Map();

  const sectionRegex = /(Section\s+\d+(\(\d+\))?|Rule\s+\d+)/gi;

  rawTexts.forEach((text) => {
    if (!text || typeof text !== "string") return;

    // Split text into individual sentences
    const sentences = text.split(/(?<=[.!?])\s+/);

    sentences.forEach((sentence) => {
      const cleanSentence = sentence.trim();
      if (cleanSentence.length < 15) return;

      const matches = cleanSentence.match(sectionRegex);
      if (matches && matches.length > 0) {
        // Unique section references in this sentence
        const uniqueSections = Array.from(new Set(matches.map((m) => m.trim())));

        if (!claimMap.has(cleanSentence)) {
          claimMap.set(cleanSentence, {
            sentence: cleanSentence,
            citedSections: uniqueSections
          });
        }
      }
    });
  });

  return Array.from(claimMap.values());
}
