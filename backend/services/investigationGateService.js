import { Thread, INVESTIGATION_STAGES } from "../models/Thread.js";
import { getThread, updateStage, memoryStore } from "./threadService.js";
import { compileStructuredContradictions } from "./contradictionService.js";

/**
 * Evaluates the investigation completeness gate server-side before legal assessment.
 * Evaluates facts, clarification answers, contradictions, evidence inventory,
 * and company policy research according to dispute category.
 * 
 * @param {object} params
 * @param {string} params.threadId
 * @param {string|null} [params.userId]
 * @param {string|null} [params.guestToken]
 * @param {boolean} [params.proceedWithLimitationsOverride]
 * @param {string} [params.overrideReason]
 * @returns {Promise<object>} Gate evaluation result and updated investigation
 */
export async function evaluateInvestigationGate({
  threadId,
  userId = null,
  guestToken = null,
  proceedWithLimitationsOverride = false,
  overrideReason = ""
}) {
  if (!threadId) throw new Error("threadId is required.");

  const thread = await getThread(threadId, userId, guestToken);
  if (!thread) {
    const err = new Error(`Investigation with threadId "${threadId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  const intake = thread.intake || {};
  const initialAnalysis = thread.initialAnalysis || {};
  const unresolvedQuestions = thread.unresolvedQuestions || [];
  const clarificationHistory = thread.clarificationHistory || [];
  const evidenceInventory = thread.evidenceInventory || [];
  const userReportedFacts = thread.userReportedFacts || [];
  const companyPolicyResearch = thread.companyPolicyResearch || {};
  const category = (thread.category || initialAnalysis.disputeCategory || "General Consumer Dispute").trim();

  const missingCriticalEvidence = [];
  const contradictionsIdentified = [];
  const unansweredQuestions = [];
  const limitationsDisclosed = [];

  // 1. Evaluate Essential Facts & Chronology
  const hasComplaint = Boolean(intake.complaint && intake.complaint.trim().length >= 10);
  const hasCompany = Boolean(intake.company && intake.company.trim() && intake.company !== "Not provided");
  const hasAmount = Boolean(intake.amount && intake.amount.trim() && intake.amount !== "Not provided");
  const hasDate = Boolean(
    initialAnalysis.purchaseOrServiceDate &&
    initialAnalysis.purchaseOrServiceDate !== "Not provided" &&
    initialAnalysis.purchaseOrServiceDate.trim()
  ) || clarificationHistory.some((h) => h.question?.toLowerCase().includes("date") || h.answerText?.match(/\d{4}/));

  const essentialFactsComplete = hasComplaint && (hasCompany || hasAmount || hasDate);

  // 2. Evaluate Unresolved Contradictions
  const detectedContradictions = Array.isArray(initialAnalysis.possibleContradictions)
    ? initialAnalysis.possibleContradictions
    : [];

  for (const c of detectedContradictions) {
    // Check if user answered a clarification addressing the contradiction
    const addressed = clarificationHistory.some(
      (h) => h.question?.toLowerCase().includes("discrepancy") || h.question?.toLowerCase().includes("sequence of dates")
    );
    if (!addressed) {
      contradictionsIdentified.push(c);
    }
  }

  // Also check if any uploaded evidence contradicted consumer's stated claims
  const contradictedDocs = evidenceInventory.filter((doc) => doc.status === "CONTRADICTED");
  if (contradictedDocs.length > 0) {
    contradictionsIdentified.push(
      `Evidence discrepancy noted in: ${contradictedDocs.map((d) => d.title).join(", ")}`
    );
  }

  // 3. Evaluate Clarification Questions
  const pendingCritical = unresolvedQuestions.filter(
    (q) => q.status === "PENDING" && q.importance === "CRITICAL"
  );
  if (pendingCritical.length > 0) {
    unansweredQuestions.push(...pendingCritical.map((q) => q.question));
  }

  const clarificationComplete = Boolean(
    thread.isClarificationComplete ||
    unresolvedQuestions.length === 0 ||
    pendingCritical.length === 0
  );

  // 4. Evaluate Evidence Inventory (Category-Aware & Relevance-Grounded)
  const uploadedDocs = evidenceInventory.filter((doc) => doc.uploaded);
  const inspectedDocs = evidenceInventory.filter((doc) => doc.inspected);
  const relevantDocs = inspectedDocs.filter(
    (doc) => doc.relevance === "RELEVANT" || doc.relevance === "PARTIALLY_RELEVANT"
  );
  const unrelatedDocs = inspectedDocs.filter((doc) => doc.relevance === "UNRELATED");
  const unavailableDocs = evidenceInventory.filter((doc) => doc.unavailable);

  let evidenceSatisfied = false;
  if (relevantDocs.length > 0) {
    evidenceSatisfied = true;
    if (unrelatedDocs.length > 0) {
      limitationsDisclosed.push(
        `Note: ${unrelatedDocs.length} uploaded document(s) (${unrelatedDocs.map((d) => d.title).join(", ")}) were flagged as unrelated to the complaint issue and excluded from substantive claims.`
      );
    }
  } else if (unrelatedDocs.length > 0) {
    // Only unrelated documents uploaded - does NOT satisfy readiness gate
    evidenceSatisfied = false;
    missingCriticalEvidence.push(
      `Uploaded document (${unrelatedDocs.map((d) => d.title).join(", ")}) appears unrelated to your ${category} complaint (${unrelatedDocs[0]?.relevanceReason || "domain mismatch"}). Relevant evidence (e.g., booking confirmation, PNR receipt, cancellation advice, or refund correspondence) is required, or you must mark it unavailable.`
    );
    limitationsDisclosed.push(
      `Evidence mismatch: Uploaded document (${unrelatedDocs.map((d) => d.title).join(", ")}) does not substantiate the ${category} complaint.`
    );
  } else if (uploadedDocs.length > 0) {
    const hasPossibleRelevant = uploadedDocs.some((d) => d.relevance !== "UNRELATED");
    if (hasPossibleRelevant) {
      evidenceSatisfied = true;
      limitationsDisclosed.push("Uploaded documents contain images/scans not yet OCR-indexed; assessment relies on consumer-reported values.");
    } else {
      evidenceSatisfied = false;
      missingCriticalEvidence.push("Uploaded documents do not correspond to the complaint category.");
    }
  } else if (unavailableDocs.length > 0) {
    // Consumer marked primary document as unavailable with reason
    evidenceSatisfied = false; // requires proceed with limitations
    limitationsDisclosed.push(
      `Primary documentary evidence unavailable: ${unavailableDocs.map((d) => `${d.title} (${d.unavailableReason || "Not available"})`).join("; ")}. Assessment will proceed based on secondary facts.`
    );
  } else {
    // No evidence uploaded and none marked unavailable
    evidenceSatisfied = false;
    missingCriticalEvidence.push(
      `Supporting documents (e.g. ${category.includes("Bank") ? "Bank Statement" : (category.includes("Travel") || category.includes("Flight") || category.includes("Aviation")) ? "Ticket / PNR Receipt / Cancellation Advice" : category.includes("Insurance") ? "Policy / Rejection Letter" : "Purchase Invoice / Receipt"}) neither uploaded nor marked as unavailable.`
    );
  }

  // 5. Evaluate Company Policy Research
  const policyResearchCompleted = Boolean(
    companyPolicyResearch.status &&
    companyPolicyResearch.status !== "NOT_STARTED"
  );
  if (!policyResearchCompleted) {
    limitationsDisclosed.push("Company policy research not yet conducted. Default statutory CPA 2019 standards apply.");
  }

  // Evaluation Checklist
  const evaluationChecklist = {
    essentialFactsComplete,
    clarificationComplete,
    clarificationsAnswered: clarificationComplete,
    evidenceSatisfied,
    evidenceUploaded: evidenceSatisfied,
    policyResearchCompleted,
    policyResearched: policyResearchCompleted,
    noUnresolvedContradictions: contradictionsIdentified.length === 0
  };

  // Determine Gate Status
  let gateStatus = "INCOMPLETE";

  const effectiveOverride = proceedWithLimitationsOverride || Boolean(thread.investigationGate?.proceedWithoutEvidenceOverride);
  let effectiveOverrideReason = overrideReason || thread.investigationGate?.overrideReason || "";

  const allStrictCriteriaMet =
    essentialFactsComplete &&
    clarificationComplete &&
    evidenceSatisfied &&
    contradictionsIdentified.length === 0;

  if (allStrictCriteriaMet) {
    gateStatus = "READY";
  } else if (effectiveOverride) {
    // Consumer explicitly requests or previously confirmed to proceed despite missing documents or minor limitations
    if (essentialFactsComplete && unansweredQuestions.length === 0) {
      gateStatus = "PROCEED_WITH_LIMITATIONS";
      if (!effectiveOverrideReason) {
        effectiveOverrideReason = "Consumer chose to proceed with legal assessment based on available facts and disclosed evidentiary limitations.";
      }
      overrideReason = effectiveOverrideReason;
    } else {
      // Cannot override if essential facts are completely absent
      gateStatus = "INCOMPLETE";
      if (!essentialFactsComplete) {
        limitationsDisclosed.push("Cannot proceed: Essential complaint facts (intake details) are entirely missing.");
      }
    }
  } else {
    // If only evidence is missing or marked unavailable, consumer can proceed with limitations
    if (essentialFactsComplete && clarificationComplete && contradictionsIdentified.length === 0) {
      if (unavailableDocs.length > 0 || missingCriticalEvidence.length > 0) {
        gateStatus = "INCOMPLETE"; // requires explicit consumer consent to proceed with limitations
      }
    }
  }

  // Build explicit auditable lists of satisfied vs outstanding requirements
  const satisfiedRequirements = [];
  const outstandingRequirements = [];

  if (essentialFactsComplete) {
    satisfiedRequirements.push("Essential complaint facts & transaction context documented.");
  } else {
    outstandingRequirements.push("Essential complaint details (product/company/amount) incomplete.");
  }

  if (clarificationComplete) {
    satisfiedRequirements.push("Complaint-specific clarification questions completed.");
  } else {
    outstandingRequirements.push(`Pending critical questions require consumer response (${unansweredQuestions.length} remaining).`);
  }

  if (relevantDocs.length > 0) {
    satisfiedRequirements.push(`Relevant documentary evidence inspected (${relevantDocs.map((d) => d.title).join(", ")}).`);
  } else if (unrelatedDocs.length > 0) {
    outstandingRequirements.push(`Uploaded document (${unrelatedDocs.map((d) => d.title).join(", ")}) is unrelated to ${category}. Relevant evidence required.`);
  } else if (uploadedDocs.length > 0) {
    satisfiedRequirements.push("Documents uploaded (awaiting OCR/deep indexing).");
  } else if (unavailableDocs.length > 0 && gateStatus === "PROCEED_WITH_LIMITATIONS") {
    satisfiedRequirements.push("Document unavailability documented with stated reasons; proceeding with disclosed limitations.");
  } else {
    outstandingRequirements.push("Primary supporting evidence neither uploaded nor marked unavailable with reason.");
  }

  if (contradictionsIdentified.length === 0) {
    satisfiedRequirements.push("No unresolved chronological or transactional contradictions detected.");
  } else {
    outstandingRequirements.push(`Factual discrepancies require clarification: ${contradictionsIdentified.join("; ")}`);
  }

  if (policyResearchCompleted) {
    satisfiedRequirements.push("Opposite party published policy research conducted.");
  } else {
    limitationsDisclosed.push("Merchant policy research not yet finalized; statutory Consumer Protection Act benchmarks apply.");
  }

  // Explicit decision rationale
  let decisionReason = "";
  if (gateStatus === "READY") {
    decisionReason = "All essential factual, evidentiary, and clarification prerequisites are satisfied. Proceeding to formal legal assessment.";
  } else if (gateStatus === "PROCEED_WITH_LIMITATIONS") {
    decisionReason = overrideReason || "Proceeding with legal assessment under documented evidentiary limitations confirmed by the consumer.";
  } else {
    decisionReason = `Investigation readiness gate INCOMPLETE. Outstanding prerequisites: ${outstandingRequirements.join(" | ")}`;
  }

  const structuredContradictions = compileStructuredContradictions(thread);

  if (gateStatus === "PROCEED_WITH_LIMITATIONS" && contradictionsIdentified.length > 0) {
    limitationsDisclosed.push("Proceeding under documented factual/evidentiary discrepancies; outcome assessment will account for dispute uncertainty.");
  }

  const isSatisfied = gateStatus === "READY" || gateStatus === "PROCEED_WITH_LIMITATIONS";

  const gateRecord = {
    status: gateStatus,
    isSatisfied,
    missingCriticalEvidence,
    contradictionsIdentified,
    structuredContradictions,
    unansweredQuestions,
    limitationsDisclosed,
    satisfiedRequirements,
    outstandingRequirements,
    decisionReason,
    proceedWithoutEvidenceOverride: gateStatus === "PROCEED_WITH_LIMITATIONS",
    overrideReason: gateStatus === "PROCEED_WITH_LIMITATIONS" ? overrideReason : null,
    evaluationChecklist,
    evaluatedAt: new Date()
  };

  // If gate is satisfied, update stage to READY_FOR_ASSESSMENT
  let updatedStage = thread.stage;
  if (isSatisfied && thread.stage !== INVESTIGATION_STAGES.READY_FOR_ASSESSMENT && thread.stage !== INVESTIGATION_STAGES.ASSESSMENT_COMPLETE) {
    updatedStage = INVESTIGATION_STAGES.READY_FOR_ASSESSMENT;
  }

  // Persist gate record and updated stage
  if (thread._id && typeof Thread.findOneAndUpdate === "function") {
    try {
      await Thread.findOneAndUpdate(
        { threadId },
        {
          $set: {
            investigationGate: gateRecord,
            stage: updatedStage,
            updatedAt: new Date()
          }
        },
        { new: true }
      );
    } catch (e) {
      console.warn("⚠️ MongoDB gate update warning:", e.message);
    }
  }

  thread.investigationGate = gateRecord;
  thread.stage = updatedStage;
  thread.updatedAt = new Date();
  if (memoryStore) memoryStore.set(threadId, thread);

  return {
    gate: gateRecord,
    isSatisfied,
    stage: updatedStage,
    investigation: thread
  };
}

/**
 * Convenient helper to proceed through the completeness gate with limitations
 */
export async function proceedWithLimitations({
  threadId,
  userId = null,
  guestToken = null,
  overrideReason = ""
}) {
  return evaluateInvestigationGate({
    threadId,
    userId,
    guestToken,
    proceedWithLimitationsOverride: true,
    overrideReason: overrideReason || "Consumer explicitly confirmed proceeding with legal assessment under documented evidentiary limitations."
  });
}
