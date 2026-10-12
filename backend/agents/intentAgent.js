import { generateContentWithRetry } from "../services/gemini.js";
import { safeParseJSON } from "../utils/jsonHelper.js";

/**
 * Intent Classification Agent.
 * Classifies user legal question into a domain category and confidence score.
 * 
 * @param {string} question The user's input question.
 * @returns {Promise<{category: string, confidence: number}>}
 */
export async function intentAgent(question) {
  const prompt = `
You are an Indian Legal Intent & Domain Classifier.

Your job is to identify the legal category of the user's question and estimate your classification confidence (0 to 100).

Possible Consumer Law Categories:
- Defective Product
- Refund
- Warranty
- E-commerce
- Unfair Trade Practice
- Product Liability
- Misleading Advertisement

Possible Non-Consumer Categories:
- Criminal Law
- Property Dispute
- Family Law / Marriage
- Employment / Labor Law
- Taxation
- Corporate / Contract Law
- Cybercrime
- Other / General

The JSON structure below is a SCHEMA TEMPLATE ONLY. Generate fresh values based ONLY on the question:

Return ONLY a valid JSON object matching this structure (no markdown, no code fences):

{
  "category": "<category name>",
  "confidence": <integer 0 to 100>
}

Question:
${question}
`;

  try {
    const result = await generateContentWithRetry(prompt);
    const text = result.response.text();
    const parsed = safeParseJSON(text);

    return {
      category: parsed.category || "Other",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 50
    };
  } catch (error) {
    console.warn("⚠️ Intent Classifier Warning:", error.message);
    return { category: "General Consumer Law", confidence: 60 };
  }
}