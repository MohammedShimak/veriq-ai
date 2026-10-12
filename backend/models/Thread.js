import mongoose from "mongoose";

/**
 * Formal Investigation Lifecycle Stages
 */
export const INVESTIGATION_STAGES = {
  INITIAL_ANALYSIS: "INITIAL_ANALYSIS",
  AWAITING_CLARIFICATION: "AWAITING_CLARIFICATION",
  AWAITING_EVIDENCE: "AWAITING_EVIDENCE",
  EVIDENCE_REVIEW: "EVIDENCE_REVIEW",
  READY_FOR_ASSESSMENT: "READY_FOR_ASSESSMENT",
  ASSESSMENT_COMPLETE: "ASSESSMENT_COMPLETE",
  FINAL_OUTCOME_COMPLETE: "FINAL_OUTCOME_COMPLETE"
};

/**
 * Valid state transitions to prevent premature judgment generation
 */
export const ALLOWED_STAGE_TRANSITIONS = {
  INITIAL_ANALYSIS: [
    INVESTIGATION_STAGES.AWAITING_CLARIFICATION,
    INVESTIGATION_STAGES.AWAITING_EVIDENCE
  ],
  AWAITING_CLARIFICATION: [
    INVESTIGATION_STAGES.AWAITING_EVIDENCE,
    INVESTIGATION_STAGES.EVIDENCE_REVIEW,
    INVESTIGATION_STAGES.INITIAL_ANALYSIS
  ],
  AWAITING_EVIDENCE: [
    INVESTIGATION_STAGES.EVIDENCE_REVIEW,
    INVESTIGATION_STAGES.AWAITING_CLARIFICATION
  ],
  EVIDENCE_REVIEW: [
    INVESTIGATION_STAGES.AWAITING_CLARIFICATION,
    INVESTIGATION_STAGES.AWAITING_EVIDENCE,
    INVESTIGATION_STAGES.READY_FOR_ASSESSMENT
  ],
  READY_FOR_ASSESSMENT: [
    INVESTIGATION_STAGES.ASSESSMENT_COMPLETE,
    INVESTIGATION_STAGES.EVIDENCE_REVIEW
  ],
  ASSESSMENT_COMPLETE: [
    INVESTIGATION_STAGES.FINAL_OUTCOME_COMPLETE,
    INVESTIGATION_STAGES.EVIDENCE_REVIEW // Allows reopening case if new evidence emerges
  ],
  FINAL_OUTCOME_COMPLETE: [
    INVESTIGATION_STAGES.EVIDENCE_REVIEW,
    INVESTIGATION_STAGES.ASSESSMENT_COMPLETE
  ]
};

const TurnSchema = new mongoose.Schema({
  question: { type: String, required: true },
  retrievedContext: { type: String, default: "" },
  category: { type: String, default: "" },
  judgeConfidence: { type: Number, default: null },
  // Relaxed to optional for backward compatibility and allowing non-judgment turns
  support: { type: Object, default: null },
  oppose: { type: Object, default: null },
  judge: { type: Object, default: null },
  timestamp: { type: Date, default: Date.now }
});

