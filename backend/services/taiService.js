import { Thread, INVESTIGATION_STAGES, ALLOWED_STAGE_TRANSITIONS } from "../models/Thread.js";
import {
  getThread,
  updateStage,
  saveInitialAnalysis,
  submitClarificationAnswers,
  advanceInvestigationRound,
  appendAuditTimelineEvent,
  updateTaiMetadata
} from "./threadService.js";
import {
  analyzeComplaint,
  generateFollowUpQuestions,
  MAX_CLARIFICATION_ROUNDS
} from "./investigationAnalysis.js";
import { researchCompanyPolicy } from "./companyPolicyService.js";
import {
  evaluateInvestigationGate,
  proceedWithLimitations
} from "./investigationGateService.js";
import { generateLegalAssessment } from "./legalAssessmentService.js";
import {
  generateFinalCaseOutcome,
  getFinalCaseOutcome
} from "./finalOutcomeService.js";
import {
  getTransferAssessmentData,
  saveTransferAssessmentReview
} from "./transferAssessmentService.js";

// In-memory per-thread execution lock to prevent duplicate concurrent operations
const activeExecutionLocks = new Set();

/**
 * Supported TAI Action Identifiers
 */
export const TAI_ACTIONS = {
  ANALYZE_COMPLAINT: "ANALYZE_COMPLAINT",
  ANSWER_CLARIFICATIONS: "ANSWER_CLARIFICATIONS",
  UPLOAD_EVIDENCE: "UPLOAD_EVIDENCE",
  PERFORM_POLICY_RESEARCH: "PERFORM_POLICY_RESEARCH",
  EVALUATE_GATE: "EVALUATE_GATE",
  PROCEED_WITH_LIMITATIONS: "PROCEED_WITH_LIMITATIONS",
  REVIEW_TRANSFER_ASSESSMENT: "REVIEW_TRANSFER_ASSESSMENT",
  GENERATE_ASSESSMENT: "GENERATE_ASSESSMENT",
  VIEW_ASSESSMENT: "VIEW_ASSESSMENT",
  GENERATE_FINAL_OUTCOME: "GENERATE_FINAL_OUTCOME",
  VIEW_FINAL_OUTCOME: "VIEW_FINAL_OUTCOME",
  EXPORT_REPORT: "EXPORT_REPORT"
};

/**
 * Computes an explainable case health score.
 * Explains factual, evidentiary, and policy readiness.
 * CRITICAL RULE: Explicitly disclaimed as NOT an estimate of legal win probability.
 * 
 * @param {object} thread 
 * @returns {object} Explainable case health breakdown
 */
export function calculateCaseHealth(thread) {
  const intake = thread.intake || {};
  const initialAnalysis = thread.initialAnalysis || {};
  const clarificationHistory = thread.clarificationHistory || [];
  const evidenceInventory = thread.evidenceInventory || [];
  const companyPolicyResearch = thread.companyPolicyResearch || {};
  const gate = thread.investigationGate || {};

  // 1. Factual Clarity (0 to 35 points)
  let factsScore = 10; // baseline for initial complaint
  if (intake.complaint && intake.complaint.trim().length >= 30) factsScore += 5;
  if (intake.company && intake.company !== "Not provided") factsScore += 5;
  if (intake.amount && intake.amount !== "Not provided") factsScore += 5;
  if (initialAnalysis.purchaseOrServiceDate && initialAnalysis.purchaseOrServiceDate !== "Not provided") factsScore += 5;
  if (clarificationHistory.length > 0) factsScore += 5;
  factsScore = Math.min(35, factsScore);

  // 2. Evidence Completeness (0 to 35 points)
  let evidenceScore = 0;
  const inspectedCount = evidenceInventory.filter((d) => d.inspected).length;
  const uploadedCount = evidenceInventory.filter((d) => d.uploaded).length;
  const unavailableCount = evidenceInventory.filter((d) => d.unavailable).length;
  
  if (inspectedCount >= 1) evidenceScore = 35;
  else if (uploadedCount >= 1) evidenceScore = 25;
  else if (unavailableCount >= 1) evidenceScore = 15;
  else if (gate.proceedWithoutEvidenceOverride) evidenceScore = 15;

  // 3. Company & Policy Context (0 to 15 points)
  let policyScore = 0;
  if (companyPolicyResearch.status === "COMPLETED") policyScore = 15;
  else if (companyPolicyResearch.status === "LIMITED" || companyPolicyResearch.status === "NOT_FOUND") policyScore = 10;
  else if (companyPolicyResearch.status === "PENDING") policyScore = 5;

  // 4. Gate Readiness (0 to 15 points)
  let gateScore = 0;
  if (gate.status === "READY") gateScore = 15;
  else if (gate.status === "PROCEED_WITH_LIMITATIONS") gateScore = 12;
  else if (gate.status === "INCOMPLETE") gateScore = 5;

  const totalScore = Math.min(100, factsScore + evidenceScore + policyScore + gateScore);

  return {
    score: totalScore,
    breakdown: {
      factualClarity: { score: factsScore, max: 35 },
      evidenceCompleteness: { score: evidenceScore, max: 35 },
      policyContext: { score: policyScore, max: 15 },
      gateReadiness: { score: gateScore, max: 15 }
    },
    disclaimer: "Case-Health Score reflects factual and documentary intake completeness under Consumer Protection Act, 2019 inquiry protocols. It is NOT a calculation of legal outcome probability or a guarantee of victory."
  };
}

