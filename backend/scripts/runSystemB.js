/**
 * LexAgent System B: Independent Statutory RAG Pipeline.
 * 
 * STRICT ISOLATION GUARANTEES:
 * - NO HuggingFace cases
 * - NO court judgments
 * - NO secondary legal QA
 * - NO reuse of System C retrieval results, decisions, or answers
 * - Queries ONLY primary legislation (Consumer Protection Act, 2019) & official rules (primary_legislation_rules.json)
 */

import fs from "fs";
import path from "path";
import { generateContentWithRetry } from "../services/gemini.js";
import { retrieveRelevantSections } from "../services/retriever.js";
import { validateAgentOutput } from "../services/groundingValidator.js";

const LEGISLATION_PATH = path.resolve("./data/primary_legislation_rules.json");

/**
 * Runs independent Statutory RAG (System B) on a user query.
 * @param {string} rawQuestion The user's legal question / case facts
 * @returns {Promise<object>} Isolated System B evaluation output
 */
export async function runSystemBStatutoryRAG(rawQuestion) {
  console.log("  -> [System B] Independent Statutory RAG Execution Started...");

  // 1. Vector Search restricted ONLY to Statutory Chunks (Consumer Protection Act, 2019)
  let statutorySections = [];
  try {
    const vectorResults = await retrieveRelevantSections(rawQuestion, 4);
    statutorySections = vectorResults.map(s => ({
      source_type: "STATUTE",
      act: "Consumer Protection Act, 2019",
      section: s.metadata.section || "Section N/A",
      title: s.metadata.title || "Statutory Provision",
      text: s.text,
      authority_level: 1,
      source_url: "https://www.indiacode.nic.in/handle/123456789/15256"
    }));
  } catch (err) {
    console.warn("  ⚠️ System B statutory vector fallback:", err.message);
  }

  // 2. Fetch Official Statutory Rules from primary_legislation_rules.json ONLY
  let officialRules = [];
  try {
    if (fs.existsSync(LEGISLATION_PATH)) {
      const legData = JSON.parse(fs.readFileSync(LEGISLATION_PATH, "utf-8"));
      const lowerQuery = rawQuestion.toLowerCase();

      legData.forEach(doc => {
        if (doc.provisions && Array.isArray(doc.provisions)) {
          doc.provisions.forEach(prov => {
            const matchesText = lowerQuery.includes(prov.title.toLowerCase()) ||
                                lowerQuery.includes(prov.section_or_rule.toLowerCase()) ||
                                (lowerQuery.includes("e-commerce") && doc.document_name.includes("E-Commerce")) ||
                                (lowerQuery.includes("refund") && prov.text.toLowerCase().includes("refund")) ||
                                (lowerQuery.includes("defect") && prov.text.toLowerCase().includes("defect"));

            if (matchesText) {
              officialRules.push({
                source_type: "RULE",
                document_name: doc.document_name,
                rule: prov.section_or_rule,
                title: prov.title,
                text: prov.text,
                authority_level: 2,
                source_url: doc.source
              });
            }
          });
        }
      });
    }
  } catch (err) {
    console.warn("  ⚠️ System B rules retrieval fallback:", err.message);
  }

  // Strictly filter out any non-statutory items (Safety Assertion)
  const retrievedSources = [...statutorySections, ...officialRules].filter(src => 
    src.source_type === "STATUTE" || src.source_type === "RULE"
  );

  // Construct System B prompt with ONLY statutory context
  const contextSnippet = retrievedSources.map((s, idx) => 
    `[Source ${idx+1}] ${s.source_type === "STATUTE" ? s.section : s.rule} - ${s.title}\n${s.text}`
  ).join("\n\n");

  const prompt = `
You are an expert Legal AI Assistant evaluating a dispute based ONLY on statutory provisions and official rules of the Consumer Protection Act, 2019.

STATUTORY SOURCES RETRIEVED:
${contextSnippet || "No specific statutory sections retrieved."}

FACTS OF THE CASE:
${rawQuestion}

INSTRUCTIONS:
Analyze the case strictly against the statutory text above.
If essential statutory elements or evidence (such as purchase invoice, defect proof, or notice) are missing, or if the case is outside Consumer Protection jurisdiction, you MUST state "Inconclusive / Insufficient Evidence" or "OUT_OF_SCOPE".

Provide your output in valid JSON format:
{
  "decision": "<Allowed | Dismissed | Inconclusive / Insufficient Evidence | OUT_OF_SCOPE>",
  "cited_statutes": ["<e.g. Section 2(10), Section 35>"],
  "reasoning": "<brief legal reasoning grounded strictly in statutes>"
}
`;

  try {
    const res = await generateContentWithRetry(prompt);
    const text = res.response.text();
    
    let decision = "Inconclusive / Insufficient Evidence";
    let citedStatutes = [];
    let reasoning = text;

    try {
      const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanedText);
      decision = parsed.decision || decision;
      citedStatutes = parsed.cited_statutes || [];
      reasoning = parsed.reasoning || text;
    } catch (e) {
      if (text.toLowerCase().includes("out_of_scope")) decision = "OUT_OF_SCOPE";
      else if (text.toLowerCase().includes("allowed")) decision = "Allowed";
      else if (text.toLowerCase().includes("dismissed")) decision = "Dismissed";
    }

    const groundingReport = validateAgentOutput("SystemB", { reasoning, cited_statutes: citedStatutes }, contextSnippet).grounding_report;

    return {
      system: "System B (Statutory RAG Only)",
      decision,
      cited_statutes: citedStatutes,
      reasoning,
      retrieved_sources: retrievedSources,
      grounding_report: groundingReport,
      is_abstention: decision.includes("Inconclusive") || decision.includes("Insufficient") || decision.includes("OUT_OF_SCOPE")
    };
  } catch (err) {
    return {
      system: "System B (Statutory RAG Only)",
      decision: "Inconclusive / Insufficient Evidence",
      cited_statutes: [],
      reasoning: err.message,
      retrieved_sources: retrievedSources,
      grounding_report: { valid: false, errors: [err.message] },
      is_abstention: true
    };
  }
}
