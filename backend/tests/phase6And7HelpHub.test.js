import { jest } from "@jest/globals";
import crypto from "crypto";
import mongoose from "mongoose";
import {
  createInvestigation,
  getThread,
  updateStage,
  submitClarificationAnswers
} from "../services/threadService.js";
import { INVESTIGATION_STAGES } from "../models/Thread.js";
import {
  evaluateInvestigationGate,
  proceedWithLimitations
} from "../services/investigationGateService.js";
import {
  generateLegalAssessment,
  compileFactualInventory,
  buildBalancedAssessment,
  OUTCOME_CLASSIFICATIONS
} from "../services/legalAssessmentService.js";
import {
  generateVerdictPDF,
  generateInvestigationReportPDF
} from "../services/pdfGenerator.js";
import {
  HELP_HUB_INTENTS,
  CONSUMER_CATEGORIES,
  PROCEDURAL_KNOWLEDGE,
  generateDocumentDraft,
  searchHelpHubKnowledge
} from "../services/helpHubService.js";
import investigationRouter from "../routes/investigation.js";
import helpHubRouter from "../routes/helpHub.js";

/**
 * Mock response helper for route handler execution
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
 * Dispatch helper for simulated investigation router requests
 */
async function executeInvestigationRoute(urlPath, method, req, res) {
  if (!req.ip) req.ip = "127.0.0.1";
  if (!req.app) req.app = { get: () => false };
  if (!req.headers) req.headers = {};
  if (!req.query) req.query = {};
  if (!req.params) req.params = {};

  const cleanPath = urlPath.split("?")[0];

  for (const layer of investigationRouter.stack) {
    if (!layer.route) continue;
    const routeMethod = Object.keys(layer.route.methods)[0]?.toUpperCase();
    if (routeMethod !== method.toUpperCase()) continue;

    const routePath = layer.route.path;

    // Pattern 1: /:threadId/assessment
    if (routePath === "/:threadId/assessment") {
      const match = cleanPath.match(/^\/([^\/]+)\/assessment$/);
      if (match) {
        req.params.threadId = match[1];
        await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
        return;
      }
    }

    // Pattern 2: /:threadId/export/pdf
    if (routePath === "/:threadId/export/pdf") {
      const match = cleanPath.match(/^\/([^\/]+)\/export\/pdf$/);
      if (match) {
        req.params.threadId = match[1];
        await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
        return;
      }
    }

    // Pattern 3: /:threadId/gate/evaluate
    if (routePath === "/:threadId/gate/evaluate") {
      const match = cleanPath.match(/^\/([^\/]+)\/gate\/evaluate$/);
      if (match) {
        req.params.threadId = match[1];
        await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
        return;
      }
    }

    // Pattern 4: /:threadId/gate/proceed
    if (routePath === "/:threadId/gate/proceed") {
      const match = cleanPath.match(/^\/([^\/]+)\/gate\/proceed$/);
      if (match) {
        req.params.threadId = match[1];
        await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
        return;
      }
    }
  }
}

/**
 * Dispatch helper for Help Hub router
 */
async function executeHelpHubRoute(urlPath, method, req, res) {
  if (!req.headers) req.headers = {};
  if (!req.query) req.query = {};
  if (!req.params) req.params = {};

  const cleanPath = urlPath.split("?")[0];

  for (const layer of helpHubRouter.stack) {
    if (!layer.route) continue;
    const routeMethod = Object.keys(layer.route.methods)[0]?.toUpperCase();
    if (routeMethod !== method.toUpperCase()) continue;

    const routePath = layer.route.path;

    if (routePath === cleanPath) {
      await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
      return;
    }

    if (routePath === "/categories/:categoryId") {
      const match = cleanPath.match(/^\/categories\/([^\/]+)$/);
      if (match) {
        req.params.categoryId = match[1];
        await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
        return;
      }
    }
  }
}

