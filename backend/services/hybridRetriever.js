import fs from "fs";
import path from "path";
import { retrieveRelevantSections } from "./retriever.js";
import { searchLiveLaws, isLiveEnabled } from "./indianKanoon.js";

const NORMALIZED_DIR = path.resolve("./data/normalized");
const STATUTES_PATH = path.join(NORMALIZED_DIR, "statutes.json");
const RULES_PATH = path.join(NORMALIZED_DIR, "rules.json");
const PRECEDENTS_PATH = path.join(NORMALIZED_DIR, "precedents.json");
const CASE_LAW_PATH = path.join(NORMALIZED_DIR, "case_law.json");

// Fallback paths if normalized directory has not been generated yet
const LEGACY_JUDGMENTS_PATH = path.resolve("./data/consumer_protection_judgments.json");
const LEGACY_LEGISLATION_PATH = path.resolve("./data/primary_legislation_rules.json");
const LEGACY_HF_CORPUS_PATH = path.resolve("./data/hf_consumer_rag_corpus.json");

/**
 * Configurable Retrieval Reranking Weights for Ablation & Research Experiments.
 */
export const RETRIEVAL_CONFIG = {
  semanticWeight: 0.35,
  keywordWeight: 0.25,
  legalIssueWeight: 0.20,
  authorityWeight: 0.20,
  topK: 4
};

function getAuthorityScore(type, courtLevel = "") {
  if (type === "statute" || type === "STATUTE") return 1.0;
  if (type === "rule" || type === "RULE") return 0.9;
  if ((type === "precedent" || type === "PRECEDENT") && courtLevel === "SUPREME_COURT") return 0.85;
  if (type === "precedent" || type === "PRECEDENT") return 0.75;
  if (type === "case_law" || type === "CASE_LAW_HF") return 0.65;
  if (type === "secondary_qa" || type === "SECONDARY_QA_HF") return 0.50;
  return 0.5;
}

/**
 * Module 2: Hybrid Multi-Source Legal Knowledge Retriever.
 * Consumes schema-validated normalized datasets from backend/data/normalized/
 * and local FAISS vector store.
 * 
 * @param {object} caseRepresentation Structured JSON output from caseReasoningAgent
 * @param {string} rawQuestion The user's query text
 * @param {object} customConfig Optional custom RETRIEVAL_CONFIG for ablation experiments
 * @returns {Promise<object>} Normalized Hybrid Legal Knowledge Object
 */
