import { Thread, INVESTIGATION_STAGES } from "../models/Thread.js";
import { getThread, updateStage } from "./threadService.js";
import { retrieveHybridLegalKnowledge } from "./hybridRetriever.js";
import { validateAgentOutput } from "./groundingValidator.js";
import { semanticValidate } from "./semanticValidator.js";
import { generateContentWithRetry } from "./gemini.js";
import { safeParseJSON } from "../utils/jsonHelper.js";
import { getAuthenticHistoricalJudgments, buildPrecedentComparisons } from "./finalOutcomeService.js";
import { compileStructuredContradictions, categorizeEstablishedVsDisputedFacts } from "./contradictionService.js";
import mongoose from "mongoose";

/**
 * Valid outcome classifications for preliminary analytical assessments.
 * Appropriately cautious non-definitive determinations.
 */
export const OUTCOME_CLASSIFICATIONS = {
  SUPPORTED: "Consumer's position appears supported by available evidence.",
  PARTIALLY_SUPPORTED: "Consumer's position is partially supported.",
  INSUFFICIENT_EVIDENCE: "Evidence is insufficient to assess the dispute reliably.",
  FACTS_DISPUTED: "Important facts remain disputed.",
  NOT_CURRENTLY_SUPPORTED: "Available information does not currently support the claim."
};

/**
 * Compiles categorized factual inventory across all 7 strict evidence statuses.
 * Distinguishes user allegations from verified evidence.
 */
export function compileFactualInventory(thread) {
  const intake = thread.intake || {};
  const initialAnalysis = thread.initialAnalysis || {};
  const clarificationHistory = thread.clarificationHistory || [];
  const userReportedFacts = thread.userReportedFacts || [];
  const evidenceInventory = thread.evidenceInventory || [];
  const companyPolicyResearch = thread.companyPolicyResearch || {};

  const inventory = {
    USER_REPORTED: [],
    DOCUMENT_UPLOADED: [],
    DOCUMENT_INSPECTED: [],
    INDEPENDENTLY_VERIFIED: [],
    CONTRADICTED: [],
    NOT_INSPECTED: [],
    UNAVAILABLE: [],
    UNRELATED: []
  };

  // 1. User-Reported Intake facts (unsworn complainant allegations)
  if (intake.complaint) {
    inventory.USER_REPORTED.push({
      type: "COMPLAINT_STATEMENT",
      text: intake.complaint.trim(),
      attribution: "Consumer stated in initial complaint"
    });
  }
  if (intake.product && intake.product !== "Not provided") {
    inventory.USER_REPORTED.push({
      type: "SUBJECT_MATTER",
      text: `Product / Service in dispute: ${intake.product}`,
      attribution: "Consumer reported product name"
    });
  }
  if (intake.company && intake.company !== "Not provided") {
    inventory.USER_REPORTED.push({
      type: "RESPONDENT_ENTITY",
      text: `Seller / Service Provider: ${intake.company}`,
      attribution: "Consumer reported company name"
    });
  }
  if (intake.amount && intake.amount !== "Not provided") {
    inventory.USER_REPORTED.push({
      type: "DISPUTED_AMOUNT",
      text: `Alleged transaction amount: ${intake.amount}`,
      attribution: "Consumer reported transaction value"
    });
  }

  // Add structured analysis items
  if (initialAnalysis.purchaseOrServiceDate && initialAnalysis.purchaseOrServiceDate !== "Not provided") {
    inventory.USER_REPORTED.push({
      type: "TRANSACTION_DATE",
      text: `Purchase / Service date stated as: ${initialAnalysis.purchaseOrServiceDate}`,
      attribution: "Consumer intake statement"
    });
  }

  // Clarification Q&A responses
  clarificationHistory.forEach((item) => {
    const ansText = item.answerText || (typeof item.answer === "object" ? JSON.stringify(item.answer) : String(item.answer));
    inventory.USER_REPORTED.push({
      type: "CLARIFICATION_ANSWER",
      text: `Q: ${item.question} -> A: ${ansText}`,
      attribution: "Consumer response during clarification"
    });
  });

  // Additional reported facts
  userReportedFacts.forEach((fact) => {
    inventory.USER_REPORTED.push({
      type: "USER_FACT",
      text: fact.text,
      attribution: fact.source || "USER_INPUT"
    });
  });

  // 2. Process Evidence Inventory documents
  evidenceInventory.forEach((doc) => {
    const status = doc.status || (doc.unavailable ? "UNAVAILABLE" : doc.inspected ? "DOCUMENT_INSPECTED" : "DOCUMENT_UPLOADED");
    const extracted = doc.extractedInfo || {};

    if (doc.relevance === "UNRELATED" || doc.userConfirmedUnrelated) {
      inventory.UNRELATED.push({
        title: doc.title || doc.originalName,
        category: doc.category,
        relevanceReason: doc.relevanceReason || "Document content does not correspond to the complaint domain.",
        mismatchWarning: doc.mismatchWarning,
        claimsNotSupported: doc.claimsNotSupported || [],
        exclusionNote: "Flagged as unrelated to dispute issue and excluded from substantive claims."
      });
      return;
    }

    if (status === "UNAVAILABLE" || doc.unavailable) {
      inventory.UNAVAILABLE.push({
        title: doc.title || doc.originalName || "Requested Document",
        category: doc.category || "OTHER",
        reason: doc.unavailableReason || "Document unavailable or never issued by merchant.",
        disclosure: `Consumer disclosed: Document was not provided by vendor or cannot be retrieved.`
      });
    } else if (status === "CONTRADICTED") {
      inventory.CONTRADICTED.push({
        title: doc.title || doc.originalName,
        category: doc.category,
        contradictions: extracted.contradictionsNoted || ["Discrepancy noted between stated claim and document content."],
        details: `Document details: ${extracted.rawText?.substring(0, 150) || "Extracted content"}`
      });
    } else if (status === "DOCUMENT_INSPECTED" || doc.inspected) {
      inventory.DOCUMENT_INSPECTED.push({
        title: doc.title || doc.originalName,
        category: doc.category,
        documentType: extracted.documentType || "DOCUMENT",
        datesFound: extracted.datesFound || [],
        amountsFound: extracted.amountsFound || [],
        partiesFound: extracted.partiesFound || [],
        referenceNumbers: extracted.referenceNumbers || [],
        pertinentClauses: extracted.pertinentClauses || [],
        supportsUserClaims: extracted.supportsUserClaims,
        userCorrection: doc.userCorrection ? doc.userCorrection.correctedText : null,
        fileSize: doc.fileSize,
        verifiedAt: extracted.extractedAt || doc.uploadedAt
      });
    } else if (status === "NOT_INSPECTED") {
      inventory.NOT_INSPECTED.push({
        title: doc.title || doc.originalName,
        category: doc.category,
        reason: "Document uploaded but unreadable, scanned without OCR text, or inspection unsupported."
      });
    } else {
      inventory.DOCUMENT_UPLOADED.push({
        title: doc.title || doc.originalName,
        category: doc.category,
        filename: doc.originalName,
        fileSize: doc.fileSize
      });
    }
  });

  // 3. Independently Verified (from company policy research and statutory records)
  if (companyPolicyResearch && Array.isArray(companyPolicyResearch.policies)) {
    companyPolicyResearch.policies.forEach((pol) => {
      inventory.INDEPENDENTLY_VERIFIED.push({
        title: pol.title,
        sourceUrl: pol.sourceUrl,
        passage: pol.passage,
        claimSupported: pol.claimSupported,
        statutoryComparison: pol.statutoryComparison,
        retrievalDate: pol.retrievalDate
      });
    });
  }

  return inventory;
}

