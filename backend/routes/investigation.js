import express from "express";
import {
  createInvestigation,
  getThread,
  updateStage,
  saveClarificationResponse,
  recordInvestigationProgress,
  saveInitialAnalysis,
  submitClarificationAnswers,
  advanceInvestigationRound,
  sanitizeStageMetadata
} from "../services/threadService.js";
import {
  analyzeComplaint,
  generateFollowUpQuestions,
  MAX_CLARIFICATION_ROUNDS
} from "../services/investigationAnalysis.js";
import { optionalProtect } from "../middleware/authMiddleware.js";
import { INVESTIGATION_STAGES } from "../models/Thread.js";
import {
  uploadAndInspectEvidence,
  markDocumentUnavailable,
  submitDocumentCorrection,
  getEvidenceFile,
  removeEvidenceDocument,
  clarifyEvidenceRelevance
} from "../services/evidenceService.js";
import { researchCompanyPolicy } from "../services/companyPolicyService.js";
import {
  evaluateInvestigationGate,
  proceedWithLimitations
} from "../services/investigationGateService.js";
import { generateLegalAssessment } from "../services/legalAssessmentService.js";
import {
  generateFinalCaseOutcome,
  getFinalCaseOutcome
} from "../services/finalOutcomeService.js";
import {
  getTransferAssessmentData,
  saveTransferAssessmentReview
} from "../services/transferAssessmentService.js";
import {
  generateInvestigationReportPDF,
  generateFinalOutcomePDF
} from "../services/pdfGenerator.js";
import taiRouter from "./tai.js";

const router = express.Router();

// Mount TAI (Tribunal & Triage Artificial Intelligence) Central AI sub-router
router.use("/:threadId/tai", taiRouter);

/**
 * @route POST /api/investigation
 * @desc Creates a new investigation record before any legal judgment exists
 */
router.post("/", optionalProtect, async (req, res) => {
  try {
    const {
      complaint,
      question,
      product,
      company,
      amount,
      category,
      threadId
    } = req.body;

    const initialText = complaint || question;
    if (!initialText || typeof initialText !== "string" || !initialText.trim()) {
      return res.status(400).json({
        error: "Complaint text is required to start an investigation."
      });
    }

    const userId = req.user ? req.user._id : null;

    const result = await createInvestigation({
      threadId,
      userId,
      complaint: initialText.trim(),
      product,
      company,
      amount,
      category,
      generateGuestToken: !userId
    });

    const guestToken = result.guestToken || null;
    delete result.guestToken;

    return res.status(201).json({
      success: true,
      investigation: result,
      ...(guestToken ? { guestToken } : {})
    });
  } catch (err) {
    console.error("❌ Error creating investigation:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to initialize investigation."
    });
  }
});

/**
 * @route GET /api/investigation/:threadId
 * @desc Retrieves an investigation by threadId, enforcing user isolation
 */
router.get("/:threadId", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const investigation = await getThread(threadId, userId, guestToken);
    if (!investigation) {
      return res.status(404).json({
        error: `Investigation with threadId "${threadId}" not found.`
      });
    }

    return res.status(200).json({
      success: true,
      investigation
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error fetching investigation:", err.message);
    return res.status(500).json({
      error: "Failed to retrieve investigation details."
    });
  }
});

/**
 * @route POST /api/investigation/:threadId/analyze
 * @desc Executes initial structured analysis and generates first round of questions
 */
router.post("/:threadId/analyze", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const existing = await getThread(threadId, userId, guestToken);
    if (!existing) {
      return res.status(404).json({
        error: `Investigation with threadId "${threadId}" not found.`
      });
    }

    // Idempotency: If questions already generated for round 1, return them
    const pendingQuestions = (existing.unresolvedQuestions || []).filter((q) => q.status === "PENDING");
    if (pendingQuestions.length > 0 && existing.initialAnalysis?.disputeCategory) {
      return res.status(200).json({
        success: true,
        message: "Existing analysis retrieved.",
        analysis: existing.initialAnalysis,
        questions: pendingQuestions,
        stage: existing.stage,
        investigation: existing
      });
    }

    const complaint = existing.intake?.complaint || "";
    const product = existing.intake?.product || "";
    const company = existing.intake?.company || "";
    const amount = existing.intake?.amount || "";
    const category = existing.category || existing.intake?.category || "";

    // 1. Analyze initial complaint with category awareness
    const analysis = await analyzeComplaint({ complaint, product, company, amount, category });

    // 2. Generate Round 1 follow-up questions
    const questionResult = await generateFollowUpQuestions({
      analysis,
      intake: existing.intake,
      clarificationHistory: existing.clarificationHistory || [],
      userReportedFacts: existing.userReportedFacts || [],
      roundNumber: 1
    });

    // 3. Persist analysis and questions
    const updated = await saveInitialAnalysis(
      threadId,
      analysis,
      questionResult.questions,
      userId,
      guestToken
    );

    return res.status(200).json({
      success: true,
      message: "Initial analysis and follow-up questions generated.",
      analysis: updated.initialAnalysis,
      questions: questionResult.questions,
      stage: updated.stage,
      investigation: updated
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error analyzing investigation:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to analyze complaint."
    });
  }
});

