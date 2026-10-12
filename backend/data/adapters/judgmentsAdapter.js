import fs from "fs";
import path from "path";
import { slugify, cleanText } from "./adapterUtils.js";

const JUDGMENTS_PATH = path.resolve("./data/consumer_protection_judgments.json");

/**
 * Adapter for verified Supreme Court and NCDRC judgments/precedents.
 * Maps SC judgments to authority_level 3, NCDRC/High Court to authority_level 4.
 * Constructs rich embedding text and preserves full domain metadata.
 * 
 * @returns {Array<object>} Array of unified precedent records
 */
export function loadJudgmentsAndPrecedents() {
  if (!fs.existsSync(JUDGMENTS_PATH)) {
    throw new Error(`Judgments file not found at: ${JUDGMENTS_PATH}`);
  }

  const rawData = JSON.parse(fs.readFileSync(JUDGMENTS_PATH, "utf-8"));
  const precedents = [];

  rawData.forEach((record) => {
    const courtLevel = record.court_level || "NATIONAL_COMMISSION";
    const authorityLevel = courtLevel === "SUPREME_COURT" ? 3 : 4;
    const caseName = record.case_name || "Unknown Precedent";
    const citation = record.citation || "Citation N/A";
    const year = record.year || null;
    const docId = `prec_${slugify(caseName)}_${year || "year"}`;

    const legalIssuesText = Array.isArray(record.legal_issues) ? record.legal_issues.join("; ") : "";
    const categories = Array.isArray(record.case_category) ? record.case_category : [];
    const relevantSecs = Array.isArray(record.relevant_sections)
      ? record.relevant_sections.map((s) => s.section)
      : [];

    // Construct rich embedding text
    const compositeText = cleanText(`
${caseName} (${citation})
Court: ${record.court || "Court"}
Facts: ${record.facts || ""}
Legal Issues: ${legalIssuesText}
Consumer Supporting Principle: ${record.consumer_supporting_principle || ""}
Respondent Supporting Principle: ${record.respondent_supporting_principle || ""}
Court Reasoning: ${record.court_reasoning || ""}
Decision: ${record.decision || ""}
Relief: ${record.relief || ""}
    `);

    precedents.push({
      doc_id: docId,
      source_type: "precedent",
      title: `${caseName} (${citation})`,
      text: compositeText,
      tags: [...categories, ...relevantSecs, caseName, citation, courtLevel],
      jurisdiction: "India",
      authority_level: authorityLevel,
      verified: record.source_verified === true,
      source_url: record.source || "",
      year: year,
      metadata: {
        case_name: caseName,
        case_number: record.case_number || "",
        citation: citation,
        court: record.court || "",
        court_level: courtLevel,
        bench: record.bench || "",
        case_category: categories,
        parties: record.parties || {},
        facts: record.facts || "",
        legal_issues: Array.isArray(record.legal_issues) ? record.legal_issues : [],
        relevant_sections: relevantSecs,
        consumer_arguments: record.consumer_arguments || "",
        opposite_party_arguments: record.opposite_party_arguments || "",
        court_reasoning: record.court_reasoning || "",
        consumer_supporting_principle: record.consumer_supporting_principle || "",
        respondent_supporting_principle: record.respondent_supporting_principle || "",
        decision: record.decision || "",
        relief: record.relief || "",
        judgment_outcome: record.judgment_outcome || {}
      }
    });
  });

  console.log(`⚖️ Loaded ${precedents.length} precedent records.`);
  return precedents;
}
