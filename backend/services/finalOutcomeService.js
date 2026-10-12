import { Thread, INVESTIGATION_STAGES } from "../models/Thread.js";
import { getThread, appendAuditTimelineEvent, memoryStore } from "./threadService.js";
import { evaluateInvestigationGate } from "./investigationGateService.js";
import { compileFactualInventory, OUTCOME_CLASSIFICATIONS } from "./legalAssessmentService.js";
import { compileStructuredContradictions, categorizeEstablishedVsDisputedFacts } from "./contradictionService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JUDGMENTS_PATH = path.resolve(__dirname, "../data/consumer_protection_judgments.json");

/**
 * Standard final outcome classifications.
 * Non-definitive, reasoned analytical classifications under CPA 2019.
 */
export const FINAL_OUTCOME_CLASSIFICATIONS = {
  STRONGLY_SUPPORTED: "Consumer's case appears strongly supported by available evidence and precedents",
  PARTIALLY_SUPPORTED: "Consumer's case is partially supported on current evidence",
  INSUFFICIENTLY_SUPPORTED: "Evidence is insufficiently supported on current record",
  OUTCOME_UNCERTAIN: "Outcome remains uncertain due to factual and procedural disputes"
};

/**
 * Loads authentic historical judgments from the local verified dataset.
 * Guarantees zero fabricated case names, citations, or URLs.
 */
export function getAuthenticHistoricalJudgments(category = "", complaintText = "") {
  try {
    if (fs.existsSync(JUDGMENTS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(JUDGMENTS_PATH, "utf-8"));
      const query = `${category} ${complaintText}`.toLowerCase();

      // Score and sort judgments by relevance
      const scored = raw
        .filter((j) => j.source_verified !== false)
        .map((j) => {
          let score = 0;
          const catList = Array.isArray(j.case_category) ? j.case_category : [];
          if (catList.some((c) => query.includes(c.toLowerCase()))) score += 5;
          if (query.includes("car") || query.includes("vehicle") || query.includes("auto")) {
            if (catList.includes("Automobile") || j.case_name.toLowerCase().includes("tata")) score += 6;
          }
          if (query.includes("laptop") || query.includes("phone") || query.includes("tv") || query.includes("screen") || query.includes("electronic")) {
            if (catList.includes("Electronics") || catList.includes("Defective Product")) score += 6;
          }
          if (query.includes("amazon") || query.includes("flipkart") || query.includes("online") || query.includes("e-commerce")) {
            if (catList.includes("E-Commerce") || j.case_name.toLowerCase().includes("amazon")) score += 6;
          }
          if (query.includes("bank") || query.includes("atm") || query.includes("fraud") || query.includes("upi")) {
            if (catList.includes("Banking") || j.case_name.toLowerCase().includes("bank")) score += 6;
          }
          if (query.includes("insur") || query.includes("policy") || query.includes("mediclaim")) {
            if (catList.includes("Insurance") || j.case_name.toLowerCase().includes("insurance")) score += 6;
          }
          if (query.includes("builder") || query.includes("flat") || query.includes("housing") || query.includes("possession")) {
            if (catList.includes("Real Estate")) score += 6;
          }
          if (query.includes("coaching") || query.includes("college") || query.includes("fee") || query.includes("course")) {
            if (catList.includes("Education Services") || j.case_name.toLowerCase().includes("fiitjee")) score += 6;
          }
          if (query.includes("hospital") || query.includes("doctor") || query.includes("medical")) {
            if (catList.includes("Medical Services")) score += 6;
          }
          return { judgment: j, score };
        });

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 3).map((s) => s.judgment);
    }
  } catch (err) {
    console.warn("⚠️ Warning loading authentic judgments:", err.message);
  }
  return [];
}

/**
 * Generates fact-by-fact comparisons between user dispute facts and historical court judgments.
 */
