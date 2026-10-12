import { extractClaimSentences } from "../utils/claimExtractor.js";
import { findRetrievedTextForSection } from "../utils/sectionMatcher.js";
import { getEntailmentPrompt } from "../prompts/entailmentPrompt.js";
import { generateContentWithRetry } from "./gemini.js";
import { safeParseJSON } from "../utils/jsonHelper.js";

const MAX_CLAIMS_TO_CHECK = 3;

/**
 * Module C: Semantic Grounding Layer.
 * Performs parallel LLM-based semantic entailment validation on section-citing claim sentences.
 * 
 * @param {string} agentName "Support" | "Oppose" | "Judge"
 * @param {object} agentOutput Raw agent response object
 * @param {string} retrievedContext Raw retrieved statutory context
 * @returns {Promise<object>} Semantic Validation Report
 */
export async function semanticValidate(agentName, agentOutput, retrievedContext = "") {
  const resultObj = {
    agent: agentName,
    total_claims_checked: 0,
    results: [],
    summary: {
      entailed: 0,
      contradicted: 0,
      unsupported: 0
    }
  };

  if (!agentOutput || typeof agentOutput !== "object") {
    return resultObj;
  }

  const claimPairs = extractClaimSentences(agentOutput);
  if (!claimPairs || claimPairs.length === 0) {
    console.log(`🔬 [Semantic Grounding ${agentName}]: 0 claim sentences with section citations found.`);
    return resultObj;
  }

  const claimsToCheck = claimPairs.slice(0, MAX_CLAIMS_TO_CHECK);
  console.log(`🔬 [Semantic Grounding ${agentName}]: Validating ${claimsToCheck.length} claim sentence(s) in parallel...`);

  const checkPromises = claimsToCheck.map(async (pair, i) => {
    const sentence = pair.sentence;
    const primarySection = pair.citedSections[0] || "Section N/A";
    const textSnippet = findRetrievedTextForSection(primarySection, retrievedContext);

    if (!textSnippet) {
      return {
        claim_sentence: sentence,
        cited_section: primarySection,
        retrieved_text_snippet: "",
        verdict: "unsupported",
        confidence: 1.0,
        explanation: "Section not present in retrieved statutory context."
      };
    }

    try {
      const prompt = getEntailmentPrompt(sentence, primarySection, textSnippet);
      const llmResult = await generateContentWithRetry(prompt);
      const rawText = llmResult.response.text();
      const parsed = safeParseJSON(rawText);

      const verdict = ["entailed", "contradicted", "unsupported"].includes(parsed.verdict)
        ? parsed.verdict
        : "unsupported";
      const confidence = typeof parsed.confidence === "number" ? Math.min(1.0, Math.max(0.0, parsed.confidence)) : 0.85;
      const explanation = parsed.explanation || "Entailment analysis completed.";

      return {
        claim_sentence: sentence,
        cited_section: primarySection,
        retrieved_text_snippet: textSnippet.slice(0, 150) + "...",
        verdict,
        confidence,
        explanation
      };
    } catch (err) {
      return {
        claim_sentence: sentence,
        cited_section: primarySection,
        retrieved_text_snippet: textSnippet.slice(0, 150) + "...",
        verdict: "unsupported",
        confidence: 0.5,
        explanation: "Validation check encountered an API error — treated as unsupported."
      };
    }
  });

  const checkResults = await Promise.all(checkPromises);

  checkResults.forEach((res) => {
    resultObj.results.push(res);
    if (res.verdict === "entailed") resultObj.summary.entailed++;
    else if (res.verdict === "contradicted") resultObj.summary.contradicted++;
    else resultObj.summary.unsupported++;
  });

  resultObj.total_claims_checked = resultObj.results.length;

  console.log(
    `🔬 [Semantic Grounding ${agentName} Complete]: ${resultObj.summary.entailed} Entailed, ${resultObj.summary.contradicted} Contradicted, ${resultObj.summary.unsupported} Unsupported`
  );

  return resultObj;
}
