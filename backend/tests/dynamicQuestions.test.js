import mongoose from "mongoose";
import { setCustomGenerator, resetCustomGenerator } from "../services/gemini.js";
import {
  createInvestigation,
  getThread,
  saveInitialAnalysis,
  submitClarificationAnswers,
  advanceInvestigationRound,
  updateStage,
  normalizeAnswerPayload,
  hashGuestToken
} from "../services/threadService.js";
import {
  analyzeComplaint,
  generateFollowUpQuestions,
  detectDateContradictions,
  classifyDisputeCategory,
  getCategoryConfig,
  MAX_CLARIFICATION_ROUNDS
} from "../services/investigationAnalysis.js";
import { INVESTIGATION_STAGES } from "../models/Thread.js";

describe("Phase 2: Dynamic Follow-Up Question Generation & Multi-Turn Clarification", () => {
  const dummyUserId1 = new mongoose.Types.ObjectId().toString();
  const dummyUserId2 = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    resetCustomGenerator();
  });

  afterAll(() => {
    resetCustomGenerator();
  });

  // Test 1: A complaint creates a persistent investigation
  test("1. A complaint creates a persistent investigation", async () => {
    const threadId = `phase2_test_${Date.now()}_1`;
    const complaintText = "Purchased a brand new washing machine that makes loud screeching noises and leaks water.";
    
    const result = await createInvestigation({
      threadId,
      userId: dummyUserId1,
      complaint: complaintText,
      product: "Whirlpool Hydro 7kg",
      company: "Whirlpool India Ltd",
      amount: "28000"
    });

    expect(result).toBeDefined();
    expect(result.threadId).toBe(threadId);
    expect(result.stage).toBe(INVESTIGATION_STAGES.INITIAL_ANALYSIS);
    expect(result.intake.complaint).toBe(complaintText);
    expect(result.clarificationRound).toBe(1);
    expect(result.isClarificationComplete).toBe(false);
    expect(result.assessment.status).toBe("NOT_READY");
  });

  // Test 2: Initial analysis identifies facts without inventing missing data
  test("2. Initial analysis identifies facts without inventing missing data", async () => {
    // Mock Gemini response returning structured facts without hallucinating
    setCustomGenerator(async () => ({
      response: {
        text: () => JSON.stringify({
          disputeCategory: "Defective Product",
          productOrService: "Smart LED TV",
          companyOrSeller: "ElectroHub Retailers",
          purchaseOrServiceDate: "Not provided",
          disputedAmount: "Not provided",
          reportedProblem: "Display panel started flickering within 48 hours of installation.",
          actionsTaken: ["Called support hotline"],
          responsesReceived: ["Support promised technician visit but nobody arrived"],
          possibleContradictions: [],
          missingMaterialFacts: [
            "Exact date of purchase invoice",
            "Proof of purchase receipt number",
            "Warranty card validity status"
          ],
          potentialRelevantEvidence: [
            "Purchase Tax Invoice",
            "Installation Slip",
            "Photographs of flickering screen"
          ],
          extractedFacts: [
            "Consumer purchased Smart LED TV from ElectroHub Retailers",
            "Display panel flickered within 48 hours of installation",
            "Support hotline promised technician visit but did not dispatch"
          ]
        })
      }
    }));

    const analysis = await analyzeComplaint({
      complaint: "Smart LED TV display panel flickering after 48 hours. Support promised technician visit but no one came.",
      product: "Smart LED TV",
      company: "ElectroHub Retailers"
    });

    expect(analysis.disputeCategory).toBe("Defective Product");
    // Explicitly labeled missing data - NOT invented
    expect(analysis.purchaseOrServiceDate).toBe("Not provided");
    expect(analysis.disputedAmount).toBe("Not provided");
    expect(analysis.missingMaterialFacts).toContain("Exact date of purchase invoice");
    expect(analysis.userReportedFacts).toHaveLength(3);
    expect(analysis.userReportedFacts[0].source).toBe("USER_INPUT");
  });

  // Test 3: Questions are generated dynamically from the complaint
  test("3. Questions are generated dynamically from the complaint", async () => {
    setCustomGenerator(async () => ({
      response: {
        text: () => JSON.stringify([
          {
            id: "q_1_invoice_date",
            question: "On what date was the television delivered and installed?",
            importance: "CRITICAL",
            legalRelevance: "Determines 30-day return window and statutory warranty under CPA 2019."
          },
          {
            id: "q_1_physical_damage",
            question: "Is there any external physical impact or crack on the screen?",
            importance: "HIGH",
            legalRelevance: "Rules out consumer negligence or accidental damage defense."
          }
        ])
      }
    }));

    const mockAnalysis = {
      disputeCategory: "Defective Product",
      productOrService: "Smart LED TV",
      companyOrSeller: "ElectroHub",
      purchaseOrServiceDate: "Not provided",
      disputedAmount: "Not provided",
      reportedProblem: "Flickering screen",
      missingMaterialFacts: ["Delivery date", "Physical inspection status"],
      possibleContradictions: []
    };

    const questionResult = await generateFollowUpQuestions({
      analysis: mockAnalysis,
      roundNumber: 1
    });

    expect(questionResult.isComplete).toBe(false);
    expect(questionResult.questions).toHaveLength(2);
    expect(questionResult.questions[0].id).toBe("q_1_invoice_date");
    expect(questionResult.questions[0].status).toBe("PENDING");
    expect(questionResult.questions[0].importance).toBe("CRITICAL");
  });

  // Test 4: Already answered questions are not unnecessarily repeated
  test("4. Already answered questions are not unnecessarily repeated", async () => {
    setCustomGenerator(async () => ({
      response: {
        text: () => JSON.stringify([
          {
            id: "q_2_invoice_date",
            question: "On what date was the television delivered?", // Duplicate concept
            importance: "CRITICAL",
            legalRelevance: "Already known"
          },
          {
            id: "q_2_job_card",
            question: "Did the technician issue a physical job card or service docket?",
            importance: "HIGH",
            legalRelevance: "Documentary verification of service attempt."
          }
        ])
      }
    }));

    const existingClarifications = [
      {
        questionId: "q_1_invoice_date",
        question: "On what date was the television delivered?",
        answer: "Delivered on 10 October 2026."
      }
    ];

    const questionResult = await generateFollowUpQuestions({
      analysis: {
        productOrService: "Smart LED TV",
        companyOrSeller: "ElectroHub",
        missingMaterialFacts: ["Job card"],
        possibleContradictions: []
      },
      clarificationHistory: existingClarifications,
      roundNumber: 2
    });

    // The repeated question must be filtered out
    expect(questionResult.questions).toHaveLength(1);
    expect(questionResult.questions[0].id).toBe("q_2_job_card");
    expect(questionResult.questions[0].question).toContain("job card");
  });

  // Test 5: Answers are persisted correctly
  test("5. Answers are persisted correctly", async () => {
    const threadId = `phase2_test_${Date.now()}_5`;
    await createInvestigation({
      threadId,
      complaint: "Defective laptop battery dies in 10 minutes."
    });

    // Save initial questions
    await saveInitialAnalysis(
      threadId,
      { disputeCategory: "Defective Product", missingMaterialFacts: ["Charger tested"] },
      [
        { id: "q_charger", question: "Did you test with an original charger?", status: "PENDING" }
      ]
    );

    // Submit answers
    const updated = await submitClarificationAnswers(threadId, [
      { questionId: "q_charger", answer: "Yes, tested with the original OEM charger." }
    ]);

    expect(updated.clarificationHistory).toHaveLength(1);
    expect(updated.clarificationHistory[0].questionId).toBe("q_charger");
    expect(updated.clarificationHistory[0].answer).toBe("Yes, tested with the original OEM charger.");
    
    // Marked answered
    const q = updated.unresolvedQuestions.find((uq) => uq.id === "q_charger");
    expect(q.status).toBe("ANSWERED");
    expect(q.answer).toBe("Yes, tested with the original OEM charger.");

    // Added to user reported facts
    const ansFact = updated.userReportedFacts.find((f) => f.source === "CLARIFICATION_ANSWER");
    expect(ansFact).toBeDefined();
    expect(ansFact.text).toBe("Yes, tested with the original OEM charger.");
  });

  // Test 6: A subsequent question round uses previous answers
  test("6. A subsequent question round uses previous answers", async () => {
    setCustomGenerator(async () => ({
      response: {
        text: () => JSON.stringify([
          {
            id: "q_2_service_refusal",
            question: "Did the service center give a written reason for denying battery replacement under warranty?",
            importance: "CRITICAL",
            legalRelevance: "Defines whether denial constitutes deficiency in service under Section 2(11)."
          }
        ])
      }
    }));

    const previousHistory = [
      {
        questionId: "q_1_service_visit",
        question: "Did you visit the authorized service center?",
        answer: "Yes, visited the authorized center in Bengaluru on Monday."
      }
    ];

    const round2Result = await generateFollowUpQuestions({
      analysis: {
        productOrService: "Laptop",
        missingMaterialFacts: ["Written denial letter"],
        possibleContradictions: []
      },
      clarificationHistory: previousHistory,
      roundNumber: 2
    });

    expect(round2Result.round).toBe(2);
    expect(round2Result.questions).toHaveLength(1);
    expect(round2Result.questions[0].question).toContain("written reason for denying");
  });

  // Test 7: Contradictory dates trigger clarification
  test("7. Contradictory dates trigger clarification", async () => {
    // Consumer states purchase on 25 Oct 2026, but breakdown on 5 Oct 2026 (impossible chronology)
    const contradictoryComplaint = "I bought the smartphone on 25 October 2026, but the screen cracked on 5 October 2026.";
    const detected = detectDateContradictions(contradictoryComplaint);

    expect(detected.length).toBeGreaterThan(0);
    expect(detected[0]).toContain("Chronological discrepancy");

    // Analysis preserves contradiction
    setCustomGenerator(async () => ({
      response: {
        text: () => JSON.stringify({
          disputeCategory: "Defective Product",
          productOrService: "Smartphone",
          companyOrSeller: "Not provided",
          purchaseOrServiceDate: "25 October 2026",
          disputedAmount: "Not provided",
          reportedProblem: contradictoryComplaint,
          possibleContradictions: detected,
          missingMaterialFacts: [],
          extractedFacts: [contradictoryComplaint]
        })
      }
    }));

    const analysis = await analyzeComplaint({ complaint: contradictoryComplaint });
    expect(analysis.possibleContradictions.length).toBeGreaterThan(0);

    // Follow-up question generation targets the contradiction
    setCustomGenerator(async () => ({
      response: {
        text: () => JSON.stringify([])
      }
    }));

    const qResult = await generateFollowUpQuestions({
      analysis,
      roundNumber: 1
    });

    // Should include contradiction clarifying question
    expect(qResult.questions.some((q) => q.importance === "CRITICAL" && q.question.toLowerCase().includes("discrepancy"))).toBe(true);
  });

  // Test 8: AI failures do not erase the case
  test("8. AI failures do not erase the case and fallback safely", async () => {
    // Force Gemini to throw an unexpected network failure
    setCustomGenerator(async () => {
      throw new Error("Gemini 503 Service Unavailable / Quota Exceeded");
    });

    const complaintText = "Air conditioner cooling failed within 2 days of delivery.";
    const fallbackAnalysis = await analyzeComplaint({
      complaint: complaintText,
      product: "Daikin AC 1.5 Ton"
    });

    // Case is NOT lost; robust fallback extracted facts without hallucinating
    expect(fallbackAnalysis).toBeDefined();
    expect(fallbackAnalysis.disputeCategory).toBe("Defective Product");
    expect(fallbackAnalysis.reportedProblem).toBe(complaintText);
    expect(fallbackAnalysis.productOrService).toBe("Daikin AC 1.5 Ton");
    expect(fallbackAnalysis.userReportedFacts).toHaveLength(1);
  });

  // Test 9: Reopening a case retrieves its questions and answers
  test("9. Reopening a case retrieves its questions and answers", async () => {
    const threadId = `phase2_test_${Date.now()}_9`;
    await createInvestigation({
      threadId,
      complaint: "Delivered counterfeit luxury watch."
    });

    await saveInitialAnalysis(
      threadId,
      { disputeCategory: "E-Commerce / Delivery Issue", missingMaterialFacts: ["Authentication certificate"] },
      [{ id: "q_cert", question: "Do you possess an authentication report from a certified jeweler?", status: "PENDING" }]
    );

    await submitClarificationAnswers(threadId, [
      { questionId: "q_cert", answer: "Yes, certified by Titan Watch Heritage lab." }
    ]);

    // Simulate browser refresh or user reopening case
    const reopened = await getThread(threadId);
    expect(reopened).not.toBeNull();
    expect(reopened.clarificationHistory).toHaveLength(1);
    expect(reopened.clarificationHistory[0].answer).toContain("Titan Watch Heritage lab");
    expect(reopened.stage).toBe(INVESTIGATION_STAGES.AWAITING_CLARIFICATION);
  });

  // Test 10: Authentication and user isolation are enforced
  test("10. Authentication and user isolation are enforced", async () => {
    const threadId = `phase2_test_${Date.now()}_10`;
    await createInvestigation({
      threadId,
      userId: dummyUserId1,
      complaint: "Private consumer dispute regarding bank credit card charges."
    });

    // Owner (dummyUserId1) can access
    const ownerDoc = await getThread(threadId, dummyUserId1);
    expect(ownerDoc).not.toBeNull();

    // Another user (dummyUserId2) MUST be denied with 403
    await expect(getThread(threadId, dummyUserId2)).rejects.toThrow(
      "Access denied: You do not own this investigation case."
    );
  });

  // Test 11: Question-round limits prevent endless loops
  test("11. Question-round limits prevent endless loops", async () => {
    const threadId = `phase2_test_${Date.now()}_11`;
    await createInvestigation({
      threadId,
      complaint: "Repeated questioning safety boundary test."
    });

    // Advance to round 3
    await advanceInvestigationRound(threadId, [{ id: "q3_1", question: "Final round question", status: "PENDING" }], false);
    await advanceInvestigationRound(threadId, [], false); // Sets clarificationRound to 3

    // When round exceeds MAX_CLARIFICATION_ROUNDS, questions stop
    const stopResult = await generateFollowUpQuestions({
      analysis: { missingMaterialFacts: ["More info"] },
      roundNumber: MAX_CLARIFICATION_ROUNDS + 1
    });

    expect(stopResult.isComplete).toBe(true);
    expect(stopResult.questions).toHaveLength(0);

    // Advancing complete marks stage AWAITING_EVIDENCE
    const finalDoc = await advanceInvestigationRound(threadId, [], true);
    expect(finalDoc.isClarificationComplete).toBe(true);
    expect(finalDoc.stage).toBe(INVESTIGATION_STAGES.AWAITING_EVIDENCE);
  });

  // Test 12: No final legal assessment is generated during Phase 2
  test("12. No final legal assessment is generated during Phase 2", async () => {
    const threadId = `phase2_test_${Date.now()}_12`;
    await createInvestigation({
      threadId,
      complaint: "Phase 2 strict boundary safety test."
    });

    await saveInitialAnalysis(
      threadId,
      { disputeCategory: "Defective Product" },
      [{ id: "q_test", question: "Test question?", status: "PENDING" }]
    );

    const doc = await getThread(threadId);
    expect(doc.assessment.status).toBe("NOT_READY");
    expect(doc.assessment.preliminaryAssessment).toBeNull();
    expect(doc.turns).toHaveLength(0);

    // Direct transition to ASSESSMENT_COMPLETE from AWAITING_CLARIFICATION is blocked by state machine
    await expect(
      updateStage(threadId, INVESTIGATION_STAGES.ASSESSMENT_COMPLETE)
    ).rejects.toThrow("Invalid stage transition");
  });

  // Test 13: Category-aware question generation across 5 key complaint categories
  test("13. Category-aware question generation across 5 key complaint categories", async () => {
    // 13.1 Electronics complaint
    const electronicsComplaint = "Smart TV purchased with 1 year warranty screen stopped working and went completely black after 2 months. Service center denies replacement.";
    const elecCategory = classifyDisputeCategory(electronicsComplaint, "Smart TV", "Sony Service Center");
    expect(elecCategory).toBe("Defective Product");
    const elecConfig = getCategoryConfig(elecCategory);
    expect(elecConfig.missingFacts).toContain("Date of purchase and delivery of the electronic product");
    expect(elecConfig.fallbackQuestions.some(q => q.id.includes("purchase_date"))).toBe(true);

    // 13.2 Banking complaint
    const bankingComplaint = "Unauthorized debit of Rs 45,000 via UPI on Google Pay without OTP. Bank branch manager refused chargeback.";
    const bankCategory = classifyDisputeCategory(bankingComplaint, "Savings Account", "HDFC Bank");
    expect(bankCategory).toBe("Banking & Payments");
    const bankConfig = getCategoryConfig(bankCategory);
    expect(bankConfig.missingFacts).toContain("Exact date and time of disputed transaction");
    expect(bankConfig.evidence).toContain("Bank Account Statement showing disputed debit");
    expect(bankConfig.fallbackQuestions.some(q => q.id.includes("reporting_timeline"))).toBe(true);

    // 13.3 Insurance complaint
    const insuranceComplaint = "Cashless mediclaim rejected by Star Health TPA for pre-existing disease clause despite 4 consecutive policy renewals.";
    const insCategory = classifyDisputeCategory(insuranceComplaint, "Health Insurance Policy", "Star Health Insurance");
    expect(insCategory).toBe("Insurance");
    const insConfig = getCategoryConfig(insCategory);
    expect(insConfig.missingFacts).toContain("Exact ground or clause stated in insurer's repudiation letter");
    expect(insConfig.fallbackQuestions.some(q => q.id.includes("repudiation_reason"))).toBe(true);

    // 13.4 Telecom complaint
    const telecomComplaint = "Airtel fiber broadband connection disconnected for 18 days despite advance recharge payment. Support refuses refund.";
    const telCategory = classifyDisputeCategory(telecomComplaint, "Fiber Broadband", "Airtel");
    expect(telCategory).toBe("Telecom & Internet");
    const telConfig = getCategoryConfig(telCategory);
    expect(telConfig.missingFacts).toContain("Telecom service identifier (Broadband ID, Mobile Number, or Customer ID)");
    expect(telConfig.fallbackQuestions.some(q => q.id.includes("outage_duration"))).toBe(true);

    // 13.5 Travel complaint
    const travelComplaint = "Flight ticket cancelled by IndiGo airlines 2 hours before departure without alternative flight or full refund.";
    const travCategory = classifyDisputeCategory(travelComplaint, "Flight 6E-204", "IndiGo Airlines");
    expect(travCategory).toBe("Travel & Hotels");
    const travConfig = getCategoryConfig(travCategory);
    expect(travConfig.missingFacts).toContain("Booking PNR, reservation code, or ticket number");
    expect(travConfig.fallbackQuestions.some(q => q.id.includes("pnr"))).toBe(true);

    // Verify questions generated in fallback mode for banking do NOT hallucinate electronics warranty/job cards
    setCustomGenerator(async () => {
      throw new Error("AI service unavailable for test");
    });

    const bankQuestions = await generateFollowUpQuestions({
      analysis: {
        disputeCategory: bankCategory,
        productOrService: "Savings Account",
        companyOrSeller: "HDFC Bank",
        missingMaterialFacts: bankConfig.missingFacts,
        possibleContradictions: []
      },
      roundNumber: 1
    });

    expect(bankQuestions.questions.length).toBeGreaterThanOrEqual(2);
    // Should contain banking terms, not electronics warranty terms
    const questionsText = bankQuestions.questions.map(q => q.question.toLowerCase()).join(" ");
    expect(questionsText).not.toContain("job sheet");
    expect(questionsText).not.toContain("technician");
    expect(questionsText).toContain("bank");
  });

  // Test 14: Generic fallback for ambiguous/unclassified complaints
  test("14. Generic fallback question generation when category is ambiguous", async () => {
    const ambiguousComplaint = "I paid 15,000 rupees to an agency for consulting but they vanished and stopped answering my calls.";
    const category = classifyDisputeCategory(ambiguousComplaint, "", "");
    expect(category).toBe("General Consumer Dispute");

    setCustomGenerator(async () => {
      throw new Error("AI service unavailable for test");
    });

    const genericQuestions = await generateFollowUpQuestions({
      analysis: {
        disputeCategory: category,
        productOrService: "Consulting",
        companyOrSeller: "Unknown Agency",
        missingMaterialFacts: ["Payment proof", "Transaction date"],
        possibleContradictions: []
      },
      roundNumber: 1
    });

    expect(genericQuestions.questions.length).toBeGreaterThanOrEqual(2);
    // Verifies generic questions don't assume defective electronics
    const qText = genericQuestions.questions.map(q => q.question.toLowerCase()).join(" ");
    expect(qText).not.toContain("service center");
    expect(qText).not.toContain("warranty card");
    expect(genericQuestions.questions.some(q => q.type === "radio" || q.type === "date" || q.type === "numeric")).toBe(true);
  });

  // Test 15: Answer controls generation (radio, checkbox, date, numeric, text) and payload normalization
  test("15. Answer controls generation and payload normalization", async () => {
    // 15.1 Verify structured controls attributes
    const insConfig = getCategoryConfig("Insurance");
    const radioQ = insConfig.fallbackQuestions.find(q => q.type === "radio" || q.type === "single_choice");
    expect(radioQ).toBeDefined();
    expect(Array.isArray(radioQ.options)).toBe(true);
    expect(radioQ.options.length).toBeGreaterThanOrEqual(2);

    const checkboxQ = insConfig.fallbackQuestions.find(q => q.type === "checkbox" || q.type === "multiple_choice");
    expect(checkboxQ).toBeDefined();
    expect(Array.isArray(checkboxQ.options)).toBe(true);

    const generalConfig = getCategoryConfig("General Consumer Dispute");
    const numQ = generalConfig.fallbackQuestions.find(q => q.type === "numeric" || q.type === "number");
    expect(numQ).toBeDefined();
    expect(numQ.unit).toBe("₹");

    const dateQ = generalConfig.fallbackQuestions.find(q => q.type === "date");
    expect(dateQ).toBeDefined();

    // 15.2 Verify normalizeAnswerPayload
    // Radio single-choice string
    const normRadio = normalizeAnswerPayload("UPI");
    expect(normRadio.value).toBe("UPI");
    expect(normRadio.text).toBe("UPI");

    // Radio with Other custom text
    const normOther = normalizeAnswerPayload({ selected: "Other", otherText: "Direct IMPS Bank Transfer" });
    expect(normOther.value).toBe("Direct IMPS Bank Transfer");
    expect(normOther.text).toBe("Direct IMPS Bank Transfer");

    // Checkbox multi-choice array
    const normCheckbox = normalizeAnswerPayload(["Delayed refund", "Rude staff communication"]);
    expect(normCheckbox.value).toEqual(["Delayed refund", "Rude staff communication"]);
    expect(normCheckbox.text).toBe("Delayed refund, Rude staff communication");

    // Date picker
    const normDate = normalizeAnswerPayload("2026-10-05");
    expect(normDate.value).toBe("2026-10-05");
    expect(normDate.text).toBe("2026-10-05");

    // Numeric input
    const normNumeric = normalizeAnswerPayload(45000);
    expect(normNumeric.value).toBe(45000);
    expect(normNumeric.text).toBe("45000");

    // Text explanation
    const normText = normalizeAnswerPayload("Branch manager refused to accept formal written complaint.");
    expect(normText.value).toBe("Branch manager refused to accept formal written complaint.");
    expect(normText.text).toBe("Branch manager refused to accept formal written complaint.");
  });

  // Test 16: Conditional follow-up question definitions and handling
  test("16. Conditional follow-up question definitions and submission", async () => {
    const bankConfig = getCategoryConfig("Banking & Payments");
    const parentQ = bankConfig.fallbackQuestions.find(q => q.conditionalFollowUp);
    expect(parentQ).toBeDefined();
    expect(parentQ.conditionalFollowUp.parentQuestionId).toBe(parentQ.id);
    expect(Array.isArray(parentQ.conditionalFollowUp.showIfOptions)).toBe(true);
    expect(parentQ.conditionalFollowUp.type).toBeDefined();

    // Create an investigation thread and save questions
    const threadId = `phase2_test_${Date.now()}_16`;
    await createInvestigation({
      threadId,
      complaint: "Unauthorized UPI transaction dispute."
    });

    await saveInitialAnalysis(
      threadId,
      { disputeCategory: "Banking & Payments", missingMaterialFacts: ["Bank report"] },
      [
        {
          id: parentQ.id,
          question: parentQ.question,
          type: parentQ.type,
          options: parentQ.options,
          status: "PENDING",
          conditionalFollowUp: parentQ.conditionalFollowUp
        }
      ]
    );

    // User submits parent answer and follow-up answer together
    const answers = [
      { questionId: parentQ.id, answer: parentQ.conditionalFollowUp.showIfOptions[0] },
      { questionId: parentQ.conditionalFollowUp.id, answer: "Reported on 2026-10-02, Ticket #HDFC998231" }
    ];

    const updated = await submitClarificationAnswers(threadId, answers);
    expect(updated.clarificationHistory.length).toBe(2);
    expect(updated.clarificationHistory.some(c => c.questionId === parentQ.id)).toBe(true);
    expect(updated.clarificationHistory.some(c => c.questionId === parentQ.conditionalFollowUp.id)).toBe(true);
  });

  // Test 17: Resilient handling of malformed and empty AI responses in Round 1
  test("17. Resilient handling of malformed and empty AI responses in Round 1", async () => {
    // 17.1 Malformed JSON object (not an array or questions object)
    setCustomGenerator(async () => ({
      response: {
        text: () => JSON.stringify({ randomKey: "unexpected format", valid: false })
      }
    }));

    const malformedResult = await generateFollowUpQuestions({
      analysis: {
        disputeCategory: "Banking & Payments",
        productOrService: "UPI Account",
        companyOrSeller: "Bank",
        missingMaterialFacts: ["Transaction date"],
        possibleContradictions: []
      },
      roundNumber: 1
    });

    // Recovers gracefully with category questions instead of 0 questions
    expect(malformedResult.questions.length).toBeGreaterThanOrEqual(1);
    expect(malformedResult.isComplete).toBe(false);

    // 17.2 Completely empty array in Round 1 must fallback to category questions
    setCustomGenerator(async () => ({
      response: {
        text: () => "[]"
      }
    }));

    const emptyArrayResult = await generateFollowUpQuestions({
      analysis: {
        disputeCategory: "Travel & Hotels",
        productOrService: "Flight Ticket",
        companyOrSeller: "Airline",
        missingMaterialFacts: ["Flight PNR"],
        possibleContradictions: []
      },
      roundNumber: 1
    });

    expect(emptyArrayResult.questions.length).toBeGreaterThanOrEqual(1);
    expect(emptyArrayResult.isComplete).toBe(false);

    // 17.3 Verify output NEVER contains misleading callback / phone call promises
    const allQTexts = emptyArrayResult.questions.map(q => q.question.toLowerCase()).join(" ");
    expect(allQTexts).not.toContain("called again");
    expect(allQTexts).not.toContain("call you back");
    expect(allQTexts).not.toContain("phone call");
  });

  // Test 18: Answer persistence with updates/edits without duplicate history or fact entries
  test("18. Answer persistence with updates/edits without duplicate history or fact entries", async () => {
    const threadId = `phase2_test_${Date.now()}_18`;
    await createInvestigation({
      threadId,
      complaint: "Double charge on debit card at merchant POS terminal."
    });

    await saveInitialAnalysis(
      threadId,
      { disputeCategory: "Banking & Payments", missingMaterialFacts: ["Payment method", "Merchant name"] },
      [
        { id: "q_method", question: "What was the payment method used?", status: "PENDING", type: "radio" },
        { id: "q_amount", question: "What was the total disputed amount?", status: "PENDING", type: "numeric" }
      ]
    );

    // User submits first answer
    const firstSubmission = await submitClarificationAnswers(threadId, [
      { questionId: "q_method", answer: "Debit Card" }
    ]);
    expect(firstSubmission.clarificationHistory).toHaveLength(1);
    expect(firstSubmission.clarificationHistory[0].answer).toBe("Debit Card");

    const factCountAfterFirst = firstSubmission.userReportedFacts.filter(f => f.source === "CLARIFICATION_ANSWER").length;
    expect(factCountAfterFirst).toBe(1);

    // User edits / updates their previous answer (e.g. realizing it was actually UPI)
    const editedSubmission = await submitClarificationAnswers(threadId, [
      { questionId: "q_method", answer: "UPI / QR Code" }
    ]);

    // MUST NOT create a duplicate entry in clarificationHistory
    expect(editedSubmission.clarificationHistory).toHaveLength(1);
    expect(editedSubmission.clarificationHistory[0].answer).toBe("UPI / QR Code");

    // MUST NOT duplicate userReportedFacts
    const factCountAfterEdit = editedSubmission.userReportedFacts.filter(f => f.source === "CLARIFICATION_ANSWER").length;
    expect(factCountAfterEdit).toBe(1);
    expect(editedSubmission.userReportedFacts.find(f => f.source === "CLARIFICATION_ANSWER").text).toBe("UPI / QR Code");

    // Answering second question increases count to 2 cleanly
    const secondQSubmission = await submitClarificationAnswers(threadId, [
      { questionId: "q_amount", answer: 12500 }
    ]);
    expect(secondQSubmission.clarificationHistory).toHaveLength(2);
  });

  // Test 19: Duplicate and idempotent submission handling
  test("19. Duplicate and idempotent submission handling", async () => {
    const threadId = `phase2_test_${Date.now()}_19`;
    await createInvestigation({
      threadId,
      complaint: "Broadband disconnection grievance."
    });

    await saveInitialAnalysis(
      threadId,
      { disputeCategory: "Telecom & Internet" },
      [{ id: "q_docket", question: "What is your ticket docket number?", status: "PENDING" }]
    );

    // Submit answer
    await submitClarificationAnswers(threadId, [
      { questionId: "q_docket", answer: "DOC-2026-99124" }
    ]);

    // User or network retries identical submission
    const resubmitted = await submitClarificationAnswers(threadId, [
      { questionId: "q_docket", answer: "DOC-2026-99124" }
    ]);

    expect(resubmitted.clarificationHistory).toHaveLength(1);
    expect(resubmitted.clarificationHistory[0].answer).toBe("DOC-2026-99124");
    const clarificationFacts = resubmitted.userReportedFacts.filter(f => f.source === "CLARIFICATION_ANSWER");
    expect(clarificationFacts).toHaveLength(1);
  });

  // Test 20: Guest token security and isolation during clarification questioning
  test("20. Guest token security and isolation during clarification questioning", async () => {
    const threadId = `guest_question_${Date.now()}_20`;
    const created = await createInvestigation({
      threadId,
      complaint: "Guest dispute regarding defective air purifier.",
      generateGuestToken: true
    });

    expect(created.guestToken).toBeDefined();
    expect(created.guestToken.length).toBe(64);
    expect(created.guestTokenHash).toBe(hashGuestToken(created.guestToken));

    // Save initial questions
    await saveInitialAnalysis(
      threadId,
      { disputeCategory: "Defective Product" },
      [{ id: "q_guest_1", question: "What is the filter replacement status?", status: "PENDING" }],
      null,
      created.guestToken
    );

    // Reading with valid guest token succeeds
    const guestDoc = await getThread(threadId, null, created.guestToken);
    expect(guestDoc).not.toBeNull();
    expect(guestDoc.unresolvedQuestions).toHaveLength(1);

    // Submitting answer with valid guest token succeeds
    const answeredDoc = await submitClarificationAnswers(
      threadId,
      [{ questionId: "q_guest_1", answer: "Replaced last week with genuine filter." }],
      null,
      created.guestToken
    );
    expect(answeredDoc.clarificationHistory).toHaveLength(1);

    // Tampered guest token fails with 403
    await expect(
      getThread(threadId, null, "invalid_tampered_guest_token_00000000000000000000000000000000")
    ).rejects.toThrow("Access denied: Invalid guest access token.");

    // Another guest's token fails with 403
    const otherGuestThread = await createInvestigation({
      threadId: `other_guest_${Date.now()}`,
      complaint: "Unrelated guest case.",
      generateGuestToken: true
    });

    await expect(
      getThread(threadId, null, otherGuestThread.guestToken)
    ).rejects.toThrow("Access denied: Invalid guest access token.");
  });
});

