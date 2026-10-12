import { Thread, INVESTIGATION_STAGES, ALLOWED_STAGE_TRANSITIONS } from "../models/Thread.js";
import mongoose from "mongoose";
import crypto from "crypto";

// In-memory fallback map if MongoDB is offline or for isolated testing
export const memoryStore = new Map();

/**
 * Permitted metadata fields when updating investigation stages.
 */
export const ALLOWED_STAGE_METADATA_FIELDS = new Set([
  "proceedWithoutEvidenceOverride",
  "overrideReason",
  "notes",
  "reason"
]);

/**
 * Protected internal fields that clients must NEVER be allowed to overwrite.
 */
export const PROTECTED_INTERNAL_FIELDS = new Set([
  "_id",
  "threadId",
  "userId",
  "guestTokenHash",
  "assessment",
  "investigationGate",
  "evidenceInventory",
  "turns",
  "userReportedFacts",
  "clarificationHistory",
  "unresolvedQuestions",
  "initialAnalysis",
  "intake",
  "category",
  "stage",
  "createdAt",
  "clarificationRound",
  "maxClarificationRounds",
  "isClarificationComplete",
  "companyPolicyResearch",
  "taiMetadata",
  "auditTimeline"
]);

/**
 * Validates and sanitizes stage update metadata.
 * Prohibits modification of protected internal fields.
 * 
 * @param {object} metadata 
 * @returns {object} Sanitized metadata containing only allowed fields
 */