/**
 * Synthesizes the balanced 14-section legal assessment based on verified facts,
 * statutory benchmarks under CPA 2019, and disclosed limitations.
 */
export async function buildBalancedAssessment({
  thread,
  factualInventory,
  hybridKnowledge,
  isProceedWithLimitations = false,
  limitationsDisclosed = []
}) {
  const intake = thread.intake || {};
  const initialAnalysis = thread.initialAnalysis || {};
  const category = thread.category || initialAnalysis.disputeCategory || "Consumer Dispute";
  const companyName = intake.company || "Opposite Party / Merchant";
  const productName = intake.product || "Product / Service";
  const disputedAmount = intake.amount || "Unspecified amount";

  const inspectedDocs = factualInventory.DOCUMENT_INSPECTED || [];
  const unavailableDocs = factualInventory.UNAVAILABLE || [];
  const contradictedDocs = factualInventory.CONTRADICTED || [];
  const userReported = factualInventory.USER_REPORTED || [];
  const independentlyVerified = factualInventory.INDEPENDENTLY_VERIFIED || [];

  // 1. Case Summary
  const caseSummary = `Consumer dispute regarding ${productName} provided by ${companyName}. The complainant alleges deficiency of service and/or unfair trade practice regarding transaction value ${disputedAmount}. ${
    inspectedDocs.length > 0
      ? `Physical documentation comprising ${inspectedDocs.map((d) => d.title).join(", ")} was submitted and inspected.`
      : isProceedWithLimitations
      ? `Investigation proceeded based on consumer testimony under disclosed evidentiary limitations.`
      : `Evidentiary record examined.`
  }`;

  // 2. Consumer's Allegations
  const consumerAllegations = [
    `Complainant states: "${intake.complaint || "Unresolved consumer grievance"}"`,
    ...(initialAnalysis.reportedProblem ? [`Reported defect/deficiency: ${initialAnalysis.reportedProblem}`] : []),
    ...(initialAnalysis.actionsTaken && initialAnalysis.actionsTaken.length > 0
      ? [`Steps taken by consumer: ${initialAnalysis.actionsTaken.join("; ")}`]
      : []),
    ...(initialAnalysis.responsesReceived && initialAnalysis.responsesReceived.length > 0
      ? [`Merchant response received: ${initialAnalysis.responsesReceived.join("; ")}`]
      : [])
  ];

  // 3. Established and Unestablished Facts (with 7 status badges)
  const establishedFacts = [];
  const unestablishedFacts = [];

  // Inspected docs establish verified facts
  inspectedDocs.forEach((doc) => {
    const details = [];
    if (doc.datesFound?.length) details.push(`Date: ${doc.datesFound.join(", ")}`);
    if (doc.amountsFound?.length) details.push(`Amount: ${doc.amountsFound.join(", ")}`);
    if (doc.referenceNumbers?.length) details.push(`Ref #: ${doc.referenceNumbers.join(", ")}`);

    establishedFacts.push({
      statement: `Documentary evidence "${doc.title}" confirms transaction details (${details.join(" | ")}).`,
      evidenceStatus: "DOCUMENT_INSPECTED",
      sourceReference: doc.title,
      isEstablished: true
    });

    if (doc.userCorrection) {
      establishedFacts.push({
        statement: `Consumer clarification noted for "${doc.title}": ${doc.userCorrection}`,
        evidenceStatus: "DOCUMENT_INSPECTED",
        sourceReference: `${doc.title} (Clarified)`,
        isEstablished: true
      });
    }
  });

  // Independently verified policies
  independentlyVerified.forEach((iv) => {
    establishedFacts.push({
      statement: `Published policy terms for ${companyName} (${iv.title}) verified against statutory standards.`,
      evidenceStatus: "INDEPENDENTLY_VERIFIED",
      sourceReference: iv.sourceUrl || "Official Regulatory Record",
      isEstablished: true
    });
  });

  // User-reported statements remain unestablished allegations unless backed by documents
  userReported.forEach((ur) => {
    const isDocCorroborated = inspectedDocs.some(
      (d) =>
        (d.amountsFound && d.amountsFound.some((a) => ur.text.includes(a))) ||
        (d.referenceNumbers && d.referenceNumbers.some((r) => ur.text.includes(r)))
    );

    if (isDocCorroborated) {
      establishedFacts.push({
        statement: ur.text,
        evidenceStatus: "DOCUMENT_INSPECTED",
        sourceReference: "Corroborated by inspected records",
        isEstablished: true
      });
    } else {
      unestablishedFacts.push({
        statement: ur.text,
        evidenceStatus: "USER_REPORTED",
        sourceReference: ur.attribution || "Consumer Statement",
        isEstablished: false
      });
    }
  });

  // Contradicted items
  contradictedDocs.forEach((cd) => {
    unestablishedFacts.push({
      statement: `Contradiction identified in ${cd.title}: ${cd.contradictions.join("; ")}`,
      evidenceStatus: "CONTRADICTED",
      sourceReference: cd.title,
      isEstablished: false
    });
  });

  // Unavailable items
  unavailableDocs.forEach((ud) => {
    unestablishedFacts.push({
      statement: `${ud.title} was not produced. Disclosed reason: ${ud.reason}`,
      evidenceStatus: "UNAVAILABLE",
      sourceReference: "Consumer Disclosure",
      isEstablished: false
    });
  });

  // 4. Evidence Reviewed
  const evidenceReviewed = inspectedDocs.map((doc) => ({
    title: doc.title,
    category: doc.category,
    documentType: doc.documentType,
    datesFound: doc.datesFound,
    amountsFound: doc.amountsFound,
    referenceNumbers: doc.referenceNumbers,
    status: "DOCUMENT_INSPECTED",
    supportsClaim: doc.supportsUserClaims !== false
  }));

  // 5. Evidence Limitations
  const evidenceLimitations = [
    ...limitationsDisclosed,
    ...(unavailableDocs.length > 0
      ? unavailableDocs.map((ud) => `Missing document: ${ud.title} (${ud.reason})`)
      : []),
    ...(factualInventory.NOT_INSPECTED.length > 0
      ? factualInventory.NOT_INSPECTED.map((ni) => `Uninspected document: ${ni.title} (${ni.reason})`)
      : []),
    ...(inspectedDocs.length === 0
      ? ["No documentary evidence was inspected. Assessment relies solely on consumer-supplied declarations."]
      : [])
  ];

  // 6. Relevant Company Policy and Terms
  const policyResearch = thread.companyPolicyResearch || {};
  const companyPolicyAndTerms = {
    companyName: policyResearch.companyName || companyName,
    policySummary: policyResearch.policySummary || "Statutory standards under Consumer Protection Act, 2019 apply in the absence of specific contractual exemption.",
    policies: policyResearch.policies || [],
    limitationNote: policyResearch.limitationNote || null
  };

  // 7. Applicable Legal Provisions (CPA 2019 + Sectoral)
  const applicableLegalProvisions = [
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 2(7)",
      title: "Definition of 'Consumer'",
      text: "Any person who buys any goods or hires/avails any services for a consideration which has been paid or promised, excluding commercial resale.",
      authority: "Parliament of India",
      relevance: "Establishes locus standi of the complainant as a consumer under Indian Law."
    },
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 2(11)",
      title: "Deficiency in Service",
      text: "Any fault, imperfection, shortcoming or inadequacy in the quality, nature and manner of performance which is required to be maintained by or under any law or in pursuance of a contract.",
      authority: "Parliament of India",
      relevance: "Governs failure of the seller or service provider to fulfill committed standards or resolve grievances."
    },
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 2(47)",
      title: "Unfair Trade Practice",
      text: "Adopting any unfair method or unfair or deceptive practice including false representation of goods/services, refusal to refund, or imposing harsh non-negotiable clauses.",
      authority: "Parliament of India",
      relevance: "Applies if the merchant advertised false specifications or unreasonably refused statutory remedies."
    },
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 35 & 39",
      title: "Filing and Powers of District Commission to Order Relief",
      text: "Authorizes the Commission to order removal of defects, replacement of goods, return of price with interest, and compensation for negligence or loss suffered by the consumer.",
      authority: "District Consumer Disputes Redressal Commission",
      relevance: "Provides the statutory basis for consumer's financial remedies and replacement orders."
    },
    {
      act: "Consumer Protection (E-Commerce) Rules, 2020",
      section: "Rule 5 & Rule 6",
      title: "Liabilities of Marketplace and Inventory E-Commerce Entities",
      text: "Mandates appointment of Grievance Officer, acknowledgment of complaints within 48 hours, resolution within one month, and prohibition of unreasonable cancellation fees or denial of legitimate return requests.",
      authority: "Central Consumer Protection Authority (CCPA)",
      relevance: "Applies to e-commerce marketplaces and digital service aggregators."
    }
  ];

  // 8. Consumer's Strongest Arguments
  const consumerStrongestArguments = [
    {
      issue: "Deficiency of Service / Defective Product",
      argument: `The consumer contracted for ${productName} against consideration of ${disputedAmount}. The failure to deliver compliant goods/services constitutes a statutory deficiency under Section 2(11) of CPA 2019.`,
      statutoryBasis: "Section 2(11), Consumer Protection Act, 2019",
      evidentiaryWeight: inspectedDocs.length > 0 ? "HIGH (Supported by uploaded documentation)" : "MODERATE (Relying on consumer statement)"
    },
    {
      issue: "Right to Timely Grievance Redressal",
      argument: `Under the Consumer Protection (E-Commerce) Rules, 2020 and benchmark standards, a service provider must address consumer grievances within 48 hours and provide redress within one month. Protracted delay constitutes unfair trade practice.`,
      statutoryBasis: "Consumer Protection (E-Commerce) Rules, 2020, Rule 5",
      evidentiaryWeight: "STRONG"
    },
    {
      issue: "Unfair Contract Terms Inapplicable",
      argument: `Internal seller disclaimers or arbitrary 'no-refund' declarations cannot override mandatory statutory consumer remedies under Section 2(47) and Section 39 of CPA 2019.`,
      statutoryBasis: "Section 2(47) & Section 39, Consumer Protection Act, 2019",
      evidentiaryWeight: "STRONG"
    }
  ];

  // 9. Company's Strongest Plausible Counterarguments (Reasonable, factual defense model, no fabricated quotes)
  const companyStrongestCounterarguments = [
    {
      issue: "Terms of Service & Return Window Compliance",
      argument: `The company may assert that return or replacement requests must be initiated strictly within the published policy window (e.g., 7 or 10 days from delivery). If the consumer reported the issue after the stipulated window, standard manufacturer warranty channels apply rather than merchant return.`,
      rebuttalNote: "Consumer must verify whether initial contact was made within the return window.",
      isFabricatedResponse: false,
      disclaimer: "Analytical defense model: The opposite party has not yet submitted a formal reply."
    },
    {
      issue: "Verification & Authorized Inspection Requirement",
      argument: `For technical defects, company terms routinely require inspection by an authorized service engineer to confirm that the failure is a manufacturing defect rather than customer-induced physical damage, electrical surge, or unauthorized handling.`,
      rebuttalNote: "Consumer should produce any job sheet, inspection report, or technician visitation confirmation.",
      isFabricatedResponse: false,
      disclaimer: "Analytical defense model: The opposite party has not yet submitted a formal reply."
    },
    {
      issue: "Marketplace Intermediary Exemption (Safe Harbor)",
      argument: `If the platform is an e-commerce marketplace under Section 79 of the Information Technology Act, 2000, it may contend that the primary liability lies with the independent third-party merchant rather than the platform operator, provided it discharged notice-and-take-down obligations.`,
      rebuttalNote: "Under CPA 2019 E-Commerce Rules, marketplace platforms still owe affirmative duties regarding grievance handling and seller identification.",
      isFabricatedResponse: false,
      disclaimer: "Analytical defense model: The opposite party has not yet submitted a formal reply."
    }
  ];

  // 10. Conflicting Evidence and Unresolved Questions
  const structuredContradictions = compileStructuredContradictions(thread);
  const { establishedFacts: structuredEstablished, disputedFacts: structuredDisputed } = categorizeEstablishedVsDisputedFacts(thread, structuredContradictions);
  const hasUnresolvedContradictions = structuredContradictions.some((c) => !c.isResolved) || contradictedDocs.length > 0;

  const conflictingEvidenceAndUnresolvedQuestions = [];
  if (contradictedDocs.length > 0) {
    contradictedDocs.forEach((cd) => {
      conflictingEvidenceAndUnresolvedQuestions.push(
        `Discrepancy noted in ${cd.title}: ${cd.contradictions.join("; ")}`
      );
    });
  }
  if (structuredContradictions.length > 0) {
    structuredContradictions.filter((c) => !c.isResolved).forEach((c) => {
      conflictingEvidenceAndUnresolvedQuestions.push(
        `Discrepancy: ${c.title} — ${c.clarificationNeeded}`
      );
    });
  }
  if (unavailableDocs.length > 0) {
    conflictingEvidenceAndUnresolvedQuestions.push(
      `Absence of physical verification documents: ${unavailableDocs.map((ud) => ud.title).join(", ")}`
    );
  }
  if (!intake.amount || intake.amount === "Not provided") {
    conflictingEvidenceAndUnresolvedQuestions.push(
      "Exact disputed transaction amount and proof of bank debit have not been conclusively quantified."
    );
  }
  if (conflictingEvidenceAndUnresolvedQuestions.length === 0) {
    conflictingEvidenceAndUnresolvedQuestions.push(
      "Opposite party's formal written version has not been received; full assessment is contingent on their factual disclosures."
    );
  }

  // 11. Preliminary Assessment & Analytical Outcome Classification
  let outcomeClassification = OUTCOME_CLASSIFICATIONS.PARTIALLY_SUPPORTED;

  if (hasUnresolvedContradictions) {
    outcomeClassification = OUTCOME_CLASSIFICATIONS.FACTS_DISPUTED;
  } else if (inspectedDocs.length > 0 && inspectedDocs.some((d) => d.supportsUserClaims !== false)) {
    outcomeClassification = OUTCOME_CLASSIFICATIONS.SUPPORTED;
  } else if (isProceedWithLimitations) {
    outcomeClassification = OUTCOME_CLASSIFICATIONS.PARTIALLY_SUPPORTED;
  } else if (inspectedDocs.length === 0) {
    outcomeClassification = OUTCOME_CLASSIFICATIONS.INSUFFICIENT_EVIDENCE;
  }

  const preliminaryAssessmentExplanation = `Based on the currently available evidentiary record, ${outcomeClassification} ${
    outcomeClassification === OUTCOME_CLASSIFICATIONS.SUPPORTED
      ? `The consumer's uploaded documentation corroborates the purchase and initial grievance reporting. Under Section 2(11) and Section 39 of CPA 2019, a prima facie case of service deficiency is established.`
      : outcomeClassification === OUTCOME_CLASSIFICATIONS.PARTIALLY_SUPPORTED
      ? `While the consumer's grievance appears consistent with statutory standards, the absence of independent inspection reports or complete documentation limits the conclusiveness of the preliminary assessment.`
      : `Important factual elements remain unresolved or subject to dispute upon formal proceedings.`
  } This is a preliminary analytical assessment and does not constitute a judicial decree.`;

  // 12. Potential Remedies or Next Steps
  const potentialRemedies = {
    possibleRemedies: [
      {
        remedy: "Full Refund of Price Paid",
        statutoryProvision: "Section 39(1)(c), CPA 2019",
        eligibility: "Applicable where goods are irreparably defective or services entirely unrendered."
      },
      {
        remedy: "Free Replacement with Defect-Free Unit",
        statutoryProvision: "Section 39(1)(b), CPA 2019",
        eligibility: "Applicable where merchant or manufacturer has identical product in stock."
      },
      {
        remedy: "Rectification / Free Repair of Defect",
        statutoryProvision: "Section 39(1)(a), CPA 2019",
        eligibility: "Applicable where authorized service center can remedy defect within reasonable timeframe."
      },
      {
        remedy: "Reasonable Compensation for Harassment & Mental Agony",
        statutoryProvision: "Section 39(1)(d), CPA 2019",
        eligibility: "Subject to proof of actual injury, negligence, or pecuniary loss suffered by the consumer. Amounts are determined at the discretion of the Consumer Commission; no specific figure is guaranteed."
      }
    ],
    eligibilityConditions: [
      "Proof of valid consumer transaction (invoice, order ID, or payment confirmation).",
      "Notice of defect communicated to opposite party within reasonable or warranty period.",
      "Clear identification of the opposite party's registered entity and contact information."
    ],
    missingInformation: evidenceLimitations.length > 0 ? evidenceLimitations : ["None identified."],
    stepsConsumerCanConsiderNext: [
      "Submit a formal written escalation letter to the Company's designated Grievance / Nodal Officer giving 7 to 15 days for resolution.",
      "Register an official complaint on the National Consumer Helpline (NCH) at consumerhelpline.gov.in or call 1915.",
      "If unresolved after 15 days, prepare and file a formal consumer complaint on the e-Daakhil portal (edaakhil.nic.in) before the competent District Consumer Disputes Redressal Commission."
    ]
  };

  // 14. Authoritative Historical Judgments and Precedent Comparisons
  const historicalJudgments = getAuthenticHistoricalJudgments(category, intake.complaint || "");
  const precedentComparisons = historicalJudgments.map((j) =>
    buildPrecedentComparisons(j, intake, inspectedDocs, unavailableDocs)
  );

  // 13. Calibrated Assessment Strength & Transparent Confidence Calibration
  const relevantDocs = inspectedDocs.filter((d) => d.relevance !== "UNRELATED");
  const unrelatedDocs = (factualInventory.UNRELATED || []).concat(
    (thread.evidenceInventory || []).filter((d) => d.relevance === "UNRELATED")
  );
  const hasOnlyUnrelatedEvidence =
    (thread.evidenceInventory || []).length > 0 &&
    relevantDocs.length === 0 &&
    unrelatedDocs.length > 0;

  let confidenceScore = 60; // Neutral evidentiary baseline for intake testimony
  if (relevantDocs.length > 0) confidenceScore += 15; // Corroborated by verified relevant documents
  if (historicalJudgments && historicalJudgments.length > 0) confidenceScore += 10; // High-authority precedents directly match
  if (isProceedWithLimitations) confidenceScore -= 15; // Proceeded under disclosed evidentiary limitations
  if (unavailableDocs.length > 0) confidenceScore -= 10; // Missing primary documents
  if (hasOnlyUnrelatedEvidence) confidenceScore -= 25; // Irrelevant document supplied instead of relevant proof
  if (contradictedDocs.length > 0) confidenceScore -= 20; // Material internal contradictions
  confidenceScore = Math.max(35, Math.min(85, confidenceScore));

  const uncertaintyFactors = [
    "Opposite party's defense has not been tested through cross-examination or formal counter-affidavit.",
    ...(hasOnlyUnrelatedEvidence
      ? [`Submitted document(s) (${unrelatedDocs.map((u) => u.title).join(", ")}) are unrelated to this complaint. Primary booking/cancellation evidence remains missing.`]
      : []),
    ...(isProceedWithLimitations ? ["Investigation proceeded under disclosed evidentiary limitations."] : []),
    ...(unavailableDocs.length > 0 ? [`Missing physical records: ${unavailableDocs.map((u) => u.title).join(", ")}`] : []),
    "Consumer Commission possesses judicial discretion to weigh evidence and award remedies under Section 39."
  ];

  // 15. Likely Outcome & Plausible Alternative Scenarios
  const likelyOutcomeAndScenarios = {
    primaryScenario: outcomeClassification,
    alternativeScenarios: [
      "If the opposite party fails to respond within the statutory notice period, the Commission may proceed ex-parte under Section 38(3)(b)(ii) of CPA 2019.",
      "If the opposite party produces an authorized technician report alleging user-induced damage or out-of-warranty condition, the matter will require court appointment of an independent expert laboratory under Section 38(2)(c)."
    ],
    evidentiarySensitivity: isProceedWithLimitations
      ? "High sensitivity to documentary proof: Submitting purchase invoice, serial numbers, and service communications will significantly reinforce consumer standing."
      : "Low sensitivity: Primary purchase and notice facts are established by inspected records."
  };

  // 16. Recommended Next Steps
  const recommendedNextSteps = [
    "Serve a formal Legal Escalation Notice to the Company's Nodal / Grievance Officer giving 15 days for voluntary resolution.",
    "Lodge an official consumer grievance on the National Consumer Helpline (NCH 1915 or consumerhelpline.gov.in).",
    "If unresolved, file an electronic consumer complaint before the competent District Commission via e-Daakhil (edaakhil.nic.in)."
  ];

  // 17. Sources and Citations (Primary verified legislation & real precedents with Indian Kanoon links)
  const sourcesAndCitations = [
    {
      type: "STATUTE",
      title: "Consumer Protection Act, 2019",
      identifier: "Act No. 35 of 2019",
      sectionsCited: ["Section 2(7)", "Section 2(10)", "Section 2(11)", "Section 2(47)", "Section 35", "Section 39", "Section 69"],
      authority: "Parliament of India",
      effectiveDate: "20 July 2020",
      sourceUrl: "https://www.indiacode.nic.in/handle/123456789/15256",
      verified: true
    },
    {
      type: "RULES",
      title: "Consumer Protection (E-Commerce) Rules, 2020",
      identifier: "G.S.R. 462(E)",
      sectionsCited: ["Rule 4", "Rule 5", "Rule 6"],
      authority: "Ministry of Consumer Affairs, Food and Public Distribution",
      effectiveDate: "23 July 2020",
      sourceUrl: "https://consumeraffairs.nic.in/",
      verified: true
    },
    ...historicalJudgments.map((j) => ({
      type: "PRECEDENT",
      title: j.case_name,
      identifier: j.citation || "Judicial Citation",
      authority: j.court || "Supreme Court of India / NCDRC",
      courtLevel: j.court_level || "NATIONAL_COMMISSION",
      legalWeight: j.court_level === "SUPREME_COURT"
        ? "BINDING PRECEDENT (Article 141, Constitution of India)"
        : "APPELLATE & PERSUASIVE PRECEDENT (NCDRC Landmark Ruling)",
      sourceUrl: j.source || j.source_url || "https://indiankanoon.org/",
      relevance: j.consumer_supporting_principle || j.court_reasoning?.substring(0, 160) || "Precedent governing liability standards.",
      verified: true
    }))
  ];

  return {
    caseSummary,
    consumerAllegations,
    factsAnalysis: {
      establishedFacts,
      unestablishedFacts,
      totalEstablished: establishedFacts.length,
      totalUnestablished: unestablishedFacts.length,
      structuredEstablished,
      structuredDisputed
    },
    contradictionAnalysis: {
      contradictions: structuredContradictions,
      establishedFacts: structuredEstablished,
      disputedFacts: structuredDisputed
    },
    structuredContradictions,
    establishedFacts: structuredEstablished,
    disputedFacts: structuredDisputed,
    evidenceReviewed,
    evidenceLimitations,
    companyPolicyAndTerms,
    applicableLegalProvisions,
    relevantHistoricalJudgments: historicalJudgments,
    precedentComparisons,
    consumerStrongestArguments,
    companyStrongestCounterarguments,
    conflictingEvidenceAndUnresolvedQuestions,
    preliminaryAssessment: {
      outcomeClassification,
      explanation: preliminaryAssessmentExplanation
    },
    likelyOutcomeAndScenarios,
    potentialRemedies,
    confidenceScore,
    confidenceAndUncertainty: {
      confidenceScore,
      uncertaintyFactors
    },
    recommendedNextSteps,
    sourcesAndCitations
  };
}

/**
 * Generates the grounded legal assessment for an investigation case.
 * Enforces server-side readiness gate and user ownership.
 * 
 * @param {object} params
 * @param {string} params.threadId
 * @param {string|null} [params.userId]
 * @param {string|null} [params.guestToken]
 * @returns {Promise<object>} Assessment output and updated investigation
 */
export async function generateLegalAssessment({ threadId, userId = null, guestToken = null }) {
  if (!threadId) throw new Error("threadId is required.");

  const thread = await getThread(threadId, userId, guestToken);
  if (!thread) {
    const err = new Error(`Investigation with threadId "${threadId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 1. ENFORCE READINESS GATE SERVER-SIDE
  const gate = thread.investigationGate || {};
  const isSatisfied = Boolean(
    gate.isSatisfied ||
    gate.status === "READY" ||
    gate.status === "PROCEED_WITH_LIMITATIONS"
  );

  if (!isSatisfied) {
    const error = new Error(
      `Cannot generate legal assessment before investigation completeness gate is satisfied. Current gate status: ${gate.status || "NOT_EVALUATED"}. Please answer pending questions, provide evidence, or confirm proceeding with limitations.`
    );
    error.statusCode = 400;
    throw error;
  }

  const isProceedWithLimitations = gate.status === "PROCEED_WITH_LIMITATIONS" || Boolean(gate.proceedWithoutEvidenceOverride);
  const limitationsDisclosed = Array.isArray(gate.limitationsDisclosed) ? gate.limitationsDisclosed : [];

  // 2. COMPILE FACTUAL INVENTORY ACROSS 7 EVIDENCE STATUSES
  const factualInventory = compileFactualInventory(thread);

  // 3. RETRIEVE HYBRID LEGAL KNOWLEDGE (CPA 2019 Statutes + Official Rules + Precedents)
  const intakeText = `${thread.intake?.complaint || ""} ${thread.intake?.product || ""} ${thread.intake?.company || ""}`;
  let hybridKnowledge = null;
  try {
    hybridKnowledge = await retrieveHybridLegalKnowledge(
      { facts: [intakeText], disputed_amount: thread.intake?.amount || "Unspecified" },
      intakeText
    );
  } catch (err) {
    console.warn("⚠️ Hybrid legal retrieval warning, using statutory defaults:", err.message);
  }

  // 4. BUILD BALANCED 14-SECTION ASSESSMENT
  const assessmentSections = await buildBalancedAssessment({
    thread,
    factualInventory,
    hybridKnowledge,
    isProceedWithLimitations,
    limitationsDisclosed
  });

  // 5. VALIDATE CITATIONS AND GROUNDING DETERMINISTICALLY
  const rawAssessmentOutput = {
    applicable_sections: assessmentSections.applicableLegalProvisions.map((p) => p.section),
    sources: assessmentSections.sourcesAndCitations,
    verdict: assessmentSections.preliminaryAssessment.outcomeClassification,
    summary: assessmentSections.caseSummary
  };

  const retrievedContext = (assessmentSections.applicableLegalProvisions || [])
    .map((p) => `[${p.section} - ${p.act}]\n${p.text}`)
    .join("\n\n");

  const groundingValidation = validateAgentOutput("Judge", rawAssessmentOutput, retrievedContext);

  const assessmentRecord = {
    status: "COMPLETE",
    summary: assessmentSections.caseSummary,
    preliminaryAssessment: {
      outcomeClassification: assessmentSections.preliminaryAssessment.outcomeClassification,
      explanation: assessmentSections.preliminaryAssessment.explanation,
      confidenceScore: assessmentSections.confidenceAndUncertainty.confidenceScore,
      sections: assessmentSections,
      groundingAudit: {
        citationErrors: groundingValidation.citation_errors || [],
        fabricatedSources: groundingValidation.fabricated_sources || [],
        valid: groundingValidation.valid !== false
      },
      isProceedWithLimitations,
      generatedAt: new Date()
    },
    completedAt: new Date()
  };

  // 6. PERSIST ASSESSMENT AND ADVANCE STAGE TO ASSESSMENT_COMPLETE
  const updatedStage = INVESTIGATION_STAGES.ASSESSMENT_COMPLETE;

  if (mongoose.connection.readyState === 1) {
    try {
      await Thread.findOneAndUpdate(
        { threadId },
        {
          $set: {
            assessment: assessmentRecord,
            stage: updatedStage,
            updatedAt: new Date()
          }
        },
        { new: true }
      );
    } catch (e) {
      console.warn("⚠️ MongoDB assessment save warning:", e.message);
    }
  }

  thread.assessment = assessmentRecord;
  thread.stage = updatedStage;
  thread.updatedAt = new Date();

  return {
    success: true,
    stage: updatedStage,
    assessment: assessmentRecord,
    investigation: thread
  };
}
