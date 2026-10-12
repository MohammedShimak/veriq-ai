/**
 * Safely parses JSON strings returned by AI models.
 * Handles Markdown code fences (e.g. ```json ... ```), JSON arrays, objects, and leading/trailing noise.
 */
export function safeParseJSON(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid or empty string provided for JSON parsing.");
  }

  let cleaned = text.trim();

  // Strip markdown code block wrappers if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  // 1. Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue to boundary extractor
  }

  // 2. Determine whether object '{' or array '[' comes first
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    const lastBracket = cleaned.lastIndexOf("]");
    if (lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
  } else if (firstBrace !== -1) {
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to parse JSON response. Raw text:", text);
    throw new Error(`JSON Parsing Error: ${error.message}`);
  }
}