export function sanitizeStageMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (PROTECTED_INTERNAL_FIELDS.has(key)) {
      const error = new Error(`Modification of protected internal field "${key}" is prohibited.`);
      error.statusCode = 400;
      throw error;
    }
    if (!ALLOWED_STAGE_METADATA_FIELDS.has(key)) {
      const error = new Error(`Unsupported metadata field: "${key}".`);
      error.statusCode = 400;
      throw error;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

/**
 * Computes a secure SHA-256 hash of a guest token.
 * 
 * @param {string} token 
 * @returns {string|null}
 */
export function hashGuestToken(token) {
  if (!token || typeof token !== "string") return null;
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Validates that an object belongs to the user if a userId is provided,
 * or verifies the cryptographic guest token if it is a guest investigation.
 * 
 * @param {object} thread 
 * @param {string|null} userId 
 * @param {string|null} [guestToken]
 * @returns {boolean}
 */
export function verifyUserOwnership(thread, userId, guestToken = null) {
  if (!thread) return false;

  // Registered user investigation: must match registered userId
  if (thread.userId) {
    if (!userId) return false;
    return thread.userId.toString() === userId.toString();
  }

  // Guest investigation with token hash: must verify incoming guestToken
  if (thread.guestTokenHash) {
    if (!guestToken || typeof guestToken !== "string") return false;
    const incomingHash = hashGuestToken(guestToken);
    try {
      const incomingBuf = Buffer.from(incomingHash, "hex");
      const storedBuf = Buffer.from(thread.guestTokenHash, "hex");
      if (incomingBuf.length !== storedBuf.length) return false;
      return crypto.timingSafeEqual(incomingBuf, storedBuf);
    } catch (e) {
      return false;
    }
  }

  // Fallback for legacy guest threads without a token hash
  return true;
}

/**
 * Creates a new investigation record before any legal judgment exists.
 * 
 * @param {object} params
 * @param {string} [params.threadId] Optional unique identifier
 * @param {string|null} [params.userId] User ID owning the investigation
 * @param {string} params.complaint Raw initial complaint description
 * @param {string} [params.product] Product or service name
 * @param {string} [params.company] Company or seller name
 * @param {string} [params.amount] Disputed consideration amount
 * @param {string} [params.category] Consumer law domain category
 * @returns {Promise<object>} Created investigation record
 */
export async function createInvestigation({
  threadId = null,
  userId = null,
  guestToken = null,
  complaint = "",
  product = "",
  company = "",
  amount = "",
  category = "General Consumer Law",
  generateGuestToken = false
} = {}) {
  const cleanComplaint = (complaint || "").trim();
  if (!cleanComplaint) {
    throw new Error("Complaint is required to initialize an investigation.");
  }

  const activeThreadId = threadId || `investigation_${crypto.randomUUID()}`;

  const initialFact = {
    factId: crypto.randomUUID(),
    text: cleanComplaint,
    source: "USER_INPUT",
    addedAt: new Date()
  };

  let rawGuestToken = null;
  let guestTokenHash = null;

  if (!userId) {
    if (guestToken && typeof guestToken === "string") {
      rawGuestToken = guestToken.trim();
      guestTokenHash = hashGuestToken(rawGuestToken);
    } else if (generateGuestToken) {
      rawGuestToken = crypto.randomBytes(32).toString("hex");
      guestTokenHash = hashGuestToken(rawGuestToken);
    }
  }

  const investigationData = {
    threadId: activeThreadId,
    userId: userId || null,
    guestTokenHash,
    category: category || "General Consumer Law",
    stage: INVESTIGATION_STAGES.INITIAL_ANALYSIS,
    intake: {
      complaint: cleanComplaint,
      product: (product || "").trim(),
      company: (company || "").trim(),
      amount: (amount || "").trim()
    },
    initialAnalysis: {
      disputeCategory: "",
      productOrService: (product || "").trim() || "Not provided",
      companyOrSeller: (company || "").trim() || "Not provided",
      purchaseOrServiceDate: "Not provided",
      disputedAmount: (amount || "").trim() || "Not provided",
      reportedProblem: cleanComplaint,
      actionsTaken: [],
      responsesReceived: [],
      possibleContradictions: [],
      missingMaterialFacts: [],
      potentialRelevantEvidence: [],
      analyzedAt: null
    },
    clarificationRound: 1,
    maxClarificationRounds: 3,
    isClarificationComplete: false,
    userReportedFacts: [initialFact],
    unresolvedQuestions: [],
    clarificationHistory: [],
    evidenceInventory: [],
    companyPolicyResearch: {
      companyName: (company || "").trim(),
      status: "NOT_STARTED",
      policySummary: null,
      sourceUrl: null,
      termsRetrieved: [],
      limitationNote: null,
      lastCheckedAt: null
    },
    investigationGate: {
      isSatisfied: false,
      missingCriticalEvidence: [],
      contradictionsIdentified: [],
      proceedWithoutEvidenceOverride: false,
      overrideReason: null,
      evaluatedAt: null
    },
    assessment: {
      status: "NOT_READY",
      summary: null,
      preliminaryAssessment: null,
      completedAt: null
    },
    taiMetadata: {
      lastPlanAt: null,
      lastActionExecuted: null,
      caseHealthScore: null,
      statusNote: null
    },
    auditTimeline: [],
    turns: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const created = await Thread.create(investigationData);
      const resDoc = created.toObject ? created.toObject() : created;
      if (rawGuestToken) resDoc.guestToken = rawGuestToken;
      return resDoc;
    } catch (err) {
      console.warn("⚠️ MongoDB createInvestigation warning:", err.message);
    }
  }

  // Fallback to in-memory store
  if (rawGuestToken) investigationData.guestToken = rawGuestToken;
  memoryStore.set(activeThreadId, investigationData);
  return investigationData;
}

/**
 * Retrieves an investigation thread by threadId, enforcing user isolation
 * and cryptographic guest token validation.
 * Automatically backfills stage for legacy completed records.
 * 
 * @param {string} threadId 
 * @param {string|null} [userId] Optional userId for ownership verification
 * @param {string|null} [guestToken] Optional guest token for guest cases
 * @returns {Promise<object|null>}
 */
export async function getThread(threadId, userId = null, guestToken = null) {
  if (!threadId) return null;

  let threadDoc = null;

  if (mongoose.connection.readyState === 1) {
    try {
      threadDoc = await Thread.findOne({ threadId }).lean();
    } catch (err) {
      console.warn("⚠️ MongoDB getThread warning:", err.message);
    }
  }

  if (!threadDoc) {
    threadDoc = memoryStore.get(threadId) || null;
  }

  if (!threadDoc) return null;

  // Enforce user isolation and authentication for owned threads
  if (threadDoc.userId) {
    if (!userId) {
      const error = new Error("Authentication required: This investigation is private to a registered user.");
      error.statusCode = 401;
      throw error;
    }
    if (!verifyUserOwnership(threadDoc, userId, guestToken)) {
      const error = new Error("Access denied: You do not own this investigation case.");
      error.statusCode = 403;
      throw error;
    }
  }

  // Enforce guest access token for guest investigations
  if (!threadDoc.userId && threadDoc.guestTokenHash) {
    if (!guestToken) {
      const error = new Error("Guest authorization required: Missing guest access token.");
      error.statusCode = 401;
      throw error;
    }
    if (!verifyUserOwnership(threadDoc, userId, guestToken)) {
      const error = new Error("Access denied: Invalid guest access token.");
      error.statusCode = 403;
      throw error;
    }
  }

  // Backward compatibility: If an old record has completed turns but no stage, infer ASSESSMENT_COMPLETE
  if (!threadDoc.stage) {
    const hasJudgment = Array.isArray(threadDoc.turns) && threadDoc.turns.length > 0 && !!threadDoc.turns[0].judge;
    threadDoc.stage = hasJudgment
      ? INVESTIGATION_STAGES.ASSESSMENT_COMPLETE
      : INVESTIGATION_STAGES.INITIAL_ANALYSIS;
  }

  return threadDoc;
}

/**
 * Updates the investigation stage with strict transition validation.
 * 
 * @param {string} threadId 
 * @param {string} newStage 
 * @param {string|null} [userId] 
 * @param {object} [metadata] Additional fields to update alongside stage
 * @returns {Promise<object>} Updated thread
 */
export async function updateStage(threadId, newStage, userId = null, metadata = {}, guestToken = null) {
  if (!threadId) throw new Error("threadId is required.");
  if (!Object.values(INVESTIGATION_STAGES).includes(newStage)) {
    const error = new Error(`Invalid stage: "${newStage}". Allowed stages: ${Object.values(INVESTIGATION_STAGES).join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  // Validate and sanitize metadata against protected fields and allowlist
  const cleanMetadata = sanitizeStageMetadata(metadata);

  const existing = await getThread(threadId, userId, guestToken);
  if (!existing) {
    const error = new Error(`Investigation with threadId "${threadId}" not found.`);
    error.statusCode = 404;
    throw error;
  }

  const currentStage = existing.stage || INVESTIGATION_STAGES.INITIAL_ANALYSIS;

  // Validate state transition
  if (currentStage !== newStage) {
    const allowedTargets = ALLOWED_STAGE_TRANSITIONS[currentStage] || [];
    if (!allowedTargets.includes(newStage)) {
      const error = new Error(`Invalid stage transition from "${currentStage}" to "${newStage}". Allowed next stages: ${allowedTargets.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Premature transition guard: ensure clarification is complete before entering READY_FOR_ASSESSMENT
  if (newStage === INVESTIGATION_STAGES.READY_FOR_ASSESSMENT && !existing.isClarificationComplete) {
    const error = new Error("Cannot transition to READY_FOR_ASSESSMENT while clarification is incomplete.");
    error.statusCode = 400;
    throw error;
  }

  const updateFields = {
    stage: newStage,
    updatedAt: new Date(),
    ...cleanMetadata
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const updated = await Thread.findOneAndUpdate(
        { threadId },
        { $set: updateFields },
        { new: true }
      ).lean();
      if (updated) return updated;
    } catch (err) {
      console.warn("⚠️ MongoDB updateStage warning:", err.message);
    }
  }

  // In-memory store fallback
  const memDoc = memoryStore.get(threadId) || existing;
  Object.assign(memDoc, updateFields);
  memoryStore.set(threadId, memDoc);
  return { ...memDoc };
}

/**
 * Normalizes user answer payload into structured format and human-readable text
 */
export function normalizeAnswerPayload(answer) {
  if (answer === null || answer === undefined) {
    return { cleanAns: null, answerText: "", value: null, text: "" };
  }
  if (typeof answer === "string") {
    const trimmed = answer.trim();
    return { cleanAns: trimmed, answerText: trimmed, value: trimmed, text: trimmed };
  }
  if (typeof answer === "number") {
    return { cleanAns: answer, answerText: String(answer), value: answer, text: String(answer) };
  }
  if (Array.isArray(answer)) {
    const filtered = answer.map((item) => (typeof item === "string" ? item.trim() : String(item))).filter(Boolean);
    const joined = filtered.join(", ");
    return { cleanAns: filtered, answerText: joined, value: filtered, text: joined };
  }
  if (typeof answer === "object") {
    let text = "";
    const custom = answer.otherText || answer.customText;
    if (answer.selected && custom) {
      text = answer.selected === "Other" ? custom : `${answer.selected}: ${custom}`;
    } else if (answer.selected) {
      text = answer.selected;
    } else if (answer.value && answer.followUp) {
      text = `${answer.value} (Details: ${answer.followUp})`;
    } else if (answer.text) {
      text = answer.text;
    } else {
      text = JSON.stringify(answer);
    }
    const clean = custom && answer.selected === "Other" ? custom : answer;
    return { cleanAns: clean, answerText: text, value: clean, text };
  }
  const str = String(answer).trim();
  return { cleanAns: str, answerText: str, value: str, text: str };
}

/**
 * Saves a user clarification response to an investigation.
 * Supports structured answer controls and prevents duplicate entries.
 * 
 * @param {string} threadId 
 * @param {string} questionId 
 * @param {*} answer 
 * @param {string} [questionText] 
 * @param {string|null} [userId] 
 * @returns {Promise<object>}
 */
export async function saveClarificationResponse(threadId, questionId, answer, questionText = "", userId = null, guestToken = null) {
  if (!threadId || !questionId) {
    throw new Error("threadId and questionId are required.");
  }
  const { cleanAns, answerText } = normalizeAnswerPayload(answer);
  if (!cleanAns || (typeof cleanAns === "string" && !cleanAns) || (Array.isArray(cleanAns) && cleanAns.length === 0)) {
    throw new Error("Answer must be a non-empty string.");
  }

  const existing = await getThread(threadId, userId, guestToken);
  if (!existing) {
    const error = new Error(`Investigation with threadId "${threadId}" not found.`);
    error.statusCode = 404;
    throw error;
  }

  return submitClarificationAnswers(
    threadId,
    [{ questionId, answer: cleanAns, question: questionText }],
    userId,
    guestToken
  );
}

/**
 * Records investigation progress (facts, evidence inventory, policy, gate).
 * 
 * @param {string} threadId 
 * @param {object} progressUpdates 
 * @param {string|null} [userId] 
 * @returns {Promise<object>}
 */
export async function recordInvestigationProgress(threadId, progressUpdates = {}, userId = null, guestToken = null) {
  if (!threadId) throw new Error("threadId is required.");

  const existing = await getThread(threadId, userId, guestToken);
  if (!existing) {
    const error = new Error(`Investigation with threadId "${threadId}" not found.`);
    error.statusCode = 404;
    throw error;
  }

  const sanitizedUpdates = { ...progressUpdates, updatedAt: new Date() };

  if (mongoose.connection.readyState === 1) {
    try {
      const updated = await Thread.findOneAndUpdate(
        { threadId },
        { $set: sanitizedUpdates },
        { new: true }
      ).lean();
      if (updated) return updated;
    } catch (err) {
      console.warn("⚠️ MongoDB recordProgress warning:", err.message);
    }
  }

  // In-memory fallback
  const memDoc = memoryStore.get(threadId) || existing;
  Object.assign(memDoc, sanitizedUpdates);
  memoryStore.set(threadId, memDoc);
  return { ...memDoc };
}

/**
 * Saves initial structured analysis and first-round questions to the investigation.
 * Transitions stage from INITIAL_ANALYSIS to AWAITING_CLARIFICATION.
 * 
 * @param {string} threadId 
 * @param {object} analysis 
 * @param {Array} [questions] 
 * @param {string|null} [userId] 
 * @returns {Promise<object>}
 */
export async function saveInitialAnalysis(threadId, analysis, questions = [], userId = null, guestToken = null) {
  if (!threadId || !analysis) {
    throw new Error("threadId and analysis are required.");
  }

  const existing = await getThread(threadId, userId, guestToken);
  if (!existing) {
    const error = new Error(`Investigation with threadId "${threadId}" not found.`);
    error.statusCode = 404;
    throw error;
  }

  const category = analysis.disputeCategory || existing.category || "General Consumer Law";
  const newFacts = Array.isArray(analysis.userReportedFacts) ? analysis.userReportedFacts : [];

  const analysisRecord = {
    disputeCategory: analysis.disputeCategory || "",
    productOrService: analysis.productOrService || existing.intake?.product || "Not provided",
    companyOrSeller: analysis.companyOrSeller || existing.intake?.company || "Not provided",
    purchaseOrServiceDate: analysis.purchaseOrServiceDate || "Not provided",
    disputedAmount: analysis.disputedAmount || existing.intake?.amount || "Not provided",
    reportedProblem: analysis.reportedProblem || existing.intake?.complaint || "",
    actionsTaken: Array.isArray(analysis.actionsTaken) ? analysis.actionsTaken : [],
    responsesReceived: Array.isArray(analysis.responsesReceived) ? analysis.responsesReceived : [],
    possibleContradictions: Array.isArray(analysis.possibleContradictions) ? analysis.possibleContradictions : [],
    missingMaterialFacts: Array.isArray(analysis.missingMaterialFacts) ? analysis.missingMaterialFacts : [],
    potentialRelevantEvidence: Array.isArray(analysis.potentialRelevantEvidence) ? analysis.potentialRelevantEvidence : [],
    analyzedAt: new Date()
  };

  const updateFields = {
    category,
    stage: INVESTIGATION_STAGES.AWAITING_CLARIFICATION,
    initialAnalysis: analysisRecord,
    unresolvedQuestions: questions,
    clarificationRound: 1,
    updatedAt: new Date()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const updated = await Thread.findOneAndUpdate(
        { threadId },
        {
          $set: updateFields,
          $push: {
            userReportedFacts: { $each: newFacts }
          }
        },
        { new: true }
      ).lean();
      if (updated) return updated;
    } catch (err) {
      console.warn("⚠️ MongoDB saveInitialAnalysis warning:", err.message);
    }
  }

  // Memory fallback
  const memDoc = memoryStore.get(threadId) || existing;
  Object.assign(memDoc, updateFields);
  if (!memDoc.userReportedFacts) memDoc.userReportedFacts = [];
  for (const f of newFacts) {
    if (!memDoc.userReportedFacts.some((ef) => ef.text === f.text)) {
      memDoc.userReportedFacts.push(f);
    }
  }
  memoryStore.set(threadId, memDoc);
  return { ...memDoc };
}

/**
 * Submits batch or single clarification answers to an investigation.
 * 
 * @param {string} threadId 
 * @param {Array<{ questionId: string, answer: string, question?: string }>} answersList 
 * @param {string|null} [userId] 
 * @returns {Promise<object>}
 */
export async function submitClarificationAnswers(threadId, answersList = [], userId = null, guestToken = null) {
  if (!threadId) throw new Error("threadId is required.");
  if (!Array.isArray(answersList) || answersList.length === 0) {
    throw new Error("answersList must be a non-empty array of { questionId, answer }.");
  }

  const existing = await getThread(threadId, userId, guestToken);
  if (!existing) {
    const error = new Error(`Investigation with threadId "${threadId}" not found.`);
    error.statusCode = 404;
    throw error;
  }

  const normalizedItems = [];

  for (const item of answersList) {
    const { questionId, answer, question } = item;
    if (!questionId || typeof questionId !== "string") {
      throw new Error("Each answer must specify a valid questionId.");
    }
    const { cleanAns, answerText } = normalizeAnswerPayload(answer);
    if (
      cleanAns === null ||
      cleanAns === undefined ||
      (typeof cleanAns === "string" && !cleanAns.trim()) ||
      (Array.isArray(cleanAns) && cleanAns.length === 0) ||
      (typeof cleanAns === "object" && !Array.isArray(cleanAns) && Object.keys(cleanAns).length === 0)
    ) {
      throw new Error(`Answer for question "${questionId}" cannot be empty.`);
    }

    const targetQ = (existing.unresolvedQuestions || []).find((q) => q.id === questionId);
    const qText = question || targetQ?.question || "";

    normalizedItems.push({
      questionId,
      question: qText,
      cleanAns,
      answerText: answerText || (typeof cleanAns === "string" ? cleanAns : JSON.stringify(cleanAns))
    });
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const currentDoc = await Thread.findOne({ threadId });
      if (currentDoc) {
        if (!currentDoc.clarificationHistory) currentDoc.clarificationHistory = [];
        if (!currentDoc.userReportedFacts) currentDoc.userReportedFacts = [];
        if (!currentDoc.unresolvedQuestions) currentDoc.unresolvedQuestions = [];

        for (const item of normalizedItems) {
          // 1. Update unresolvedQuestions status and answer
          const q = currentDoc.unresolvedQuestions.find((uq) => uq.id === item.questionId);
          if (q) {
            q.status = "ANSWERED";
            q.answer = item.cleanAns;
            q.answeredAt = new Date();
          }

          // 2. Upsert clarificationHistory (prevent duplicate entries)
          const existingHistoryIdx = currentDoc.clarificationHistory.findIndex(
            (ch) => ch.questionId === item.questionId
          );
          const historyEntry = {
            questionId: item.questionId,
            question: item.question,
            answer: item.cleanAns,
            answerText: item.answerText,
            timestamp: new Date()
          };

          if (existingHistoryIdx !== -1) {
            currentDoc.clarificationHistory[existingHistoryIdx] = historyEntry;
          } else {
            currentDoc.clarificationHistory.push(historyEntry);
          }

          // 3. Upsert userReportedFacts associated with this question
          const existingFactIdx = currentDoc.userReportedFacts.findIndex(
            (f) => f.questionId === item.questionId
          );
          if (existingFactIdx !== -1) {
            currentDoc.userReportedFacts[existingFactIdx].text = item.answerText;
            currentDoc.userReportedFacts[existingFactIdx].addedAt = new Date();
          } else {
            currentDoc.userReportedFacts.push({
              factId: crypto.randomUUID(),
              questionId: item.questionId,
              text: item.answerText,
              source: "CLARIFICATION_ANSWER",
              addedAt: new Date()
            });
          }
        }

        currentDoc.updatedAt = new Date();
        await currentDoc.save();
        return currentDoc.toObject();
      }
    } catch (err) {
      console.warn("⚠️ MongoDB submitClarificationAnswers warning:", err.message);
    }
  }

  // Memory fallback
  const memDoc = memoryStore.get(threadId) || existing;
  if (!memDoc.clarificationHistory) memDoc.clarificationHistory = [];
  if (!memDoc.userReportedFacts) memDoc.userReportedFacts = [];
  if (!memDoc.unresolvedQuestions) memDoc.unresolvedQuestions = [];

  for (const item of normalizedItems) {
    const q = memDoc.unresolvedQuestions.find((uq) => uq.id === item.questionId);
    if (q) {
      q.status = "ANSWERED";
      q.answer = item.cleanAns;
      q.answeredAt = new Date();
    }

    const existingHistoryIdx = memDoc.clarificationHistory.findIndex(
      (ch) => ch.questionId === item.questionId
    );
    const historyEntry = {
      questionId: item.questionId,
      question: item.question,
      answer: item.cleanAns,
      answerText: item.answerText,
      timestamp: new Date()
    };

    if (existingHistoryIdx !== -1) {
      memDoc.clarificationHistory[existingHistoryIdx] = historyEntry;
    } else {
      memDoc.clarificationHistory.push(historyEntry);
    }

    const existingFactIdx = memDoc.userReportedFacts.findIndex(
      (f) => f.questionId === item.questionId
    );
    if (existingFactIdx !== -1) {
      memDoc.userReportedFacts[existingFactIdx].text = item.answerText;
      memDoc.userReportedFacts[existingFactIdx].addedAt = new Date();
    } else {
      memDoc.userReportedFacts.push({
        factId: crypto.randomUUID(),
        questionId: item.questionId,
        text: item.answerText,
        source: "CLARIFICATION_ANSWER",
        addedAt: new Date()
      });
    }
  }

  memDoc.updatedAt = new Date();
  memoryStore.set(threadId, memDoc);
  return { ...memDoc };
}

/**
 * Advances the investigation to the next question round or marks clarification complete.
 * 
 * @param {string} threadId 
 * @param {Array} [nextQuestions] 
 * @param {boolean} [isComplete] 
 * @param {string|null} [userId] 
 * @returns {Promise<object>}
 */
export async function advanceInvestigationRound(threadId, nextQuestions = [], isComplete = false, userId = null, guestToken = null) {
  if (!threadId) throw new Error("threadId is required.");

  const existing = await getThread(threadId, userId, guestToken);
  if (!existing) {
    const error = new Error(`Investigation with threadId "${threadId}" not found.`);
    error.statusCode = 404;
    throw error;
  }

  const updateFields = {
    updatedAt: new Date()
  };

  if (isComplete) {
    updateFields.isClarificationComplete = true;
    updateFields.stage = INVESTIGATION_STAGES.AWAITING_EVIDENCE;
  } else {
    updateFields.clarificationRound = (existing.clarificationRound || 1) + 1;
    const currentUnresolved = existing.unresolvedQuestions || [];
    updateFields.unresolvedQuestions = [...currentUnresolved, ...nextQuestions];
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const updated = await Thread.findOneAndUpdate(
        { threadId },
        { $set: updateFields },
        { new: true }
      ).lean();
      if (updated) return updated;
    } catch (err) {
      console.warn("⚠️ MongoDB advanceInvestigationRound warning:", err.message);
    }
  }

  // Memory fallback
  const memDoc = memoryStore.get(threadId) || existing;
  Object.assign(memDoc, updateFields);
  memoryStore.set(threadId, memDoc);
  return { ...memDoc };
}

