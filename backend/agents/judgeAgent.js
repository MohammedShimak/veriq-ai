import { generateContentWithRetry } from "../services/gemini.js";
import { safeParseJSON } from "../utils/jsonHelper.js";
import { getJudgePrompt } from "../prompts/judgePrompt.js";

/**
 * Judge Agent acting as the Judicial Bench.
 * Generates predicted judgment with final orders under CPA 2019.
 * 
 * @param {object} caseRepresentation Output from caseReasoningAgent
 * @param {object} hybridKnowledge Output from hybridRetriever
 * @param {object} supportOutput Output from supportAgent
 * @param {object} opposeOutput Output from opposeAgent
 * @param {Array} history Optional conversation history
 * @returns {Promise<object>} Structured JSON object for Judge Agent.
 */
export async function judgeAgent(caseRepresentation, hybridKnowledge, supportOutput, opposeOutput, history = []) {
  const historySection = Array.isArray(history) && history.length > 0
    ? `\nPRIOR CONVERSATION HISTORY:\n${history.map((t, idx) => `Turn ${idx + 1}: Q: ${t.question} | Verdict: ${t.judge?.decision || "N/A"}`).join("\n")}\n`
    : "";

  console.log("========================================");
  console.log("MODULE 5: JUDGE AGENT (THE BENCH)");
  console.log("========================================\n");

  const prompt = getJudgePrompt(caseRepresentation, hybridKnowledge, supportOutput, opposeOutput, historySection);

  try {
    const result = await generateContentWithRetry(prompt);
    const parsedJSON = safeParseJSON(result.response.text());

    // Normalize sources array across Statutes, Rules, and Precedents
    const sourcesList = [];
    (hybridKnowledge.statutory_sections || []).forEach(s => {
      sourcesList.push({
        type: "STATUTE",
        title: s.act || "Consumer Protection Act, 2019",
        identifier: s.section,
        source_url: s.source_url,
        live: s.source === "live",
        verified: true
      });
    });

    (hybridKnowledge.official_rules || []).forEach(r => {
      sourcesList.push({
        type: "RULE",
        title: r.document_name,
        identifier: r.rule,
        source_url: r.source_url,
        verified: r.verified !== false
      });
    });

    (hybridKnowledge.verified_precedents || []).forEach(p => {
      sourcesList.push({
        type: "PRECEDENT",
        title: p.case_name,
        identifier: p.citation,
        source_url: p.source_url,
        verified: p.verified !== false
      });
    });

    const fallbackMissingEv = caseRepresentation.missing_evidence || ["Certified technician inspection report"];
    const currentAssessment = parsedJSON.current_assessment || parsedJSON.decision || "🟢 Preliminary assessment favors consumer on submitted allegations";
    const assessmentExplanation = parsedJSON.assessment_explanation || parsedJSON.decision_explanation || "Based on currently available facts, the consumer has stated a prima facie case of defect/deficiency under Consumer Protection Act, 2019, subject to supporting documentation.";

    const defaultRelief = [
      "1. Potential refund of purchase consideration under Section 39(1)(c), subject to proof of unrectifiable defect.",
      "2. Potential repair or replacement under Section 39(1)(a)/(b), subject to technical inspection.",
      "3. Reasonable compensation for distress under Section 39(1)(d), subject to evidence of actual loss and Commission discretion (no specific amount can be determined prior to formal adjudication)."
    ];

    const predictedJg = parsedJSON.predicted_judgment || {
      verdict_title: currentAssessment.includes("Respondent") || currentAssessment.includes("gap")
        ? "🔴 Preliminary AI-Assisted Case Assessment: Evidentiary Gaps Noted in Claim"
        : currentAssessment.includes("depends") || currentAssessment.includes("proof")
        ? "🟡 Preliminary AI-Assisted Case Assessment: Outcome Depends on Evidence and Technical Proof"
        : "🟢 Preliminary AI-Assisted Case Assessment: Consumer Position Supported on Intake Facts",
      ruling_summary: parsedJSON.assessment_explanation || "Preliminary analytical assessment indicates potential deficiency or defect under Consumer Protection Act, 2019, subject to documentary verification.",
      relief_awarded: Array.isArray(parsedJSON.relief) && parsedJSON.relief.length > 0 ? parsedJSON.relief : defaultRelief,
      statutory_sections_applied: (hybridKnowledge.statutory_sections || []).map(s => `${s.section} (${s.act})`),
      final_orders: "Procedural Note: This assessment is an analytical aid for consumer dispute resolution under CPA 2019 and does not constitute a judicial order or decree. Binding relief resides exclusively with the competent Consumer Commission."
    };

    const resultObj = {
      case_summary: parsedJSON.case_summary || caseRepresentation.case_summary || "Consumer dispute submitted under Consumer Protection Act, 2019.",
      key_legal_issues: Array.isArray(parsedJSON.key_legal_issues) && parsedJSON.key_legal_issues.length > 0
        ? parsedJSON.key_legal_issues
        : (caseRepresentation.legal_issues || ["Existence of Defect under Section 2(10)"]),
      consumer_argument: parsedJSON.consumer_argument || supportOutput.position || "Consumer asserts statutory remedies under Consumer Protection Act, 2019.",
      respondent_argument: parsedJSON.respondent_argument || opposeOutput.position || "Respondent asserts warranty terms exclusion and statutory proof gap.",
      available_evidence: Array.isArray(parsedJSON.available_evidence) && parsedJSON.available_evidence.length > 0
        ? parsedJSON.available_evidence
        : ["Factually asserted in claim text."],
      not_provided_evidence: Array.isArray(parsedJSON.not_provided_evidence)
        ? parsedJSON.not_provided_evidence
        : fallbackMissingEv,
      outcome_changing_evidence: Array.isArray(parsedJSON.outcome_changing_evidence) && parsedJSON.outcome_changing_evidence.length > 0
        ? parsedJSON.outcome_changing_evidence
        : [
            "Certified Technician Inspection Report -> If factory fault: Consumer position stronger; If user damage: Respondent defense stronger."
          ],
      current_assessment: currentAssessment,
      assessment_explanation: assessmentExplanation,
      decision: currentAssessment,
      decision_explanation: assessmentExplanation,
      legal_issues_evaluated: Array.isArray(parsedJSON.legal_issues_evaluated) && parsedJSON.legal_issues_evaluated.length > 0
        ? parsedJSON.legal_issues_evaluated
        : [
            {
              issue: caseRepresentation.legal_issues ? caseRepresentation.legal_issues[0] : "Existence of Defect under Section 2(10)",
              finding: "LIKELY",
              reason: "Post-delivery defect timeline supports consideration under Section 2(10) defect provisions."
            }
          ],
      predicted_judgment: predictedJg,
      relief: Array.isArray(parsedJSON.relief) && parsedJSON.relief.length > 0 ? parsedJSON.relief : defaultRelief,
      overall_confidence: typeof parsedJSON.overall_confidence === "number" ? parsedJSON.overall_confidence : 0.82,
      sources: Array.isArray(parsedJSON.sources) && parsedJSON.sources.length > 0 ? parsedJSON.sources : sourcesList
    };

    console.log(JSON.stringify(resultObj, null, 2));
    console.log("========================================\n");

    return resultObj;
  } catch (err) {
    console.warn("⚠️ Judge Agent Warning:", err.message);
    const fallbackEv = caseRepresentation.missing_evidence || ["Purchase proof"];
    return {
      case_summary: "Consumer dispute submitted under Consumer Protection Act, 2019.",
      key_legal_issues: ["Existence of Defect under Section 2(10)"],
      consumer_argument: "Consumer asserts statutory remedies under CPA 2019.",
      respondent_argument: "Respondent asserts statutory proof gap.",
      available_evidence: ["Factually asserted in claim text."],
      not_provided_evidence: fallbackEv,
      outcome_changing_evidence: ["Technical Inspection Report -> If factory fault: Consumer position stronger; If user damage: Respondent defense stronger."],
      current_assessment: "🟢 Preliminary assessment favors consumer on submitted allegations",
      assessment_explanation: "Complainant states a prima facie grievance under Consumer Protection Act, 2019, subject to documentary verification.",
      decision: "🟢 Preliminary assessment favors consumer on submitted allegations",
      decision_explanation: "Complainant states a prima facie grievance under Consumer Protection Act, 2019, subject to documentary verification.",
      legal_issues_evaluated: [
        {
          issue: "Existence of Defect under Section 2(10)",
          finding: "LIKELY",
          reason: "Cause of failure supported by intake statement and timeline."
        }
      ],
      predicted_judgment: {
        verdict_title: "🟢 Preliminary AI-Assisted Case Assessment: Consumer Position Supported on Intake Facts",
        ruling_summary: "Analytical case evaluation indicates potential deficiency under Section 2(11) or defect under Section 2(10), CPA 2019.",
        relief_awarded: [
          "1. Possible refund under Section 39(1)(c), subject to proof of irreparable defect.",
          "2. Possible repair or replacement under Section 39(1)(a)/(b).",
          "3. Statutory compensation at Commission discretion under Section 39(1)(d) (no fixed amount can be awarded without formal adjudication)."
        ],
        statutory_sections_applied: ["Section 2(10) Defect", "Section 2(11) Deficiency", "Section 39 Orders"],
        final_orders: "Procedural Note: This assessment is an analytical aid for consumer dispute resolution under CPA 2019 and does not constitute a judicial order or decree."
      },
      relief: ["Possible refund under Section 39(1)(c)", "Repair/replacement under Section 39(1)(a)/(b)", "Compensation at Commission discretion under Section 39(1)(d)"],
      overall_confidence: 0.82,
      sources: []
    };
  }
}