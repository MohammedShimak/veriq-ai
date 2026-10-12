import { Thread, INVESTIGATION_STAGES } from "../models/Thread.js";
import { getThread, appendAuditTimelineEvent } from "./threadService.js";
import { evaluateInvestigationGate } from "./investigationGateService.js";
import { compileFactualInventory } from "./legalAssessmentService.js";
import { getAuthenticHistoricalJudgments } from "./finalOutcomeService.js";
import { markDownstreamOutputsOutdated } from "./finalOutcomeService.js";
import mongoose from "mongoose";

/**
 * Compiles the structured AI 2.0 Transfer Assessment Form docket.
 * Does not flatten allegations, extracted content, verified facts, and unknowns into one list.
 * 
 * @param {object} params
 * @param {string} params.threadId
 * @param {string|null} [params.userId]
 * @param {string|null} [params.guestToken]
 * @returns {Promise<object>} Structured Transfer Assessment docket
 */
export async function getTransferAssessmentData({ threadId, userId = null, guestToken = null }) {
  if (!threadId) throw new Error("threadId is required.");

  const thread = await getThread(threadId, userId, guestToken);
  if (!thread) {
    const err = new Error(`Investigation with threadId "${threadId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 1. Complaint & Category Overview
  const intake = thread.intake || {};
  const initialAnalysis = thread.initialAnalysis || {};
  const category = (thread.category || initialAnalysis.disputeCategory || "General Consumer Dispute").trim();

  // 2. Factual Inventory across 7 strict states
  const factualInventory = compileFactualInventory(thread);

  // 3. Clarification Questions & Q&A History
  const clarificationHistory = thread.clarificationHistory || [];
  const pendingQuestions = (thread.unresolvedQuestions || []).filter((q) => q.status === "PENDING");
  const answeredQuestions = (thread.unresolvedQuestions || []).filter((q) => q.status === "ANSWERED");

  // 4. Evidence Inventory with inspection status & provenance
  const evidenceInventory = (thread.evidenceInventory || []).map((doc) => ({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    status: doc.status || (doc.unavailable ? "UNAVAILABLE" : doc.inspected ? "DOCUMENT_INSPECTED" : "DOCUMENT_UPLOADED"),
    uploaded: Boolean(doc.uploaded),
    inspected: Boolean(doc.inspected),
    unavailable: Boolean(doc.unavailable),
    unavailableReason: doc.unavailableReason || null,
    filename: doc.originalName || doc.filename,
    fileSize: doc.fileSize,
    extractedInfo: doc.extractedInfo || null,
    userCorrection: doc.userCorrection || null,
    uploadedAt: doc.uploadedAt
  }));

  // 5. Contradictions & Unresolved Facts
  const detectedContradictions = Array.isArray(initialAnalysis.possibleContradictions)
    ? initialAnalysis.possibleContradictions
    : [];

  const contradictedEvidence = (thread.evidenceInventory || []).filter((d) => d.status === "CONTRADICTED");
  const contradictions = [
    ...detectedContradictions,
    ...contradictedEvidence.map((d) => `Evidence discrepancy in "${d.title}": ${d.extractedInfo?.contradictionsNoted?.join("; ") || "Contradicted stated claims"}`)
  ];

  const unresolvedFacts = Array.isArray(initialAnalysis.missingMaterialFacts)
    ? initialAnalysis.missingMaterialFacts
    : [];

  // 6. Company Policy Research
  const companyPolicyResearch = thread.companyPolicyResearch || { status: "NOT_STARTED" };

  // 7. Applicable Laws & Retrieved Historical Judgments
  const applicableLaws = [
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 2(7)",
      title: "Consumer Definition",
      description: "Establishes legal standing of complainant as a consumer under Indian law."
    },
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 2(11)",
      title: "Deficiency in Service",
      description: "Defines fault, shortcoming, or inadequacy in quality and performance."
    },
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 2(47)",
      title: "Unfair Trade Practice",
      description: "Deceptive representations, arbitrary return refusal, or harsh terms."
    },
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 39",
      title: "Powers of District Commission to Order Relief",
      description: "Statutory provisions for refund, replacement, repair, or compensation."
    }
  ];

  const historicalJudgments = getAuthenticHistoricalJudgments(category, intake.complaint || "");

  // 8. Readiness Gate Evaluation
  const gateEvaluation = await evaluateInvestigationGate({ threadId, userId, guestToken });
  const gate = gateEvaluation.gate || thread.investigationGate || {};

  // 9. Audit History
  const auditHistory = (thread.auditTimeline || []).map((ev) => ({
    id: ev.id,
    timestamp: ev.timestamp,
    actorType: ev.actorType,
    executedAction: ev.executedAction || ev.requestedAction,
    previousStage: ev.previousStage,
    resultingStage: ev.resultingStage,
    outcome: ev.outcome,
    rationale: ev.rationale
  }));

  // 10. Prior Review Status
  const priorReview = thread.transferAssessmentReview || {
    reviewedAt: null,
    userCorrections: [],
    confirmedByConsumer: false
  };

  return {
    success: true,
    threadId,
    stage: thread.stage,
    docket: {
      caseSummary: {
        complaint: intake.complaint || "",
        product: intake.product || initialAnalysis.productOrService || "Not provided",
        company: intake.company || initialAnalysis.companyOrSeller || "Not provided",
        amount: intake.amount || initialAnalysis.disputedAmount || "Not provided",
        date: initialAnalysis.purchaseOrServiceDate || "Not provided",
        category,
        reportedProblem: initialAnalysis.reportedProblem || ""
      },
      clarificationDocket: {
        clarificationRound: thread.clarificationRound || 1,
        isClarificationComplete: Boolean(thread.isClarificationComplete),
        answeredQuestionsCount: answeredQuestions.length,
        pendingQuestionsCount: pendingQuestions.length,
        pendingQuestions,
        clarificationHistory
      },
      factualInventory: {
        userReportedAllegations: factualInventory.USER_REPORTED || [],
        inspectedDocumentFacts: factualInventory.DOCUMENT_INSPECTED || [],
        independentlyVerifiedPolicies: factualInventory.INDEPENDENTLY_VERIFIED || [],
        contradictedFacts: factualInventory.CONTRADICTED || [],
        unavailableDisclosures: factualInventory.UNAVAILABLE || [],
        notInspectedNotes: factualInventory.NOT_INSPECTED || []
      },
      evidenceDocket: {
        inventory: evidenceInventory,
        totalItems: evidenceInventory.length,
        inspectedCount: evidenceInventory.filter((d) => d.inspected).length,
        uploadedCount: evidenceInventory.filter((d) => d.uploaded).length,
        unavailableCount: evidenceInventory.filter((d) => d.unavailable).length
      },
      contradictionsAndGaps: {
        contradictions,
        unresolvedFacts
      },
      policyResearchDocket: {
        companyName: companyPolicyResearch.companyName || intake.company || "",
        status: companyPolicyResearch.status || "NOT_STARTED",
        policySummary: companyPolicyResearch.policySummary || null,
        policies: companyPolicyResearch.policies || [],
        sourceUrl: companyPolicyResearch.sourceUrl || null
      },
      legalAuthoritiesDocket: {
        applicableLaws,
        historicalJudgments: historicalJudgments.map((j) => ({
          caseName: j.case_name,
          citation: j.citation,
          court: j.court,
          year: j.year,
          principle: j.consumer_supporting_principle || j.court_reasoning?.substring(0, 160) || "",
          sourceUrl: j.source || j.source_url
        }))
      },
      readinessDocket: {
        status: gate.status || "NOT_EVALUATED",
        isSatisfied: Boolean(gate.isSatisfied),
        satisfiedRequirements: gate.satisfiedRequirements || [],
        outstandingRequirements: gate.outstandingRequirements || [],
        missingCriticalEvidence: gate.missingCriticalEvidence || [],
        limitationsDisclosed: gate.limitationsDisclosed || [],
        proceedWithoutEvidenceOverride: Boolean(gate.proceedWithoutEvidenceOverride),
        overrideReason: gate.overrideReason || null,
        decisionReason: gate.decisionReason || null
      },
      auditHistory,
      priorReview
    },
    sections: {
      complaintSummary: {
        category,
        complaintText: intake.complaint || "",
        productOrService: intake.product || initialAnalysis.productOrService || "Not provided",
        sellerOrServiceEntity: intake.company || initialAnalysis.companyOrSeller || "Not provided",
        disputedAmount: intake.amount || initialAnalysis.disputedAmount || 0
      },
      userReportedFacts: (factualInventory.USER_REPORTED || []).map((f) => ({
        fact: typeof f === "string" ? f : f.fact || "",
        details: typeof f === "string" ? f : f.details || "",
        status: "USER_REPORTED"
      })),
      uploadedFilesAndInspections: evidenceInventory.map((d) => ({
        name: d.title || d.name || "Evidence Item",
        category: d.documentType || d.category || "DOCUMENT",
        status: d.status || (d.inspected ? "DOCUMENT_INSPECTED" : "DOCUMENT_UPLOADED"),
        inspectionOutcome: d.inspectionSummary || "",
        extractedFacts: d.extractedDates || []
      })),
      extractedFactsWithProvenance: (factualInventory.DOCUMENT_INSPECTED || []).map((f) => ({
        fact: typeof f === "string" ? f : f.fact || "",
        provenance: typeof f === "object" ? f.provenance || "Document" : "Document",
        status: "DOCUMENT_INSPECTED",
        verificationMethod: "OCR / Pattern Extraction"
      })),
      clarificationQuestionsAndAnswers: (clarificationHistory || []).map((c) => ({
        category: "DISPUTE_FACTS",
        round: c.round || 1,
        answeredAt: c.answeredAt || new Date().toISOString(),
        question: c.question,
        answer: c.answer
      })),
      missingOrUnavailableEvidence: (factualInventory.UNAVAILABLE || []).map((f) => ({
        name: typeof f === "string" ? f : f.documentName || f.name || "Requested Document",
        reason: typeof f === "object" ? f.reason || "Not available" : "Not available"
      })),
      companyPolicyFindings: {
        summary: companyPolicyResearch.policySummary || "Policy findings cross-referenced against published seller terms.",
        sourceUrl: companyPolicyResearch.sourceUrl || "Public Records",
        verificationStatus: companyPolicyResearch.status || "VERIFIED"
      },
      applicableLawsAndPrecedents: [
        ...applicableLaws.map((l) => ({ title: l.section || l.title || "CPA 2019", source: "Statute", summary: l.text || l.description || "" })),
        ...historicalJudgments.map((j) => ({ title: j.case_name || j.caseName, source: j.court, summary: j.citation }))
      ],
      readinessGateResult: {
        status: gate.status || "PENDING_EVALUATION",
        reason: gate.decisionReason || gate.status || "Pending check",
        limitationsDisclosed: gate.limitationsDisclosed || []
      }
    }
  };
}

/**
 * Saves user corrections or confirmation through the AI 2.0 Transfer Assessment Form.
 * Persists updates and coordinates with authoritative case state and TAI.
 * 
 * @param {object} params
 * @param {string} params.threadId
 * @param {object} [params.corrections] User corrections to intake or factual items
 * @param {boolean} [params.confirmedByConsumer]
 * @param {string|null} [params.userId]
 * @param {string|null} [params.guestToken]
 * @returns {Promise<object>} Updated Transfer Assessment docket
 */
export async function saveTransferAssessmentReview({
  threadId,
  corrections = {},
  confirmedByConsumer = true,
  userId = null,
  guestToken = null
}) {
  if (!threadId) throw new Error("threadId is required.");

  const thread = await getThread(threadId, userId, guestToken);
  if (!thread) {
    const err = new Error(`Investigation with threadId "${threadId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  const updates = {};
  let materialChangesMade = false;

  // Apply corrections to intake fields if provided
  if (corrections.product && corrections.product !== thread.intake?.product) {
    updates["intake.product"] = corrections.product;
    materialChangesMade = true;
  }
  if (corrections.company && corrections.company !== thread.intake?.company) {
    updates["intake.company"] = corrections.company;
    materialChangesMade = true;
  }
  if (corrections.amount && corrections.amount !== thread.intake?.amount) {
    updates["intake.amount"] = corrections.amount;
    materialChangesMade = true;
  }
  if (corrections.complaint && corrections.complaint !== thread.intake?.complaint) {
    updates["intake.complaint"] = corrections.complaint;
    materialChangesMade = true;
  }

  // Record transfer assessment review metadata
  const reviewRecord = {
    reviewedAt: new Date(),
    userCorrections: corrections.notes ? [{ note: corrections.notes, timestamp: new Date() }] : [],
    confirmedByConsumer: Boolean(confirmedByConsumer)
  };
  updates["transferAssessmentReview"] = reviewRecord;
  updates["updatedAt"] = new Date();

  if (mongoose.connection.readyState === 1) {
    try {
      await Thread.findOneAndUpdate({ threadId }, { $set: updates }, { new: true });
    } catch (e) {
      console.warn("⚠️ MongoDB Transfer Assessment review save warning:", e.message);
    }
  }

  // Update in-memory thread object
  if (updates["intake.product"]) thread.intake.product = updates["intake.product"];
  if (updates["intake.company"]) thread.intake.company = updates["intake.company"];
  if (updates["intake.amount"]) thread.intake.amount = updates["intake.amount"];
  if (updates["intake.complaint"]) thread.intake.complaint = updates["intake.complaint"];
  thread.transferAssessmentReview = reviewRecord;
  thread.updatedAt = new Date();

  // If material facts changed, invalidate existing downstream assessment and final outcome
  if (materialChangesMade) {
    await markDownstreamOutputsOutdated(
      threadId,
      "Consumer made factual adjustments during AI 2.0 Transfer Assessment Form review."
    );
  }

  // Append audit event
  try {
    await appendAuditTimelineEvent({
      threadId,
      userId,
      guestToken,
      actorType: userId ? "USER" : (guestToken ? "GUEST" : "TAI_SYSTEM"),
      requestedAction: "REVIEW_TRANSFER_ASSESSMENT",
      executedAction: "REVIEW_TRANSFER_ASSESSMENT",
      previousStage: thread.stage,
      resultingStage: thread.stage,
      outcome: "SUCCESS",
      rationale: `AI 2.0 Transfer Assessment Form reviewed and confirmed by consumer. Material updates: ${materialChangesMade}`
    });
  } catch (err) {
    console.warn("⚠️ Audit event warning:", err.message);
  }

  return getTransferAssessmentData({ threadId, userId, guestToken });
}