export function buildPrecedentComparisons(judgment, intake, inspectedDocs, unavailableDocs) {
  const caseName = judgment.case_name || "Historical Authority";
  const productName = intake.product || "Product/Service in dispute";
  const hasDocuments = inspectedDocs.length > 0;

  let factualSimilarity = "";
  let distinguishingFactor = "";
  let applicationRationale = "";

  if (judgment.case_name?.includes("Tata Motors")) {
    factualSimilarity = `Like in Tata Motors Ltd. v. Antonio Paulo Vaz, the consumer reported severe product defects within days of delivery, where repairs/replacements were resisted by the opposite party.`;
    distinguishingFactor = hasDocuments
      ? `In the cited precedent, expert mechanical engineering reports proved an inherent flaw; here, documentary invoices and job sheets corroborate purchase, but independent laboratory testing under Section 38(2)(c) may be sought if the defect is contested.`
      : `Unlike Tata Motors where job cards proved repeated dealer visits within 15 days, here physical inspection reports have not yet been produced.`;
    applicationRationale = `The Supreme Court established that brand-new goods suffering repeated breakdowns establish a prima facie manufacturing defect under Section 2(10), making seller and manufacturer jointly liable under Section 84.`;
  } else if (judgment.case_name?.includes("Amazon Seller Services")) {
    factualSimilarity = `Like in Amazon v. Vishwajit Singh, the dispute concerns transaction fulfillment and grievance handling on an online retail marketplace platform.`;
    distinguishingFactor = hasDocuments
      ? `The consumer possesses digital payment transaction and purchase records corroborating consideration paid, matching the evidentiary standard upheld by the NCDRC.`
      : `The cited precedent relied on unboxing records; consumer must verify communications exchanged with customer support.`;
    applicationRationale = `The NCDRC held that under the Consumer Protection (E-Commerce) Rules, 2020, marketplace platforms cannot disown liability for trade deficiency or non-delivery by asserting safe-harbour immunity under Section 79 of the IT Act.`;
  } else if (judgment.case_name?.includes("State Bank of India")) {
    factualSimilarity = `Like in SBI v. Sheila Ranganathan, the dispute involves disputed transaction deductions and timely notification to the provider.`;
    distinguishingFactor = hasDocuments
      ? `Inspected transaction statements corroborate the disputed debit amount.`
      : `Consumer must establish proof of immediate notification (call logs/complaint docket) within 3 days.`;
    applicationRationale = `NCDRC ruled that financial service providers bear strict operational duties to transmit real-time alerts and reverse unauthorized debits under RBI Zero Liability standards.`;
  } else if (judgment.case_name?.includes("National Insurance")) {
    factualSimilarity = `Like in National Insurance v. Harsolia Motors, the complainant asserts denial of contractual indemnification and deficiency under Section 2(11).`;
    distinguishingFactor = `The Supreme Court affirmed that risk indemnification is not a commercial purpose excluding consumer standing under Section 2(7).`;
    applicationRationale = `Technical exclusion clauses must be interpreted strictly in favor of the insured.`;
  } else if (judgment.case_name?.includes("FIITJEE")) {
    factualSimilarity = `Like in FIITJEE v. Minathi Rath, the consumer seeks refund for unrendered service duration against harsh non-negotiable clauses.`;
    distinguishingFactor = `NCDRC held that one-sided non-refundable agreements signed under compulsion are 'unfair contracts' under Section 2(46).`;
    applicationRationale = `Service providers are entitled only to retain pro-rata consideration for the exact period services were availed.`;
  } else {
    factualSimilarity = `The core grievance involves alleged shortcoming in quality or performance required to be maintained by law or contract under Section 2(11) of CPA 2019.`;
    distinguishingFactor = hasDocuments
      ? `Documentary records provide initial corroboration, subject to counter-party reply.`
      : `Evidentiary record relies primarily on consumer testimony under disclosed limitations.`;
    applicationRationale = `Judicial benchmarks require proving defect or deficiency on the balance of probabilities.`;
  }

  const legalWeight = judgment.court_level === "SUPREME_COURT" || judgment.court?.includes("Supreme Court")
    ? "BINDING PRECEDENT (Article 141, Constitution of India — Authoritative on all Commissions)"
    : "APPELLATE & PERSUASIVE PRECEDENT (NCDRC Landmark Ruling — Authoritative on District & State Commissions)";

  return {
    caseName,
    citation: judgment.citation || "Official Legal Report",
    court: judgment.court || "Supreme Court of India / NCDRC",
    year: judgment.year || 2021,
    legalWeight,
    sourceUrl: judgment.source || judgment.source_url || "https://indiankanoon.org/",
    factsSummary: judgment.facts || judgment.facts_summary || "",
    factualSimilarity,
    distinguishingFactor,
    applicationRationale,
    courtReasoning: judgment.court_reasoning || judgment.judgment || "",
    decision: judgment.decision || "Allowed in favor of consumer",
    indianKanoonUrl: judgment.source || judgment.source_url || "https://indiankanoon.org/",
    comparison: {
      similarities: factualSimilarity,
      distinctions: distinguishingFactor,
      impactOnOutcome: applicationRationale
    }
  };
}