export async function retrieveHybridLegalKnowledge(caseRepresentation, rawQuestion, customConfig = null) {
  const config = customConfig || RETRIEVAL_CONFIG;

  console.log("========================================");
  console.log("MODULE 2: HYBRID LEGAL KNOWLEDGE RETRIEVAL (NORMALIZED & FAISS)");
  console.log(`Weights: Semantic=${config.semanticWeight}, Keyword=${config.keywordWeight}, Issue=${config.legalIssueWeight}, Authority=${config.authorityWeight}`);
  console.log("========================================\n");

  const legalIssuesText = Array.isArray(caseRepresentation.legal_issues) ? caseRepresentation.legal_issues.join(" ") : "";
  const queryText = `${rawQuestion} ${legalIssuesText} ${caseRepresentation.product_or_service || ""}`;
  const lowerQuery = queryText.toLowerCase();

  // 1. FAISS Vector Search (CPA 2019) + Live Indian Kanoon search (all Indian laws), in parallel
  const liveQueries = [
    rawQuestion,
    ...(Array.isArray(caseRepresentation.legal_issues) ? caseRepresentation.legal_issues.slice(0, 2) : [])
  ];
  const [vectorResult, liveResult] = await Promise.allSettled([
    retrieveRelevantSections(queryText, config.topK * 2),
    customConfig?.disableLive ? Promise.resolve([]) : searchLiveLaws(liveQueries)
  ]);

  let vectorSections = [];
  if (vectorResult.status === "fulfilled") {
    vectorSections = vectorResult.value;
  } else {
    console.warn("⚠️ FAISS vector retrieval fallback:", vectorResult.reason?.message);
  }

  let liveSections = [];
  if (liveResult.status === "fulfilled") {
    liveSections = liveResult.value;
  } else {
    console.warn("⚠️ Indian Kanoon live search fallback:", liveResult.reason?.message);
  }

  // Format & Score Statutory Sections (Priority 1)
  const statutorySections = vectorSections.map((s) => {
    const semanticScore = s.adjustedScore || s.score || 0.6;
    const isExactSectionMatch = (caseRepresentation.potential_sections || []).some((sec) =>
      s.metadata.section && s.metadata.section.toLowerCase().includes(String(sec).toLowerCase())
    );
    const keywordScore = isExactSectionMatch ? 1.0 : 0.6;
    const issueScore = legalIssuesText.toLowerCase().includes((s.metadata.title || "").toLowerCase()) ? 0.9 : 0.5;
    const authorityScore = getAuthorityScore("STATUTE");

    const finalScore =
      semanticScore * config.semanticWeight +
      keywordScore * config.keywordWeight +
      issueScore * config.legalIssueWeight +
      authorityScore * config.authorityWeight;

    return {
      source_type: "STATUTE",
      source: "local",
      title: s.metadata.title || "Statutory Provision",
      section: s.metadata.section || "Section N/A",
      act: s.metadata.act || "Consumer Protection Act, 2019",
      text: s.text,
      authority_level: 1,
      final_score: Number(finalScore.toFixed(4)),
      source_url: s.metadata.source || "https://www.indiacode.nic.in/handle/123456789/15256",
      verified: true
    };
  });

  statutorySections.sort((a, b) => b.final_score - a.final_score);

  // Merge top local sections with live Indian Kanoon sections, deduped by section + act
  const mergedSections = [];
  const seenSectionKeys = new Set();
  [...statutorySections.slice(0, config.topK), ...liveSections].forEach((s) => {
    const key = `${s.section}|${s.act}`.toLowerCase();
    if (!seenSectionKeys.has(key)) {
      seenSectionKeys.add(key);
      mergedSections.push(s);
    }
  });
  mergedSections.sort((a, b) => b.final_score - a.final_score);

  // 2. Fetch Official Statutory Rules from normalized rules.json (Priority 2)
  let officialRules = [];
  try {
    const rulesFile = fs.existsSync(RULES_PATH) ? RULES_PATH : LEGACY_LEGISLATION_PATH;
    if (fs.existsSync(rulesFile)) {
      const rawRules = JSON.parse(fs.readFileSync(rulesFile, "utf-8"));

      if (rulesFile === RULES_PATH) {
        // Normalized rules format
        rawRules.forEach((ruleRec) => {
          const textMatches =
            lowerQuery.includes(ruleRec.title.toLowerCase()) ||
            lowerQuery.includes(ruleRec.metadata.section_or_rule.toLowerCase()) ||
            (lowerQuery.includes("e-commerce") && ruleRec.metadata.act_or_document_name.includes("E-Commerce")) ||
            (lowerQuery.includes("refund") && ruleRec.text.toLowerCase().includes("refund")) ||
            (lowerQuery.includes("defect") && ruleRec.text.toLowerCase().includes("defect"));

          if (textMatches) {
            const authorityScore = getAuthorityScore("RULE");
            const finalScore =
              0.75 * config.semanticWeight +
              0.85 * config.keywordWeight +
              0.80 * config.legalIssueWeight +
              authorityScore * config.authorityWeight;

            officialRules.push({
              source_type: "RULE",
              document_name: ruleRec.metadata.act_or_document_name,
              rule: ruleRec.metadata.section_or_rule,
              title: ruleRec.title,
              text: ruleRec.text,
              legal_purpose: ruleRec.metadata.legal_purpose,
              authority_level: 2,
              final_score: Number(finalScore.toFixed(4)),
              source_url: ruleRec.source_url,
              verified: ruleRec.verified
            });
          }
        });
      } else {
        // Legacy rules format fallback
        rawRules.forEach((doc) => {
          if (doc.provisions && Array.isArray(doc.provisions)) {
            doc.provisions.forEach((prov) => {
              const textMatches =
                lowerQuery.includes(prov.title.toLowerCase()) ||
                lowerQuery.includes(prov.section_or_rule.toLowerCase()) ||
                (lowerQuery.includes("e-commerce") && doc.document_name.includes("E-Commerce")) ||
                (lowerQuery.includes("refund") && prov.text.toLowerCase().includes("refund"));

              if (textMatches) {
                officialRules.push({
                  source_type: "RULE",
                  document_name: doc.document_name,
                  rule: prov.section_or_rule,
                  title: prov.title,
                  text: prov.text,
                  legal_purpose: prov.legal_purpose,
                  authority_level: 2,
                  final_score: 0.82,
                  source_url: doc.source,
                  verified: true
                });
              }
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn("⚠️ Rules metadata loading warning:", err.message);
  }

  const uniqueRules = [];
  const seenRuleKeys = new Set();
  officialRules.forEach((r) => {
    const key = `${r.document_name}_${r.rule}`;
    if (!seenRuleKeys.has(key)) {
      seenRuleKeys.add(key);
      uniqueRules.push(r);
    }
  });

  // 3. Fetch Official Supreme Court / NCDRC Precedents from normalized precedents.json (Priority 3)
  let verifiedPrecedents = [];
  try {
    const precFile = fs.existsSync(PRECEDENTS_PATH) ? PRECEDENTS_PATH : LEGACY_JUDGMENTS_PATH;
    if (fs.existsSync(precFile)) {
      const rawJudgments = JSON.parse(fs.readFileSync(precFile, "utf-8"));

      rawJudgments.forEach((j) => {
        const meta = j.metadata || j;
        const caseName = meta.case_name || j.case_name || "";
        const citation = meta.citation || j.citation || "";
        const court = meta.court || j.court || "";
        const courtLevel = meta.court_level || j.court_level || "NATIONAL_COMMISSION";
        const categories = meta.case_category || j.case_category || [];
        const facts = meta.facts || j.facts || "";

        if (j.verified === false || (j.source_verified === false && !j.verified)) return;

        const matchesCategory = categories.some((cat) => lowerQuery.includes(cat.toLowerCase()));
        const matchesText =
          lowerQuery.includes(facts.toLowerCase().substring(0, 30)) ||
          (lowerQuery.includes("laptop") && categories.includes("Electronics")) ||
          (lowerQuery.includes("car") && categories.includes("Automobile")) ||
          (lowerQuery.includes("washing") && categories.includes("Defective Product")) ||
          (lowerQuery.includes("coaching") && categories.includes("Education Services")) ||
          (lowerQuery.includes("ad") && categories.includes("Misleading Advertisement")) ||
          (lowerQuery.includes("bank") && categories.includes("Banking")) ||
          (lowerQuery.includes("insurance") && categories.includes("Insurance"));

        if (matchesCategory || matchesText) {
          const authorityLevel = courtLevel === "SUPREME_COURT" ? 3 : 4;
          const authorityScore = getAuthorityScore("PRECEDENT", courtLevel);
          const finalScore =
            0.80 * config.semanticWeight +
            0.90 * config.keywordWeight +
            0.85 * config.legalIssueWeight +
            authorityScore * config.authorityWeight;

          verifiedPrecedents.push({
            source_type: "PRECEDENT",
            case_name: caseName,
            citation: citation,
            court: court,
            court_level: courtLevel,
            year: meta.year || j.year,
            facts_summary: facts,
            consumer_supporting_principle: meta.consumer_supporting_principle || j.consumer_supporting_principle,
            respondent_supporting_principle: meta.respondent_supporting_principle || j.respondent_supporting_principle,
            decision: meta.decision || j.decision,
            relief: meta.relief || j.relief,
            authority_level: authorityLevel,
            final_score: Number(finalScore.toFixed(4)),
            source_url: j.source_url || j.source || "",
            verified: j.verified === true || j.source_verified === true
          });
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ Precedent metadata loading warning:", err.message);
  }

  // 4. Fetch Supplementary Case Law & QA Records (Priority 4 / 5)
  let hfSupplementaryCases = [];
  try {
    const caseLawFile = fs.existsSync(CASE_LAW_PATH) ? CASE_LAW_PATH : LEGACY_HF_CORPUS_PATH;
    if (fs.existsSync(caseLawFile)) {
      const rawCaseLaw = JSON.parse(fs.readFileSync(caseLawFile, "utf-8"));

      rawCaseLaw.forEach((item) => {
        const itemText = (item.text || `${item.case_title} ${item.facts}`).toLowerCase();
        const matchesQuery = lowerQuery.split(" ").some((w) => w.length > 4 && itemText.includes(w));

        if (matchesQuery) {
          const isQA = item.source_type === "secondary_qa";
          const authorityScore = getAuthorityScore(isQA ? "SECONDARY_QA_HF" : "CASE_LAW_HF");
          const finalScore =
            0.70 * config.semanticWeight +
            0.75 * config.keywordWeight +
            0.70 * config.legalIssueWeight +
            authorityScore * config.authorityWeight;

          hfSupplementaryCases.push({
            source_type: isQA ? "SECONDARY_QA" : "SUPPLEMENTARY_CASE_LAW",
            case_id: item.doc_id || item.case_id,
            case_title: item.title || item.metadata?.case_title || item.case_title,
            court: (item.metadata && item.metadata.court) || item.court || "Consumer Forum",
            date: item.year || item.metadata?.date || item.date || "",
            facts_summary: (item.metadata && item.metadata.facts) || item.facts || "",
            legal_provisions: (item.metadata && item.metadata.legal_provisions) || item.legal_provisions || [],
            judgment: (item.metadata && item.metadata.judgment) || item.judgment || "",
            authority_level: 5,
            final_score: Number(finalScore.toFixed(4)),
            source_dataset: (item.metadata && item.metadata.source_dataset) || "huggingface_consumer_rag",
            source_url: item.source_url || "",
            verified: item.verified === true
          });
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ HF Corpus retrieval loading warning:", err.message);
  }

  hfSupplementaryCases.sort((a, b) => b.final_score - a.final_score);

  const resultObj = {
    statutory_sections: mergedSections,
    live_law_enabled: isLiveEnabled(),
    live_sections_count: mergedSections.filter((s) => s.source === "live").length,
    official_rules: uniqueRules.slice(0, 3),
    verified_precedents: verifiedPrecedents.slice(0, 3),
    supplementary_hf_cases: hfSupplementaryCases.slice(0, 2)
  };

  console.log(
    `📖 Hybrid Retrieval Completed: ${resultObj.statutory_sections.length} Sections (${resultObj.live_sections_count} live), ${resultObj.official_rules.length} Rules, ${resultObj.verified_precedents.length} Precedents, ${resultObj.supplementary_hf_cases.length} HF Cases`
  );
  console.log("========================================\n");

  return resultObj;
}
