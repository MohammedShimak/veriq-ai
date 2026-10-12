import { jest } from "@jest/globals";
import crypto from "crypto";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import {
  createInvestigation,
  getThread,
  updateStage,
  submitClarificationAnswers
} from "../services/threadService.js";
import { Thread, INVESTIGATION_STAGES } from "../models/Thread.js";
import {
  evaluateInvestigationGate,
  proceedWithLimitations
} from "../services/investigationGateService.js";
import {
  generateFollowUpQuestions
} from "../services/investigationAnalysis.js";
import {
  uploadAndInspectEvidence,
  markDocumentUnavailable,
  EVIDENCE_STATUSES
} from "../services/evidenceService.js";
import { generateLegalAssessment } from "../services/legalAssessmentService.js";
import { generateVerdictPDF, generateInvestigationReportPDF } from "../services/pdfGenerator.js";
import { judgeAgent } from "../agents/judgeAgent.js";
import { getJudgePrompt } from "../prompts/judgePrompt.js";
import debateRouter from "../routes/debate.js";

/**
 * Mock Response Factory for testing Route Handlers
 */
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    headersSent: false,
    writtenChunks: [],
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
    write(chunk) {
      this.writtenChunks.push(chunk);
    },
    end() {
      this.headersSent = true;
    }
  };
  return res;
}

/**
 * Route invoker helper for Debate Router
 */
async function invokeDebateRoute(req, res) {
  for (const layer of debateRouter.stack) {
    if (layer.route && layer.route.path === "/" && layer.route.methods.post) {
      const handlers = layer.route.stack;
      const finalHandler = handlers[handlers.length - 1].handle;
      await finalHandler(req, res);
      return;
    }
  }
  throw new Error("Route handler for POST / not found in debate router");
}

/**
 * Safe helper to update test thread in memory and MongoDB without connection hangs
 */
async function updateTestThread(threadId, updates, userId = null, guestToken = null) {
  const thread = await getThread(threadId, userId, guestToken);
  if (thread) {
    Object.assign(thread, updates);
  }
  if (mongoose.connection.readyState === 1) {
    await Thread.findOneAndUpdate({ threadId }, { $set: updates });
  }
  return thread;
}

