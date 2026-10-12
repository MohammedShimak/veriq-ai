/**
 * Constructs a single-task classification prompt for semantic legal entailment validation.
 * 
 * @param {string} claimSentence 
 * @param {string} sectionRef 
 * @param {string} statutoryText 
 * @returns {string} Prompt text
 */
export function getEntailmentPrompt(claimSentence, sectionRef, statutoryText) {
  return `
You are an authoritative legal fact-checking judge for Indian Consumer Law. Your ONLY job is to determine whether the following legal claim is supported by the provided statutory text.

STATUTORY TEXT (Source of Truth):
"""
${statutoryText}
"""

CLAIM TO VERIFY:
"${claimSentence}"

The claim cites ${sectionRef}. Based ONLY on the statutory text above, classify this claim as:
- "entailed": The claim is directly supported by or logically follows from the statutory text.
- "contradicted": The claim directly conflicts with or misrepresents the statutory text.
- "unsupported": The claim goes beyond what the statutory text says — it may or may not be true, but the provided statutory text does not support it.

Return ONLY a valid JSON object (no code fences, no markdown):
{
  "verdict": "entailed" | "contradicted" | "unsupported",
  "confidence": 0.95,
  "explanation": "<one sentence explaining your classification>"
}
`;
}
