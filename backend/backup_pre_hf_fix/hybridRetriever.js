import fs from "fs";
import path from "path";
import { retrieveRelevantSections } from "./retriever.js";

const JUDGMENTS_PATH = path.resolve("./data/consumer_protection_judgments.json");
const LEGISLATION_PATH = path.resolve("./data/primary_legislation_rules.json");
const HF_RAG_CORPUS_PATH = path.resolve("./data/hf_consumer_rag_corpus.json");

/**
 * Configurable Retrieval Reranking Weights for Ablation & Research Experiments.
 * 
 * final_score = (semanticScore * semanticWeight) +
 *               (keywordScore * keywordWeight) +
 *               (legalIssueScore * legalIssueWeight) +
 *               (authorityScore * authorityWeight)
 */
export const RETRIEVAL_CONFIG = {
  semanticWeight: 0.35,
  keywordWeight: 0.25,
  legalIssueWeight: 0.20,
  authorityWeight: 0.20,
  topK: 4
};

/**
 * Assigns authority level per research hierarchy:
 * Priority 1 (Level 1): Official Statute (Consumer Protection Act, 2019) -> Authority 1.0
 * Priority 2 (Level 2): Official Rules & Regulations (E-Commerce, Direct Selling, Mediation, CDRC) -> Authority 0.9
 * Priority 3 (Level 3): Supreme Court Binding Precedent -> Authority 0.85
 * Priority 4 (Level 4): NCDRC / High Court Precedent -> Authority 0.75
 * Priority 5 (Level 5): HuggingFace Consumer Case Law & Legal QA -> Authority 0.60
 */
function getAuthorityScore(type, courtLevel = "") {
  if (type === "STATUTE") return 1.0;
  if (type === "RULE") return 0.9;
  if (type === "PRECEDENT" && courtLevel === "SUPREME_COURT") return 0.85;
  if (type === "PRECEDENT") return 0.75;
  if (type === "CASE_LAW_HF") return 0.65;
  if (type === "SECONDARY_QA_HF") return 0.50;
  return 0.5;
}

/**
 * Module 2: Hybrid Multi-Source Legal Knowledge Retriever.
 * 
 * Pipeline:
 * 1. Query Construction from Structured Case Model
 * 2. Dense Embedding Vector Retrieval (ChromaDB)
 * 3. Metadata Filtering (Acts, Rules, Judgments, HF Cases)
 * 4. Multi-Signal Scoring & Reranking (Semantic + Keyword + Legal Issue + Authority)
 * 5. Metadata Normalization & Source Verification Audit
 * 
 * @param {object} caseRepresentation Structured JSON output from caseReasoningAgent
 * @param {string} rawQuestion The user's query text
 * @param {object} customConfig Optional custom RETRIEVAL_CONFIG for ablation experiments
 * @returns {Promise<object>} Normalized Hybrid Legal Knowledge Object
 */
