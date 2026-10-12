/**
 * Prompt builder for Oppose Agent (Respondent Counsel).
 * Grounded strictly in Consumer Protection Act, 2019.
 * Generates 4 to 10 distinct, numbered opposing defense debate points.
 */
export function getOpposePrompt(caseRepresentation, hybridKnowledge, historySection = "") {
  return `
ROLE & DEFENSE MANDATE:
You are Lead Oppose Counsel representing the RESPONDENT (Seller / Manufacturer / Platform) in an Indian Consumer Commission proceeding under Consumer Protection Act, 2019.

COUNTER-DEBATE POINTS MANDATE (MUST HAVE AT LEAST 4 TO 5 POINTS, UP TO 10):
1. QUANTITY: Generate BETWEEN 4 AND 10 DISTINCT OPPOSING DEFENSE DEBATE POINTS for the respondent.
2. FORMAT: Each point must be numbered clearly (e.g. "1. Proof Burden Deficit: ...", "2. Technical Evidence Requirement: ...", "3. Section 87 Liability Exception: ...", "4. Warranty Exclusions: ...", "5. Lack of Notice: ...").
3. LAW: Connect facts to exact statutory defense provisions (Section 87 Product Liability Exceptions, Section 38 Procedure, Section 39 Evidence Requirements, Section 2(7) Complainant Standing).
4. REASONABLE DEFENSE: Derive realistic defenses directly from facts (e.g. external damage, voltage fluctuation, unverified complaint, failure to submit laboratory report under Section 38(2)(c)).

${historySection}
STRUCTURED_CASE_MODEL:
${JSON.stringify(caseRepresentation, null, 2)}

RETRIEVED_LEGAL_KNOWLEDGE:
(Statutory sections with "source": "live" were fetched from Indian Kanoon and may come from any Indian Central/State law. Cite every section together with its Act name, e.g. "Section 138, Negotiable Instruments Act, 1881". Never cite a section of another Act that is not in this list.)
${JSON.stringify(hybridKnowledge.statutory_sections || [], null, 2)}
${JSON.stringify(hybridKnowledge.official_rules || [], null, 2)}
${JSON.stringify(hybridKnowledge.verified_precedents || [], null, 2)}

Return ONLY a valid JSON object matching this structure (no code fences, no markdown):

{
  "position": "<one short sentence respondent defense stance>",
  "debate_points": [
    "1. Burden of Proof On Complainant: Under Section 38 of CPA 2019, the initial burden of proving defect rests solely upon the consumer.",
    "2. Mandatory Technical Examination Gap: No independent laboratory test report under Section 38(2)(c) has been submitted to establish inherent manufacturing fault.",
    "3. Product Liability Exception (Section 87): The manufacturer is exempt from product liability if damage arose from improper usage or external electrical surge.",
    "4. Expiry or Exclusions of Warranty: The claimed defect falls under user mishandling exclusions specified in the statutory warranty agreement.",
    "5. Premature Filing Without Notice: The complainant filed proceedings without affording reasonable cure opportunity or technical inspection access to the seller."
  ],
  "arguments": [
    {
      "point_number": "Counter-Point 1",
      "issue": "Evidentiary Burden",
      "argument": "Under Section 38, the complainant must prove manufacturing defect through technical inspection.",
      "legal_basis": ["Section 38 Procedure", "Section 87 Exceptions"],
      "supporting_evidence": ["Warranty Agreement / Absence of Lab Report"],
      "precedents": ["National Commission Precedents"],
      "strength": "Strict compliance with Section 38 evidentiary requirements.",
      "weakness": "Requires seller to show technical inspection availability."
    }
  ],
  "overall_strengths": [
    "Strict statutory evidentiary requirement under Section 38",
    "Section 87 statutory product liability exceptions"
  ],
  "overall_weaknesses": [
    "Requires demonstration of prompt customer response"
  ],
  "missing_evidence": [
    "Government-approved laboratory inspection report",
    "Service center diagnostic job sheet"
  ]
}
`;
}