const ThreadSchema = new mongoose.Schema({
  threadId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  guestTokenHash: { type: String, default: null, index: true },
  category: { type: String, default: "General Consumer Law" },

  // Current investigation stage
  stage: {
    type: String,
    enum: Object.values(INVESTIGATION_STAGES),
    default: INVESTIGATION_STAGES.INITIAL_ANALYSIS,
    index: true
  },

  // Initial user complaint intake metadata
  intake: {
    complaint: { type: String, default: "" },
    product: { type: String, default: "" },
    company: { type: String, default: "" },
    amount: { type: String, default: "" }
  },

  // Initial structured complaint analysis
  initialAnalysis: {
    disputeCategory: { type: String, default: "" },
    productOrService: { type: String, default: "" },
    companyOrSeller: { type: String, default: "" },
    purchaseOrServiceDate: { type: String, default: "Not provided" },
    disputedAmount: { type: String, default: "Not provided" },
    reportedProblem: { type: String, default: "" },
    actionsTaken: { type: [String], default: [] },
    responsesReceived: { type: [String], default: [] },
    possibleContradictions: { type: [String], default: [] },
    missingMaterialFacts: { type: [String], default: [] },
    potentialRelevantEvidence: { type: [String], default: [] },
    analyzedAt: { type: Date, default: null }
  },

  // Clarification round management (anti-loop bounds)
  clarificationRound: { type: Number, default: 1 },
  maxClarificationRounds: { type: Number, default: 3 },
  isClarificationComplete: { type: Boolean, default: false },

  // User-reported facts (explicitly labeled, not verified facts)
  userReportedFacts: [
    {
      factId: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
      questionId: { type: String, default: null },
      text: { type: String, required: true },
      source: { type: String, default: "USER_INPUT" }, // "USER_INPUT", "CLARIFICATION_ANSWER"
      addedAt: { type: Date, default: Date.now }
    }
  ],

  // Dynamically generated follow-up questions
  unresolvedQuestions: [
    {
      id: { type: String, required: true },
      question: { type: String, required: true },
      type: {
        type: String,
        enum: ["single_choice", "multiple_choice", "date", "number", "text", "textarea"],
        default: "text"
      },
      options: { type: [String], default: [] },
      allowOther: { type: Boolean, default: false },
      placeholder: { type: String, default: "" },
      min: { type: Number, default: null },
      max: { type: Number, default: null },
      unit: { type: String, default: "" },
      conditionalFollowUp: { type: Object, default: null },
      importance: { type: String, default: "HIGH" }, // "CRITICAL", "HIGH", "MEDIUM"
      legalRelevance: { type: String, default: "" },
      round: { type: Number, default: 1 },
      status: { type: String, default: "PENDING" }, // "PENDING", "ANSWERED", "SKIPPED"
      answer: { type: mongoose.Schema.Types.Mixed, default: null },
      answeredAt: { type: Date, default: null }
    }
  ],

  // Q&A history
  clarificationHistory: [
    {
      questionId: { type: String, required: true },
      question: { type: String, default: "" },
      answer: { type: mongoose.Schema.Types.Mixed, required: true },
      answerText: { type: String, default: "" },
      timestamp: { type: Date, default: Date.now }
    }
  ],

  // Evidence inventory (tracking reported vs uploaded vs inspected)
  evidenceInventory: [
    {
      id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
      title: { type: String, required: true },
      category: { type: String, default: "OTHER" }, // "INVOICE", "PAYMENT_RECEIPT", "WARRANTY", "SERVICE_REPORT", "COMMUNICATION", "CONTRACT", "PHOTO", "OTHER"
      claimedByConsumer: { type: Boolean, default: false },
      uploaded: { type: Boolean, default: false },
      inspected: { type: Boolean, default: false },
      unavailable: { type: Boolean, default: false },
      unavailableReason: { type: String, default: null },
      filename: { type: String, default: null },
      originalName: { type: String, default: null },
      fileUrl: { type: String, default: null },
      fileSize: { type: Number, default: 0 },
      mimeType: { type: String, default: null },
      fileHash: { type: String, default: null },
      status: {
        type: String,
        enum: [
          "USER_REPORTED",
          "DOCUMENT_UPLOADED",
          "DOCUMENT_INSPECTED",
          "INDEPENDENTLY_VERIFIED",
          "CONTRADICTED",
          "NOT_INSPECTED",
          "UNAVAILABLE"
        ],
        default: "USER_REPORTED"
      },
      extractedInfo: {
        rawText: { type: String, default: null },
        documentType: { type: String, default: null },
        datesFound: { type: [String], default: [] },
        amountsFound: { type: [String], default: [] },
        referenceNumbers: { type: [String], default: [] },
        partiesFound: { type: [String], default: [] },
        pertinentClauses: { type: [String], default: [] },
        supportsUserClaims: { type: Boolean, default: null },
        contradictionsNoted: { type: [String], default: [] },
        extractedAt: { type: Date, default: null }
      },
      userCorrection: {
        correctedText: { type: String, default: null },
        notes: { type: String, default: null },
        correctedAt: { type: Date, default: null }
      },
      relevance: {
        type: String,
        enum: ["RELEVANT", "PARTIALLY_RELEVANT", "UNRELATED", "UNCERTAIN"],
        default: "RELEVANT"
      },
      relevanceReason: { type: String, default: null },
      mismatchWarning: { type: String, default: null },
      claimsSupported: { type: [String], default: [] },
      claimsNotSupported: { type: [String], default: [] },
      userRelevanceExplanation: { type: String, default: null },
      userConfirmedUnrelated: { type: Boolean, default: false },
      isSynthetic: { type: Boolean, default: false },
      inspectionNotes: { type: String, default: null },
      uploadedAt: { type: Date, default: null }
    }
  ],

  // Company policy research findings
  companyPolicyResearch: {
    companyName: { type: String, default: "" },
    status: { type: String, default: "NOT_STARTED" }, // "NOT_STARTED", "PENDING", "COMPLETED", "LIMITED", "NOT_FOUND"
    policySummary: { type: String, default: null },
    sourceUrl: { type: String, default: null },
    termsRetrieved: { type: [String], default: [] },
    policies: [
      {
        title: { type: String, default: "" },
        sourceUrl: { type: String, default: "" },
        retrievalDate: { type: Date, default: Date.now },
        passage: { type: String, default: "" },
        claimSupported: { type: String, default: "" },
        applicability: { type: String, default: "APPLICABLE_TO_DATE" },
        statutoryComparison: { type: String, default: "" }
      }
    ],
    limitationNote: { type: String, default: null },
    lastCheckedAt: { type: Date, default: null }
  },

  // Investigation gate evaluation
  investigationGate: {
    status: {
      type: String,
      enum: ["NOT_EVALUATED", "READY", "INCOMPLETE", "PROCEED_WITH_LIMITATIONS"],
      default: "NOT_EVALUATED"
    },
    isSatisfied: { type: Boolean, default: false },
    missingCriticalEvidence: { type: [String], default: [] },
    contradictionsIdentified: { type: [String], default: [] },
    unansweredQuestions: { type: [String], default: [] },
    limitationsDisclosed: { type: [String], default: [] },
    satisfiedRequirements: { type: [String], default: [] },
    outstandingRequirements: { type: [String], default: [] },
    decisionReason: { type: String, default: null },
    proceedWithoutEvidenceOverride: { type: Boolean, default: false },
    overrideReason: { type: String, default: null },
    evaluationChecklist: {
      essentialFactsComplete: { type: Boolean, default: false },
      clarificationComplete: { type: Boolean, default: false },
      evidenceSatisfied: { type: Boolean, default: false },
      policyResearchCompleted: { type: Boolean, default: false },
      noUnresolvedContradictions: { type: Boolean, default: false }
    },
    evaluatedAt: { type: Date, default: null }
  },

  // Assessment results (once generated in future phases)
  assessment: {
    status: { type: String, default: "NOT_READY" }, // "NOT_READY", "READY", "COMPLETE"
    summary: { type: String, default: null },
    preliminaryAssessment: { type: Object, default: null },
    isOutdated: { type: Boolean, default: false },
    outdatedReason: { type: String, default: null },
    completedAt: { type: Date, default: null }
  },

  // Final Case Outcome (separate, persistent output from preliminary assessment)
  finalCaseOutcome: {
    status: { type: String, default: "NOT_GENERATED" }, // "NOT_GENERATED", "GENERATED"
    outcomeClassification: { type: String, default: null },
    directConclusion: { type: String, default: null },
    supportingFacts: { type: [Object], default: [] },
    applicableLaws: { type: [Object], default: [] },
    historicalPrecedents: { type: [Object], default: [] },
    precedentComparisons: { type: [Object], default: [] },
    consumerArguments: { type: [Object], default: [] },
    companyCounterarguments: { type: [Object], default: [] },
    potentialRemedies: { type: Object, default: null },
    evidenceLimitations: { type: [String], default: [] },
    unresolvedDisputes: { type: [String], default: [] },
    confidenceMetrics: { type: Object, default: null },
    recommendedNextSteps: { type: [String], default: [] },
    isOutdated: { type: Boolean, default: false },
    outdatedReason: { type: String, default: null },
    disclaimer: { type: String, default: "AI-Generated Final Case Outcome — Not a Court Order" },
    generatedAt: { type: Date, default: null },
    assessmentVersion: { type: String, default: "1.0" }
  },

  // AI 2.0 Transfer Assessment Form review metadata
  transferAssessmentReview: {
    reviewedAt: { type: Date, default: null },
    userCorrections: { type: [Object], default: [] },
    confirmedByConsumer: { type: Boolean, default: false }
  },

  // TAI Central AI metadata
  taiMetadata: {
    lastPlanAt: { type: Date, default: null },
    lastActionExecuted: { type: String, default: null },
    caseHealthScore: { type: Number, default: null },
    statusNote: { type: String, default: null }
  },

  // Append-only audit timeline of investigation orchestration events
  auditTimeline: [
    {
      id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
      timestamp: { type: Date, default: Date.now },
      requestedAction: { type: String, default: null },
      executedAction: { type: String, default: null },
      previousStage: { type: String, default: null },
      resultingStage: { type: String, default: null },
      actorType: { type: String, enum: ["USER", "GUEST", "TAI_SYSTEM", "ADMIN"], default: "USER" },
      outcome: { type: String, enum: ["SUCCESS", "FAILURE", "BLOCKED"], default: "SUCCESS" },
      rationale: { type: String, default: "" },
      serviceResultId: { type: String, default: null },
      failureReason: { type: String, default: null }
    }
  ],

  // Completed debate turns (preserved for full backward compatibility)
  turns: [TurnSchema],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Thread = mongoose.models.Thread || mongoose.model("Thread", ThreadSchema);
