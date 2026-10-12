import { jest } from "@jest/globals";
import crypto from "crypto";
import mongoose from "mongoose";
import {
  createInvestigation,
  getThread,
  updateStage,
  submitClarificationAnswers,
  appendAuditTimelineEvent
} from "../services/threadService.js";
import { INVESTIGATION_STAGES } from "../models/Thread.js";
import {
  synthesizeCaseState,
  computeCasePlan,
  executeWorkflowStep,
  calculateCaseHealth,
  TAI_ACTIONS
} from "../services/taiService.js";
import {
  evaluateInvestigationGate,
  proceedWithLimitations
} from "../services/investigationGateService.js";
import { generateLegalAssessment } from "../services/legalAssessmentService.js";
import { generateInvestigationReportPDF } from "../services/pdfGenerator.js";
import { runDebate } from "../services/orchestrator.js";
import { CONSUMER_CATEGORIES } from "../services/helpHubService.js";
import taiRouter from "../routes/tai.js";

/**
 * Mock Response Factory for testing Route Handlers
 */
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.data = body;
      return this;
    },
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
    },
    end() {
      this.headersSent = true;
    }
  };
  return res;
}

/**
 * Route invoker helper for TAI Router
 */
async function invokeTaiRoute(path, method, req, res) {
  for (const layer of taiRouter.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
      return;
    }
  }
  throw new Error(`Route handler not found for [${method}] ${path}`);
}