export async function retrieveHybridLegalKnowledge(caseRepresentation, rawQuestion, customConfig = null) {
  const config = customConfig || RETRIEVAL_CONFIG;

  console.log("========================================");
  console.log("MODULE 2: HYBRID LEGAL KNOWLEDGE RETRIEVAL");
  console.log(`Weights: Semantic=${config.semanticWeight}, Keyword=${config.keywordWeight}, Issue=${config.legalIssueWeight}, Authority=${config.authorityWeight}`);
  console.log("========================================\n");

  const legalIssuesText = Array.isArray(caseRepresentation.legal_issues) ? caseRepresentation.legal_issues.join(" ") : "";
  const queryText = `${rawQuestion} ${legalIssuesText} ${caseRepresentation.product_or_service || ""}`;
  const lowerQuery = queryText.toLowerCase();

  // 1. Vector Search for Statutory Sections (CPA 2019)
  let vectorSections = [];
  try {
    vectorSections = await retrieveRelevantSections(queryText, config.topK * 2);
  } catch (err) {
    console.warn("⚠️ Vector retrieval fallback:", err.message);
  }

  // Format & Score Statutory Sections (Priority 1)
  const statutorySections = vectorSections.map(s => {
    const semanticScore = s.adjustedScore || s.score || 0.6;
    const isExactSectionMatch = (caseRepresentation.potential_sections || []).some(sec => 
      s.metadata.section && s.metadata.section.includes(sec)
    );
    const keywordScore = isExactSectionMatch ? 1.0 : 0.6;
    const issueScore = legalIssuesText.toLowerCase().includes(s.metadata.title.toLowerCase()) ? 0.9 : 0.5;
    const authorityScore = getAuthorityScore("STATUTE");

    const finalScore = (semanticScore * config.semanticWeight) +
                       (keywordScore * config.keywordWeight) +
                       (issueScore * config.legalIssueWeight) +
                       (authorityScore * config.authorityWeight);

    return {
      source_type: "STATUTE",
      title: s.metadata.title || "Statutory Provision",
      section: s.metadata.section || "Section N/A",
      act: s.metadata.act || "Consumer Protection Act, 2019",
      text: s.text,
      authority_level: 1,
      final_score: Number(finalScore.toFixed(4)),
      source_url: "https://www.indiacode.nic.in/handle/123456789/15256",
      verified: true
    };
  });

  statutorySections.sort((a, b) => b.final_score - a.final_score);

  // 2. Fetch Official Statutory Rules from primary_legislation_rules.json (Priority 2)
  let officialRules = [];
  try {
    if (fs.existsSync(LEGISLATION_PATH)) {
      const legData = JSON.parse(fs.readFileSync(LEGISLATION_PATH, "utf-8"));

      legData.forEach(doc => {
        if (doc.provisions && Array.isArray(doc.provisions)) {
          doc.provisions.forEach(prov => {
            const matchesText = lowerQuery.includes(prov.title.toLowerCase()) || 
                                lowerQuery.includes(prov.section_or_rule.toLowerCase()) ||
                                (lowerQuery.includes("e-commerce") && doc.document_name.includes("E-Commerce")) ||
                                (lowerQuery.includes("refund") && prov.text.toLowerCase().includes("refund")) ||
                                (lowerQuery.includes("defect") && prov.text.toLowerCase().includes("defect"));
            
            if (matchesText) {
              const authorityScore = getAuthorityScore("RULE");
              const finalScore = (0.75 * config.semanticWeight) +
                                 (0.85 * config.keywordWeight) +
                                 (0.80 * config.legalIssueWeight) +
                                 (authorityScore * config.authorityWeight);

              officialRules.push({
                source_type: "RULE",
                document_name: doc.document_name,
                rule: prov.section_or_rule,
                title: prov.title,
                text: prov.text,
                legal_purpose: prov.legal_purpose,
                authority_level: 2,
                final_score: Number(finalScore.toFixed(4)),
                source_url: doc.source,
                verified: doc.source_type === "OFFICIAL"
              });
            }
          });
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ Rules metadata loading warning:", err.message);
  }

  const uniqueRules = [];
  const seenRuleKeys = new Set();
  officialRules.forEach(r => {
    const key = `${r.document_name}_${r.rule}`;
    if (!seenRuleKeys.has(key)) {
      seenRuleKeys.add(key);
      uniqueRules.push(r);
    }
  });

  // 3. Fetch Official Supreme Court / NCDRC Precedents (Priority 3)
  let verifiedPrecedents = [];
  try {
    if (fs.existsSync(JUDGMENTS_PATH)) {
      const judgmentsData = JSON.parse(fs.readFileSync(JUDGMENTS_PATH, "utf-8"));

      judgmentsData.forEach(j => {
        const matchesCategory = j.case_category && j.case_category.some(cat => lowerQuery.includes(cat.toLowerCase()));
        const matchesText = lowerQuery.includes(j.facts.toLowerCase().substring(0, 30)) ||
                            (lowerQuery.includes("laptop") && j.case_category.includes("Electronics")) ||
                            (lowerQuery.includes("car") && j.case_category.includes("Automobile")) ||
                            (lowerQuery.includes("refrigerator") && j.case_category.includes("Defective Product")) ||
                            (lowerQuery.includes("coaching") && j.case_category.includes("Education Services")) ||
                            (lowerQuery.includes("ad") && j.case_category.includes("Misleading Advertisement")) ||
                            (lowerQuery.includes("bank") && j.case_category.includes("Banking")) ||
                            (lowerQuery.includes("insurance") && j.case_category.includes("Insurance"));

        if (matchesCategory || matchesText) {
          const authorityLevel = j.court_level === "SUPREME_COURT" ? 3 : 4;
          const authorityScore = getAuthorityScore("PRECEDENT", j.court_level);
          const finalScore = (0.80 * config.semanticWeight) +
                             (0.90 * config.keywordWeight) +
                             (0.85 * config.legalIssueWeight) +
                             (authorityScore * config.authorityWeight);

          verifiedPrecedents.push({
            source_type: "PRECEDENT",
            case_name: j.case_name,
            citation: j.citation,
            court: j.court,
            court_level: j.court_level,
            year: j.year,
            facts_summary: j.facts,
            consumer_supporting_principle: j.consumer_supporting_principle,
            respondent_supporting_principle: j.respondent_supporting_principle,
            decision: j.decision,
            relief: j.relief,
            authority_level: authorityLevel,
            final_score: Number(finalScore.toFixed(4)),
            source_url: j.source,
            verified: j.source_verified === true
          });
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ Precedent metadata loading warning:", err.message);
  }

  // 4. Fetch Supplementary HuggingFace Case Law & QA Records (Priority 4 / 5)
  let hfSupplementaryCases = [];
  try {
    if (fs.existsSync(HF_RAG_CORPUS_PATH)) {
      const hfCorpus = JSON.parse(fs.readFileSync(HF_RAG_CORPUS_PATH, "utf-8"));
      
      hfCorpus.forEach(item => {
        const itemText = `${item.case_title} ${item.facts} ${item.issues} ${item.legal_provisions.join(" ")}`.toLowerCase();
        const matchesQuery = lowerQuery.split(" ").some(w => w.length > 4 && itemText.includes(w));
        
        if (matchesQuery) {
          const isQA = item.source_type === "secondary_qa";
          const authorityScore = getAuthorityScore(isQA ? "SECONDARY_QA_HF" : "CASE_LAW_HF");
          const finalScore = (0.70 * config.semanticWeight) +
                             (0.75 * config.keywordWeight) +
                             (0.70 * config.legalIssueWeight) +
                             (authorityScore * config.authorityWeight);

          hfSupplementaryCases.push({
            source_type: isQA ? "SECONDARY_QA" : "SUPPLEMENTARY_CASE_LAW",
            case_id: item.case_id,
            case_title: item.case_title,
            court: item.court,
            date: item.date,
            facts_summary: item.facts,
            legal_provisions: item.legal_provisions,
            judgment: item.judgment,
            authority_level: 5,
            final_score: Number(finalScore.toFixed(4)),
            source_dataset: item.source_dataset,
            source_url: item.source_url,
            license: item.license,
            verified: false // Supplementary data requires strict verification against official law
          });
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ HF Corpus retrieval loading warning:", err.message);
  }

  hfSupplementaryCases.sort((a, b) => b.final_score - a.final_score);

  const resultObj = {
    statutory_sections: statutorySections.slice(0, config.topK),
    official_rules: uniqueRules.slice(0, 3),
    verified_precedents: verifiedPrecedents.slice(0, 3),
    supplementary_hf_cases: hfSupplementaryCases.slice(0, 2)
  };

  console.log(`📖 Hybrid Retrieval Completed: ${resultObj.statutory_sections.length} Sections, ${resultObj.official_rules.length} Rules, ${resultObj.verified_precedents.length} Precedents, ${resultObj.supplementary_hf_cases.length} HF Cases`);
  console.log("========================================\n");

  return resultObj;
}
