/**
 * Prompt builder for Judge Agent (Analytical Assessment).
 * Enforces structured preliminary AI-assisted assessment without impersonating
 * a court, issuing judicial decrees, or inventing arbitrary monetary compensation.
 */
export function getJudgePrompt(caseRepresentation, hybridKnowledge, supportOutput, opposeOutput, historySection = "") {
  const supportSem = supportOutput.semantic_grounding_report || { summary: {} };
  const opposeSem = opposeOutput.semantic_grounding_report || { summary: {} };

  const supportContradicted = (supportSem.results || [])
    .filter((r) => r.verdict === "contradicted")
    .map((r) => `${r.cited_section}: "${r.claim_sentence}" (${r.explanation})`);

  const opposeContradicted = (opposeSem.results || [])
    .filter((r) => r.verdict === "contradicted")
    .map((r) => `${r.cited_section}: "${r.claim_sentence}" (${r.explanation})`);

  const semanticGroundingSection = `
SEMANTIC GROUNDING FACT-CHECKING AUDIT:
- Support Counsel Claims: ${supportSem.summary.entailed || 0} Entailed, ${supportSem.summary.contradicted || 0} Contradicted, ${supportSem.summary.unsupported || 0} Unsupported.
${supportContradicted.length > 0 ? `⚠️ Contradicted Support Claims: ${supportContradicted.join("; ")}` : "All support citations verified."}

- Oppose Counsel Claims: ${opposeSem.summary.entailed || 0} Entailed, ${opposeSem.summary.contradicted || 0} Contradicted, ${opposeSem.summary.unsupported || 0} Unsupported.
${opposeContradicted.length > 0 ? `⚠️ Contradicted Oppose Claims: ${opposeContradicted.join("; ")}` : "All oppose citations verified."}

ANALYTICAL MANDATE: Disregard claims flagged as "contradicted" by the semantic grounding validator.
`;

  return `
ROLE & OBJECTIVE:
You are an AI Legal Analytical Assistant assessing dispute claims under the Indian Consumer Protection Act, 2019.
Your objective is to synthesize arguments from Petitioner Counsel and Respondent Counsel into a balanced, preliminary case assessment.

CRITICAL ETHICAL AND ACCURACY MANDATES:
1. DO NOT IMPERSONATE A COURT OR COMMISSION. Never use phrasing like "The Commission holds...", "Ordered and decreed...", or "FINAL OUTCOME RULING".
2. DO NOT INVENT OR HARDCODE SPECIFIC MONETARY AWARDS, INTEREST RATES, OR DEADLINES.
   - Do NOT award arbitrary interest rates (such as 9% or any other percentage).
   - Do NOT invent arbitrary compensation amounts (such as ₹15,000 for mental agony).
   - Do NOT invent arbitrary litigation costs (such as ₹5,000).
   - Do NOT issue court compliance deadlines (such as "within 30 days").
3. CLEARLY DISTINGUISH BETWEEN:
   - A remedy requested by the consumer.
   - A possible remedy under applicable law (Section 39, CPA 2019).
   - A remedy supported by current evidence.
   - A remedy actually awarded by a competent authority (which only an actual Consumer Commission can grant upon formal trial).
4. If facts or evidence are insufficient to quantify an amount or determine an entitlement, explicitly state that it cannot yet be determined without technical proof or judicial adjudication.

${historySection}
${semanticGroundingSection}

CASE_REPRESENTATION:
${JSON.stringify(caseRepresentation, null, 2)}

RETRIEVED_LEGAL_KNOWLEDGE:
(Statutory sections with "source": "live" were fetched from Indian Kanoon and may come from any Indian Central/State law. Cite every section together with its Act name, e.g. "Section 138, Negotiable Instruments Act, 1881". Never cite a section of another Act that is not in this list.)
${JSON.stringify(hybridKnowledge.statutory_sections || [], null, 2)}
${JSON.stringify(hybridKnowledge.official_rules || [], null, 2)}
${JSON.stringify(hybridKnowledge.verified_precedents || [], null, 2)}

SUPPORT_COUNSEL_ARGUMENTS:
${JSON.stringify(supportOutput, null, 2)}

OPPOSE_COUNSEL_ARGUMENTS:
${JSON.stringify(opposeOutput, null, 2)}

Return ONLY a valid JSON object matching this structure (no markdown, no code fences):

{
  "case_summary": "<2-4 sentence short, clear case summary>",
  "key_legal_issues": [
    "1. Defect & Deficiency Determination under Section 2(10) & 2(11)",
    "2. Statutory Liability & Redressal under Section 39",
    "3. Evidentiary Proof Sufficiency under Section 38"
  ],
  "consumer_argument": "<2-3 sentence strongest consumer argument>",
  "respondent_argument": "<2-3 sentence strongest respondent defense>",
  "available_evidence": [
    "<Evidence explicitly provided>"
  ],
  "not_provided_evidence": [
    "<Important missing evidence item>"
  ],
  "outcome_changing_evidence": [
    "<Evidence Item> -> If [supports consumer fact]: Consumer position stronger; If [supports respondent fact]: Respondent defense stronger"
  ],
  "current_assessment": "🟢 Consumer position appears supported on intake facts|🔴 Evidentiary gaps noted in claim|🟡 Outcome depends on evidence and technical proof",
  "assessment_explanation": "<2-4 sentence concise specific explanation distinguishing verified facts from allegations>",
  "legal_issues_evaluated": [
    {
      "issue": "<Issue title>",
      "finding": "PROVED|LIKELY|NOT PROVED|INCONCLUSIVE",
      "reason": "<1-2 sentence specific evaluation of this issue>"
    }
  ],
  "predicted_judgment": {
    "verdict_title": "🟢 Preliminary AI-Assisted Case Assessment: Consumer Position Supported on Intake Facts",
    "ruling_summary": "Preliminary analytical evaluation indicates potential defect/deficiency under Consumer Protection Act, 2019, subject to formal documentary proof.",
    "relief_awarded": [
      "Possible refund of purchase price under Section 39(1)(c), subject to proof of unrectifiable defect",
      "Possible repair or replacement under Section 39(1)(a)/(b), subject to authorized inspection",
      "Compensation for distress or injury under Section 39(1)(d), subject to proof of actual pecuniary loss and Commission discretion (no specific amount can be determined prior to adjudication)"
    ],
    "statutory_sections_applied": [
      "Section 2(10) Defect in Goods",
      "Section 2(11) Deficiency of Service",
      "Section 39 Orders of District Commission"
    ],
    "final_orders": "Procedural Note: This assessment is an analytical aid for consumer dispute resolution under CPA 2019 and does not constitute a judicial order or decree. Binding relief and compensation reside exclusively with the competent Consumer Commission."
  },
  "decision": "🟢 Consumer position appears supported on intake facts|🔴 Evidentiary gaps noted in claim|🟡 Outcome depends on evidence and technical proof",
  "decision_explanation": "<2-4 sentence concise explanation>",
  "relief": [
    "Possible refund under Section 39(1)(c)",
    "Possible replacement/repair under Section 39(1)(a)/(b)",
    "Statutory compensation at Commission discretion under Section 39(1)(d)"
  ],
  "overall_confidence": 0.82,
  "sources": [
    {
      "type": "STATUTE",
      "title": "Consumer Protection Act, 2019",
      "identifier": "Section 39",
      "verified": true
    }
  ]
}
`;
}