/**
 * @route POST /api/investigation/:threadId/answers
 * @desc Submits clarification answers (single or batch) and retrieves next round or finishes clarification
 */
router.post("/:threadId/answers", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { answers, questionId, answer, question } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const existing = await getThread(threadId, userId, guestToken);
    if (!existing) {
      return res.status(404).json({
        error: `Investigation with threadId "${threadId}" not found.`
      });
    }

    // Normalize input to array of { questionId, answer, question }
    let answersList = [];
    if (Array.isArray(answers)) {
      answersList = answers;
    } else if (answers && typeof answers === "object") {
      // Map format { "q1": "Answer text" }
      answersList = Object.entries(answers).map(([qId, ans]) => ({
        questionId: qId,
        answer: ans
      }));
    } else if (questionId && answer !== undefined && answer !== null) {
      // Single answer format
      answersList = [{ questionId, answer, question }];
    }

    if (answersList.length === 0) {
      return res.status(400).json({
        error: "At least one answer must be provided."
      });
    }

    // Validate answers (support strings, numbers, arrays, and objects)
    for (const a of answersList) {
      if (!a.questionId || typeof a.questionId !== "string") {
        return res.status(400).json({ error: "questionId is required for each answer." });
      }
      if (
        a.answer === null ||
        a.answer === undefined ||
        (typeof a.answer === "string" && !a.answer.trim()) ||
        (Array.isArray(a.answer) && a.answer.length === 0) ||
        (typeof a.answer === "object" && !Array.isArray(a.answer) && Object.keys(a.answer).length === 0)
      ) {
        return res.status(400).json({ error: `Answer for question "${a.questionId}" cannot be empty.` });
      }
    }

    // 1. Save answers to database
    const threadAfterAnswers = await submitClarificationAnswers(threadId, answersList, userId, guestToken);

    // 2. Determine whether another round of questions is required
    const currentRound = threadAfterAnswers.clarificationRound || 1;

    if (currentRound >= MAX_CLARIFICATION_ROUNDS) {
      // Round limit reached -> complete clarification
      const completedDoc = await advanceInvestigationRound(threadId, [], true, userId, guestToken);
      return res.status(200).json({
        success: true,
        clarificationComplete: true,
        message: "Maximum clarification rounds reached. Proceeding to evidence collection.",
        nextQuestions: [],
        round: currentRound,
        stage: completedDoc.stage,
        investigation: completedDoc
      });
    }

    // 3. Generate subsequent round of questions based on updated facts & answers
    const nextRoundResult = await generateFollowUpQuestions({
      analysis: threadAfterAnswers.initialAnalysis,
      intake: threadAfterAnswers.intake,
      clarificationHistory: threadAfterAnswers.clarificationHistory || [],
      userReportedFacts: threadAfterAnswers.userReportedFacts || [],
      roundNumber: currentRound + 1
    });

    if (nextRoundResult.isComplete || nextRoundResult.questions.length === 0) {
      // No more material missing facts
      const completedDoc = await advanceInvestigationRound(threadId, [], true, userId, guestToken);
      return res.status(200).json({
        success: true,
        clarificationComplete: true,
        message: "Sufficient clarification gathered. Proceeding to evidence collection.",
        nextQuestions: [],
        round: currentRound,
        stage: completedDoc.stage,
        investigation: completedDoc
      });
    }

    // 4. Save new questions for the next round
    const updatedWithNextRound = await advanceInvestigationRound(
      threadId,
      nextRoundResult.questions,
      false,
      userId,
      guestToken
    );

    return res.status(200).json({
      success: true,
      clarificationComplete: false,
      message: `Round ${currentRound + 1} questions generated.`,
      nextQuestions: nextRoundResult.questions,
      round: currentRound + 1,
      stage: updatedWithNextRound.stage,
      investigation: updatedWithNextRound
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error saving clarification answers:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to submit clarification answers."
    });
  }
});