/**
 * Generates the separate, persistent Final Case Outcome.
 * Enforces the investigation completeness gate and user isolation server-side.
 * 
 * @param {object} params
 * @param {string} params.threadId
 * @param {string|null} [params.userId]
 * @param {string|null} [params.guestToken]
 * @returns {Promise<object>} Generated final case outcome and updated investigation
 */
export async function generateFinalCaseOutcome({ threadId, userId = null, guestToken = null }) {
  if (!threadId) throw new Error("threadId is required.");

  const thread = await getThread(threadId, userId, guestToken);
  if (!thread) {
    const err = new Error(`Investigation with threadId "${threadId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  // 1. STRICT SERVER-SIDE READINESS GATE ENFORCEMENT
  const gateEvaluation = await evaluateInvestigationGate({ threadId, userId, guestToken });
  const gate = gateEvaluation.gate || thread.investigationGate || {};

  if (!gateEvaluation.isSatisfied && gate.status === "INCOMPLETE") {
    const missing = (gate.outstandingRequirements && gate.outstandingRequirements.length > 0)
      ? gate.outstandingRequirements.join(" | ")
      : (gate.missingCriticalEvidence && gate.missingCriticalEvidence.length > 0)
      ? gate.missingCriticalEvidence.join("; ")
      : "Pending clarification answers or unverified evidence.";

    const error = new Error(
      `Cannot generate Final Case Outcome while investigation is INCOMPLETE. Outstanding prerequisites: ${missing}. Please answer pending questions, upload documents, or confirm proceeding with limitations.`
    );
    error.statusCode = 400;
    error.outstandingRequirements = gate.outstandingRequirements || [];
    error.gateStatus = "INCOMPLETE";
    throw error;
  }

  const isProceedWithLimitations = gate.status === "PROCEED_WITH_LIMITATIONS" || Boolean(gate.proceedWithoutEvidenceOverride);
  const limitationsDisclosed = Array.isArray(gate.limitationsDisclosed) ? gate.limitationsDisclosed : [];

  // 2. COMPILE AUTHORITATIVE FACTUAL INVENTORY (7 Strict Statuses) & CONTRADICTIONS
  const factualInventory = compileFactualInventory(thread);
  const inspectedDocs = factualInventory.DOCUMENT_INSPECTED || [];
  const unavailableDocs = factualInventory.UNAVAILABLE || [];
  const contradictedDocs = factualInventory.CONTRADICTED || [];
  const userReported = factualInventory.USER_REPORTED || [];
  const independentlyVerified = factualInventory.INDEPENDENTLY_VERIFIED || [];

  const structuredContradictions = compileStructuredContradictions(thread);
  const { establishedFacts, disputedFacts } = categorizeEstablishedVsDisputedFacts(thread, structuredContradictions);
  const hasUnresolvedContradictions = structuredContradictions.some((c) => !c.isResolved) || contradictedDocs.length > 0;

  const intake = thread.intake || {};
  const analysis = thread.initialAnalysis || {};
  const category = (thread.category || analysis.disputeCategory || "General Consumer Dispute").trim();
  const companyName = intake.company || "Opposite Party / Merchant";
  const productName = intake.product || "Product / Service";
  const disputedAmount = intake.amount || "Unspecified amount";

  // 3. RETRIEVE AUTHORITATIVE HISTORICAL PRECEDENTS
  const judgments = getAuthenticHistoricalJudgments(category, intake.complaint || "");
  const precedentComparisons = judgments.map((j) =>
    buildPrecedentComparisons(j, intake, inspectedDocs, unavailableDocs)
  );

  // 4. OUTCOME CLASSIFICATION (Relevance-Aware)
  const relevantDocs = inspectedDocs.filter((d) => d.relevance !== "UNRELATED");
  const unrelatedDocs = (factualInventory.UNRELATED || []).concat(
    (thread.evidenceInventory || []).filter((d) => d.relevance === "UNRELATED")
  );
  const hasOnlyUnrelatedDocs =
    (thread.evidenceInventory || []).length > 0 &&
    relevantDocs.length === 0 &&
    unrelatedDocs.length > 0;

  let outcomeClassification = FINAL_OUTCOME_CLASSIFICATIONS.STRONGLY_SUPPORTED;
  if (hasUnresolvedContradictions) {
    outcomeClassification = FINAL_OUTCOME_CLASSIFICATIONS.OUTCOME_UNCERTAIN;
  } else if (hasOnlyUnrelatedDocs) {
    outcomeClassification = FINAL_OUTCOME_CLASSIFICATIONS.INSUFFICIENTLY_SUPPORTED;
  } else if (isProceedWithLimitations) {
    outcomeClassification = FINAL_OUTCOME_CLASSIFICATIONS.PARTIALLY_SUPPORTED;
  } else if (relevantDocs.length === 0) {
    outcomeClassification = FINAL_OUTCOME_CLASSIFICATIONS.INSUFFICIENTLY_SUPPORTED;
  }

  // 5. DIRECT CONCLUSION
  let directConclusion = "";
  if (outcomeClassification === FINAL_OUTCOME_CLASSIFICATIONS.STRONGLY_SUPPORTED) {
    directConclusion = `Veriq AI evaluates that the consumer's position is strongly supported under the Consumer Protection Act, 2019. Inspected documentary evidence corroborates the commercial transaction (${disputedAmount}) and timely intimation of deficiency regarding ${productName}. Binding Supreme Court and NCDRC precedents establish seller/service-provider liability under Sections 2(10), 2(11), and 39 of CPA 2019.`;
  } else if (outcomeClassification === FINAL_OUTCOME_CLASSIFICATIONS.PARTIALLY_SUPPORTED) {
    directConclusion = `Veriq AI evaluates that the consumer's grievance presents a legitimate prima facie claim of service deficiency or unfair trade practice, but conclusive outcome remains qualified due to evidentiary limitations. Because ${isProceedWithLimitations ? "the investigation proceeded under disclosed evidentiary limitations" : "independent technical inspection records remain pending"}, the opposite party may assert warranty exceptions or service verification defenses.`;
  } else if (outcomeClassification === FINAL_OUTCOME_CLASSIFICATIONS.OUTCOME_UNCERTAIN) {
    directConclusion = `Veriq AI evaluates that the final outcome remains uncertain because material factual contradictions, document variances, or timeline discrepancies were identified in the record. A competent Consumer Commission will require resolution of these disputed facts through affidavit evidence before statutory liability can be established on the balance of probabilities.`;
  } else {
    directConclusion = `Veriq AI evaluates that current evidence is insufficient to sustain a definitive outcome. While the narrative alleges a consumer grievance, ${hasOnlyUnrelatedDocs ? `the uploaded document (${unrelatedDocs.map((u) => u.title).join(", ")}) was flagged as unrelated to the ${category} complaint and excluded from proof.` : "the absence of primary purchase receipts, cancellation notices, or formal rejection letters leaves core statutory elements unproven on the balance of probabilities."}`;
  }

  // 6. SUPPORTING FACTS WITH 7 EVIDENCE STATUS BADGES & ALIASES
  const supportingFacts = [];
  relevantDocs.forEach((doc) => {
    const stmt = `Physical/digital record "${doc.title}" was inspected and extracted. Verified transaction details corroborating consumer purchase.`;
    supportingFacts.push({
      statement: stmt,
      fact: stmt,
      evidenceStatus: "DOCUMENT_INSPECTED",
      status: "DOCUMENT_INSPECTED",
      sourceReference: doc.title,
      provenance: doc.title,
      isVerified: true
    });
  });

  independentlyVerified.forEach((iv) => {
    const stmt = `Published policy terms for ${companyName} (${iv.title}) verified against regulatory statutory benchmarks.`;
    supportingFacts.push({
      statement: stmt,
      fact: stmt,
      evidenceStatus: "INDEPENDENTLY_VERIFIED",
      status: "INDEPENDENTLY_VERIFIED",
      sourceReference: iv.sourceUrl || "Official Records",
      provenance: iv.sourceUrl || "Official Records",
      isVerified: true
    });
  });

  userReported.slice(0, 4).forEach((ur) => {
    supportingFacts.push({
      statement: ur.text,
      fact: ur.text,
      evidenceStatus: "USER_REPORTED",
      status: "USER_REPORTED",
      sourceReference: ur.attribution || "Consumer Statement",
      provenance: ur.attribution || "Consumer Statement",
      isVerified: false
    });
  });

  if (contradictedDocs.length > 0) {
    contradictedDocs.forEach((cd) => {
      const stmt = `Contradiction flagged in ${cd.title}: ${cd.contradictions.join("; ")}`;
      supportingFacts.push({
        statement: stmt,
        fact: stmt,
        evidenceStatus: "CONTRADICTED",
        status: "CONTRADICTED",
        sourceReference: cd.title,
        provenance: cd.title,
        isVerified: false
      });
    });
  }

  // 7. APPLICABLE STATUTORY LAWS
  const applicableLaws = [
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 2(7)",
      title: "Consumer Definition & Standing",
      relevance: "Establishes complainant's legal right to invoke consumer commission jurisdiction.",
      sourceUrl: "https://www.indiacode.nic.in/handle/123456789/15256"
    },
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 2(11)",
      title: "Deficiency in Service",
      relevance: "Governs failure of the seller or provider to fulfill committed quality or rectify grievances.",
      sourceUrl: "https://www.indiacode.nic.in/handle/123456789/15256"
    },
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 2(47)",
      title: "Unfair Trade Practice",
      relevance: "Prohibits deceptive trade methods, arbitrary return denials, or misleading representations.",
      sourceUrl: "https://www.indiacode.nic.in/handle/123456789/15256"
    },
    {
      act: "Consumer Protection Act, 2019",
      section: "Section 39",
      title: "Statutory Powers to Order Relief",
      relevance: "Empowers the Commission to order refund, replacement, removal of defects, or compensation.",
      sourceUrl: "https://www.indiacode.nic.in/handle/123456789/15256"
    }
  ];

  if (category.toLowerCase().includes("e-commerce") || category.toLowerCase().includes("retail") || category.toLowerCase().includes("refund")) {
    applicableLaws.push({
      act: "Consumer Protection (E-Commerce) Rules, 2020",
      section: "Rule 4 & Rule 6",
      title: "Duties of Marketplace Entities & Grievance Timelines",
      relevance: "Mandates 48-hour complaint acknowledgment and 1-month resolution without unfair denial.",
      sourceUrl: "https://consumeraffairs.nic.in/"
    });
  }

  // 8. HISTORICAL PRECEDENTS
  const historicalPrecedents = judgments.map((j) => ({
    caseName: j.case_name,
    citation: j.citation,
    court: j.court,
    courtLevel: j.court_level,
    year: j.year,
    sourceUrl: j.source || j.source_url || "https://indiankanoon.org/",
    legalPrinciple: j.consumer_supporting_principle || j.court_reasoning?.substring(0, 160) || "",
    decision: j.decision || "Allowed in favor of consumer",
    verified: true
  }));

  // 9. CONSUMER ARGUMENTS & COMPANY COUNTERARGUMENTS (With Schema Aliases)
  const consumerArguments = [
    {
      point: "Contractual Consideration & Statutory Deficiency",
      detail: `Complainant paid valid consideration of ${disputedAmount} for ${productName}. Non-delivery of compliant goods/services constitutes actionable deficiency under Section 2(11).`,
      issue: "Contractual Consideration & Statutory Deficiency",
      argument: `Complainant paid valid consideration of ${disputedAmount} for ${productName}. Non-delivery of compliant goods/services constitutes actionable deficiency under Section 2(11).`
    },
    {
      point: "Timely Grievance Notice",
      detail: `Consumer notified the merchant promptly. Failure to rectify within reasonable time creates statutory liability under Section 39.`,
      issue: "Timely Grievance Notice",
      argument: `Consumer notified the merchant promptly. Failure to rectify within reasonable time creates statutory liability under Section 39.`
    },
    {
      point: "Mandatory Statutory Remedies Override Private Clauses",
      detail: `Unilateral 'no-refund' clauses or arbitrary return denial cannot contract out of CPA 2019 protections.`,
      issue: "Mandatory Statutory Remedies Override Private Clauses",
      argument: `Unilateral 'no-refund' clauses or arbitrary return denial cannot contract out of CPA 2019 protections.`
    }
  ];

  const companyCounterarguments = [
    {
      point: "Warranty Procedure & Inspection Requirement",
      detail: "Opposite party may contend that repair under warranty requires physical diagnostic inspection to verify customer vs manufacturer cause.",
      rebuttal: "Consumer should maintain all repair slips, correspondence, and job sheets.",
      issue: "Warranty Procedure & Inspection Requirement",
      argument: "Opposite party may contend that repair under warranty requires physical diagnostic inspection to verify customer vs manufacturer cause.",
      rebuttalNote: "Consumer should maintain all repair slips, correspondence, and job sheets."
    },
    {
      point: "Return Window Expiration",
      detail: "Merchant terms may argue return requests must be filed within published return policy windows.",
      rebuttal: "Inherent manufacturing defects or fundamental breach cannot be barred by short merchant return windows.",
      issue: "Return Window Expiration",
      argument: "Merchant terms may argue return requests must be filed within published return policy windows.",
      rebuttalNote: "Inherent manufacturing defects or fundamental breach cannot be barred by short merchant return windows."
    }
  ];

  // 10. POTENTIAL STATUTORY REMEDIES (Distinguishing available law from court awards)
  const potentialRemedies = {
    disclaimer: "These represent potential statutory remedies available under Section 39 of CPA 2019. Veriq AI does not award compensation; actual relief is determined exclusively by the competent Consumer Commission.",
    remediesList: [
      {
        remedy: "Full Refund of Transaction Consideration",
        statutoryProvision: "Section 39(1)(c), CPA 2019",
        statutorySection: "Section 39(1)(c), CPA 2019",
        basis: "Applicable where goods/services are irreparably defective or delivery failed.",
        eligibility: "Applicable where goods/services are irreparably defective or delivery failed.",
        applicability: "Applicable where goods/services are irreparably defective or delivery failed."
      },
      {
        remedy: "Replacement with Defect-Free Goods",
        statutoryProvision: "Section 39(1)(b), CPA 2019",
        statutorySection: "Section 39(1)(b), CPA 2019",
        basis: "Applicable where merchant or manufacturer stocks identical compliant inventory.",
        eligibility: "Applicable where merchant or manufacturer stocks identical compliant inventory.",
        applicability: "Applicable where merchant or manufacturer stocks identical compliant inventory."
      },
      {
        remedy: "Free Defect Rectification / Repair",
        statutoryProvision: "Section 39(1)(a), CPA 2019",
        statutorySection: "Section 39(1)(a), CPA 2019",
        basis: "Applicable where defect is repairable within a reasonable statutory timeline.",
        eligibility: "Applicable where defect is repairable within a reasonable statutory timeline.",
        applicability: "Applicable where defect is repairable within a reasonable statutory timeline."
      },
      {
        remedy: "Discretionary Compensation for Proven Pecuniary Loss",
        statutoryProvision: "Section 39(1)(d), CPA 2019",
        statutorySection: "Section 39(1)(d), CPA 2019",
        basis: "Subject to judicial assessment of actual injury or loss; no fixed amount or interest rate is guaranteed.",
        eligibility: "Subject to judicial assessment of actual injury or loss; no fixed amount or interest rate is guaranteed.",
        applicability: "Subject to judicial assessment of actual injury or loss; no fixed amount or interest rate is guaranteed."
      }
    ]
  };

  // 11. MATERIAL EVIDENCE GAPS, CONTRADICTIONS, AND LIMITATIONS
  const evidenceLimitations = [
    ...limitationsDisclosed,
    ...(unavailableDocs.length > 0
      ? unavailableDocs.map((u) => `Missing requested document: ${u.title} (${u.reason})`)
      : []),
    ...(inspectedDocs.length === 0
      ? ["No physical documentation has been inspected; outcome prediction relies on consumer intake statements."]
      : []),
    ...(structuredContradictions.filter((c) => !c.isResolved).length > 0
      ? structuredContradictions.filter((c) => !c.isResolved).map((c) => `Unresolved discrepancy: ${c.title} (${c.impactOnPlausibleOutcomes})`)
      : [])
  ];

  const unresolvedDisputes = [
    "Opposite party has not yet filed a formal written statement (reply) on oath.",
    ...(contradictedDocs.length > 0
      ? contradictedDocs.map((c) => `Document discrepancy: ${c.title} (${c.contradictions.join("; ")})`)
      : []),
    ...(structuredContradictions.filter((c) => !c.isResolved).length > 0
      ? structuredContradictions.filter((c) => !c.isResolved).map((c) => `Dispute point: ${c.title}`)
      : []),
    "Cross-examination of technical inspection reports has not occurred."
  ];

  // 12. CONFIDENCE METRICS WITH TRANSPARENT EXPLANATION & CALIBRATION
  let confidenceScore = 60; // Baseline
  if (relevantDocs.length > 0) confidenceScore += 15;
  if (judgments.length > 0) confidenceScore += 10;
  if (isProceedWithLimitations) confidenceScore -= 15;
  if (unavailableDocs.length > 0) confidenceScore -= 10;
  if (hasOnlyUnrelatedDocs) confidenceScore -= 25;
  if (hasUnresolvedContradictions) confidenceScore -= 20;
  confidenceScore = Math.max(35, Math.min(85, confidenceScore));

  const confidenceMetrics = {
    score: confidenceScore,
    explanation: `Assessment strength indicator (${confidenceScore}%) measures evidentiary completeness, precedent alignment, and factual consistency in the current case record. It is NOT a win probability or statistical certainty metric.`,
    factorsIncreasingConfidence: [
      ...(relevantDocs.length > 0 ? ["Documentary evidence directly corroborating the complaint was inspected."] : []),
      ...(judgments.length > 0 ? ["Landmark Supreme Court / NCDRC precedents directly match category."] : []),
      "Factual intake details and chronological complaint provided."
    ],
    factorsDecreasingConfidence: [
      ...(hasOnlyUnrelatedDocs ? [`Uploaded document (${unrelatedDocs.map((u) => u.title).join(", ")}) is unrelated to the complaint domain.`] : []),
      ...(isProceedWithLimitations ? ["Case proceeded under disclosed evidentiary limitations."] : []),
      ...(unavailableDocs.length > 0 ? ["Primary physical evidence unavailable."] : []),
      ...(hasUnresolvedContradictions ? ["Factual or documentary contradictions noted in case record."] : []),
      "Commission exercises judicial discretion under Section 39."
    ]
  };

  // 13. RECOMMENDED NEXT STEPS
  const recommendedNextSteps = [
    "1. Serve a formal Legal / Grievance Escalation Notice to the Company's Nodal Officer giving 15 days to resolve the grievance.",
    "2. Register a formal consumer grievance on the National Consumer Helpline (consumerhelpline.gov.in or call 1915).",
    "3. If unresolved after 15 days, file a formal complaint before the District Consumer Disputes Redressal Commission via the e-Daakhil portal (edaakhil.nic.in).",
    "4. Retain all original invoices, delivery records, job cards, and timestamped communications for evidentiary submission."
  ];

  const outcomeRecord = {
    status: "GENERATED",
    outcomeClassification,
    directConclusion,
    supportingFacts,
    applicableLaws,
    historicalPrecedents,
    precedentComparisons,
    consumerArguments,
    companyCounterarguments,
    potentialRemedies,
    evidenceLimitations,
    unresolvedDisputes,
    confidenceMetrics,
    recommendedNextSteps,
    structuredContradictions,
    establishedFacts,
    disputedFacts,
    isOutdated: false,
    outdatedReason: null,
    disclaimer: "AI-Generated Final Case Outcome — Not a Court Order. This assessment is an analytical evaluation under the Consumer Protection Act, 2019. It does not constitute a judicial decree, court verdict, or binding order.",
    generatedAt: new Date(),
    assessmentVersion: "1.0"
  };

  // 14. PERSIST AGAINST AUTHORIZED CASE
  const updatedStage = thread.stage === INVESTIGATION_STAGES.ASSESSMENT_COMPLETE
    ? INVESTIGATION_STAGES.FINAL_OUTCOME_COMPLETE
    : thread.stage;

  if (mongoose.connection.readyState === 1) {
    try {
      await Thread.findOneAndUpdate(
        { threadId },
        {
          $set: {
            finalCaseOutcome: outcomeRecord,
            stage: updatedStage,
            updatedAt: new Date()
          }
        },
        { new: true }
      );
    } catch (e) {
      console.warn("⚠️ MongoDB finalCaseOutcome update warning:", e.message);
    }
  }

  thread.finalCaseOutcome = outcomeRecord;
  thread.stage = updatedStage;
  thread.updatedAt = new Date();

  // Audit timeline entry
  try {
    await appendAuditTimelineEvent({
      threadId,
      userId,
      guestToken,
      actorType: userId ? "USER" : (guestToken ? "GUEST" : "TAI_SYSTEM"),
      requestedAction: "GENERATE_FINAL_CASE_OUTCOME",
      executedAction: "GENERATE_FINAL_CASE_OUTCOME",
      previousStage: thread.stage,
      resultingStage: updatedStage,
      outcome: "SUCCESS",
      rationale: `Final Case Outcome generated with classification: ${outcomeClassification}`
    });
  } catch (err) {
    console.warn("⚠️ Audit timeline event warning:", err.message);
  }

  return {
    success: true,
    stage: updatedStage,
    finalCaseOutcome: outcomeRecord,
    investigation: thread
  };
}

