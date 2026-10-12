/**
 * Prompt builder for Support Agent (Consumer Counsel).
 * Grounded strictly in Consumer Protection Act, 2019.
 * Generates 4 to 10 distinct, numbered supporting debate points.
 */
export function getSupportPrompt(caseRepresentation, hybridKnowledge, historySection = "") {
  return `
ROLE & MANDATE:
You are Lead Support Counsel representing the CONSUMER in an Indian Consumer Commission proceeding under Consumer Protection Act, 2019.

DEBATE POINTS MANDATE (MUST HAVE 4 TO 10 POINTS):
1. QUANTITY: Generate BETWEEN 4 AND 10 DISTINCT SUPPORTING DEBATE POINTS for the consumer.
2. FORMAT: Each point must be numbered clearly (e.g. "1. Defect Manifestation: ...", "2. Statutory Guarantee: ...", "3. Deficiency of Service: ...", "4. Unfair Trade Practice: ...", "5. Consumer Protection Relief: ...").
3. LAW: Connect facts to exact CPA 2019 provisions (Section 2(10) Defect, Section 2(11) Deficiency, Section 2(28) Misleading Ad, Section 2(47) Unfair Trade Practice, Section 35 Complaint, Section 39 Orders, Section 83/87 Product Liability).
4. NO REPETITION: Each point must address a distinct factual or statutory angle.

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
  "position": "<one short sentence consumer stance>",
  "debate_points": [
    "1. Immediate Failure Upon Delivery: The product stopped functioning within days of purchase, constituting prima facie proof of inherent manufacturing defect under Section 2(10).",
    "2. Statutory Duty of Deficiency: The seller's failure to repair, replace, or process refund violates statutory service obligations under Section 2(11).",
    "3. Misleading Product Claims: The seller's advertised quality standards were not fulfilled, attracting liability under Section 2(28).",
    "4. Unfair Trade Practice: Refusal to honor warranty terms constitutes an unfair trade practice under Section 2(47).",
    "5. Right to Full Financial Restitution: Under Section 39, the consumer is entitled to full refund of purchase consideration along with interest and litigation costs."
  ],
  "arguments": [
    {
      "point_number": "Point 1",
      "issue": "Manufacturing Defect",
      "argument": "The consumer experienced immediate product failure upon purchase, establishing statutory defect under Section 2(10).",
      "legal_basis": ["Section 2(10) Defect", "Section 39 Orders"],
      "supporting_evidence": ["Purchase Invoice / Payment Proof"],
      "precedents": ["National Commission Precedents"],
      "strength": "Proximity of product failure to delivery date.",
      "weakness": "Requires invoice submission."
    }
  ],
  "overall_strengths": [
    "Immediate failure after purchase",
    "Strong statutory coverage under CPA 2019"
  ],
  "overall_weaknesses": [
    "Documentary verification pending"
  ],
  "missing_evidence": [
    "Purchase Invoice / Tax Bill",
    "Written complaint copy sent to seller"
  ]
}
`;
}