/**
 * @route POST /api/investigation/:threadId/proceed
 * @desc Explicitly stops questioning and proceeds to evidence stage
 */
router.post("/:threadId/proceed", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const existing = await getThread(threadId, userId, guestToken);
    if (!existing) {
      return res.status(404).json({
        error: `Investigation with threadId "${threadId}" not found.`
      });
    }

    const updated = await advanceInvestigationRound(threadId, [], true, userId, guestToken);

    return res.status(200).json({
      success: true,
      clarificationComplete: true,
      message: "Clarification ended by user. Proceeding to evidence collection.",
      stage: updated.stage,
      investigation: updated
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error proceeding investigation:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to proceed to next stage."
    });
  }
});

/**
 * @route POST /api/investigation/:threadId/clarify
 * @desc Saves a single clarification response (preserved for backward compatibility)
 */
router.post("/:threadId/clarify", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { questionId, question, answer } = req.body;

    if (!questionId || typeof questionId !== "string") {
      return res.status(400).json({ error: "questionId is required." });
    }
    if (!answer || typeof answer !== "string" || !answer.trim()) {
      return res.status(400).json({ error: "answer must be a non-empty string." });
    }

    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const existing = await getThread(threadId, userId, guestToken);
    if (!existing) {
      return res.status(404).json({
        error: `Investigation with threadId "${threadId}" not found.`
      });
    }

    const updated = await saveClarificationResponse(
      threadId,
      questionId.trim(),
      answer.trim(),
      question || "",
      userId,
      guestToken
    );

    return res.status(200).json({
      success: true,
      message: "Clarification recorded successfully.",
      investigation: updated
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error saving clarification:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to record clarification."
    });
  }
});

/**
 * @route PATCH /api/investigation/:threadId/stage
 * @desc Updates the investigation stage with strict transition validation
 */
router.patch("/:threadId/stage", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { stage, metadata } = req.body;

    if (!stage || !Object.values(INVESTIGATION_STAGES).includes(stage)) {
      return res.status(400).json({
        error: `Invalid stage. Must be one of: ${Object.values(INVESTIGATION_STAGES).join(", ")}`
      });
    }

    // Direct client bypass to terminal assessment stages is prohibited
    const CLIENT_RESTRICTED_STAGES = [
      INVESTIGATION_STAGES.READY_FOR_ASSESSMENT,
      INVESTIGATION_STAGES.ASSESSMENT_COMPLETE
    ];
    if (CLIENT_RESTRICTED_STAGES.includes(stage)) {
      return res.status(400).json({
        error: `Direct client transition to stage "${stage}" is prohibited. This stage must be reached through the verified investigation workflow.`
      });
    }

    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const updated = await updateStage(threadId, stage, userId, metadata || {}, guestToken);

    return res.status(200).json({
      success: true,
      stage: updated.stage,
      investigation: updated
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404 || (err.message && err.message.includes("not found"))) {
      return res.status(404).json({ error: err.message });
    }
    if (err.statusCode === 400 || (err.message && (err.message.includes("Invalid stage") || err.message.includes("prohibited") || err.message.includes("Unsupported")))) {
      return res.status(400).json({ error: err.message });
    }
    console.error("❌ Error updating investigation stage:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to update investigation stage."
    });
  }
});

/**
 * ========================================================
 * PHASE 3: EVIDENCE UPLOAD & DOCUMENT INSPECTION ROUTES
 * ========================================================
 */

/**
 * @route POST /api/investigation/:threadId/evidence/upload
 * @desc Uploads, safely stores, and inspects an evidence document
 */