describe("Courtroom Workflow, Readiness Gate & Anti-Premature Verdict Regression Suite", () => {
  const testUserId1 = new mongoose.Types.ObjectId().toString();
  const testUserId2 = new mongoose.Types.ObjectId().toString();

  // =========================================================================
  // TEST 1: Complaint with pending clarification questions blocks assessment
  // =========================================================================
  test("1. Pending clarification questions causes gate to evaluate as INCOMPLETE", async () => {
    const thread = await createInvestigation({
      complaint: "Bought mobile phone for 20000. Stopped charging after 5 days.",
      category: "Defective Product / Electronics",
      product: "Smartphone X",
      company: "TechStore",
      amount: "20000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        unresolvedQuestions: [
          {
            id: "q_charge_1",
            question: "Did you use the original charger and cable provided in the box?",
            type: "single_choice",
            importance: "CRITICAL",
            status: "PENDING"
          }
        ]
      },
      testUserId1
    );

    const gateResult = await evaluateInvestigationGate({
      threadId: thread.threadId,
      userId: testUserId1
    });

    expect(gateResult.isSatisfied).toBe(false);
    expect(gateResult.gate.status).toBe("INCOMPLETE");
    expect(gateResult.gate.unansweredQuestions.length).toBeGreaterThan(0);
    expect(gateResult.gate.evaluationChecklist.clarificationComplete).toBe(false);
  });

  // =========================================================================
  // TEST 2: AI response containing no questions does not prematurely complete
  // =========================================================================
  test("2. AI returning zero questions falls back to category-aware questions without premature completion", async () => {
    const result = await generateFollowUpQuestions({
      category: "Defective Product / Electronics",
      intake: {
        complaint: "I bought a new mobile phone for ₹20,000. It stopped charging after five days.",
        company: "Seller",
        amount: "20000"
      },
      analysis: {
        missingMaterialFacts: ["Invoice number", "Warranty status", "Notice given to seller"]
      },
      clarificationHistory: [],
      roundNumber: 1
    });

    expect(result.questions).toBeDefined();
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.isComplete).toBe(false);
    expect(result.questions[0].question).toBeDefined();
  }, 20000);

  // =========================================================================
  // TEST 3: Failed question generation falls back gracefully
  // =========================================================================
  test("3. Failed question generation falls back gracefully to category questions", async () => {
    const result = await generateFollowUpQuestions({
      category: "Defective Product / Electronics",
      intake: { complaint: "Device failed" },
      analysis: null,
      clarificationHistory: [],
      roundNumber: 1
    });

    expect(result.questions).toBeDefined();
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.isComplete).toBe(false);
  }, 20000);

  // =========================================================================
  // TEST 4: No supporting documents uploaded blocks gate
  // =========================================================================
  test("4. No supporting documents uploaded causes gate to be INCOMPLETE with missingCriticalEvidence", async () => {
    const thread = await createInvestigation({
      complaint: "Laptop stopped working within warranty period.",
      category: "Defective Product / Electronics",
      company: "ComputerShop",
      amount: "55000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        isClarificationComplete: true,
        unresolvedQuestions: [],
        evidenceInventory: []
      },
      testUserId1
    );

    const gateResult = await evaluateInvestigationGate({
      threadId: thread.threadId,
      userId: testUserId1
    });

    expect(gateResult.isSatisfied).toBe(false);
    expect(gateResult.gate.status).toBe("INCOMPLETE");
    expect(gateResult.gate.missingCriticalEvidence.length).toBeGreaterThan(0);
    expect(gateResult.gate.evaluationChecklist.evidenceSatisfied).toBe(false);
  });

  // =========================================================================
  // TEST 5: Documents marked unavailable tracked without being treated as proof
  // =========================================================================
  test("5. Documents marked unavailable are tracked as unverified, requiring explicit confirmation to proceed", async () => {
    const thread = await createInvestigation({
      complaint: "AC cooling failed, bill misplaced by consumer.",
      category: "Defective Product / Electronics",
      company: "CoolAir",
      amount: "32000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        isClarificationComplete: true,
        unresolvedQuestions: [],
        evidenceInventory: [
          {
            id: "doc_inv_1",
            title: "Purchase Invoice",
            uploaded: false,
            inspected: false,
            unavailable: true,
            unavailableReason: "Paper bill lost during house moving; payment was in cash."
          }
        ]
      },
      testUserId1
    );

    const gateResult = await evaluateInvestigationGate({
      threadId: thread.threadId,
      userId: testUserId1,
      proceedWithLimitationsOverride: false
    });

    expect(gateResult.isSatisfied).toBe(false);
    expect(gateResult.gate.status).toBe("INCOMPLETE");
    expect(gateResult.gate.limitationsDisclosed.some((l) => l.includes("Primary documentary evidence unavailable"))).toBe(true);
  });

  // =========================================================================
  // TEST 6: Uploaded but uninspected evidence noted as limitation
  // =========================================================================
  test("6. Uploaded but uninspected evidence triggers limitation disclosure in gate", async () => {
    const thread = await createInvestigation({
      complaint: "TV screen flickering after delivery.",
      category: "Defective Product / Electronics",
      company: "ScreenStore",
      amount: "40000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        isClarificationComplete: true,
        unresolvedQuestions: [],
        evidenceInventory: [
          {
            id: "doc_1",
            title: "Invoice Photo",
            uploaded: true,
            inspected: false,
            unavailable: false
          }
        ]
      },
      testUserId1
    );

    const gateResult = await evaluateInvestigationGate({
      threadId: thread.threadId,
      userId: testUserId1
    });

    expect(gateResult.gate.limitationsDisclosed.some((l) => l.includes("not yet OCR-indexed"))).toBe(true);
  });

  // =========================================================================
  // TEST 7: Contradictory evidence blocks READY gate status
  // =========================================================================
  test("7. Contradictory evidence blocks READY gate status", async () => {
    const thread = await createInvestigation({
      complaint: "Washing machine delivered broken.",
      category: "Defective Product / Electronics",
      company: "ApplianceMart",
      amount: "25000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        isClarificationComplete: true,
        unresolvedQuestions: [],
        evidenceInventory: [
          {
            id: "doc_contra",
            title: "Delivery Inspection Sheet",
            uploaded: true,
            inspected: true,
            status: "CONTRADICTED"
          }
        ]
      },
      testUserId1
    );

    const gateResult = await evaluateInvestigationGate({
      threadId: thread.threadId,
      userId: testUserId1
    });

    expect(gateResult.isSatisfied).toBe(false);
    expect(gateResult.gate.status).toBe("INCOMPLETE");
    expect(gateResult.gate.contradictionsIdentified.length).toBeGreaterThan(0);
    expect(gateResult.gate.evaluationChecklist.noUnresolvedContradictions).toBe(false);
  });

  // =========================================================================
  // TEST 8: Failed or missing company policy research adds limitation note
  // =========================================================================
  test("8. Unconducted company policy research noted as limitation", async () => {
    const thread = await createInvestigation({
      complaint: "Order cancelled without refund.",
      category: "E-Commerce & Retail",
      company: "ShopZone",
      amount: "5000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        companyPolicyResearch: { status: "NOT_STARTED" },
        isClarificationComplete: true,
        unresolvedQuestions: [],
        evidenceInventory: [
          { id: "e1", title: "Order Email", uploaded: true, inspected: true, status: "VERIFIED" }
        ]
      },
      testUserId1
    );

    const gateResult = await evaluateInvestigationGate({
      threadId: thread.threadId,
      userId: testUserId1
    });

    expect(gateResult.gate.limitationsDisclosed.some((l) => l.includes("Company policy research not yet conducted"))).toBe(true);
  });

  // =========================================================================
  // TEST 9: INCOMPLETE readiness gate blocks legal assessment generation
  // =========================================================================
  test("9. Assessment generation is rejected with descriptive error when gate is INCOMPLETE", async () => {
    const thread = await createInvestigation({
      complaint: "Flight cancelled without alternative.",
      category: "Travel & Hospitality",
      company: "AirFast",
      amount: "12000",
      userId: testUserId1
    });

    await expect(
      generateLegalAssessment({
        threadId: thread.threadId,
        userId: testUserId1
      })
    ).rejects.toThrow(/investigation completeness gate is satisfied/i);
  });

  // =========================================================================
  // TEST 10: READY gate allows assessment generation
  // =========================================================================
  test("10. READY gate permits legal assessment generation", async () => {
    const thread = await createInvestigation({
      complaint: "Defective phone delivered, company refused repair.",
      category: "Defective Product / Electronics",
      company: "PhoneCo",
      amount: "15000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        isClarificationComplete: true,
        unresolvedQuestions: [],
        initialAnalysis: {
          purchaseOrServiceDate: "2026-03-01",
          possibleContradictions: []
        },
        evidenceInventory: [
          {
            id: "doc_ready_1",
            title: "Purchase Invoice",
            uploaded: true,
            inspected: true,
            status: "VERIFIED",
            extractedData: { invoiceAmount: "15000", seller: "PhoneCo" }
          }
        ],
        companyPolicyResearch: { status: "COMPLETED", policiesFound: [] }
      },
      testUserId1
    );

    const gateResult = await evaluateInvestigationGate({
      threadId: thread.threadId,
      userId: testUserId1
    });

    expect(gateResult.isSatisfied).toBe(true);
    expect(gateResult.gate.status).toBe("READY");
  });

  // =========================================================================
  // TEST 11: PROCEED_WITH_LIMITATIONS requires explicit user confirmation
  // =========================================================================
  test("11. PROCEED_WITH_LIMITATIONS explicitly records limitations and confirmation", async () => {
    const thread = await createInvestigation({
      complaint: "Dry cleaning damaged expensive suit, receipt faded.",
      category: "Service Deficiencies",
      company: "QuickClean",
      amount: "8000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        isClarificationComplete: true,
        unresolvedQuestions: [],
        evidenceInventory: [
          {
            id: "doc_faded",
            title: "Bill Copy",
            uploaded: false,
            inspected: false,
            unavailable: true,
            unavailableReason: "Ink completely faded on receipt paper."
          }
        ]
      },
      testUserId1
    );

    const result = await proceedWithLimitations({
      threadId: thread.threadId,
      userId: testUserId1,
      overrideReason: "User confirmed proceeding based on bank transaction debit SMS only."
    });

    expect(result.isSatisfied).toBe(true);
    expect(result.gate.status).toBe("PROCEED_WITH_LIMITATIONS");
    expect(result.gate.proceedWithoutEvidenceOverride).toBe(true);
    expect(result.gate.overrideReason).toContain("bank transaction debit SMS");
  });

  // =========================================================================
  // TEST 12: Direct legacy judge/debate endpoint attempts to bypass gate are rejected
  // =========================================================================
  test("12. Direct POST /api/debate without threadId or on incomplete investigation returns 400", async () => {
    // 12a. Direct call without threadId
    const reqNoThread = {
      body: {
        question: "I bought a mobile phone and it stopped charging. Give me verdict.",
        amount: "20000"
      },
      headers: {},
      user: null
    };
    const resNoThread = createMockRes();
    await invokeDebateRoute(reqNoThread, resNoThread);

    expect(resNoThread.statusCode).toBe(400);
    expect(resNoThread.data.error).toContain("Direct debate bypass rejected");

    // 12b. Call with threadId in AWAITING_CLARIFICATION stage
    const thread = await createInvestigation({
      complaint: "Defective phone",
      category: "Defective Product / Electronics",
      company: "Seller",
      amount: "20000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      { stage: INVESTIGATION_STAGES.AWAITING_CLARIFICATION },
      testUserId1
    );

    const reqIncomplete = {
      body: {
        question: "I want verdict now",
        threadId: thread.threadId
      },
      headers: {},
      user: { _id: testUserId1 }
    };
    const resIncomplete = createMockRes();
    await invokeDebateRoute(reqIncomplete, resIncomplete);

    expect(resIncomplete.statusCode).toBe(400);
    expect(resIncomplete.data.error).toContain("State bypass rejected");
  });

  // =========================================================================
  // TEST 13: Unsupported compensation amounts and court language eliminated
  // =========================================================================
  test("13. Judge prompt and agent eliminate hardcoded 9% interest, ₹15,000, and 'Commission holds' directives", () => {
    const prompt = getJudgePrompt(
      { complaint: "Mobile phone stopped charging", product_or_service: "Phone", claim_amount: "20000" },
      "CPA 2019 legal context",
      { summary: {} },
      { summary: {} }
    );
    expect(prompt).toContain("DO NOT IMPERSONATE A COURT OR COMMISSION");
    expect(prompt).toContain("Do NOT award arbitrary interest rates (such as 9% or any other percentage)");
    expect(prompt).toContain("Do NOT invent arbitrary compensation amounts (such as ₹15,000 for mental agony)");
    expect(prompt).toContain("Do NOT invent arbitrary litigation costs (such as ₹5,000)");
    expect(prompt).toContain("Preliminary AI-Assisted Case Assessment");
    expect(prompt).toContain("DO NOT INVENT OR HARDCODE SPECIFIC MONETARY AWARDS");
    expect(prompt).not.toContain("9% annual interest");
    expect(prompt).not.toContain("award ₹15,000");
    expect(prompt).not.toContain("award ₹5,000");
    expect(prompt).not.toContain("The Commission holds that");
  });

  // =========================================================================
  // TEST 14: Legal citations verified under CPA 2019
  // =========================================================================
  test("14. Judge prompt references authentic CPA 2019 provisions (Section 2(10), 2(11), 38, 39)", () => {
    const prompt = getJudgePrompt(
      { complaint: "Defective electronics", product_or_service: "Device" },
      "",
      { summary: {} },
      { summary: {} }
    );
    expect(prompt).toContain("Section 2(10)");
    expect(prompt).toContain("Section 2(11)");
    expect(prompt).toContain("Section 38");
    expect(prompt).toContain("Section 39");
  });

  // =========================================================================
  // TEST 15: Unauthorized case access is rejected
  // =========================================================================
  test("15. Accessing investigation with different user credentials returns 403 Forbidden", async () => {
    const thread = await createInvestigation({
      complaint: "Private dispute details",
      category: "Banking & Financial Services",
      company: "SecretBank",
      amount: "100000",
      userId: testUserId1
    });

    await expect(
      getThread(thread.threadId, testUserId2)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  // =========================================================================
  // TEST 16: Guest token enforcement
  // =========================================================================
  test("16. Guest investigation requires valid matching guest token", async () => {
    const thread = await createInvestigation({
      complaint: "Guest complaint",
      category: "E-Commerce & Retail",
      company: "ShopNet",
      amount: "1200",
      userId: null,
      generateGuestToken: true
    });

    expect(thread.guestToken).toBeDefined();

    const fetched = await getThread(thread.threadId, null, thread.guestToken);
    expect(fetched).toBeDefined();
    expect(fetched.threadId).toBe(thread.threadId);

    await expect(
      getThread(thread.threadId, null, "invalid-guest-token-12345")
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  // =========================================================================
  // TEST 17: Persistence after page refresh
  // =========================================================================
  test("17. Investigation state, intake, answers, and stage persist across re-fetches", async () => {
    const thread = await createInvestigation({
      complaint: "Persistent complaint test",
      category: "Defective Product / Electronics",
      company: "BrandCorp",
      amount: "25000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        stage: INVESTIGATION_STAGES.AWAITING_CLARIFICATION,
        unresolvedQuestions: [
          { id: "q_persist_1", question: "When did you buy it?", status: "PENDING", importance: "CRITICAL" }
        ]
      },
      testUserId1
    );

    await submitClarificationAnswers(
      thread.threadId,
      [{ questionId: "q_persist_1", question: "When did you buy it?", answer: "Purchased on 1st March 2026" }],
      testUserId1
    );

    await updateStage(thread.threadId, INVESTIGATION_STAGES.AWAITING_EVIDENCE, testUserId1);

    const refreshed = await getThread(thread.threadId, testUserId1);
    expect(refreshed.clarificationHistory.length).toBe(1);
    expect(refreshed.clarificationHistory[0].answerText).toBe("Purchased on 1st March 2026");
    expect(refreshed.userReportedFacts.some((f) => f.text === "Purchased on 1st March 2026")).toBe(true);
    expect(refreshed.stage).toBe(INVESTIGATION_STAGES.AWAITING_EVIDENCE);
  });

  // =========================================================================
  // TEST 18: Complete investigation reaches preliminary assessment
  // =========================================================================
  test("18. Complete investigation produces structured preliminary assessment", async () => {
    const thread = await createInvestigation({
      complaint: "Smartphone stopped charging after five days; invoice and warranty card available.",
      category: "Defective Product / Electronics",
      company: "MobileMart",
      amount: "20000",
      userId: testUserId1
    });

    await updateTestThread(
      thread.threadId,
      {
        isClarificationComplete: true,
        unresolvedQuestions: [],
        initialAnalysis: {
          purchaseOrServiceDate: "2026-03-01",
          possibleContradictions: []
        },
        evidenceInventory: [
          {
            id: "ev_inv",
            title: "Purchase Invoice",
            uploaded: true,
            inspected: true,
            status: "VERIFIED",
            extractedData: { amount: "20000", date: "2026-03-01" }
          }
        ],
        companyPolicyResearch: { status: "COMPLETED", policiesFound: [] }
      },
      testUserId1
    );

    const gate = await evaluateInvestigationGate({
      threadId: thread.threadId,
      userId: testUserId1
    });
    expect(gate.isSatisfied).toBe(true);
    expect(gate.gate.status).toBe("READY");
  });

  // =========================================================================
  // TEST 19: Legacy debate session does not mutate factual evidence
  // =========================================================================
  test("19. Evidence inventory is preserved and not mutated by debate turns", async () => {
    const thread = await createInvestigation({
      complaint: "Evidence integrity test",
      category: "Defective Product / Electronics",
      company: "DeviceMaker",
      amount: "15000",
      userId: testUserId1
    });

    const initialEvidence = [
      { id: "ev_preserved", title: "Original Invoice", uploaded: true, inspected: true, status: "VERIFIED" }
    ];

    await updateTestThread(
      thread.threadId,
      { evidenceInventory: initialEvidence },
      testUserId1
    );

    const current = await getThread(thread.threadId, testUserId1);
    expect(current.evidenceInventory.length).toBe(1);
    expect(current.evidenceInventory[0].title).toBe("Original Invoice");
  });

  // =========================================================================
  // TEST 20: PDF exports do not describe AI assessment as a real court order
  // =========================================================================
  test("20. PDF exports include non-judicial disclaimers and preliminary assessment headers", async () => {
    const mockInvestigation = {
      threadId: "test_thread_pdf",
      category: "Defective Product / Electronics",
      intake: {
        complaint: "Defective mobile phone",
        company: "Seller",
        amount: "20000"
      },
      investigationGate: {
        status: "READY",
        limitationsDisclosed: []
      },
      legalAssessment: {
        caseSummary: "Test case summary under Consumer Protection Act, 2019.",
        legalMeritScore: 85
      }
    };

    const investigationPdfStream = generateInvestigationReportPDF("test_thread_pdf", mockInvestigation);
    expect(investigationPdfStream).toBeInstanceOf(PDFDocument);

    const mockDebateThread = {
      turns: [
        {
          question: "Phone not charging",
          judge: {
            case_summary: "Dispute regarding smartphone charging issue.",
            statutory_remedies_options: ["Repair under Section 39(1)(a)"],
            preliminary_assessment: "Likely deficiency in service if defect proven."
          }
        }
      ]
    };

    const verdictPdfStream = generateVerdictPDF("test_thread_pdf", 0, mockDebateThread);
    expect(verdictPdfStream).toBeInstanceOf(PDFDocument);
  });
});