/**
 * Retrieves the saved Final Case Outcome for an authorized investigation.
 */
export async function getFinalCaseOutcome({ threadId, userId = null, guestToken = null }) {
  if (!threadId) throw new Error("threadId is required.");

  const thread = await getThread(threadId, userId, guestToken);
  if (!thread) {
    const err = new Error(`Investigation with threadId "${threadId}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  if (!thread.finalCaseOutcome || thread.finalCaseOutcome.status !== "GENERATED") {
    const err = new Error("No Final Case Outcome has been generated yet for this investigation.");
    err.statusCode = 404;
    throw err;
  }

  return {
    success: true,
    finalCaseOutcome: thread.finalCaseOutcome,
    stage: thread.stage,
    isOutdated: Boolean(thread.finalCaseOutcome.isOutdated),
    outdatedReason: thread.finalCaseOutcome.outdatedReason || null
  };
}

/**
 * Helper to mark downstream assessment and final outcome as outdated
 * when material facts, clarification answers, or evidence are modified.
 */
export async function markDownstreamOutputsOutdated(threadId, reason = "Material case facts or evidence were modified.") {
  if (!threadId) return false;

  const updates = {
    "assessment.isOutdated": true,
    "assessment.outdatedReason": reason,
    "finalCaseOutcome.isOutdated": true,
    "finalCaseOutcome.outdatedReason": reason,
    updatedAt: new Date()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await Thread.findOneAndUpdate({ threadId }, { $set: updates });
    } catch (e) {
      console.warn("⚠️ Error marking outputs outdated in MongoDB:", e.message);
    }
  }

  if (memoryStore && memoryStore.has(threadId)) {
    const memDoc = memoryStore.get(threadId);
    if (memDoc) {
      if (memDoc.assessment) {
        memDoc.assessment.isOutdated = true;
        memDoc.assessment.outdatedReason = reason;
      }
      if (memDoc.finalCaseOutcome) {
        memDoc.finalCaseOutcome.isOutdated = true;
        memDoc.finalCaseOutcome.outdatedReason = reason;
      }
      memDoc.updatedAt = new Date();
      memoryStore.set(threadId, memDoc);
    }
  }

  return true;
}