router.post("/:threadId/evidence/upload", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const {
      filename,
      originalName,
      mimeType,
      dataBase64,
      fileBase64,
      category,
      title
    } = req.body;

    const rawData = dataBase64 || fileBase64;
    if (!rawData || typeof rawData !== "string") {
      return res.status(400).json({
        error: "File data (dataBase64 or fileBase64) is required."
      });
    }

    // Strip optional data URI prefix e.g. "data:application/pdf;base64,"
    let cleanBase64 = rawData;
    if (cleanBase64.includes(";base64,")) {
      cleanBase64 = cleanBase64.split(";base64,")[1];
    }

    const buffer = Buffer.from(cleanBase64, "base64");
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        error: "Uploaded file content is empty or invalid base64 encoding."
      });
    }

    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await uploadAndInspectEvidence({
      threadId,
      buffer,
      originalName: originalName || filename || "evidence_document",
      mimeType: mimeType || "application/octet-stream",
      category: category || "OTHER",
      title: title || "",
      userId,
      guestToken
    });

    return res.status(201).json({
      success: true,
      evidence: result.document,
      investigation: result.investigation
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.statusCode === 400 || (err.message && (err.message.includes("Invalid") || err.message.includes("Unsupported") || err.message.includes("exceeds")))) {
      return res.status(400).json({ error: err.message });
    }
    console.error("❌ Error uploading evidence:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to upload and inspect evidence."
    });
  }
});

/**
 * @route POST /api/investigation/:threadId/evidence/:evidenceId/unavailable
 * @desc Marks an evidence document as unavailable by the consumer
 */
router.post("/:threadId/evidence/:evidenceId/unavailable", optionalProtect, async (req, res) => {
  try {
    const { threadId, evidenceId } = req.params;
    const { reason } = req.body;

    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await markDocumentUnavailable(
      threadId,
      evidenceId,
      reason,
      userId,
      guestToken
    );

    return res.status(200).json({
      success: true,
      evidence: result.item,
      investigation: result.investigation
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error marking evidence unavailable:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to record unavailable evidence."
    });
  }
});

/**
 * @route POST /api/investigation/:threadId/evidence/:evidenceId/correction
 * @desc Allows consumer to correct extracted document interpretation without altering disk file
 */
router.post("/:threadId/evidence/:evidenceId/correction", optionalProtect, async (req, res) => {
  try {
    const { threadId, evidenceId } = req.params;
    const { correctedText, notes } = req.body;

    if ((!correctedText || !correctedText.trim()) && (!notes || !notes.trim())) {
      return res.status(400).json({
        error: "Correction text or explanatory notes are required."
      });
    }

    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await submitDocumentCorrection(
      threadId,
      evidenceId,
      { correctedText, notes },
      userId,
      guestToken
    );

    return res.status(200).json({
      success: true,
      evidence: result.item,
      investigation: result.investigation
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error correcting evidence:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to submit evidence correction."
    });
  }
});

/**
 * @route GET /api/investigation/:threadId/evidence/:evidenceId/file
 * @desc Securely downloads an uploaded evidence file with strict authorization
 */
router.get("/:threadId/evidence/:evidenceId/file", optionalProtect, async (req, res) => {
  try {
    const { threadId, evidenceId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const fileMeta = await getEvidenceFile(threadId, evidenceId, userId, guestToken);

    return res.download(fileMeta.filePath, fileMeta.originalName);
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error downloading evidence file:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to download evidence file."
    });
  }
});

/**
 * @route DELETE /api/investigation/:threadId/evidence/:evidenceId
 * @desc Removes an incorrectly uploaded or irrelevant evidence document and updates provenance
 */
router.delete("/:threadId/evidence/:evidenceId", optionalProtect, async (req, res) => {
  try {
    const { threadId, evidenceId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await removeEvidenceDocument({ threadId, evidenceId, userId, guestToken });
    return res.status(200).json({
      success: true,
      message: "Evidence document removed successfully.",
      removedDocument: result.removedDocument,
      investigation: result.investigation
    });
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("❌ Error removing evidence document:", err.message);
    return res.status(500).json({ error: err.message || "Failed to remove evidence document." });
  }
});

/**
 * @route POST /api/investigation/:threadId/evidence/:evidenceId/relevance
 * @desc Allows consumer to explain document relevance or confirm it is unrelated
 */
router.post("/:threadId/evidence/:evidenceId/relevance", optionalProtect, async (req, res) => {
  try {
    const { threadId, evidenceId } = req.params;
    const { explanation, confirmUnrelated } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await clarifyEvidenceRelevance({
      threadId,
      evidenceId,
      explanation,
      confirmUnrelated: Boolean(confirmUnrelated),
      userId,
      guestToken
    });
    return res.status(200).json({
      success: true,
      document: result.document,
      investigation: result.investigation
    });
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("❌ Error clarifying evidence relevance:", err.message);
    return res.status(500).json({ error: err.message || "Failed to clarify evidence relevance." });
  }
});

/**
 * ========================================================
 * PHASE 4: COMPANY POLICY RESEARCH ROUTES
 * ========================================================
 */

/**
 * @route POST /api/investigation/:threadId/research
 * @desc Researches company policies, warranty terms, and regulatory benchmarks
 */
router.post("/:threadId/research", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await researchCompanyPolicy({
      threadId,
      userId,
      guestToken
    });

    return res.status(200).json({
      success: true,
      policyResearch: result.research,
      investigation: result.investigation
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error researching company policy:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to perform company policy research."
    });
  }
});