/**
 * Computes the structured action plan and recommended next step for an investigation.
 * 
 * @param {object} thread Investigation record
 * @returns {object} Action plan with recommendations, blocking reasons, and checklist
 */
export function computeCasePlan(thread) {
  if (!thread) throw new Error("Thread is required to compute case plan.");

  const threadId = thread.threadId;
  const stage = thread.stage || INVESTIGATION_STAGES.INITIAL_ANALYSIS;
  const category = (thread.category || thread.initialAnalysis?.disputeCategory || "General Consumer Dispute").trim();
  const evidenceInventory = thread.evidenceInventory || [];
  const unresolvedQuestions = thread.unresolvedQuestions || [];
  const gate = thread.investigationGate || {};
  const assessment = thread.assessment || {};
  const policy = thread.companyPolicyResearch || {};
  const initialAnalysis = thread.initialAnalysis || {};

  // Evidence Status Breakdown across 7 lifecycles
  const evidenceSummary = {
    totalItems: evidenceInventory.length,
    USER_REPORTED: evidenceInventory.filter((d) => d.status === "USER_REPORTED").length,
    DOCUMENT_UPLOADED: evidenceInventory.filter((d) => d.status === "DOCUMENT_UPLOADED" || (d.uploaded && !d.inspected)).length,
    DOCUMENT_INSPECTED: evidenceInventory.filter((d) => d.status === "DOCUMENT_INSPECTED" || d.inspected).length,
    INDEPENDENTLY_VERIFIED: evidenceInventory.filter((d) => d.status === "INDEPENDENTLY_VERIFIED").length,
    CONTRADICTED: evidenceInventory.filter((d) => d.status === "CONTRADICTED").length,
    NOT_INSPECTED: evidenceInventory.filter((d) => d.status === "NOT_INSPECTED").length,
    UNAVAILABLE: evidenceInventory.filter((d) => d.status === "UNAVAILABLE" || d.unavailable).length
  };

  // Contradictions and missing facts
  const unresolvedContradictions = [];
  if (Array.isArray(initialAnalysis.possibleContradictions)) {
    unresolvedContradictions.push(...initialAnalysis.possibleContradictions);
  }
  const contradictedDocs = evidenceInventory.filter((d) => d.status === "CONTRADICTED");
  if (contradictedDocs.length > 0) {
    unresolvedContradictions.push(`Conflicting evidence noted in: ${contradictedDocs.map((d) => d.title).join(", ")}`);
  }

  const missingCriticalElements = [];
  const pendingCriticalQuestions = unresolvedQuestions.filter((q) => q.status === "PENDING" && q.importance === "CRITICAL");
  if (pendingCriticalQuestions.length > 0) {
    missingCriticalElements.push(`Pending critical clarification questions (${pendingCriticalQuestions.length})`);
  }
  if (evidenceSummary.DOCUMENT_INSPECTED === 0 && evidenceSummary.DOCUMENT_UPLOADED === 0 && evidenceSummary.UNAVAILABLE === 0 && !gate.proceedWithoutEvidenceOverride) {
    missingCriticalElements.push("No documentary evidence uploaded or formally marked unavailable");
  }

  // Determine Next Recommended Action
  let nextAction = TAI_ACTIONS.ANALYZE_COMPLAINT;
  let label = "Analyze Complaint";
  let explanation = "Extract initial facts and identify missing information under CPA 2019.";
  let blockingReasons = [];
  let canAutoExecute = true;

  // 1. FINAL OUTCOME GENERATED
  if (thread.finalCaseOutcome?.status === "GENERATED" && !thread.finalCaseOutcome.isOutdated) {
    nextAction = TAI_ACTIONS.VIEW_FINAL_OUTCOME;
    label = "Review Final Case Outcome";
    explanation = "Final Case Outcome is generated and persisted. Review predicted outcome, judicial precedent comparisons, and action steps.";
    blockingReasons = [];
    canAutoExecute = true;
  }
  // 2. ASSESSMENT COMPLETE (Ready for Final Case Outcome)
  else if (stage === INVESTIGATION_STAGES.ASSESSMENT_COMPLETE || (assessment.status === "COMPLETE" && assessment.preliminaryAssessment)) {
    nextAction = TAI_ACTIONS.GENERATE_FINAL_OUTCOME;
    label = "Generate Final Case Outcome";
    explanation = "Preliminary legal assessment completed under Consumer Protection Act, 2019. Ready to generate the dedicated, persistent Final Case Outcome.";
    blockingReasons = [];
    canAutoExecute = true;
  }
  // 3. READY FOR ASSESSMENT
  else if (stage === INVESTIGATION_STAGES.READY_FOR_ASSESSMENT || gate.isSatisfied || gate.status === "READY" || gate.status === "PROCEED_WITH_LIMITATIONS") {
    nextAction = TAI_ACTIONS.GENERATE_ASSESSMENT;
    const isLimited = gate.status === "PROCEED_WITH_LIMITATIONS" || gate.proceedWithoutEvidenceOverride;
    label = isLimited ? "Generate Legal Assessment (With Disclosed Limitations)" : "Generate Grounded Legal Assessment";
    explanation = isLimited
      ? "Investigation passed readiness gate under acknowledged limitations. Ready to generate balanced 14-section legal assessment."
      : "All intake facts, evidence, and regulatory benchmarks are verified. Ready to generate balanced 14-section legal assessment.";
    blockingReasons = [];
    canAutoExecute = false; // requires explicit user trigger
  }
  // 3. AWAITING CLARIFICATION
  else if (stage === INVESTIGATION_STAGES.AWAITING_CLARIFICATION || (unresolvedQuestions.length > 0 && unresolvedQuestions.some((q) => q.status === "PENDING"))) {
    nextAction = TAI_ACTIONS.ANSWER_CLARIFICATIONS;
    label = "Answer Clarification Questions";
    explanation = "Provide answers to category-specific clarification questions to complete essential chronology and details.";
    blockingReasons = ["Pending clarification questions must be answered or ended by user."];
    canAutoExecute = false; // requires consumer input
  }
  // 4. AWAITING EVIDENCE / EVIDENCE REVIEW
  else if (stage === INVESTIGATION_STAGES.AWAITING_EVIDENCE || stage === INVESTIGATION_STAGES.EVIDENCE_REVIEW) {
    if (evidenceSummary.DOCUMENT_INSPECTED === 0 && evidenceSummary.DOCUMENT_UPLOADED === 0 && evidenceSummary.UNAVAILABLE === 0) {
      nextAction = TAI_ACTIONS.UPLOAD_EVIDENCE;
      label = "Provide Supporting Evidence";
      explanation = "Upload primary proof (purchase invoice, transaction alert, or service center record) or mark documents unavailable.";
      blockingReasons = ["Documentary evidence has not yet been supplied or marked unavailable."];
      canAutoExecute = false;
    } else if (policy.status === "NOT_STARTED") {
      nextAction = TAI_ACTIONS.PERFORM_POLICY_RESEARCH;
      label = "Research Company Terms & Regulatory Benchmarks";
      explanation = "Retrieve verified seller policies, warranty rules, and statutory regulatory benchmarks for this dispute.";
      blockingReasons = [];
      canAutoExecute = true;
    } else {
      nextAction = TAI_ACTIONS.EVALUATE_GATE;
      label = "Evaluate Investigation Completeness Gate";
      explanation = "Run server-side completeness check across facts, evidence, and policies to authorize legal assessment.";
      blockingReasons = [];
      canAutoExecute = true;
    }
  }
  // 5. INITIAL ANALYSIS
  else {
    if (!initialAnalysis.disputeCategory) {
      nextAction = TAI_ACTIONS.ANALYZE_COMPLAINT;
      label = "Analyze Initial Complaint";
      explanation = "Perform initial factual intake and category classification under CPA 2019.";
      blockingReasons = [];
      canAutoExecute = true;
    } else {
      nextAction = TAI_ACTIONS.ANSWER_CLARIFICATIONS;
      label = "Answer Clarification Questions";
      explanation = "Clarification questions generated for Round 1. Provide answers to proceed.";
      blockingReasons = ["Round 1 clarification pending."];
      canAutoExecute = false;
    }
  }

  // If Gate evaluated and failed as INCOMPLETE
  if (gate.status === "INCOMPLETE" && stage !== INVESTIGATION_STAGES.ASSESSMENT_COMPLETE) {
    if (evidenceSummary.DOCUMENT_INSPECTED === 0 && evidenceSummary.DOCUMENT_UPLOADED === 0 && evidenceSummary.UNAVAILABLE === 0) {
      nextAction = TAI_ACTIONS.UPLOAD_EVIDENCE;
      label = "Upload Evidence or Proceed with Limitations";
      explanation = "The completeness gate found missing critical documentary proof. Upload documents or confirm proceeding under documented limitations.";
      blockingReasons = gate.missingCriticalEvidence || ["Missing documentary evidence."];
      canAutoExecute = false;
    } else {
      nextAction = TAI_ACTIONS.PROCEED_WITH_LIMITATIONS;
      label = "Confirm Proceeding with Limitations";
      explanation = "Review identified evidentiary gaps and confirm proceeding with legal assessment under documented limitations.";
      blockingReasons = gate.limitationsDisclosed || ["Evidentiary limitations present."];
      canAutoExecute = false;
    }
  }

  const caseHealth = calculateCaseHealth(thread);

  // Optional Adversarial Debate recommendation for contested legal issues
  let adversarialDebateRecommendation = null;
  if (
    category.includes("Electronics") ||
    category.includes("Defective") ||
    category.includes("Bank") ||
    category.includes("Insurance")
  ) {
    if (stage === INVESTIGATION_STAGES.READY_FOR_ASSESSMENT || stage === INVESTIGATION_STAGES.EVIDENCE_REVIEW) {
      adversarialDebateRecommendation = {
        eligible: true,
        label: "Optional Adversarial Counsel Debate",
        description: "Contested statutory issues exist regarding limitation and burden of proof. You can optionally simulate an adversarial debate between Petitioner and Respondent counsels before finalizing.",
        isMandatory: false
      };
    }
  }

  return {
    threadId,
    stage,
    category,
    caseHealth,
    evidenceSummary,
    unresolvedContradictions,
    missingCriticalElements,
    gateStatus: gate.status || "NOT_EVALUATED",
    isGateSatisfied: Boolean(gate.isSatisfied || gate.status === "READY" || gate.status === "PROCEED_WITH_LIMITATIONS"),
    recommendedNextAction: {
      action: nextAction,
      label,
      description: explanation,
      blockingReasons,
      canAutoExecute
    },
    adversarialDebateRecommendation,
    auditTimeline: (thread.auditTimeline || []).slice(-10) // return last 10 audit events
  };
}