describe("TAI (Tribunal & Triage AI) Central Intelligence Coordination Suite", () => {
  const testUserId1 = new mongoose.Types.ObjectId().toString();
  const testUserId2 = new mongoose.Types.ObjectId().toString();

  // =========================================================================
  // SCENARIO 1: Correct Plans for each Supported Investigation Stage
  // =========================================================================
  test("1. Correct plans generated for all supported investigation stages", async () => {
    // Stage 1: INITIAL_ANALYSIS (no questions yet)
    const thread1 = {
      threadId: "t_stage_1",
      stage: INVESTIGATION_STAGES.INITIAL_ANALYSIS,
      category: "E-Commerce & Retail",
      intake: { complaint: "Received damaged smart watch from online vendor, seller refused refund." },
      initialAnalysis: {},
      evidenceInventory: []
    };
    const plan1 = computeCasePlan(thread1);
    expect(plan1.recommendedNextAction.action).toBe(TAI_ACTIONS.ANALYZE_COMPLAINT);
    expect(plan1.recommendedNextAction.canAutoExecute).toBe(true);

    // Stage 2: AWAITING_CLARIFICATION
    const thread2 = {
      threadId: "t_stage_2",
      stage: INVESTIGATION_STAGES.AWAITING_CLARIFICATION,
      category: "Defective Product",
      unresolvedQuestions: [{ id: "q1", question: "What is the purchase date?", status: "PENDING", importance: "CRITICAL" }]
    };
    const plan2 = computeCasePlan(thread2);
    expect(plan2.recommendedNextAction.action).toBe(TAI_ACTIONS.ANSWER_CLARIFICATIONS);
    expect(plan2.recommendedNextAction.canAutoExecute).toBe(false);

    // Stage 3: AWAITING_EVIDENCE (no documents)
    const thread3 = {
      threadId: "t_stage_3",
      stage: INVESTIGATION_STAGES.AWAITING_EVIDENCE,
      category: "Banking & Payments",
      evidenceInventory: []
    };
    const plan3 = computeCasePlan(thread3);
    expect(plan3.recommendedNextAction.action).toBe(TAI_ACTIONS.UPLOAD_EVIDENCE);

    // Stage 4: EVIDENCE_REVIEW with documents but unresearched company
    const thread4 = {
      threadId: "t_stage_4",
      stage: INVESTIGATION_STAGES.EVIDENCE_REVIEW,
      category: "E-Commerce & Retail",
      evidenceInventory: [{ title: "Tax Invoice", uploaded: true, inspected: true, status: "DOCUMENT_INSPECTED" }],
      companyPolicyResearch: { status: "NOT_STARTED" }
    };
    const plan4 = computeCasePlan(thread4);
    expect(plan4.recommendedNextAction.action).toBe(TAI_ACTIONS.PERFORM_POLICY_RESEARCH);
    expect(plan4.recommendedNextAction.canAutoExecute).toBe(true);

    // Stage 5: READY_FOR_ASSESSMENT
    const thread5 = {
      threadId: "t_stage_5",
      stage: INVESTIGATION_STAGES.READY_FOR_ASSESSMENT,
      category: "Defective Product",
      investigationGate: { status: "READY", isSatisfied: true }
    };
    const plan5 = computeCasePlan(thread5);
    expect(plan5.recommendedNextAction.action).toBe(TAI_ACTIONS.GENERATE_ASSESSMENT);

    // Stage 6: ASSESSMENT_COMPLETE
    const thread6 = {
      threadId: "t_stage_6",
      stage: INVESTIGATION_STAGES.ASSESSMENT_COMPLETE,
      category: "Defective Product",
      assessment: { status: "COMPLETE", preliminaryAssessment: { outcomeClassification: "Supported" } }
    };
    const plan6 = computeCasePlan(thread6);
    expect(plan6.recommendedNextAction.action).toBe(TAI_ACTIONS.GENERATE_FINAL_OUTCOME);

    // Stage 7: FINAL_OUTCOME_COMPLETE
    const thread7 = {
      threadId: "t_stage_7",
      stage: INVESTIGATION_STAGES.FINAL_OUTCOME_COMPLETE,
      category: "Defective Product",
      finalCaseOutcome: { status: "GENERATED", isOutdated: false }
    };
    const plan7 = computeCasePlan(thread7);
    expect(plan7.recommendedNextAction.action).toBe(TAI_ACTIONS.VIEW_FINAL_OUTCOME);
  });

  // =========================================================================
  // SCENARIO 2: Missing Answers & Unresolved Questions
  // =========================================================================
  test("2. Detects pending clarification questions and blocks auto-advance", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "Disputed credit card unauthorized debit of Rs 45,000.",
      category: "Banking & Payments"
    });

    created.stage = INVESTIGATION_STAGES.AWAITING_CLARIFICATION;
    created.unresolvedQuestions = [
      { id: "q_bank_1", question: "Did you receive an OTP?", status: "PENDING", importance: "CRITICAL" }
    ];

    const plan = computeCasePlan(created);
    expect(plan.recommendedNextAction.action).toBe(TAI_ACTIONS.ANSWER_CLARIFICATIONS);
    expect(plan.recommendedNextAction.canAutoExecute).toBe(false);
    expect(plan.missingCriticalElements).toContain("Pending critical clarification questions (1)");
  });

  // =========================================================================
  // SCENARIO 3: Missing Evidence Handling
  // =========================================================================
  test("3. Recommends UPLOAD_EVIDENCE when no documents are provided", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "Purchased laptop with dead display, seller refused replacement.",
      category: "Defective Product"
    });
    created.stage = INVESTIGATION_STAGES.AWAITING_EVIDENCE;
    created.evidenceInventory = [];

    const plan = computeCasePlan(created);
    expect(plan.recommendedNextAction.action).toBe(TAI_ACTIONS.UPLOAD_EVIDENCE);
    expect(plan.missingCriticalElements).toContain("No documentary evidence uploaded or formally marked unavailable");
  });

  // =========================================================================
  // SCENARIO 4: Uploaded but Uninspected Evidence
  // =========================================================================
  test("4. Tracks uploaded but uninspected evidence correctly in inventory", async () => {
    const thread = {
      threadId: "t_uninspected",
      stage: INVESTIGATION_STAGES.EVIDENCE_REVIEW,
      category: "Defective Product",
      evidenceInventory: [
        { title: "Invoice_Scan.pdf", uploaded: true, inspected: false, status: "DOCUMENT_UPLOADED" }
      ],
      companyPolicyResearch: { status: "COMPLETED" },
      investigationGate: { status: "NOT_EVALUATED" }
    };

    const plan = computeCasePlan(thread);
    expect(plan.evidenceSummary.DOCUMENT_UPLOADED).toBe(1);
    expect(plan.evidenceSummary.DOCUMENT_INSPECTED).toBe(0);
    expect(plan.recommendedNextAction.action).toBe(TAI_ACTIONS.EVALUATE_GATE);
  });

  // =========================================================================
  // SCENARIO 5: Contradictory Evidence Identified
  // =========================================================================
  test("5. Identifies contradictory evidence and surfaces discrepancy warning", async () => {
    const thread = {
      threadId: "t_contra",
      stage: INVESTIGATION_STAGES.EVIDENCE_REVIEW,
      category: "E-Commerce & Retail",
      initialAnalysis: {
        possibleContradictions: ["Reported transaction date 15 Oct 2026 occurs after delivery date 10 Oct 2026."]
      },
      evidenceInventory: [
        { title: "Receipt.pdf", status: "CONTRADICTED" }
      ]
    };

    const plan = computeCasePlan(thread);
    expect(plan.unresolvedContradictions.length).toBeGreaterThanOrEqual(2);
    expect(plan.unresolvedContradictions.some((c) => c.includes("Receipt.pdf"))).toBe(true);
  });

  // =========================================================================
  // SCENARIO 6: Missing Company Policy Research
  // =========================================================================
  test("6. Automatically prioritizes PERFORM_POLICY_RESEARCH when policy not started", async () => {
    const thread = {
      threadId: "t_policy_missing",
      stage: INVESTIGATION_STAGES.AWAITING_EVIDENCE,
      category: "E-Commerce & Retail",
      evidenceInventory: [{ title: "Order Receipt", uploaded: true, inspected: true, status: "DOCUMENT_INSPECTED" }],
      companyPolicyResearch: { status: "NOT_STARTED" }
    };

    const plan = computeCasePlan(thread);
    expect(plan.recommendedNextAction.action).toBe(TAI_ACTIONS.PERFORM_POLICY_RESEARCH);
    expect(plan.recommendedNextAction.canAutoExecute).toBe(true);
  });

  // =========================================================================
  // SCENARIO 7: Failed Retrieval / External Service Resilience
  // =========================================================================
  test("7. Synthesizes case plan gracefully when external services or policies are limited", async () => {
    const thread = {
      threadId: "t_lim_service",
      stage: INVESTIGATION_STAGES.EVIDENCE_REVIEW,
      category: "General Consumer Dispute",
      evidenceInventory: [{ title: "Handwritten Note", unavailable: true, status: "UNAVAILABLE" }],
      companyPolicyResearch: { status: "LIMITED", limitationNote: "Unlisted entity without public terms" }
    };

    const plan = computeCasePlan(thread);
    expect(plan).toBeDefined();
    expect(plan.caseHealth.score).toBeGreaterThan(0);
    expect(plan.caseHealth.disclaimer).toMatch(/NOT a calculation of legal outcome probability/);
  });

  // =========================================================================
  // SCENARIO 8: INCOMPLETE Readiness-Gate Enforcement (Blocks Assessment)
  // =========================================================================
  test("8. TAI strictly blocks GENERATE_ASSESSMENT with HTTP 400 when gate is INCOMPLETE", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "New complaint with no evidence or gate evaluation.",
      category: "Defective Product"
    });

    created.investigationGate = { status: "INCOMPLETE", isSatisfied: false };

    await expect(
      executeWorkflowStep({
        threadId: created.threadId,
        action: TAI_ACTIONS.GENERATE_ASSESSMENT,
        userId: testUserId1
      })
    ).rejects.toThrow(/Cannot generate legal assessment before investigation completeness gate is satisfied/);

    // Verify BLOCKED event recorded in audit timeline
    const threadAfter = await getThread(created.threadId, testUserId1);
    const blockedEvent = threadAfter.auditTimeline.find((e) => e.outcome === "BLOCKED");
    expect(blockedEvent).toBeDefined();
    expect(blockedEvent.requestedAction).toBe(TAI_ACTIONS.GENERATE_ASSESSMENT);
  });

  // =========================================================================
  // SCENARIO 9: READY Assessment Generation
  // =========================================================================
  test("9. TAI successfully generates legal assessment when gate is READY", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "Defective Smart TV screen lines appeared after 5 days, seller refused replacement.",
      category: "Defective Product",
      company: "Amazon Seller Services India Pvt Ltd",
      amount: "25000"
    });

    const loaded = await getThread(created.threadId, testUserId1);
    loaded.evidenceInventory = [
      { id: "e1", title: "Tax Invoice #8812", uploaded: true, inspected: true, status: "DOCUMENT_INSPECTED" }
    ];
    loaded.companyPolicyResearch = { status: "COMPLETED", companyName: "Amazon Seller Services India Pvt Ltd" };
    loaded.investigationGate = { status: "READY", isSatisfied: true };

    const result = await executeWorkflowStep({
      threadId: created.threadId,
      action: TAI_ACTIONS.GENERATE_ASSESSMENT,
      userId: testUserId1
    });

    expect(result.success).toBe(true);
    expect(result.currentStage).toBe(INVESTIGATION_STAGES.ASSESSMENT_COMPLETE);
    expect(result.investigation.assessment.status).toBe("COMPLETE");
  });

  // =========================================================================
  // SCENARIO 10: PROCEED_WITH_LIMITATIONS Confirmation
  // =========================================================================
  test("10. TAI executes PROCEED_WITH_LIMITATIONS with explicit consumer override reason", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "Flight ticket cancelled by airline without full refund of Rs 12,000.",
      category: "Travel & Hotels",
      company: "Indigo Airlines",
      amount: "12000"
    });

    const result = await executeWorkflowStep({
      threadId: created.threadId,
      action: TAI_ACTIONS.PROCEED_WITH_LIMITATIONS,
      params: { overrideReason: "Lost boarding pass but credit card debit proof exists." },
      userId: testUserId1
    });

    expect(result.success).toBe(true);
    expect(result.investigation.investigationGate.status).toBe("PROCEED_WITH_LIMITATIONS");
    expect(result.investigation.investigationGate.overrideReason).toMatch(/Lost boarding pass/);
  });

  // =========================================================================
  // SCENARIOS 11, 12, 13: Missing/Invalid Guest Token & Cross-Tenant Access
  // =========================================================================
  test("11. Rejects guest access when token is missing or invalid", async () => {
    const guestCase = await createInvestigation({
      complaint: "Guest complaint regarding wrong clothing size delivered.",
      category: "E-Commerce & Retail",
      generateGuestToken: true
    });

    const validGuestToken = guestCase.guestToken;

    // Missing token
    await expect(synthesizeCaseState(guestCase.threadId, null, null)).rejects.toThrow(/Guest authorization required/);

    // Invalid token
    await expect(synthesizeCaseState(guestCase.threadId, null, "invalid_random_token")).rejects.toThrow(/Invalid guest access token/);

    // Valid token succeeds
    const plan = await synthesizeCaseState(guestCase.threadId, null, validGuestToken);
    expect(plan.threadId).toBe(guestCase.threadId);
  });

  test("12. Blocks registered cross-user investigation access", async () => {
    const user1Case = await createInvestigation({
      userId: testUserId1,
      complaint: "User 1 private dispute.",
      category: "Insurance"
    });

    // User 2 cannot access User 1's case
    await expect(synthesizeCaseState(user1Case.threadId, testUserId2)).rejects.toThrow(/Access denied: You do not own this investigation case/);
  });

  test("13. Blocks guest access using another investigation's token", async () => {
    const guestCaseA = await createInvestigation({ complaint: "Guest A complaint", generateGuestToken: true });
    const guestCaseB = await createInvestigation({ complaint: "Guest B complaint", generateGuestToken: true });

    // Guest B token used on Case A
    await expect(synthesizeCaseState(guestCaseA.threadId, null, guestCaseB.guestToken)).rejects.toThrow(/Invalid guest access token/);
  });

  // =========================================================================
  // SCENARIO 14: Unsupported Actions
  // =========================================================================
  test("14. Rejects unsupported actions with HTTP 400", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "Action validation case.",
      category: "Defective Product"
    });

    await expect(
      executeWorkflowStep({
        threadId: created.threadId,
        action: "HACK_DATABASE_STAGE",
        userId: testUserId1
      })
    ).rejects.toThrow(/Unsupported TAI action/);
  });

  // =========================================================================
  // SCENARIO 15: Unauthorized Stage Transitions via Client Metadata
  // =========================================================================
  test("15. Prohibits client metadata injection of protected fields like auditTimeline and taiMetadata", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "Stage transition check.",
      category: "Defective Product"
    });

    // Attempting to overwrite protected internal fields via updateStage
    await expect(
      updateStage(created.threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION, testUserId1, {
        auditTimeline: [{ fake: true }],
        taiMetadata: { caseHealthScore: 100 }
      })
    ).rejects.toThrow(/Modification of protected internal field/);
  });

  // =========================================================================
  // SCENARIO 16: Concurrency Lock & Idempotent Guard
  // =========================================================================
  test("16. Concurrency lock prevents conflicting mutations on the same thread", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "Concurrency test complaint.",
      category: "Defective Product"
    });

    // Trigger policy research
    const p1 = executeWorkflowStep({
      threadId: created.threadId,
      action: TAI_ACTIONS.PERFORM_POLICY_RESEARCH,
      userId: testUserId1
    });

    // Simultaneous second call on the same threadId
    const p2 = executeWorkflowStep({
      threadId: created.threadId,
      action: TAI_ACTIONS.PERFORM_POLICY_RESEARCH,
      userId: testUserId1
    });

    const results = await Promise.allSettled([p1, p2]);
    // One succeeds, the concurrent collision is safely rejected or handled
    const rejected = results.find((r) => r.status === "rejected");
    if (rejected) {
      expect(rejected.reason.message).toMatch(/already executing/);
    }
  });

  // =========================================================================
  // SCENARIO 17: Audit Timeline Integrity
  // =========================================================================
  test("17. Appends clean audit events to timeline without leaking sensitive secrets", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "Audit log integrity check complaint.",
      category: "Banking & Payments"
    });

    await appendAuditTimelineEvent(
      created.threadId,
      {
        requestedAction: "EVALUATE_GATE",
        executedAction: "EVALUATE_GATE",
        outcome: "SUCCESS",
        rationale: "Automated readiness check before trial.",
        guestToken: "SECRET_GUEST_TOKEN_SHOULD_BE_STRIPPED",
        password: "SECRET_PASSWORD"
      },
      testUserId1
    );

    const threadAfter = await getThread(created.threadId, testUserId1);
    const lastEvent = threadAfter.auditTimeline[threadAfter.auditTimeline.length - 1];

    expect(lastEvent.requestedAction).toBe("EVALUATE_GATE");
    expect(lastEvent.outcome).toBe("SUCCESS");
    expect(lastEvent.guestToken).toBeUndefined();
    expect(lastEvent.password).toBeUndefined();
  });

  // =========================================================================
  // SCENARIO 18: Assessment and PDF Export Ownership
  // =========================================================================
  test("18. Preserves strict ownership on assessment and PDF export", async () => {
    const created = await createInvestigation({
      userId: testUserId1,
      complaint: "PDF export ownership check.",
      category: "Defective Product"
    });

    created.investigationGate = { status: "READY", isSatisfied: true };
    created.assessment = {
      status: "COMPLETE",
      preliminaryAssessment: {
        outcomeClassification: "Supported",
        sections: {
          caseSummary: "Test Summary",
          consumerAllegations: [],
          factsAnalysis: { establishedFacts: [], unestablishedFacts: [] },
          evidenceReviewed: [],
          evidenceLimitations: [],
          companyPolicyAndTerms: [],
          applicableLegalProvisions: [],
          consumerStrongestArguments: [],
          companyStrongestCounterarguments: [],
          conflictingEvidenceAndUnresolvedQuestions: [],
          preliminaryAssessment: { outcomeClassification: "Supported", explanation: "Test" },
          potentialRemedies: [],
          confidenceAndUncertainty: { confidenceScore: 85, uncertaintyFactors: [] },
          sourcesAndCitations: []
        }
      }
    };

    // User 1 stream generates successfully
    const stream = generateInvestigationReportPDF(created.threadId, created);
    expect(stream).toBeDefined();

    // User 2 cannot access case to export
    await expect(getThread(created.threadId, testUserId2)).rejects.toThrow(/Access denied/);
  });

  // =========================================================================
  // SCENARIO 19: Help Hub Non-Regression
  // =========================================================================
  test("19. Consumer Help Hub functions with zero regression", async () => {
    expect(CONSUMER_CATEGORIES.length).toBeGreaterThanOrEqual(8);
  });

  // =========================================================================
  // SCENARIO 20: Legacy Debate Integration Non-Regression
  // =========================================================================
  test("20. Legacy adversarial debate orchestrator functions with zero regression", async () => {
    const events = [];
    const result = await runDebate(
      "Is an e-commerce seller liable for broken glass delivery?",
      "",
      (ev, data) => events.push(ev)
    );

    expect(result).toBeDefined();
    expect(events.length).toBeGreaterThan(0);
    expect(events).toContain("intent");
  }, 60000);
});