/**
 * @route GET /api/investigation/:threadId/research
 * @desc Retrieves policy research for an investigation
 */
router.get("/:threadId/research", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const investigation = await getThread(threadId, userId, guestToken);
    if (!investigation) {
      return res.status(404).json({
        error: `Investigation with threadId "${threadId}" not found.`
      });
    }

    return res.status(200).json({
      success: true,
      policyResearch: investigation.companyPolicyResearch || null
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({
      error: err.message || "Failed to retrieve policy research."
    });
  }
});

/**
 * ========================================================
 * PHASE 5: INVESTIGATION COMPLETENESS GATE ROUTES
 * ========================================================
 */

/**
 * @route POST /api/investigation/:threadId/gate/evaluate
 * @desc Evaluates the completeness gate server-side before legal assessment
 */
router.post("/:threadId/gate/evaluate", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await evaluateInvestigationGate({
      threadId,
      userId,
      guestToken
    });

    return res.status(200).json({
      success: true,
      gate: result.gate,
      stage: result.stage,
      isSatisfied: result.isSatisfied,
      investigation: result.investigation
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error evaluating completeness gate:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to evaluate investigation completeness gate."
    });
  }
});

/**
 * @route POST /api/investigation/:threadId/gate/proceed
 * @desc Consumer explicitly elects to proceed with legal assessment despite missing evidence
 */
router.post("/:threadId/gate/proceed", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { overrideReason } = req.body;

    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await proceedWithLimitations({
      threadId,
      userId,
      guestToken,
      overrideReason: overrideReason || ""
    });

    return res.status(200).json({
      success: true,
      gate: result.gate,
      stage: result.stage,
      isSatisfied: result.isSatisfied,
      investigation: result.investigation
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error proceeding with limitations:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to proceed through completeness gate."
    });
  }
});

/**
 * ========================================================
 * PHASE 6: GROUNDED LEGAL ASSESSMENT ROUTES
 * ========================================================
 */

/**
 * @route POST /api/investigation/:threadId/assessment
 * @desc Generates grounded legal assessment under CPA 2019 after gate readiness check
 */
router.post("/:threadId/assessment", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await generateLegalAssessment({
      threadId,
      userId,
      guestToken
    });

    return res.status(200).json({
      success: true,
      stage: result.stage,
      assessment: result.assessment,
      investigation: result.investigation
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error generating legal assessment:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to generate preliminary legal assessment."
    });
  }
});

/**
 * @route GET /api/investigation/:threadId/assessment
 * @desc Retrieves existing legal assessment, enforcing user isolation
 */
router.get("/:threadId/assessment", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const investigation = await getThread(threadId, userId, guestToken);
    if (!investigation) {
      return res.status(404).json({
        error: `Investigation with threadId "${threadId}" not found.`
      });
    }

    if (!investigation.assessment || !investigation.assessment.preliminaryAssessment) {
      return res.status(404).json({
        error: "No legal assessment generated yet for this investigation."
      });
    }

    return res.status(200).json({
      success: true,
      assessment: investigation.assessment,
      stage: investigation.stage
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({
      error: err.message || "Failed to retrieve legal assessment."
    });
  }
});

/**
 * @route GET /api/investigation/:threadId/export/pdf
 * @desc Exports complete investigation report as court-formatted PDF
 */