/**
 * Synthesizes the complete case state and produces the TAI Case Plan.
 * Enforces ownership and access verification.
 * 
 * @param {string} threadId 
 * @param {string|null} [userId] 
 * @param {string|null} [guestToken] 
 * @returns {Promise<object>} Synthesized case plan
 */
export async function synthesizeCaseState(threadId, userId = null, guestToken = null) {
  if (!threadId) throw new Error("threadId is required.");

  const thread = await getThread(threadId, userId, guestToken);
  if (!thread) {
    const err = new Error(`Investigation with threadId "${threadId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  const plan = computeCasePlan(thread);

  // Record plan query in metadata
  await updateTaiMetadata(
    threadId,
    {
      caseHealthScore: plan.caseHealth.score,
      statusNote: plan.recommendedNextAction.label
    },
    userId,
    guestToken
  );

  return plan;
}

/**
 * Executes a single discrete workflow step under TAI orchestration.
 * Enforces execution locking, ownership, gate validation, and audit recording.
 * 
 * @param {object} params
 * @param {string} params.threadId
 * @param {string} params.action TAI action to execute
 * @param {object} [params.params] Optional parameters for the action
 * @param {string|null} [params.userId]
 * @param {string|null} [params.guestToken]
 * @returns {Promise<object>} Execution result and updated plan
 */
export async function executeWorkflowStep({
  threadId,
  action,
  params = {},
  userId = null,
  guestToken = null
}) {
  if (!threadId) throw new Error("threadId is required.");
  if (!action) throw new Error("action is required.");

  // 1. Acquire per-thread execution lock
  if (activeExecutionLocks.has(threadId)) {
    const err = new Error(`An investigation workflow action is already executing for case "${threadId}". Please retry after completion.`);
    err.statusCode = 409;
    throw err;
  }

  activeExecutionLocks.add(threadId);

  try {
    // 2. Fetch and verify ownership
    const thread = await getThread(threadId, userId, guestToken);
    if (!thread) {
      const err = new Error(`Investigation with threadId "${threadId}" not found.`);
      err.statusCode = 404;
      throw err;
    }

    const previousStage = thread.stage;
    let resultingStage = previousStage;
    let serviceResult = null;
    let rationale = "";
    let serviceResultId = null;

    // 3. Dispatch action to verified service
    switch (action) {
      case TAI_ACTIONS.ANALYZE_COMPLAINT: {
        const complaint = thread.intake?.complaint || "";
        const product = thread.intake?.product || "";
        const company = thread.intake?.company || "";
        const amount = thread.intake?.amount || "";
        const category = thread.category || thread.intake?.category || "";

        const analysis = await analyzeComplaint({ complaint, product, company, amount, category });
        const questionResult = await generateFollowUpQuestions({
          analysis,
          intake: thread.intake,
          clarificationHistory: thread.clarificationHistory || [],
          userReportedFacts: thread.userReportedFacts || [],
          roundNumber: 1
        });

        const updated = await saveInitialAnalysis(threadId, analysis, questionResult.questions, userId, guestToken);
        resultingStage = updated.stage;
        serviceResult = { analysis: updated.initialAnalysis, questions: questionResult.questions };
        rationale = "Executed complaint analysis and generated Round 1 clarification questions under CPA 2019.";
        break;
      }

      case TAI_ACTIONS.ANSWER_CLARIFICATIONS: {
        const answers = params.answers || params.answerList || [];
        if (!Array.isArray(answers) || answers.length === 0) {
          const err = new Error("Answers array is required to advance clarification questions.");
          err.statusCode = 400;
          throw err;
        }

        const afterAnswers = await submitClarificationAnswers(threadId, answers, userId, guestToken);
        const currentRound = afterAnswers.clarificationRound || 1;

        if (currentRound >= MAX_CLARIFICATION_ROUNDS) {
          const completed = await advanceInvestigationRound(threadId, [], true, userId, guestToken);
          resultingStage = completed.stage;
          serviceResult = { clarificationComplete: true, round: currentRound };
        } else {
          const nextQuestions = await generateFollowUpQuestions({
            analysis: afterAnswers.initialAnalysis,
            intake: afterAnswers.intake,
            clarificationHistory: afterAnswers.clarificationHistory || [],
            userReportedFacts: afterAnswers.userReportedFacts || [],
            roundNumber: currentRound + 1
          });

          if (nextQuestions.isComplete || nextQuestions.questions.length === 0) {
            const completed = await advanceInvestigationRound(threadId, [], true, userId, guestToken);
            resultingStage = completed.stage;
            serviceResult = { clarificationComplete: true, round: currentRound };
          } else {
            const advanced = await advanceInvestigationRound(threadId, nextQuestions.questions, false, userId, guestToken);
            resultingStage = advanced.stage;
            serviceResult = { clarificationComplete: false, nextQuestions: nextQuestions.questions, round: currentRound + 1 };
          }
        }
        rationale = `Submitted clarification answers for Round ${currentRound}.`;
        break;
      }

      case TAI_ACTIONS.PERFORM_POLICY_RESEARCH: {
        const result = await researchCompanyPolicy({ threadId, userId, guestToken });
        serviceResult = result.research;
        resultingStage = thread.stage;
        rationale = `Researched terms and regulatory benchmarks for '${result.research?.companyName || "merchant"}'. Status: ${result.research?.status}`;
        break;
      }

      case TAI_ACTIONS.EVALUATE_GATE: {
        const result = await evaluateInvestigationGate({ threadId, userId, guestToken });
        serviceResult = result.gate;
        resultingStage = result.stage;
        rationale = `Evaluated completeness gate. Outcome: ${result.gate?.status}. Satisfied: ${result.isSatisfied}`;
        break;
      }

      case TAI_ACTIONS.PROCEED_WITH_LIMITATIONS: {
        const overrideReason = params.overrideReason || "Consumer explicitly confirmed proceeding with legal assessment under documented evidentiary limitations.";
        const result = await proceedWithLimitations({
          threadId,
          userId,
          guestToken,
          overrideReason
        });
        serviceResult = result.gate;
        resultingStage = result.stage;
        rationale = `Consumer elected to proceed with legal assessment under limitations: "${overrideReason}"`;
        break;
      }

      case TAI_ACTIONS.GENERATE_ASSESSMENT: {
        // STRICT GATE VERIFICATION: Reject if gate is INCOMPLETE
        const gate = thread.investigationGate || {};
        const isGateSatisfied = Boolean(
          gate.isSatisfied ||
          gate.status === "READY" ||
          gate.status === "PROCEED_WITH_LIMITATIONS"
        );

        if (!isGateSatisfied) {
          const err = new Error(
            `Cannot generate legal assessment before investigation completeness gate is satisfied. Current gate status: ${gate.status || "NOT_EVALUATED"}. Please answer pending questions, upload evidence, or confirm proceeding with limitations.`
          );
          err.statusCode = 400;

          // Record blocked audit event
          await appendAuditTimelineEvent(
            threadId,
            {
              requestedAction: action,
              executedAction: null,
              previousStage,
              resultingStage: previousStage,
              actorType: userId ? "USER" : (guestToken ? "GUEST" : "TAI_SYSTEM"),
              outcome: "BLOCKED",
              rationale: "Assessment generation blocked: Completeness gate is INCOMPLETE.",
              failureReason: err.message
            },
            userId,
            guestToken
          );

          throw err;
        }

        const result = await generateLegalAssessment({ threadId, userId, guestToken });
        serviceResult = {
          assessmentStatus: result.assessment?.status,
          outcomeClassification: result.assessment?.preliminaryAssessment?.outcomeClassification
        };
        resultingStage = result.stage;
        serviceResultId = `assessment_${threadId}`;
        rationale = `Generated balanced 14-section legal assessment. Outcome: ${result.assessment?.preliminaryAssessment?.outcomeClassification}`;
        break;
      }

      case TAI_ACTIONS.REVIEW_TRANSFER_ASSESSMENT: {
        const result = await saveTransferAssessmentReview({
          threadId,
          corrections: params.corrections || {},
          confirmedByConsumer: params.confirmedByConsumer !== false,
          userId,
          guestToken
        });
        serviceResult = result.docket;
        resultingStage = thread.stage;
        rationale = "User reviewed and confirmed AI 2.0 Transfer Assessment Form.";
        break;
      }

      case TAI_ACTIONS.GENERATE_FINAL_OUTCOME: {
        const result = await generateFinalCaseOutcome({ threadId, userId, guestToken });
        serviceResult = {
          outcomeStatus: result.finalCaseOutcome?.status,
          outcomeClassification: result.finalCaseOutcome?.outcomeClassification
        };
        resultingStage = result.stage;
        serviceResultId = `final_outcome_${threadId}`;
        rationale = `Generated Final Case Outcome. Classification: ${result.finalCaseOutcome?.outcomeClassification}`;
        break;
      }

      case TAI_ACTIONS.VIEW_FINAL_OUTCOME: {
        const result = await getFinalCaseOutcome({ threadId, userId, guestToken });
        serviceResult = result.finalCaseOutcome;
        resultingStage = thread.stage;
        rationale = "Retrieved persistent Final Case Outcome.";
        break;
      }

      default: {
        const err = new Error(`Unsupported TAI action "${action}". Must be one of: ${Object.values(TAI_ACTIONS).join(", ")}`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 4. Record successful audit event
    await appendAuditTimelineEvent(
      threadId,
      {
        requestedAction: action,
        executedAction: action,
        previousStage,
        resultingStage,
        actorType: userId ? "USER" : (guestToken ? "GUEST" : "TAI_SYSTEM"),
        outcome: "SUCCESS",
        rationale,
        serviceResultId
      },
      userId,
      guestToken
    );

    // 5. Update TAI metadata
    await updateTaiMetadata(
      threadId,
      {
        lastActionExecuted: action,
        statusNote: rationale
      },
      userId,
      guestToken
    );

    // 6. Reload updated thread and recompute updated plan
    const updatedThread = await getThread(threadId, userId, guestToken);
    const updatedPlan = computeCasePlan(updatedThread);

    return {
      success: true,
      actionExecuted: action,
      previousStage,
      currentStage: resultingStage,
      serviceResult,
      plan: updatedPlan,
      investigation: updatedThread
    };
  } finally {
    // Release execution lock
    activeExecutionLocks.delete(threadId);
  }
}
