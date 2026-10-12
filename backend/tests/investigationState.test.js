import {
  createInvestigation,
  getThread,
  updateStage,
  saveClarificationResponse,
  saveTurn
} from "../services/threadService.js";
import { INVESTIGATION_STAGES } from "../models/Thread.js";
import mongoose from "mongoose";

describe("Phase 1: Investigation State Machine & Schema Foundation", () => {
  const dummyUserId1 = new mongoose.Types.ObjectId().toString();
  const dummyUserId2 = new mongoose.Types.ObjectId().toString();

  // Test 1: A new investigation can be created without a judgment
  test("1. A new investigation can be created without a judgment", async () => {
    const threadId = `test_inv_${Date.now()}_1`;
    const result = await createInvestigation({
      threadId,
      complaint: "Defective television screen started flickering after 3 days.",
      category: "Defective Product"
    });

    expect(result).toBeDefined();
    expect(result.threadId).toBe(threadId);
    expect(result.turns).toHaveLength(0);
    expect(result.assessment.status).toBe("NOT_READY");
    expect(result.assessment.preliminaryAssessment).toBeNull();
  });

  // Test 2: Product, company, amount, and complaint are persisted correctly
  test("2. Product, company, amount, and complaint are persisted correctly", async () => {
    const threadId = `test_inv_${Date.now()}_2`;
    const complaintText = "Smartphone battery bloated after 1 week of delivery.";
    const result = await createInvestigation({
      threadId,
      complaint: complaintText,
      product: "Apex Pro 5G",
      company: "ElectroHub Retailers Ltd",
      amount: "45000",
      category: "Defective Product"
    });

    expect(result.intake.complaint).toBe(complaintText);
    expect(result.intake.product).toBe("Apex Pro 5G");
    expect(result.intake.company).toBe("ElectroHub Retailers Ltd");
    expect(result.intake.amount).toBe("45000");
    expect(result.userReportedFacts).toHaveLength(1);
    expect(result.userReportedFacts[0].text).toBe(complaintText);
    expect(result.userReportedFacts[0].source).toBe("USER_INPUT");
  });

  // Test 3: The investigation stage is persisted as INITIAL_ANALYSIS
  test("3. The investigation stage is persisted as INITIAL_ANALYSIS", async () => {
    const threadId = `test_inv_${Date.now()}_3`;
    const result = await createInvestigation({
      threadId,
      complaint: "E-commerce seller delivered empty box and denied refund."
    });

    expect(result.stage).toBe(INVESTIGATION_STAGES.INITIAL_ANALYSIS);
  });

  // Test 4: An investigation can be retrieved after creation
  test("4. An investigation can be retrieved after creation", async () => {
    const threadId = `test_inv_${Date.now()}_4`;
    await createInvestigation({
      threadId,
      complaint: "Air conditioner compressor failed in warranty period.",
      product: "CoolBreeze AC 1.5 Ton"
    });

    const retrieved = await getThread(threadId);
    expect(retrieved).not.toBeNull();
    expect(retrieved.threadId).toBe(threadId);
    expect(retrieved.intake.product).toBe("CoolBreeze AC 1.5 Ton");
    expect(retrieved.stage).toBe(INVESTIGATION_STAGES.INITIAL_ANALYSIS);
  });

  // Test 5: A clarification response can be stored
  test("5. A clarification response can be stored and updates user-reported facts", async () => {
    const threadId = `test_inv_${Date.now()}_5`;
    await createInvestigation({
      threadId,
      complaint: "Car brake failure after first authorized service."
    });

    const clarification = await saveClarificationResponse(
      threadId,
      "q_invoice_date",
      "I received the car back on 5th October 2026 with job card number JC-9921.",
      "When did you receive the vehicle and what is the job card number?"
    );

    expect(clarification.clarificationHistory).toHaveLength(1);
    expect(clarification.clarificationHistory[0].questionId).toBe("q_invoice_date");
    expect(clarification.clarificationHistory[0].answer).toContain("job card number JC-9921");
    // Fact count increases from 1 (complaint) to 2 (clarification)
    expect(clarification.userReportedFacts).toHaveLength(2);
    expect(clarification.userReportedFacts[1].source).toBe("CLARIFICATION_ANSWER");
  });

  // Test 6: Invalid input is rejected safely
  test("6. Invalid input is rejected safely", async () => {
    // Missing complaint
    await expect(createInvestigation({ complaint: "" })).rejects.toThrow(
      "Complaint is required to initialize an investigation."
    );

    // Empty clarification answer
    const threadId = `test_inv_${Date.now()}_6`;
    await createInvestigation({ threadId, complaint: "Valid complaint text." });
    await expect(
      saveClarificationResponse(threadId, "q1", "")
    ).rejects.toThrow("Answer must be a non-empty string.");

    // Unknown stage transition
    await expect(
      updateStage(threadId, "NON_EXISTENT_STAGE")
    ).rejects.toThrow("Invalid stage: \"NON_EXISTENT_STAGE\"");
  });

  // Test 7: Existing completed debate records remain readable
  test("7. Existing completed debate records remain readable with ASSESSMENT_COMPLETE", async () => {
    const threadId = `legacy_turn_${Date.now()}_7`;

    // Simulate saving a legacy completed turn
    await saveTurn(
      threadId,
      {
        question: "Legacy complaint about flight refund delay.",
        retrievedContext: "Section 2(11) CPA 2019",
        support: { applicable_sections: ["Section 2(11)"] },
        oppose: { procedural_defenses: ["Airlines T&C"] },
        judge: { decision: "🟢 Consumer case stronger", overall_confidence: 0.85 }
      },
      dummyUserId1,
      "Aviation / Refund"
    );

    const retrieved = await getThread(threadId, dummyUserId1);
    expect(retrieved).not.toBeNull();
    expect(retrieved.threadId).toBe(threadId);
    expect(retrieved.turns).toHaveLength(1);
    expect(retrieved.turns[0].judge.decision).toBe("🟢 Consumer case stronger");
    expect(retrieved.stage).toBe(INVESTIGATION_STAGES.ASSESSMENT_COMPLETE);
  });

  // Test 8: Authentication and user isolation remain enforced
  test("8. Authentication and user isolation remain enforced", async () => {
    const threadId = `test_inv_${Date.now()}_8`;
    await createInvestigation({
      threadId,
      userId: dummyUserId1,
      complaint: "Private consumer dispute regarding medical negligence billing."
    });

    // Owner can access
    const ownerAccess = await getThread(threadId, dummyUserId1);
    expect(ownerAccess).not.toBeNull();
    expect(ownerAccess.threadId).toBe(threadId);

    // Different user cannot access
    await expect(getThread(threadId, dummyUserId2)).rejects.toThrow(
      "Access denied: You do not own this investigation case."
    );
  });

  // Test 9: Invalid stage transitions are handled appropriately
  test("9. Invalid stage transitions are prevented (e.g. INITIAL_ANALYSIS to ASSESSMENT_COMPLETE)", async () => {
    const threadId = `test_inv_${Date.now()}_9`;
    await createInvestigation({
      threadId,
      complaint: "Phone screen broken out of box."
    });

    // Illegal jump directly from INITIAL_ANALYSIS to ASSESSMENT_COMPLETE
    await expect(
      updateStage(threadId, INVESTIGATION_STAGES.ASSESSMENT_COMPLETE)
    ).rejects.toThrow(
      /Invalid stage transition from "INITIAL_ANALYSIS" to "ASSESSMENT_COMPLETE"/
    );

    // Legal transition to AWAITING_CLARIFICATION
    const updated = await updateStage(threadId, INVESTIGATION_STAGES.AWAITING_CLARIFICATION);
    expect(updated.stage).toBe(INVESTIGATION_STAGES.AWAITING_CLARIFICATION);

    // Legal transition from AWAITING_CLARIFICATION to EVIDENCE_REVIEW
    const reviewed = await updateStage(threadId, INVESTIGATION_STAGES.EVIDENCE_REVIEW);
    expect(reviewed.stage).toBe(INVESTIGATION_STAGES.EVIDENCE_REVIEW);
  });
});