router.get("/:threadId/export/pdf", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const thread = await getThread(threadId, userId, guestToken);
    if (!thread) {
      return res.status(404).json({ error: "Investigation not found." });
    }

    // Enforce completeness gate
    const gate = thread.investigationGate || {};
    if (!gate.isSatisfied && gate.status !== "READY" && gate.status !== "PROCEED_WITH_LIMITATIONS") {
      return res.status(400).json({
        error: "Cannot export investigation report before completeness gate is satisfied."
      });
    }

    const safeId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Veriq_AI_Case_Dossier_${safeId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfStream = generateInvestigationReportPDF(threadId, thread);
    pdfStream.pipe(res);
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    console.error("❌ Error exporting investigation PDF:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to generate investigation PDF report." });
    }
  }
});

/**
 * ========================================================
 * PHASE 6: AI 2.0 TRANSFER ASSESSMENT FORM ROUTES
 * ========================================================
 */

/**
 * @route GET /api/investigation/:threadId/transfer-assessment
 * @desc Retrieves structured AI 2.0 Transfer Assessment Form docket for user review
 */
router.get("/:threadId/transfer-assessment", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const data = await getTransferAssessmentData({ threadId, userId, guestToken });
    return res.status(200).json(data);
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("❌ Error retrieving Transfer Assessment docket:", err.message);
    return res.status(500).json({ error: err.message || "Failed to retrieve Transfer Assessment docket." });
  }
});

/**
 * @route PUT /api/investigation/:threadId/transfer-assessment
 * @desc Saves user review corrections and confirmation through AI 2.0 Transfer Assessment Form
 */
router.put("/:threadId/transfer-assessment", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { corrections, confirmedByConsumer } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const data = await saveTransferAssessmentReview({
      threadId,
      corrections: corrections || {},
      confirmedByConsumer: confirmedByConsumer !== false,
      userId,
      guestToken
    });

    return res.status(200).json(data);
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("❌ Error updating Transfer Assessment review:", err.message);
    return res.status(500).json({ error: err.message || "Failed to save Transfer Assessment review." });
  }
});

router.post("/:threadId/transfer-assessment", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { corrections, confirmedByConsumer } = req.body;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const data = await saveTransferAssessmentReview({
      threadId,
      corrections: corrections || {},
      confirmedByConsumer: confirmedByConsumer !== false,
      userId,
      guestToken
    });

    return res.status(200).json(data);
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || "Failed to save Transfer Assessment review." });
  }
});

/**
 * ========================================================
 * PHASE 10: SEPARATE FINAL CASE OUTCOME ROUTES
 * ========================================================
 */

/**
 * @route POST /api/investigation/:threadId/final-outcome
 * @desc Generates the separate, persistent Final Case Outcome under CPA 2019
 */
router.post("/:threadId/final-outcome", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await generateFinalCaseOutcome({
      threadId,
      userId,
      guestToken
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({
        error: err.message,
        outstandingRequirements: err.outstandingRequirements || [],
        gateStatus: err.gateStatus || "INCOMPLETE"
      });
    }
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("❌ Error generating Final Case Outcome:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to generate Final Case Outcome."
    });
  }
});

/**
 * @route GET /api/investigation/:threadId/final-outcome
 * @desc Retrieves the saved Final Case Outcome for an authorized investigation
 */
router.get("/:threadId/final-outcome", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const result = await getFinalCaseOutcome({
      threadId,
      userId,
      guestToken
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("❌ Error retrieving Final Case Outcome:", err.message);
    return res.status(500).json({
      error: err.message || "Failed to retrieve Final Case Outcome."
    });
  }
});

/**
 * @route GET /api/investigation/:threadId/final-outcome/export/pdf
 * @desc Streams the official Final Case Outcome PDF report
 */
router.get("/:threadId/final-outcome/export/pdf", optionalProtect, async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestToken = req.guestToken || (req.headers && req.headers["x-guest-token"]) || null;

    const thread = await getThread(threadId, userId, guestToken);
    if (!thread) {
      return res.status(404).json({ error: "Investigation not found." });
    }

    if (!thread.finalCaseOutcome || thread.finalCaseOutcome.status !== "GENERATED") {
      return res.status(400).json({
        error: "Final Case Outcome has not been generated yet for this investigation."
      });
    }

    const safeId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Veriq_AI_Case_Dossier_${safeId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfStream = generateFinalOutcomePDF(threadId, thread);
    pdfStream.pipe(res);
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("❌ Error exporting Final Case Outcome PDF:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to generate Final Case Outcome PDF." });
    }
  }
});

export default router;

