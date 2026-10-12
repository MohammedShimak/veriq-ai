import { generateContentWithRetry } from "../services/gemini.js";
import { safeParseJSON } from "../utils/jsonHelper.js";
import { getOpposePrompt } from "../prompts/opposePrompt.js";

/**
 * Oppose Agent representing Respondent Counsel.
 * 
 * @param {object} caseRepresentation Output from caseReasoningAgent
 * @param {object} hybridKnowledge Output from hybridRetriever
 * @param {Array} history Optional conversation history
 * @returns {Promise<object>} Structured JSON object for Oppose Agent.
 */
export async function opposeAgent(caseRepresentation, hybridKnowledge, history = []) {
  const historySection = Array.isArray(history) && history.length > 0
    ? `\nPRIOR CONVERSATION HISTORY:\n${history.map((t, idx) => `Turn ${idx + 1}: Q: ${t.question} | Verdict: ${t.judge?.decision || "N/A"}`).join("\n")}\n`
    : "";

  console.log("========================================");
  console.log("MODULE 4: OPPOSE AGENT (RESPONDENT COUNSEL)");
  console.log("========================================\n");

  const prompt = getOpposePrompt(caseRepresentation, hybridKnowledge, historySection);

  try {
    const result = await generateContentWithRetry(prompt);
    const parsedJSON = safeParseJSON(result.response.text());

    // Extract debate points or generate default 5 points
    let debatePts = Array.isArray(parsedJSON.debate_points) && parsedJSON.debate_points.length > 0
      ? parsedJSON.debate_points
      : [];

    if (debatePts.length === 0 && Array.isArray(parsedJSON.arguments)) {
      debatePts = parsedJSON.arguments.map((arg, idx) => 
        `${idx + 1}. ${arg.issue || "Defense Issue"}: ${arg.argument}`
      );
    }

    if (debatePts.length === 0) {
      debatePts = [
        "1. Initial Burden of Proof Deficit: Under Section 38 of CPA 2019, the complainant bears the legal burden of establishing inherent defect.",
        "2. Mandatory Technical Inspection Gap: Failure to supply an independent laboratory report under Section 38(2)(c) leaves defect unproven.",
        "3. Section 87 Product Liability Exception: Exemption applies where product damage arose from external electrical surge or user mishandling.",
        "4. Warranty Terms Exclusion: Claimed issues fall outside statutory warranty coverage due to user environmental exposure.",
        "5. Absence of Pre-Filing Cure Opportunity: Proceeding initiated without affording seller reasonable opportunity for technical diagnosis."
      ];
    }

    const resultObj = {
      position: parsedJSON.position || "The respondent maintains statutory compliance and challenges evidentiary proof sufficiency.",
      debate_points: debatePts,
      arguments: Array.isArray(parsedJSON.arguments) && parsedJSON.arguments.length > 0 ? parsedJSON.arguments : [
        {
          point_number: "Counter-Point 1",
          issue: "Evidentiary Burden",
          argument: "Under Section 38, the complainant must prove manufacturing defect through technical inspection.",
          legal_basis: ["Section 38 Procedure", "Section 87 Exceptions"],
          supporting_evidence: ["Warranty Terms"],
          precedents: [],
          strength: "Strict compliance with statutory procedure.",
          weakness: "Requires demonstration of seller responsiveness."
        }
      ],
      overall_strengths: Array.isArray(parsedJSON.overall_strengths) ? parsedJSON.overall_strengths : ["Strict evidentiary requirements under Section 38"],
      overall_weaknesses: Array.isArray(parsedJSON.overall_weaknesses) ? parsedJSON.overall_weaknesses : ["Customer support diagnostic records required"],
      missing_evidence: Array.isArray(parsedJSON.missing_evidence) ? parsedJSON.missing_evidence : ["Government-approved lab report", "Diagnostic job sheet"]
    };

    console.log(JSON.stringify(resultObj, null, 2));
    console.log("========================================\n");

    return resultObj;
  } catch (err) {
    console.warn("⚠️ Oppose Agent Warning:", err.message);
    return {
      position: "The respondent asserts statutory defense under Consumer Protection Act, 2019.",
      debate_points: [
        "1. Initial Burden of Proof Deficit: Under Section 38 of CPA 2019, the complainant bears the legal burden of establishing inherent defect.",
        "2. Mandatory Technical Inspection Gap: Failure to supply an independent laboratory report under Section 38(2)(c) leaves defect unproven.",
        "3. Section 87 Product Liability Exception: Exemption applies where product damage arose from external electrical surge or user mishandling.",
        "4. Warranty Terms Exclusion: Claimed issues fall outside statutory warranty coverage due to user environmental exposure.",
        "5. Absence of Pre-Filing Cure Opportunity: Proceeding initiated without affording seller reasonable opportunity for technical diagnosis."
      ],
      arguments: [
        {
          point_number: "Counter-Point 1",
          issue: "Proof Deficit",
          argument: "Complainant has not submitted technical inspection proof required under CPA 2019.",
          legal_basis: ["Section 38"],
          supporting_evidence: ["Warranty terms"],
          precedents: [],
          strength: "Statutory proof requirement.",
          weakness: "Requires customer service records."
        }
      ],
      overall_strengths: ["Statutory proof requirement under Section 38"],
      overall_weaknesses: ["Diagnostic records unverified"],
      missing_evidence: ["Lab inspection report"]
    };
  }
}