/**
 * Legacy Turn Saver (Preserved for full backward compatibility)
 * Saves a new turn to a thread document with user association.
 * Automatically marks stage as ASSESSMENT_COMPLETE if a judge verdict is present.
 * 
 * @param {string} threadId 
 * @param {object} turnData { question, retrievedContext, support, oppose, judge }
 * @param {string|null} userId Optional user ID owning the thread
 * @param {string} category Optional category classification
 * @param {object} [intakeMetadata] Optional product, company, amount intake
 */
export async function saveTurn(threadId, turnData, userId = null, category = "", intakeMetadata = null, guestToken = null) {
  if (!threadId || !turnData) return;

  // Verify ownership if existing thread is owned
  let existingDoc = null;
  if (mongoose.connection.readyState === 1) {
    try {
      existingDoc = await Thread.findOne({ threadId }).lean();
    } catch (e) {}
  }
  if (!existingDoc) {
    existingDoc = memoryStore.get(threadId) || null;
  }
  if (existingDoc) {
    if (existingDoc.userId && !userId) {
      const error = new Error("Authentication required: This investigation is private to a registered user.");
      error.statusCode = 401;
      throw error;
    }
    if (!verifyUserOwnership(existingDoc, userId, guestToken)) {
      const error = new Error("Access denied: You do not own this investigation case.");
      error.statusCode = 403;
      throw error;
    }
  }

  const judgeConf = turnData.judge?.overall_confidence !== undefined
    ? turnData.judge.overall_confidence
    : null;

  const newTurn = {
    ...turnData,
    category: category || turnData.category || "",
    judgeConfidence: judgeConf,
    timestamp: new Date()
  };

  const IN_PROGRESS_INVESTIGATION_STAGES = [
    INVESTIGATION_STAGES.INITIAL_ANALYSIS,
    INVESTIGATION_STAGES.AWAITING_CLARIFICATION,
    INVESTIGATION_STAGES.AWAITING_EVIDENCE,
    INVESTIGATION_STAGES.EVIDENCE_REVIEW
  ];

  const isComplete = Boolean(turnData.judge);

  // If this thread is an existing formal investigation in progress, preserve its stage and do not bypass to ASSESSMENT_COMPLETE
  let targetStage;
  if (existingDoc && existingDoc.stage && IN_PROGRESS_INVESTIGATION_STAGES.includes(existingDoc.stage)) {
    targetStage = existingDoc.stage;
  } else {
    targetStage = isComplete ? INVESTIGATION_STAGES.ASSESSMENT_COMPLETE : INVESTIGATION_STAGES.INITIAL_ANALYSIS;
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const updatePayload = {
        $push: { turns: newTurn },
        $set: {
          stage: targetStage,
          updatedAt: new Date()
        }
      };

      if (userId) updatePayload.$set.userId = userId;
      if (category) updatePayload.$set.category = category;

      if (intakeMetadata && typeof intakeMetadata === "object") {
        if (intakeMetadata.product) updatePayload.$set["intake.product"] = intakeMetadata.product;
        if (intakeMetadata.company) updatePayload.$set["intake.company"] = intakeMetadata.company;
        if (intakeMetadata.amount) updatePayload.$set["intake.amount"] = intakeMetadata.amount;
        if (intakeMetadata.complaint) updatePayload.$set["intake.complaint"] = intakeMetadata.complaint;
      }

      await Thread.findOneAndUpdate(
        { threadId },
        updatePayload,
        { upsert: true, new: true }
      );
      return;
    } catch (err) {
      console.warn("⚠️ MongoDB saveTurn warning:", err.message);
    }
  }

  // Fallback to in-memory store
  const existing = memoryStore.get(threadId) || {
    threadId,
    userId,
    category,
    stage: targetStage,
    intake: {
      complaint: intakeMetadata?.complaint || turnData.question || "",
      product: intakeMetadata?.product || "",
      company: intakeMetadata?.company || "",
      amount: intakeMetadata?.amount || ""
    },
    turns: []
  };

  if (userId && !existing.userId) existing.userId = userId;
  if (category && !existing.category) existing.category = category;
  existing.stage = targetStage;
  existing.updatedAt = new Date();
  existing.turns.push(newTurn);
  memoryStore.set(threadId, existing);
}

