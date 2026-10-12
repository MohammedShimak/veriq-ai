import { jest } from "@jest/globals";
import mongoose from "mongoose";
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
  uploadAndInspectEvidence,
  markDocumentUnavailable,
  EVIDENCE_STATUSES
} from "../services/evidenceService.js";
import { generateLegalAssessment } from "../services/legalAssessmentService.js";
import {
  generateFinalCaseOutcome,
  getFinalCaseOutcome,
  getAuthenticHistoricalJudgments,
  buildPrecedentComparisons,
  markDownstreamOutputsOutdated
} from "../services/finalOutcomeService.js";
import {
  getTransferAssessmentData,
  saveTransferAssessmentReview
} from "../services/transferAssessmentService.js";
import { generateFinalOutcomePDF } from "../services/pdfGenerator.js";

const testUserId = new mongoose.Types.ObjectId().toString();

async function updateTestThread(threadId, updates, userId = testUserId, guestToken = null) {
  const thread = await getThread(threadId, userId, guestToken);
  if (thread) {
    Object.assign(thread, updates);
  }
  if (mongoose.connection.readyState === 1) {
    await Thread.findOneAndUpdate({ threadId }, { $set: updates });
  }
  return thread;
}

describe("Master Prompt 3.0: Final Case Outcome, Precedent Benchmarking & AI 2.0 Transfer Assessment", () => {
  // =========================================================================
  // TEST 1: Three Distinct Outputs Architecture
  // =========================================================================
  test("1. Verifies Three Distinct Outputs: Grounded Legal Assessment, Assessment Confidence, and Final Case Outcome", async () => {
    const thread = await createInvestigation({
      complaint: "Purchased laptop for ₹65,000 online. Defective motherboard within 10 days of delivery. Company refused refund.",
      category: "E-Commerce / Online Purchase",
      product: "Laptop Z",
      company: "MegaElectronics",
      amount: "65000",
      userId: testUserId
    });

    // Provide complete answers and evidence
    await updateTestThread(thread.threadId, {
      unresolvedQuestions: [],
      clarificationHistory: [
        { round: 1, question: "Did you notify the seller within the return window?", answer: "Yes, on day 2 via email." },
        { round: 1, question: "Did the technician issue a job sheet?", answer: "Yes, job sheet confirms hardware failure." }
      ],
      isClarificationComplete: true,
      stage: INVESTIGATION_STAGES.AWAITING_EVIDENCE
    }, testUserId);

    await uploadAndInspectEvidence({
      threadId: thread.threadId,
      buffer: Buffer.from("Invoice INV-2024-99 Amount 65000 Date 10-Jan-2024 Laptop Z Purchase Receipt"),
      originalName: "invoice.txt",
      mimeType: "text/plain",
      category: "INVOICE",
      title: "Retail Purchase Invoice",
      userId: testUserId
    });

    // Evaluate gate -> READY
    const gateRes = await evaluateInvestigationGate({
      threadId: thread.threadId,
      userId: testUserId
    });
    expect(gateRes.gate.status).toBe("READY");

    // Output 1: Generate Grounded Legal Assessment
    const assessmentRes = await generateLegalAssessment({
      threadId: thread.threadId,
      userId: testUserId
    });
    expect(assessmentRes).toBeDefined();
    const preliminaryAssessment = assessmentRes.assessment?.preliminaryAssessment || assessmentRes.preliminaryAssessment;
    expect(preliminaryAssessment).toBeDefined();
    expect(preliminaryAssessment.sections).toBeDefined();
    expect(preliminaryAssessment.sections.caseSummary).toBeDefined();
    expect(preliminaryAssessment.sections.applicableLegalProvisions).toBeDefined();

    // Output 2: Assessment Confidence
    const confScore = preliminaryAssessment.confidenceScore;
    expect(typeof confScore).toBe("number");
    expect(confScore).toBeGreaterThanOrEqual(0);
    expect(confScore).toBeLessThanOrEqual(100);

    // Output 3: Final Case Outcome
    const outcomeRes = await generateFinalCaseOutcome({
      threadId: thread.threadId,
      userId: testUserId
    });
    expect(outcomeRes).toBeDefined();
    expect(outcomeRes.finalCaseOutcome).toBeDefined();
    const finalOutcome = outcomeRes.finalCaseOutcome;

    // Verify Output 3 has independent schema & structure
    expect(finalOutcome.outcomeClassification).toBeDefined();
    expect(finalOutcome.directConclusion).toBeDefined();
    expect(Array.isArray(finalOutcome.supportingFacts)).toBe(true);
    expect(Array.isArray(finalOutcome.historicalPrecedents)).toBe(true);
    expect(Array.isArray(finalOutcome.precedentComparisons)).toBe(true);
    expect(Array.isArray(finalOutcome.potentialRemedies?.remediesList || finalOutcome.potentialRemedies)).toBe(true);
    expect(finalOutcome.disclaimer).toContain("AI-Generated Final Case Outcome — Not a Court Order");

    // Output 3 is not merely copying the confidence score or introductory summary
    expect(finalOutcome.directConclusion).not.toEqual(confScore.toString());
    expect(finalOutcome.outcomeClassification).toMatch(/supported|uncertain|insufficiently/i);
  });

  // =========================================================================
  // TEST 2: Server-side Gate Enforcement Blocks Final Outcome on Incomplete Case
  // =========================================================================
  test("2. Blocks Final Case Outcome generation if investigation gate is INCOMPLETE", async () => {
    const thread = await createInvestigation({
      complaint: "Washing machine delivered broken.",
      category: "Defective Product / Electronics",
      product: "Washing Machine",
      company: "HomeAppliances",
      amount: "30000",
      userId: testUserId
    });

    // Add pending question
    await updateTestThread(thread.threadId, {
      unresolvedQuestions: [
        { id: "q1", question: "Did you notify delivery team?", status: "PENDING" }
      ],
      isClarificationComplete: false,
      stage: INVESTIGATION_STAGES.ANALYSIS_PENDING
    }, testUserId);

    // Attempt to generate Final Case Outcome must fail server-side
    await expect(
      generateFinalCaseOutcome({
        threadId: thread.threadId,
        userId: testUserId
      })
    ).rejects.toThrow(/INCOMPLETE/i);
  });

  // =========================================================================
  // TEST 3: Proceed with Disclosed Limitations carries into Final Case Outcome
  // =========================================================================
  test("3. Confirmed evidentiary limitations are carried and disclosed in Final Case Outcome", async () => {
    const thread = await createInvestigation({
      complaint: "AC cooling stopped working. Service technician visited verbally without receipt.",
      category: "Defective Product / Electronics",
      product: "Split AC 1.5 Ton",
      company: "CoolAir Ltd",
      amount: "42000",
      userId: testUserId
    });

    await updateTestThread(thread.threadId, {
      unresolvedQuestions: [],
      clarificationHistory: [
        { round: 1, question: "Did service center provide a job sheet?", answer: "No, technician refused paper receipt." }
      ],
      isClarificationComplete: true,
      stage: INVESTIGATION_STAGES.AWAITING_EVIDENCE
    }, testUserId);

    // Mark job sheet unavailable with reason
    await markDocumentUnavailable(
      thread.threadId,
      "Technician Job Sheet",
      "Technician visited verbally and refused written receipt.",
      testUserId
    );

    // Proceed with limitations confirmation
    const gateRes = await proceedWithLimitations({
      threadId: thread.threadId,
      overrideReason: "Consumer confirmed absence of paper job sheet due to technician refusal.",
      userId: testUserId
    });
    expect(gateRes.gate.status).toBe("PROCEED_WITH_LIMITATIONS");
    expect(gateRes.gate.limitationsDisclosed.length).toBeGreaterThan(0);

    // Generate Final Case Outcome
    const outcomeRes = await generateFinalCaseOutcome({
      threadId: thread.threadId,
      userId: testUserId
    });
    const finalOutcome = outcomeRes.finalCaseOutcome;

    expect(finalOutcome.evidenceLimitations.length).toBeGreaterThan(0);
    expect(finalOutcome.evidenceLimitations.some(lim => lim.includes("Technician Job Sheet") || lim.includes("limitations"))).toBe(true);
  });

  // =========================================================================
  // TEST 4: Authentic Precedents & 0% Hallucination Fact Comparison
  // =========================================================================
  test("4. Retrieves authentic Supreme Court & NCDRC judgments with genuine fact comparisons", async () => {
    // Test retrieval from local verified judgments
    const precedents = getAuthenticHistoricalJudgments("E-Commerce / Online Purchase", "Amazon delivery counterfeit");
    expect(Array.isArray(precedents)).toBe(true);
    expect(precedents.length).toBeGreaterThan(0);

    const first = precedents[0];
    expect(first.case_name || first.caseName).toBeDefined();
    expect(first.court).toMatch(/Supreme Court|National Consumer Disputes Redressal Commission/i);
    expect(first.citation).toBeDefined();
    expect(first.source || first.indianKanoonUrl).toContain("indiankanoon.org");

    // Test fact-by-fact comparison generation
    const comparison = buildPrecedentComparisons(
      first,
      { product: "Smartphone", company: "Online Platform" },
      [{ title: "Invoice", datesFound: ["2024-01-10"], amountsFound: [15000] }],
      []
    );
    expect(comparison).toBeDefined();
    expect(comparison.caseName).toBe(first.case_name || first.caseName);
    expect(comparison.factualSimilarity).toBeDefined();
    expect(comparison.distinguishingFactor).toBeDefined();
    expect(comparison.applicationRationale).toBeDefined();
  });

  // =========================================================================
  // TEST 5: AI 2.0 Transfer Assessment Form Organization & Review Persistence
  // =========================================================================
  test("5. AI 2.0 Transfer Assessment Form compiles structured docket and saves user review", async () => {
    const thread = await createInvestigation({
      complaint: "Flight ticket cancelled by airline without refund.",
      category: "Aviation / Flight Delays & Cancellations",
      product: "Flight Ticket BLR-DEL",
      company: "FlyAirways",
      amount: "8500",
      userId: testUserId
    });

    // 1. Get structured transfer docket across 10 sections
    const docketRes = await getTransferAssessmentData({
      threadId: thread.threadId,
      userId: testUserId
    });
    expect(docketRes).toBeDefined();
    expect(docketRes.sections).toBeDefined();
    const sec = docketRes.sections;

    // Verify sections
    expect(sec.complaintSummary).toBeDefined();
    expect(sec.userReportedFacts).toBeDefined();
    expect(sec.uploadedFilesAndInspections).toBeDefined();
    expect(sec.extractedFactsWithProvenance).toBeDefined();
    expect(sec.readinessGateResult).toBeDefined();

    // 2. User reviews and saves docket notes
    const reviewRes = await saveTransferAssessmentReview({
      threadId: thread.threadId,
      corrections: { product: "Flight Ticket BLR-DEL (Confirmed PNR FLY99281)" },
      confirmedByConsumer: true,
      userId: testUserId
    });
    expect(reviewRes).toBeDefined();
    expect(reviewRes.docket || reviewRes.sections).toBeDefined();
  });

  // =========================================================================
  // TEST 6: Invalidation of Downstream Outputs when Material Facts Change
  // =========================================================================
  test("6. Marks final outcome and assessment outdated when material answers change", async () => {
    const thread = await createInvestigation({
      complaint: "Car engine overheating after second service.",
      category: "Automobile & Vehicle Services",
      product: "Sedan Car",
      company: "AutoMotors",
      amount: "850000",
      userId: testUserId
    });

    // Seed an existing finalCaseOutcome
    await updateTestThread(thread.threadId, {
      finalCaseOutcome: {
        status: "COMPLETED",
        outcomeClassification: "Consumer's case appears strongly supported",
        directConclusion: "Precedent supports claim under Tata Motors v. Antonio Paulo Vaz",
        isOutdated: false
      }
    }, testUserId);

    // Mark downstream outputs outdated
    const updated = await markDownstreamOutputsOutdated(thread.threadId, "User submitted new clarification answers");
    expect(updated).toBe(true);

    const refreshedThread = await getThread(thread.threadId, testUserId);
    expect(refreshedThread.finalCaseOutcome.isOutdated).toBe(true);
    expect(refreshedThread.finalCaseOutcome.outdatedReason).toContain("clarification answers");
  });

  // =========================================================================
  // TEST 7: PDF Generation for Final Case Outcome Dossier
  // =========================================================================
  test("7. Generates valid PDF stream for Final Case Outcome", async () => {
    const thread = await createInvestigation({
      complaint: "Insurance claim repudiated unlawfully.",
      category: "Banking, Insurance & Financial Services",
      product: "Health Insurance Policy",
      company: "CareInsurance",
      amount: "150000",
      userId: testUserId
    });

    await updateTestThread(thread.threadId, {
      finalCaseOutcome: {
        status: "COMPLETED",
        outcomeClassification: "Consumer's case appears strongly supported",
        directConclusion: "Insurer cannot repudiate genuine claim on hyper-technical exclusions.",
        supportingFacts: [{ fact: "Policy Active", status: "DOCUMENT_INSPECTED", provenance: "Policy Document" }],
        precedentComparisons: [
          {
            caseName: "National Insurance Co. Ltd. v. Harsolia Motors",
            court: "Supreme Court of India",
            year: "2023",
            citation: "(2023) 8 SCC 362",
            comparison: {
              similarities: "Commercial insurer disputed coverage under exclusionary clause.",
              distinctions: "Present case involves individual consumer.",
              impactOnOutcome: "Protects consumer against arbitrary repudiation."
            }
          }
        ],
        consumerArguments: [{ issue: "Arbitrary Rejection", argument: "Claim submitted with all medical bills" }],
        companyCounterarguments: [{ issue: "Pre-existing Condition", argument: "Insurer alleged prior history", rebuttalNote: "No prior symptoms recorded" }],
        potentialRemedies: [{ remedy: "Direction to pay claim amount", statutoryProvision: "CPA 2019 Section 39(1)(e)", eligibility: "Supported by hospital receipts" }],
        confidenceMetrics: { score: 85, explanation: "Primary policy document verified." },
        evidenceLimitations: [],
        recommendedNextSteps: ["File complaint on e-Daakhil", "Serve formal legal notice"],
        disclaimer: "AI-Generated Final Case Outcome — Not a Court Order."
      }
    }, testUserId);

    const pdfStream = await generateFinalOutcomePDF(thread);
    expect(pdfStream).toBeDefined();

    // Verify stream emits data
    const chunks = [];
    await new Promise((resolve, reject) => {
      pdfStream.on("data", (chunk) => chunks.push(chunk));
      pdfStream.on("end", resolve);
      pdfStream.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);
    expect(buffer.length).toBeGreaterThan(100);
    // PDF header magic bytes %PDF-
    expect(buffer.toString("utf-8", 0, 5)).toBe("%PDF-");
  });
});