describe("PHASE 6: GROUNDED LEGAL ASSESSMENT & GATE ENFORCEMENT", () => {
  const uniqueId = () => `p6_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  test("A. Rejects legal assessment when completeness gate is INCOMPLETE (cannot bypass gate)", async () => {
    const threadId = uniqueId();
    const created = await createInvestigation({
      threadId,
      complaint: "TV screen has display lines and service center refused repair.",
      company: "LG Electronics",
      amount: "₹42,000",
      generateGuestToken: true
    });
    const guestToken = created.guestToken;

    // Directly attempt to generate legal assessment before gate evaluation
    await expect(generateLegalAssessment({ threadId, guestToken })).rejects.toThrow(
      /Cannot generate legal assessment before investigation completeness gate is satisfied/
    );

    // Call through HTTP route
    const req = { body: {}, headers: { "x-guest-token": guestToken } };
    const res = createMockRes();
    await executeInvestigationRoute(`/${threadId}/assessment`, "POST", req, res);

    expect(res.statusCode).toBe(400);
    expect(res.data.error).toMatch(/completeness gate is satisfied/);
  });

  test("B. Prevents direct client manipulation into ASSESSMENT_COMPLETE state via updateStage", async () => {
    const threadId = uniqueId();
    const created = await createInvestigation({
      threadId,
      complaint: "Refund denied for cancelled flight tickets.",
      generateGuestToken: true
    });
    const guestToken = created.guestToken;

    // Attempt invalid transition directly from INITIAL_ANALYSIS to ASSESSMENT_COMPLETE
    await expect(
      updateStage(threadId, INVESTIGATION_STAGES.ASSESSMENT_COMPLETE, null, {}, guestToken)
    ).rejects.toThrow(/Invalid stage transition/);
  });

  test("C. Compiles factual inventory with strict distinction between 7 evidence statuses", () => {
    const mockThread = {
      intake: {
        complaint: "Laptop motherboard failed in 10 days; seller refused replacement.",
        product: "Dell Inspiron 15",
        company: "Dell India",
        amount: "₹65,000"
      },
      initialAnalysis: {
        purchaseOrServiceDate: "2026-01-10",
        reportedProblem: "Dead motherboard"
      },
      clarificationHistory: [
        {
          question: "Did authorized technician examine the device?",
          answerText: "Yes, technician confirmed defective component."
        }
      ],
      userReportedFacts: [{ text: "Consumer has invoice soft copy" }],
      evidenceInventory: [
        {
          title: "Authorized Service Job Sheet",
          category: "SERVICE_REPORT",
          inspected: true,
          status: "DOCUMENT_INSPECTED",
          extractedInfo: {
            datesFound: ["15-01-2026"],
            amountsFound: ["₹0"],
            supportsUserClaims: true
          }
        },
        {
          title: "Physical Delivery Challan",
          unavailable: true,
          status: "UNAVAILABLE",
          unavailableReason: "Delivery agent did not provide paper copy"
        },
        {
          title: "Warranty Card",
          status: "DOCUMENT_UPLOADED",
          originalName: "warranty.pdf"
        },
        {
          title: "Smudged Receipt",
          status: "NOT_INSPECTED"
        },
        {
          title: "Invoice with wrong date",
          status: "CONTRADICTED",
          extractedInfo: {
            contradictionsNoted: ["Invoice shows 2024 purchase, not 2026"]
          }
        }
      ],
      companyPolicyResearch: {
        policies: [
          {
            title: "Dell Return Policy",
            sourceUrl: "https://dell.com/returns",
            passage: "14-day replacement for DOA units."
          }
        ]
      }
    };

    const inventory = compileFactualInventory(mockThread);

    expect(inventory.USER_REPORTED.length).toBeGreaterThanOrEqual(4);
    expect(inventory.DOCUMENT_INSPECTED.length).toBe(1);
    expect(inventory.UNAVAILABLE.length).toBe(1);
    expect(inventory.DOCUMENT_UPLOADED.length).toBe(1);
    expect(inventory.NOT_INSPECTED.length).toBe(1);
    expect(inventory.CONTRADICTED.length).toBe(1);
    expect(inventory.INDEPENDENTLY_VERIFIED.length).toBe(1);

    // Assert user allegations are never converted into established facts without documentary proof
    expect(inventory.USER_REPORTED[0].type).toBe("COMPLAINT_STATEMENT");
    expect(inventory.USER_REPORTED[0].attribution).toMatch(/Consumer stated/);
  });

  test("D. Successfully generates balanced 14-section legal assessment when Gate is READY", async () => {
    const threadId = uniqueId();
    const created = await createInvestigation({
      threadId,
      complaint: "Purchased refrigerator on Amazon; compressor failed on day 3. Return refused.",
      product: "Samsung Refrigerator",
      company: "Amazon Seller Services India Pvt Ltd",
      amount: "₹28,500",
      generateGuestToken: true
    });
    const guestToken = created.guestToken;

    // Simulate inspection of valid invoice document
    const thread = await getThread(threadId, null, guestToken);
    thread.evidenceInventory = [
      {
        id: "doc_inv_1",
        title: "Amazon Tax Invoice",
        category: "INVOICE",
        inspected: true,
        status: "DOCUMENT_INSPECTED",
        extractedInfo: {
          documentType: "TAX_INVOICE",
          datesFound: ["2026-01-20"],
          amountsFound: ["₹28,500"],
          referenceNumbers: ["INV-998822"],
          supportsUserClaims: true
        }
      }
    ];
    thread.isClarificationComplete = true;

    // Evaluate completeness gate -> READY
    const gateRes = await evaluateInvestigationGate({
      threadId,
      guestToken
    });
    expect(gateRes.gate.status).toBe("READY");
    expect(gateRes.isSatisfied).toBe(true);

    // Generate Grounded Legal Assessment
    const assessRes = await generateLegalAssessment({
      threadId,
      guestToken
    });

    expect(assessRes.success).toBe(true);
    expect(assessRes.stage).toBe(INVESTIGATION_STAGES.ASSESSMENT_COMPLETE);
    expect(assessRes.assessment.status).toBe("COMPLETE");

    const sec = assessRes.assessment.preliminaryAssessment.sections;

    // Verify all 14 required sections
    expect(sec.caseSummary).toBeDefined();
    expect(sec.consumerAllegations).toBeInstanceOf(Array);
    expect(sec.factsAnalysis).toBeDefined();
    expect(sec.factsAnalysis.establishedFacts.length).toBeGreaterThan(0);
    expect(sec.evidenceReviewed.length).toBe(1);
    expect(sec.evidenceLimitations).toBeInstanceOf(Array);
    expect(sec.companyPolicyAndTerms).toBeDefined();
    expect(sec.applicableLegalProvisions.length).toBeGreaterThanOrEqual(4);
    expect(sec.consumerStrongestArguments.length).toBeGreaterThanOrEqual(2);
    expect(sec.companyStrongestCounterarguments.length).toBeGreaterThanOrEqual(2);
    expect(sec.conflictingEvidenceAndUnresolvedQuestions).toBeInstanceOf(Array);
    expect(sec.preliminaryAssessment).toBeDefined();
    expect(sec.potentialRemedies).toBeDefined();
    expect(sec.confidenceAndUncertainty).toBeDefined();
    expect(sec.sourcesAndCitations.length).toBeGreaterThanOrEqual(2);

    // Verify cautious outcome determination
    expect(sec.preliminaryAssessment.outcomeClassification).toBe(
      OUTCOME_CLASSIFICATIONS.SUPPORTED
    );

    // Verify company counterarguments are labeled as analytical defense model
    expect(sec.companyStrongestCounterarguments[0].disclaimer).toMatch(
      /Analytical defense model: The opposite party has not yet submitted a formal reply/
    );

    // Verify remedies distinguish eligibility and disclaim guaranteed figures
    expect(sec.potentialRemedies.possibleRemedies[0].statutoryProvision).toMatch(/Section 39/);
    expect(sec.potentialRemedies.eligibilityConditions).toBeInstanceOf(Array);
    expect(sec.potentialRemedies.stepsConsumerCanConsiderNext).toBeInstanceOf(Array);
  });

  test("E. Successfully generates assessment when proceeding with disclosed limitations (PROCEED_WITH_LIMITATIONS)", async () => {
    const threadId = uniqueId();
    const created = await createInvestigation({
      threadId,
      complaint: "Paid ₹12,000 cash for mobile repair; technician refused to give paper receipt and phone stopped working.",
      product: "OnePlus Mobile Repair",
      company: "QuickFix Mobile Care",
      amount: "₹12,000",
      generateGuestToken: true
    });
    const guestToken = created.guestToken;

    // Proceed through gate with explicit consumer override
    const proceedRes = await proceedWithLimitations({
      threadId,
      guestToken,
      overrideReason: "Technician refused cash receipt; proceeding based on UPI payment alert."
    });
    expect(proceedRes.gate.status).toBe("PROCEED_WITH_LIMITATIONS");
    expect(proceedRes.isSatisfied).toBe(true);

    // Generate assessment
    const assessRes = await generateLegalAssessment({
      threadId,
      guestToken
    });

    expect(assessRes.success).toBe(true);
    expect(assessRes.assessment.preliminaryAssessment.isProceedWithLimitations).toBe(true);

    const sec = assessRes.assessment.preliminaryAssessment.sections;
    expect(sec.evidenceLimitations.length).toBeGreaterThan(0);
    expect(sec.preliminaryAssessment.outcomeClassification).toBe(
      OUTCOME_CLASSIFICATIONS.PARTIALLY_SUPPORTED
    );
  });

  test("F. Enforces user isolation and guest token security on legal assessment route", async () => {
    const threadId1 = uniqueId();
    const threadId2 = uniqueId();

    const guest1 = await createInvestigation({
      threadId: threadId1,
      complaint: "Case 1 complaint.",
      generateGuestToken: true
    });
    const guest2 = await createInvestigation({
      threadId: threadId2,
      complaint: "Case 2 complaint.",
      generateGuestToken: true
    });

    // Attempting to access Case 1 using Case 2's guest token
    const req = {
      body: {},
      headers: { "x-guest-token": guest2.guestToken }
    };
    const res = createMockRes();
    await executeInvestigationRoute(`/${threadId1}/assessment`, "GET", req, res);

    expect(res.statusCode).toBe(403);
    expect(res.data.error).toMatch(/Access denied/);
  });
});

describe("PHASE 7: END-TO-END INVESTIGATION INTEGRATION & PDF EXPORT", () => {
  const uniqueId = () => `p7_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  test("A. Prevents PDF export when completeness gate is not satisfied", async () => {
    const threadId = uniqueId();
    const guest = await createInvestigation({
      threadId,
      complaint: "Incomplete case intake.",
      generateGuestToken: true
    });

    const req = {
      headers: { "x-guest-token": guest.guestToken }
    };
    const res = createMockRes();
    await executeInvestigationRoute(`/${threadId}/export/pdf`, "GET", req, res);

    expect(res.statusCode).toBe(400);
    expect(res.data.error).toMatch(/completeness gate is satisfied/);
  });

  test("B. Exports complete investigation PDF when legal assessment is complete", async () => {
    const threadId = uniqueId();
    const guest = await createInvestigation({
      threadId,
      complaint: "Flight cancelled without refund.",
      company: "IndiGo Airlines",
      amount: "₹8,500",
      generateGuestToken: true
    });

    // Proceed with limitations and generate assessment
    await proceedWithLimitations({ threadId, guestToken: guest.guestToken });
    const assessRes = await generateLegalAssessment({ threadId, guestToken: guest.guestToken });
    expect(assessRes.success).toBe(true);

    const threadData = assessRes.investigation;
    const pdfStream = generateInvestigationReportPDF(threadId, threadData);

    expect(pdfStream).toBeDefined();
    expect(typeof pdfStream.pipe).toBe("function");

    // Collect buffer chunks
    const chunks = [];
    const buffer = await new Promise((resolve, reject) => {
      pdfStream.on("data", (chunk) => chunks.push(chunk));
      pdfStream.on("end", () => resolve(Buffer.concat(chunks)));
      pdfStream.on("error", reject);
    });

    expect(buffer.length).toBeGreaterThan(1000);
    // PDF Magic bytes
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  });
});