/**
 * Safely appends an audit event to the thread's immutable audit timeline.
 * Enforces ownership checks and prevents leakage of sensitive secrets.
 * 
 * @param {string} threadId 
 * @param {object} event 
 * @param {string|null} [userId] 
 * @param {string|null} [guestToken] 
 * @returns {Promise<object>} The appended audit event
 */
export async function appendAuditTimelineEvent(threadIdOrParams, event = {}, userId = null, guestToken = null) {
  let activeThreadId = threadIdOrParams;
  let activeEvent = event;
  let activeUserId = userId;
  let activeGuestToken = guestToken;

  if (typeof threadIdOrParams === "object" && threadIdOrParams !== null) {
    activeThreadId = threadIdOrParams.threadId;
    activeUserId = threadIdOrParams.userId || userId;
    activeGuestToken = threadIdOrParams.guestToken || guestToken;
    activeEvent = threadIdOrParams;
  }

  if (!activeThreadId) throw new Error("threadId is required to record audit event.");
  const thread = await getThread(activeThreadId, activeUserId, activeGuestToken);
  if (!thread) {
    const err = new Error(`Investigation with threadId "${activeThreadId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  const cleanEvent = {
    id: activeEvent.id || crypto.randomUUID(),
    timestamp: activeEvent.timestamp || new Date(),
    requestedAction: activeEvent.requestedAction || null,
    executedAction: activeEvent.executedAction || null,
    previousStage: activeEvent.previousStage || thread.stage || null,
    resultingStage: activeEvent.resultingStage || thread.stage || null,
    actorType: activeEvent.actorType || (activeUserId ? "USER" : (activeGuestToken ? "GUEST" : "TAI_SYSTEM")),
    outcome: activeEvent.outcome || "SUCCESS", // "SUCCESS", "FAILURE", "BLOCKED"
    rationale: (activeEvent.rationale || "").trim(),
    serviceResultId: activeEvent.serviceResultId || null,
    failureReason: activeEvent.failureReason || null
  };

  // Prevent leakage of secrets, tokens, or raw credentials in timeline
  delete cleanEvent.guestToken;
  delete cleanEvent.password;
  delete cleanEvent.token;

  if (mongoose.connection.readyState === 1) {
    try {
      await Thread.findOneAndUpdate(
        { threadId: activeThreadId },
        {
          $push: { auditTimeline: cleanEvent },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );
    } catch (e) {
      console.warn("⚠️ MongoDB appendAuditTimelineEvent warning:", e.message);
    }
  }

  // Update in-memory / local thread representation
  if (!Array.isArray(thread.auditTimeline)) {
    thread.auditTimeline = [];
  }
  thread.auditTimeline.push(cleanEvent);
  thread.updatedAt = new Date();

  return cleanEvent;
}

/**
 * Updates TAI coordination metadata on a thread.
 */
export async function updateTaiMetadata(threadId, metadata = {}, userId = null, guestToken = null) {
  const thread = await getThread(threadId, userId, guestToken);
  if (!thread) {
    const err = new Error(`Investigation with threadId "${threadId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  const cleanMeta = {
    ...(thread.taiMetadata || {}),
    ...metadata,
    lastPlanAt: new Date()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await Thread.findOneAndUpdate(
        { threadId },
        {
          $set: {
            taiMetadata: cleanMeta,
            updatedAt: new Date()
          }
        },
        { new: true }
      );
    } catch (e) {
      console.warn("⚠️ MongoDB updateTaiMetadata warning:", e.message);
    }
  }

  thread.taiMetadata = cleanMeta;
  thread.updatedAt = new Date();
  return cleanMeta;
}

