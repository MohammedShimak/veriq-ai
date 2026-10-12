import { generateContentWithRetry } from "../services/gemini.js";
import { safeParseJSON } from "../utils/jsonHelper.js";

/**
 * Module 1: Case Understanding & Factual Reasoning Agent.
 * Strict compliance with LexAgent rules:
 * - Max 3-4 sentence simple summary.
 * - Max 5 established facts bullets.
 * - Max 3 specific legal issues (no vague generic questions).
 * - Extracts new evidence on follow-up turns without repeating past turns.
 */
export async function caseReasoningAgent(question, history = []) {
  const isFollowUp = Array.isArray(history) && history.length > 0;
  
  const historyContext = isFollowUp
    ? `\nPRIOR CASE CONTEXT:\n${history.map((h, i) => `Turn ${i + 1} Q: ${h.question}`).join("\n")}\n`
    : "";

  const prompt = `
ROLE & CONCISE RULE MANDATE:
You are the Lead Case Understanding Agent for LexAgent (Indian Consumer Protection Act, 2019).

${historyContext}
LATEST USER INPUT:
${question}

CONCISE EXTRACTION RULES:
1. DO NOT REPEAT ENTIRE CASE HISTORY: Extract only NEW facts/evidence from latest message if follow-up. Do not create a giant repeated paragraph.
2. CASE SUMMARY: Maximum 3-4 short sentences in simple plain language.
3. ESTABLISHED FACTS: Maximum 5 bullet points of facts explicitly stated or proven.
4. SPECIFIC LEGAL ISSUES: Maximum 3 specific legal questions (e.g. "Does the motor failure constitute a defect under Section 2(10)?"). Never output vague generic questions like "Whether deficiency or defect occurred under Consumer Law?".
5. REALISTIC RESPONDENT DEFENSE: Infer realistic defenses from facts (e.g. "Overloading claim / warranty exclusion"). Never say "No specific defense established".

Return ONLY a valid JSON object matching this structure (no code fences, no markdown):

{
  "case_summary": "<maximum 3-4 short sentences in simple language>",
  "facts": [
    "<fact 1 (max 5 bullets total)>"
  ],
  "parties": [
    "Consumer / Complainant",
    "Respondent / Opposite Party"
  ],
  "product_or_service": "<e.g. Electronics / Appliances / E-Commerce>",
  "consumer_claims": [
    "<claim 1>"
  ],
  "respondent_defence": [
    "<realistic defense derived from facts, e.g. Warranty exclusion or alleged misuse>"
  ],
  "evidence": [
    "<submitted evidence document 1 (max 4)>"
  ],
  "missing_evidence": [
    "<missing evidence document 1 (max 4)>"
  ],
  "legal_issues": [
    "<specific legal issue 1 (max 3)>"
  ],
  "potential_sections": [
    "Section 2(10) Defect",
    "Section 2(11) Deficiency",
    "Section 39 Orders"
  ],
  "requested_relief": [
    "<relief sought, e.g. Refund or Replacement>"
  ],
  "uncertainties": [
    "<unverified claim>"
  ]
}
`;

  try {
    const result = await generateContentWithRetry(prompt);
    const text = result.response.text();
    const parsed = safeParseJSON(text);

    console.log("========================================");
    console.log("MODULE 1: CASE UNDERSTANDING STRUCTURED OUTPUT");
    console.log("========================================");
    console.log(JSON.stringify(parsed, null, 2));
    console.log("========================================\n");

    return {
      case_summary: parsed.case_summary || question.slice(0, 200),
      facts: (Array.isArray(parsed.facts) ? parsed.facts : [question]).slice(0, 5),
      parties: Array.isArray(parsed.parties) && parsed.parties.length > 0 ? parsed.parties : ["Consumer", "Respondent"],
      product_or_service: parsed.product_or_service || "Consumer Product / Service",
      consumer_claims: Array.isArray(parsed.consumer_claims) ? parsed.consumer_claims : [question],
      respondent_defence: Array.isArray(parsed.respondent_defence) && parsed.respondent_defence.length > 0 ? parsed.respondent_defence : ["Warranty terms exclusion / Burden of proof on complainant"],
      evidence: (Array.isArray(parsed.evidence) ? parsed.evidence : ["Factually asserted in claim"]).slice(0, 4),
      missing_evidence: (Array.isArray(parsed.missing_evidence) ? parsed.missing_evidence : ["Purchase Invoice", "Service Inspection Report"]).slice(0, 4),
      legal_issues: (Array.isArray(parsed.legal_issues) ? parsed.legal_issues : ["Does the product failure constitute a defect under Section 2(10)?"]).slice(0, 3),
      potential_sections: Array.isArray(parsed.potential_sections) ? parsed.potential_sections : ["Section 2(10)", "Section 2(11)", "Section 39"],
      requested_relief: Array.isArray(parsed.requested_relief) ? parsed.requested_relief : ["Replacement or Refund"],
      uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties : ["Documentary verification pending"]
    };
  } catch (error) {
    console.warn("⚠️ Case Reasoning Agent Warning:", error.message);
    return {
      case_summary: question.slice(0, 200),
      facts: [question].slice(0, 5),
      parties: ["Consumer", "Respondent"],
      product_or_service: "Consumer Product / Service",
      consumer_claims: [question],
      respondent_defence: ["Warranty terms exclusion / Burden of proof on complainant"],
      evidence: ["Factually asserted in claim"],
      missing_evidence: ["Purchase Invoice", "Service Inspection Report"],
      legal_issues: ["Does the product failure constitute a defect under Section 2(10)?"],
      potential_sections: ["Section 2(10)", "Section 2(11)", "Section 39"],
      requested_relief: ["Replacement or Refund"],
      uncertainties: ["Documentary verification pending"]
    };
  }
}