describe("CONSUMER HELP HUB: PROCEDURAL GUIDANCE & DOCUMENT DRAFTING", () => {
  test("A. GET /api/help-hub/intents returns 4 primary user intents", async () => {
    const req = {};
    const res = createMockRes();
    await executeHelpHubRoute("/intents", "GET", req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.intents.length).toBe(4);
    const ids = res.data.intents.map((i) => i.id);
    expect(ids).toContain("UNDERSTAND_MY_PROBLEM");
    expect(ids).toContain("LEARN_THE_PROCESS");
    expect(ids).toContain("PREPARE_A_DOCUMENT");
    expect(ids).toContain("INVESTIGATE_MY_CASE");
  });

  test("B. GET /api/help-hub/categories returns 8+ categories with evidence checklists", async () => {
    const req = {};
    const res = createMockRes();
    await executeHelpHubRoute("/categories", "GET", req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.categories.length).toBeGreaterThanOrEqual(8);

    const ecom = res.data.categories.find((c) => c.id === "ecommerce_retail");
    expect(ecom).toBeDefined();
    expect(ecom.evidenceChecklist.length).toBeGreaterThanOrEqual(3);
    expect(ecom.governingRules).toMatch(/Consumer Protection/);
  });

  test("C. GET /api/help-hub/procedural returns grounded CPA 2019 benchmarks", async () => {
    const req = {};
    const res = createMockRes();
    await executeHelpHubRoute("/procedural", "GET", req, res);

    expect(res.statusCode).toBe(200);
    const proc = res.data.procedural;

    // Pecuniary limits
    expect(proc.jurisdiction.tiers[0].claimLimit).toMatch(/50,00,000/);
    expect(proc.jurisdiction.tiers[1].claimLimit).toMatch(/2,00,00,000/);
    // Section 34(2) territorial rule
    expect(proc.jurisdiction.territorialRule).toMatch(/Section 34\(2\)/);
    // Free fee slab for claims up to ₹5L
    expect(proc.filingFees.slabs[0].fee).toMatch(/NIL/);
    // Limitation period 2 years
    expect(proc.limitationPeriod.statute).toMatch(/Section 69/);
    expect(proc.limitationPeriod.rule).toMatch(/TWO \(2\) YEARS/);
    // Official portals
    const portals = proc.officialPortals.map((p) => p.name);
    expect(portals).toContain("e-Daakhil Portal");
    expect(portals).toContain("National Consumer Helpline (NCH)");
  });

  test("D. POST /api/help-hub/draft generates structured drafts with placeholders and cautions", async () => {
    const req = {
      body: {
        documentType: "CONSUMER_COMPLAINT",
        category: "ecommerce_retail",
        consumerData: {
          consumerName: "Anita Sharma",
          companyName: "Flipkart Internet Pvt Ltd",
          productName: "Air Conditioner 1.5 Ton",
          orderId: "OD123456789",
          disputedAmount: "₹34,999",
          problemDescription: "Unit delivered with gas leak; technician refused repair.",
          remedySought: "Full refund of ₹34,999 with interest"
        }
      }
    };
    const res = createMockRes();
    await executeHelpHubRoute("/draft", "POST", req, res);

    expect(res.statusCode).toBe(200);
    const draft = res.data.draft;

    expect(draft.title).toMatch(/District Commission/);
    expect(draft.draftText).toMatch(/Anita Sharma/);
    expect(draft.draftText).toMatch(/Flipkart Internet Pvt Ltd/);
    expect(draft.draftText).toMatch(/SECTION 35 OF THE CONSUMER PROTECTION ACT, 2019/i);
    expect(draft.disclaimer).toMatch(/DRAFT TEMPLATE/);
    expect(draft.cautions.length).toBeGreaterThan(0);
    expect(draft.placeholders).toBeInstanceOf(Array);
  });

  test("E. POST /api/help-hub/search provides grounded procedural routing", async () => {
    const req = {
      body: { query: "what is the filing fee for consumer complaint?" }
    };
    const res = createMockRes();
    await executeHelpHubRoute("/search", "POST", req, res);

    expect(res.statusCode).toBe(200);
    expect(res.data.result.proceduralGuidance.filingFees).toBeDefined();
    expect(res.data.result.proceduralGuidance.filingFees.slabs[0].fee).toMatch(/NIL/);
  });
});
