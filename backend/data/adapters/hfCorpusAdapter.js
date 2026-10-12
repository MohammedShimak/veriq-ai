import fs from "fs";
import path from "path";
import { slugify, cleanText } from "./adapterUtils.js";

const HF_CORPUS_PATH = path.resolve("./data/hf_consumer_rag_corpus.json");
const EXPANDED_CORPUS_PATH = path.resolve("./data/expanded_consumer_rag_corpus.json");

/**
 * Adapter for HuggingFace consumer legal corpus and secondary QA records.
 * Filters out short/boilerplate entries (< 80 chars) and maps to authority_level 5.
 * 
 * @returns {Array<object>} Array of unified case law & secondary QA records
 */
export function loadHFCorpusAndSecondaryQA() {
  const sources = [HF_CORPUS_PATH, EXPANDED_CORPUS_PATH];
  const caseLawRecords = [];
  const seenIds = new Set();

  sources.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      try {
        const rawData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (Array.isArray(rawData)) {
          rawData.forEach((item, idx) => {
            const rawText = `${item.case_title || ""} ${item.facts || ""} ${item.issues || ""} ${item.judgment || ""}`.trim();
            if (rawText.length < 80) return; // Filter out short / boilerplate entries

            const caseId = item.case_id || item.id || item.case_title || `hf_item_${idx}`;
            const caseTitle = item.case_title || item.title || "Consumer Legal Case";
            const docId = `caselaw_hf_${slugify(caseId)}`;

            if (seenIds.has(docId)) return;
            seenIds.add(docId);

            const isQA = item.source_type === "secondary_qa" || item.source_type === "qa";
            const sourceType = isQA ? "secondary_qa" : "case_law";

            const compositeText = cleanText(`
Title: ${caseTitle}
Court: ${item.court || "Consumer Forum"}
Facts: ${item.facts || item.text || ""}
Issues: ${Array.isArray(item.issues) ? item.issues.join("; ") : item.issues || ""}
Provisions: ${Array.isArray(item.legal_provisions) ? item.legal_provisions.join(", ") : ""}
Judgment: ${item.judgment || ""}
            `);

            caseLawRecords.push({
              doc_id: docId,
              source_type: sourceType,
              title: caseTitle,
              text: compositeText,
              tags: Array.isArray(item.legal_provisions) ? item.legal_provisions : [caseTitle],
              jurisdiction: "India",
              authority_level: 5,
              verified: false,
              source_url: item.source_url || "",
              year: item.date ? parseInt(item.date) || null : null,
              metadata: {
                case_title: caseTitle,
                case_name: caseTitle,
                court: item.court || "Consumer Forum",
                date: item.date || "",
                legal_provisions: Array.isArray(item.legal_provisions) ? item.legal_provisions : [],
                facts: item.facts || "",
                judgment: item.judgment || "",
                source_dataset: item.source_dataset || "huggingface_consumer_rag",
                license: item.license || "CC-BY-4.0"
              }
            });
          });
        }
      } catch (err) {
        console.warn(`⚠️ Warning reading HF corpus at ${filePath}:`, err.message);
      }
    }
  });

  console.log(`📚 Loaded ${caseLawRecords.length} secondary HuggingFace case law & QA records.`);
  return caseLawRecords;
}
