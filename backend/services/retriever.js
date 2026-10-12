import { generateEmbedding } from "./embedding.js";
import { queryFaissIndex } from "./faissService.js";

/**
 * Historical term patterns that indicate older 1986 Act references in PDF appendices.
 */
const HISTORICAL_PATTERNS = [
  /district forum/i,
  /consumer protection act,?\s*1986/i,
  /act 62 of 2002/i,
  /act 50 of 1993/i
];

/**
 * Checks whether a retrieved legal chunk contains historical/older framework terminology.
 * @param {string} text 
 * @param {object} metadata 
 * @returns {boolean}
 */
export function isHistoricalChunk(text = "", metadata = {}) {
  const textMatches = HISTORICAL_PATTERNS.some((pattern) => pattern.test(text));
  const isAppendixPage = metadata.page && Number(metadata.page) > 57;
  return textMatches || (isAppendixPage && /forum/i.test(text));
}

/**
 * Normalizes Section metadata to extract specific sub-sections (e.g. Section 2(10), 2(11), 2(47))
 * instead of returning plain 'Section 2' repetitively.
 * 
 * @param {string} text 
 * @param {string} rawSection 
 * @returns {string} Precise Section Identifier
 */
export function normalizeSectionIdentifier(text = "", rawSection = "Section N/A") {
  if (!text || typeof text !== "string") return rawSection;

  // Extract explicit section numbers if present in chunk heading/body
  const specificMatch = text.match(/Section\s+\d+\s*\(\d+\)/i);
  if (specificMatch) {
    return specificMatch[0];
  }

  // Sub-section matching for Section 2 (Definitions)
  if (rawSection.trim() === "Section 2" || /definitions/i.test(text)) {
    if (/\(10\)/.test(text) || /defect/i.test(text)) return "Section 2(10)";
    if (/\(11\)/.test(text) || /deficiency/i.test(text)) return "Section 2(11)";
    if (/\(28\)/.test(text) || /misleading advertisement/i.test(text)) return "Section 2(28)";
    if (/\(47\)/.test(text) || /unfair trade practice/i.test(text)) return "Section 2(47)";
    if (/\(7\)/.test(text) || /consumer/i.test(text)) return "Section 2(7)";
    if (/\(46\)/.test(text) || /unfair contract/i.test(text)) return "Section 2(46)";
  }

  return rawSection;
}

/**
 * Retrieves the topK most relevant legal sections for a user query using embedded FAISS vector store.
 * 
 * @param {string} query User question / claim
 * @param {number} topK Number of relevant legal chunks to retrieve (default: 3)
 * @returns {Promise<Array<{text: string, metadata: object, score: number, isHistorical: boolean}>>}
 */
export async function retrieveRelevantSections(query, topK = 3) {
  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("Query must be a valid non-empty string.");
  }

  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Fetch candidate pool from local FAISS vector store
  const candidateLimit = Math.max(topK * 4, 12);
  const faissResults = await queryFaissIndex(queryEmbedding, candidateLimit);

  if (!faissResults || faissResults.length === 0) {
    console.log("========================================");
    console.log("LEXAGENT RETRIEVAL (FAISS)");
    console.log("==================");
    console.log(`Query:\n${query}\n`);
    console.log("Retrieved chunks: None");
    console.log("Relevant provision not found in indexed legal sources.");
    console.log("========================================\n");
    return [];
  }

  // 3. Process candidates with metadata normalization and historical detection
  const candidates = faissResults.map((item) => {
    const baseScore = item.score || 0.6;
    const rawMeta = item.metadata || {};
    const rawSec = rawMeta.section_or_rule || rawMeta.section || "Section N/A";
    const preciseSection = normalizeSectionIdentifier(item.text, rawSec);

    const metadata = {
      act: rawMeta.act_or_document_name || rawMeta.act || "Consumer Protection Act, 2019",
      section: preciseSection,
      raw_section: rawSec,
      title: rawMeta.title || "Legal Provision",
      page: rawMeta.page !== undefined ? Number(rawMeta.page) : 1,
      source: rawMeta.source_url || rawMeta.source || "Consumer_Protection_Act_2019.pdf",
      documentVersion: "2019"
    };

    const isHistorical = isHistoricalChunk(item.text, metadata);
    const adjustedScore = isHistorical ? baseScore * 0.82 : baseScore;

    return {
      text: item.text,
      metadata,
      score: baseScore,
      adjustedScore,
      isHistorical
    };
  });

  // 4. Sort candidates by adjusted score descending
  candidates.sort((a, b) => b.adjustedScore - a.adjustedScore);

  // 5. Select topK results
  const selectedResults = candidates.slice(0, topK);

  // 6. Print debug output
  console.log("========================================");
  console.log("LEXAGENT FAISS RETRIEVAL");
  console.log("==================");
  console.log(`\nQuery:\n${query}\n`);
  console.log("Retrieved chunks:\n");

  selectedResults.forEach((item, i) => {
    console.log(`[${i + 1}]`);
    console.log(`Section: ${item.metadata.section}`);
    console.log(`Title: ${item.metadata.title}`);
    console.log(`Source: ${item.metadata.source}`);
    console.log(`Score: ${item.score}`);
    if (item.isHistorical) {
      console.log("WARNING: POSSIBLE HISTORICAL PROVISION");
    }
    console.log("");
  });

  console.log("========================================\n");

  return selectedResults;
}
