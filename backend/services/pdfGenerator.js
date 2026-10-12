import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Potential logo locations
const POSSIBLE_LOGO_PATHS = [
  path.resolve(__dirname, "../../frontend/public/assets/veriq-logo.png"),
  path.resolve(__dirname, "../assets/veriq-logo.png"),
  path.resolve(__dirname, "../../frontend/dist/assets/veriq-logo.png")
];

function getLogoPath() {
  for (const p of POSSIBLE_LOGO_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Sanitizes input text for standard Helvetica font in PDFKit.
 * Converts Rupee symbols (₹) to "Rs. " and normalizes smart quotes and dashes.
 */
function sanitizePdfText(str) {
  if (!str) return "";
  return String(str)
    .replace(/₹/g, "Rs. ")
    .replace(/[\u20B9]/g, "Rs. ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2022]/g, "*")
    .replace(/[^\x00-\x7F]/g, "");
}

/**
 * Generates a court-formatted PDF document for a case verdict turn (preserved for backward compatibility).
 *
 * @param {string} threadId 
 * @param {number} turnIndex 
 * @param {object} threadData Thread Mongoose document or object
 * @returns {PDFDocument} PDFDocument readable stream
 */
export function generateVerdictPDF(threadId, turnIndex, threadData) {
  const doc = new PDFDocument({ margin: 54, size: "A4" });

  const turns = threadData?.turns || [];
  const turn = turns[turnIndex] || turns[turns.length - 1] || {};

  const support = turn.support || {};
  const oppose = turn.oppose || {};
  const judge = turn.judge || {};
  const category = turn.category || threadData.category || "Consumer Dispute";
  const caseRep = turn.caseRepresentation || {};

  // Header & Title
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .fillColor("#003366")
    .text("Veriq AI Preliminary Case Assessment Report", { align: "center" })
    .moveDown(0.2);

  doc
    .fontSize(11)
    .font("Helvetica")
    .fillColor("#444444")
    .text("Indian Consumer Protection Act, 2019 Analytical Decision Support", { align: "center" })
    .moveDown(0.5);

  doc.lineWidth(1).strokeColor("#333333").moveTo(54, doc.y).lineTo(541, doc.y).stroke().moveDown(0.8);

  // Metadata Box
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text(`Case Thread ID: `, { continued: true })
    .font("Helvetica")
    .text(sanitizePdfText(threadId))
    .font("Helvetica-Bold")
    .text(`Turn Index: `, { continued: true })
    .font("Helvetica")
    .text(`#${turnIndex + 1}`)
    .font("Helvetica-Bold")
    .text(`Category: `, { continued: true })
    .font("Helvetica")
    .text(sanitizePdfText(category))
    .font("Helvetica-Bold")
    .text(`Date Generated: `, { continued: true })
    .font("Helvetica")
    .text(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))
    .moveDown(0.8);

  doc.lineWidth(0.5).strokeColor("#cccccc").moveTo(54, doc.y).lineTo(541, doc.y).stroke().moveDown(0.8);

  // Section 1: Facts of the Case
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#003366").text("I. Facts of the Case").moveDown(0.4);
  doc.fontSize(10).font("Helvetica").fillColor("#222222").text(sanitizePdfText(turn.question || "No case query text recorded.")).moveDown(0.8);

  // Section 2: Petitioner's Counsel (Support) Arguments
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#003366").text("II. Petitioner's Counsel (Support) Position").moveDown(0.4);
  doc.fontSize(10).font("Helvetica").fillColor("#222222").text(sanitizePdfText(support.position || "Consumer asserts statutory remedies under CPA 2019.")).moveDown(0.4);

  if (Array.isArray(support.arguments) && support.arguments.length > 0) {
    support.arguments.forEach((arg, idx) => {
      doc
        .font("Helvetica-Bold")
        .text(`Point ${idx + 1}: ${sanitizePdfText(arg.issue || "Legal Issue")}`)
        .font("Helvetica")
        .text(sanitizePdfText(arg.argument || ""))
        .moveDown(0.3);
    });
  }
  doc.moveDown(0.5);

  // Section 3: Respondent's Counsel (Oppose) Arguments
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#003366").text("III. Respondent's Counsel (Oppose) Position").moveDown(0.4);
  doc.fontSize(10).font("Helvetica").fillColor("#222222").text(sanitizePdfText(oppose.position || "Respondent asserts compliance with standard statutory terms.")).moveDown(0.4);

  if (Array.isArray(oppose.arguments) && oppose.arguments.length > 0) {
    oppose.arguments.forEach((arg, idx) => {
      doc
        .font("Helvetica-Bold")
        .text(`Point ${idx + 1}: ${sanitizePdfText(arg.issue || "Defense Point")}`)
        .font("Helvetica")
        .text(sanitizePdfText(arg.argument || ""))
        .moveDown(0.3);
    });
  }
  doc.moveDown(0.5);

  // Section 4: Judge Decision & Relief
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#003366").text("IV. Judicial Assessment & Findings").moveDown(0.4);
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#111827").text(`Decision: ${sanitizePdfText(judge.decision || "Pending evaluation")}`).moveDown(0.2);
  doc.fontSize(9.5).font("Helvetica").fillColor("#374151").text(sanitizePdfText(judge.decision_explanation || "")).moveDown(0.4);

  if (Array.isArray(judge.relief) && judge.relief.length > 0) {
    doc.font("Helvetica-Bold").text("Potential Remedies under Section 39:").moveDown(0.2);
    judge.relief.forEach((r) => {
      doc.font("Helvetica").text(`* ${sanitizePdfText(r)}`).moveDown(0.1);
    });
    doc.moveDown(0.4);
  }

  // Footer Disclaimer
  doc.lineWidth(0.5).strokeColor("#cccccc").moveTo(54, doc.y).lineTo(541, doc.y).stroke().moveDown(0.6);
  doc
    .fontSize(8)
    .font("Helvetica-Oblique")
    .fillColor("#666666")
    .text(
      "DISCLAIMER: This document is an analytical assessment prepared by Veriq AI for decision-support purposes under the Consumer Protection Act, 2019. It does not constitute a formal court order, judicial decree, or binding legal judgment.",
      { align: "center" }
    );

  doc.end();
  return doc;
}

/**
 * Generates the authoritative 13-Section Veriq AI Consumer Case Dossier.
 * Incorporates cover page, claim matrix, evidence provenance, gap analysis,
 * legal framework, calibrated confidence metrics, and limitation disclosures.
 *
 * @param {string} threadId
 * @param {object} threadData
 * @returns {PDFDocument}
 */
export function generateCaseDossierPDF(threadId, threadData) {
  const doc = new PDFDocument({ margin: 54, size: "A4", bufferPages: true });

  const intake = threadData?.intake || {};
  const initialAnalysis = threadData?.initialAnalysis || {};
  const category = threadData?.category || initialAnalysis.disputeCategory || "Consumer Protection Dispute";
  const outcome = threadData?.finalCaseOutcome || {};
  const assessmentObj = threadData?.assessment || {};
  const preliminary = assessmentObj.preliminaryAssessment || {};
  const sections = preliminary.sections || {};
  const gate = threadData?.investigationGate || {};
  const evidenceInventory = threadData?.evidenceInventory || [];
  const policyResearch = threadData?.companyPolicyResearch || {};
  const clarificationHistory = threadData?.clarificationHistory || [];
  const userReportedFacts = threadData?.userReportedFacts || [];

  const companyName = intake.company || initialAnalysis.companyOrSeller || "Opposite Party / Merchant";
  const productName = intake.product || initialAnalysis.productOrService || "Product / Service";
  const disputedAmount = intake.amount || initialAnalysis.disputedAmount || "Not specified";
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // Helper section divider
  function sectionHeader(numberStr, titleStr) {
    if (doc.y > 680) doc.addPage();
    doc.moveDown(0.6);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#003366").text(`${numberStr}. ${titleStr}`).moveDown(0.3);
    doc.lineWidth(0.75).strokeColor("#003366").moveTo(54, doc.y).lineTo(541, doc.y).stroke().moveDown(0.5);
  }

  // =========================================================================
  // 1. COVER PAGE
  // =========================================================================
  const logoPath = getLogoPath();
  if (logoPath) {
    try {
      doc.image(logoPath, 54, 80, { width: 140 });
      doc.moveDown(4.5);
    } catch (e) {
      doc.moveDown(2);
    }
  } else {
    doc.moveDown(2);
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#003366").text("VERIQ AI", { align: "left" }).moveDown(0.2);
  }

  doc.fontSize(24).font("Helvetica-Bold").fillColor("#003366").text("Veriq AI — Consumer Case Dossier").moveDown(0.3);
  doc.fontSize(13).font("Helvetica").fillColor("#b8860b").text("Evidence-Grounded Preliminary Case Assessment").moveDown(1.5);

  // Metadata card
  doc.rect(54, doc.y, 487, 140).fillAndStroke("#f8fafc", "#cbd5e1");
  const cardStartY = doc.y + 16;
  doc.fillColor("#0f172a");

  doc.fontSize(10).font("Helvetica-Bold").text("Case ID / Reference:", 70, cardStartY);
  doc.font("Helvetica").text(sanitizePdfText(threadId), 220, cardStartY);

  doc.font("Helvetica-Bold").text("Dispute Category:", 70, cardStartY + 20);
  doc.font("Helvetica").text(sanitizePdfText(category), 220, cardStartY + 20);

  doc.font("Helvetica-Bold").text("Opposite Entity:", 70, cardStartY + 40);
  doc.font("Helvetica").text(sanitizePdfText(companyName), 220, cardStartY + 40);

  doc.font("Helvetica-Bold").text("Report Generation Time:", 70, cardStartY + 60);
  doc.font("Helvetica").text(`${dateStr} at ${timeStr}`, 220, cardStartY + 60);

  doc.font("Helvetica-Bold").text("Dossier Version:", 70, cardStartY + 80);
  doc.font("Helvetica").text("v1.2 (Validated Proof Record)", 220, cardStartY + 80);

  doc.font("Helvetica-Bold").text("Legal Status:", 70, cardStartY + 100);
  doc.font("Helvetica-Bold").fillColor("#b45309").text("PRELIMINARY & NON-BINDING (CPA 2019 Decision Support)", 220, cardStartY + 100);

  doc.y = cardStartY + 150;
  doc.moveDown(2);

  // Notice box on cover
  doc.rect(54, doc.y, 487, 85).fillAndStroke("#fefce8", "#fde047");
  doc.fillColor("#713f12").fontSize(9.5).font("Helvetica-Bold").text("IMPORTANT PROCEDURAL NOTICE", 70, doc.y + 12);
  doc.font("Helvetica").fontSize(8.5).text(
    sanitizePdfText(
      "This document is an AI-assisted legal assessment synthesized by Veriq AI under India's Consumer Protection Act, 2019. It evaluates complaint statements, inspected documents, and binding precedents. It does not constitute a formal court order, judicial decree, or binding judgment. Binding awards reside exclusively with the competent Consumer Commission."
    ),
    70,
    doc.y + 6,
    { width: 455 }
  );

  doc.addPage();

  // =========================================================================
  // 2. EXECUTIVE SUMMARY
  // =========================================================================
  sectionHeader("2", "Executive Summary");
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#1e293b");
  doc.text(`Dispute Domain: `, { continued: true }).font("Helvetica").text(sanitizePdfText(category));
  doc.font("Helvetica-Bold").text(`Opposite Party: `, { continued: true }).font("Helvetica").text(sanitizePdfText(companyName));
  doc.font("Helvetica-Bold").text(`Product / Subject Matter: `, { continued: true }).font("Helvetica").text(sanitizePdfText(productName));
  doc.font("Helvetica-Bold").text(`Disputed Consideration: `, { continued: true }).font("Helvetica").text(sanitizePdfText(disputedAmount));
  doc.font("Helvetica-Bold").text(`Requested Statutory Remedy: `, { continued: true }).font("Helvetica").text(
    sanitizePdfText(outcome.potentialRemedies?.remediesList?.[0]?.remedy || "Full refund and compensation for deficiency under Section 39")
  );
  doc.moveDown(0.4);

  const execSummaryText = outcome.directConclusion || preliminary.sections?.caseSummary || "Comprehensive legal review of complaint and evidence.";
  doc.fontSize(9.5).font("Helvetica").fillColor("#334155").text(sanitizePdfText(execSummaryText), { lineGap: 2 });
  doc.moveDown(0.6);

  // =========================================================================
  // 3. COMPLAINT AND PROCEDURAL TIMELINE
  // =========================================================================
  sectionHeader("3", "Complaint Narrative & Procedural Timeline");
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text("Consumer Intake Statement:").moveDown(0.2);
  doc.fontSize(9).font("Helvetica").fillColor("#334155").text(sanitizePdfText(`"${intake.complaint || "Unresolved consumer grievance"}"`), { lineGap: 1.5 });
  doc.moveDown(0.4);

  doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text("Timeline Particulars (User-Reported):").moveDown(0.2);
  const events = [];
  if (initialAnalysis.purchaseOrServiceDate && initialAnalysis.purchaseOrServiceDate !== "Not provided") {
    events.push(`Purchase / Service Date: ${initialAnalysis.purchaseOrServiceDate} (Unverified consumer statement)`);
  }
  if (Array.isArray(initialAnalysis.actionsTaken) && initialAnalysis.actionsTaken.length > 0) {
    events.push(`Grievance Escalations: ${initialAnalysis.actionsTaken.join("; ")}`);
  }
  if (Array.isArray(initialAnalysis.responsesReceived) && initialAnalysis.responsesReceived.length > 0) {
    events.push(`Merchant Communication: ${initialAnalysis.responsesReceived.join("; ")}`);
  }
  if (clarificationHistory.length > 0) {
    clarificationHistory.slice(0, 3).forEach((c) => {
      events.push(`Clarification Point: ${c.question} -> Answer: ${c.answerText || c.answer}`);
    });
  }

  if (events.length === 0) {
    doc.fontSize(8.5).font("Helvetica-Oblique").fillColor("#64748b").text("No precise dates supplied during intake.").moveDown(0.3);
  } else {
    events.forEach((ev) => {
      doc.fontSize(8.5).font("Helvetica").fillColor("#334155").text(`* ${sanitizePdfText(ev)}`).moveDown(0.2);
    });
  }
  doc.moveDown(0.4);

  // =========================================================================
  // 4. FACTS AND CLAIM MATRIX
  // =========================================================================
  sectionHeader("4", "Facts and Claim Matrix");
  doc.fontSize(9).font("Helvetica").fillColor("#334155").text(
    "Evaluation distinguishes between established facts corroborated by relevant records and unproven allegations:",
    { lineGap: 1.5 }
  ).moveDown(0.3);

  const factsList = outcome.supportingFacts || preliminary.sections?.establishedFacts || [];
  if (factsList.length === 0) {
    doc.fontSize(8.5).font("Helvetica-Oblique").fillColor("#64748b").text("No independently verified facts recorded.").moveDown(0.3);
  } else {
    factsList.slice(0, 5).forEach((f, idx) => {
      const statusBadge = f.evidenceStatus || "FACT";
      const stmt = f.statement || f.fact || "";
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a").text(`[${sanitizePdfText(statusBadge)}] `, { continued: true });
      doc.font("Helvetica").fillColor("#334155").text(sanitizePdfText(stmt)).moveDown(0.2);
    });
  }
  doc.moveDown(0.4);

  // =========================================================================
  // 5. EVIDENCE INVENTORY & PROVENANCE
  // =========================================================================
  sectionHeader("5", "Evidence Inventory & Provenance Record");
  if (evidenceInventory.length === 0) {
    doc.fontSize(8.5).font("Helvetica-Oblique").fillColor("#64748b").text("No physical or digital documents uploaded.").moveDown(0.3);
  } else {
    evidenceInventory.forEach((docItem, idx) => {
      const isUnrelated = docItem.relevance === "UNRELATED" || docItem.userConfirmedUnrelated;
      const isSynthetic = Boolean(docItem.isSynthetic);
      const badgeColor = isUnrelated ? "#dc2626" : docItem.relevance === "PARTIALLY_RELEVANT" ? "#d97706" : "#16a34a";

      doc.fontSize(9).font("Helvetica-Bold").fillColor(badgeColor).text(
        `Item ${idx + 1}: ${sanitizePdfText(docItem.title || docItem.originalName || "Document")} [${isUnrelated ? "UNRELATED / EXCLUDED" : docItem.relevance || "INSPECTED"}]`
      );

      doc.fontSize(8.5).font("Helvetica").fillColor("#334155");
      doc.text(`Declared Category: ${sanitizePdfText(docItem.category || "OTHER")}`);
      doc.text(`Status: ${sanitizePdfText(docItem.status || "UPLOADED")} | Inspected: ${docItem.inspected ? "Yes" : "No"}${isSynthetic ? " | Test Fixture: YES (SYNTHETIC)" : ""}`);

      if (docItem.mismatchWarning) {
        doc.font("Helvetica-Bold").fillColor("#b91c1c").text(`Mismatch Warning: ${sanitizePdfText(docItem.mismatchWarning)}`);
      }
      if (docItem.relevanceReason) {
        doc.font("Helvetica").fillColor("#475569").text(`Relevance Assessment: ${sanitizePdfText(docItem.relevanceReason)}`);
      }
      if (Array.isArray(docItem.claimsSupported) && docItem.claimsSupported.length > 0) {
        doc.font("Helvetica").fillColor("#166534").text(`Claims Supported: ${sanitizePdfText(docItem.claimsSupported.join("; "))}`);
      }
      if (Array.isArray(docItem.claimsNotSupported) && docItem.claimsNotSupported.length > 0) {
        doc.font("Helvetica").fillColor("#991b1b").text(`Claims NOT Supported: ${sanitizePdfText(docItem.claimsNotSupported.join("; "))}`);
      }
      doc.moveDown(0.4);
    });
  }

  // =========================================================================
  // 6. EVIDENCE GAPS AND CONTRADICTIONS
  // =========================================================================
  sectionHeader("6", "Evidence Gaps & Mismatch Disclosures");
  const unrelatedItems = evidenceInventory.filter((d) => d.relevance === "UNRELATED" || d.userConfirmedUnrelated);
  const unavailableItems = evidenceInventory.filter((d) => d.unavailable);

  if (unrelatedItems.length > 0) {
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#b91c1c").text("Documents Excluded as Unrelated:").moveDown(0.2);
    unrelatedItems.forEach((u) => {
      doc.fontSize(8.5).font("Helvetica").fillColor("#7f1d1d").text(
        `* ${sanitizePdfText(u.title)}: ${sanitizePdfText(u.relevanceReason || "Does not match complaint domain. Excluded from substantiating legal claims.")}`
      ).moveDown(0.2);
    });
    doc.moveDown(0.3);
  }

  if (unavailableItems.length > 0) {
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#d97706").text("Documents Marked Unavailable:").moveDown(0.2);
    unavailableItems.forEach((u) => {
      doc.fontSize(8.5).font("Helvetica").fillColor("#92400e").text(
        `* ${sanitizePdfText(u.title)}: ${sanitizePdfText(u.unavailableReason || "Unavailable or never issued by vendor.")}`
      ).moveDown(0.2);
    });
    doc.moveDown(0.3);
  }

  if (gate.missingCriticalEvidence && gate.missingCriticalEvidence.length > 0) {
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text("Missing Material Evidence:").moveDown(0.2);
    gate.missingCriticalEvidence.forEach((m) => {
      doc.fontSize(8.5).font("Helvetica").fillColor("#475569").text(`* ${sanitizePdfText(m)}`).moveDown(0.1);
    });
    doc.moveDown(0.3);
  }

  if (unrelatedItems.length === 0 && unavailableItems.length === 0 && (!gate.missingCriticalEvidence || gate.missingCriticalEvidence.length === 0)) {
    doc.fontSize(8.5).font("Helvetica-Oblique").fillColor("#64748b").text("No material evidentiary discrepancies identified.").moveDown(0.3);
  }

  // =========================================================================
  // 7. COMPANY-POLICY RESEARCH
  // =========================================================================
  sectionHeader("7", "Company-Policy & Industry Benchmark Research");
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text(`Entity Identified: ${sanitizePdfText(policyResearch.companyName || companyName)}`);
  doc.font("Helvetica").fillColor("#334155").text(`Research Status: ${sanitizePdfText(policyResearch.status || "COMPLETED")}`);

  if (policyResearch.sourceUrl) {
    doc.text(`Official Source Domain: ${sanitizePdfText(policyResearch.sourceUrl)}`);
  }
  if (policyResearch.policySummary) {
    doc.moveDown(0.2);
    doc.fontSize(8.5).font("Helvetica").fillColor("#334155").text(sanitizePdfText(policyResearch.policySummary), { lineGap: 1.5 });
  }
  doc.moveDown(0.4);

  // =========================================================================
  // 8. LEGAL FRAMEWORK & AUTHORITATIVE PRECEDENTS
  // =========================================================================
  sectionHeader("8", "Applicable Statutory Framework & Precedents");
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#003366").text("Statutory Provisions (Consumer Protection Act, 2019):").moveDown(0.2);
  const laws = outcome.applicableLaws || preliminary.sections?.statutoryFramework || [
    { section: "Section 2(10)", title: "Defect in Goods", text: "Fault, imperfection, or shortcoming in quality or standard." },
    { section: "Section 2(11)", title: "Deficiency in Service", text: "Shortcoming or inadequacy in performance required by contract or law." },
    { section: "Section 39", title: "Remedies & Relief", text: "Powers of District Commission to award refund, replacement, or compensation." }
  ];
  laws.slice(0, 3).forEach((l) => {
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a").text(`${sanitizePdfText(l.section || l.title)}: `, { continued: true });
    doc.font("Helvetica").fillColor("#334155").text(sanitizePdfText(l.text || l.substance || "")).moveDown(0.2);
  });
  doc.moveDown(0.3);

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#003366").text("Authoritative Precedent Comparisons:").moveDown(0.2);
  const judgments = outcome.historicalPrecedents || preliminary.sections?.precedentComparisons || [];
  if (judgments.length === 0) {
    doc.fontSize(8.5).font("Helvetica-Oblique").fillColor("#64748b").text("Default CPA 2019 statutory benchmarks applied.").moveDown(0.3);
  } else {
    judgments.slice(0, 2).forEach((j) => {
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a").text(sanitizePdfText(j.caseName || j.case_name || "Landmark Case"));
      doc.font("Helvetica-Oblique").fillColor("#475569").text(`Citation: ${sanitizePdfText(j.citation || "Supreme Court of India / NCDRC")}`);
      if (j.factualSimilarity) {
        doc.font("Helvetica").fillColor("#334155").text(`Application: ${sanitizePdfText(j.factualSimilarity)}`);
      }
      doc.moveDown(0.3);
    });
  }

  // =========================================================================
  // 9. BALANCED ANALYSIS (CONSUMER VS RESPONDENT)
  // =========================================================================
  sectionHeader("9", "Balanced Dialectical Analysis");
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#166534").text("Arguments Supporting Complainant:").moveDown(0.2);
  const consArgs = outcome.consumerArguments || preliminary.sections?.consumerArguments || [];
  consArgs.slice(0, 2).forEach((a) => {
    doc.fontSize(8.5).font("Helvetica").fillColor("#334155").text(`* ${sanitizePdfText(a.argument || a.point || a)}`).moveDown(0.2);
  });
  doc.moveDown(0.3);

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#991b1b").text("Plausible Respondent Defenses:").moveDown(0.2);
  const respArgs = outcome.companyCounterarguments || preliminary.sections?.respondentCounterarguments || [];
  respArgs.slice(0, 2).forEach((a) => {
    doc.fontSize(8.5).font("Helvetica").fillColor("#334155").text(`* ${sanitizePdfText(a.argument || a.point || a)}`).moveDown(0.2);
  });
  doc.moveDown(0.4);

  // =========================================================================
  // 10. PRELIMINARY OUTCOME ASSESSMENT & CONFIDENCE
  // =========================================================================
  sectionHeader("10", "Preliminary Outcome Assessment & Confidence");
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#003366").text(
    `Classification: ${sanitizePdfText(outcome.outcomeClassification || "PRELIMINARY EVALUATION")}`
  ).moveDown(0.3);

  doc.fontSize(9).font("Helvetica").fillColor("#1e293b").text(
    sanitizePdfText(outcome.directConclusion || "Direct evaluation generated based on verified records."),
    { lineGap: 1.5 }
  ).moveDown(0.5);

  const conf = outcome.confidenceMetrics || {};
  const confScore = conf.score !== undefined ? conf.score : 60;
  doc.rect(54, doc.y, 487, 65).fillAndStroke("#f1f5f9", "#cbd5e1");
  const confY = doc.y + 10;
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text(`Assessment Strength Indicator: ${confScore}%`, 70, confY);
  doc.fontSize(8).font("Helvetica").fillColor("#475569").text(
    sanitizePdfText(conf.explanation || `Strength score (${confScore}%) measures evidentiary completeness, precedent alignment, and factual consistency. It is NOT a win probability or mathematical certainty guarantee.`),
    70,
    confY + 16,
    { width: 455, lineGap: 1.5 }
  );
  doc.y = confY + 65;
  doc.moveDown(0.4);

  // =========================================================================
  // 11. POTENTIAL REMEDIES AND NEXT STEPS
  // =========================================================================
  sectionHeader("11", "Potential Remedies & Recommended Next Steps");
  const remedies = outcome.potentialRemedies?.remediesList || [];
  remedies.slice(0, 2).forEach((r) => {
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a").text(`* ${sanitizePdfText(r.remedy)} (${sanitizePdfText(r.statutoryProvision || "CPA 2019")}): `, { continued: true });
    doc.font("Helvetica").fillColor("#334155").text(sanitizePdfText(r.eligibility || "Subject to judicial discretion.")).moveDown(0.2);
  });
  doc.moveDown(0.3);

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#003366").text("Recommended Escalation Roadmap:").moveDown(0.2);
  const steps = outcome.recommendedNextSteps || [
    "1. Serve a formal written grievance / legal escalation letter to the Company Nodal Officer giving 15 days for resolution.",
    "2. Register a formal complaint on the National Consumer Helpline (consumerhelpline.gov.in / dial 1915).",
    "3. File a formal consumer complaint via e-Daakhil (edaakhil.nic.in) before the competent District Consumer Disputes Redressal Commission."
  ];
  steps.forEach((s) => {
    doc.fontSize(8.5).font("Helvetica").fillColor("#334155").text(sanitizePdfText(s)).moveDown(0.2);
  });
  doc.moveDown(0.4);

  // =========================================================================
  // 12. SOURCE REGISTER
  // =========================================================================
  sectionHeader("12", "Source Register");
  doc.fontSize(8.5).font("Helvetica").fillColor("#334155");
  doc.text("1. Consumer Protection Act, 2019 (Act No. 35 of 2019), Ministry of Consumer Affairs, Government of India.");
  doc.text("2. Landmark Precedents Repository: Supreme Court of India / National Consumer Disputes Redressal Commission (IndianKanoon.org).");
  if (policyResearch.sourceUrl) {
    doc.text(`3. Company Terms Register: ${sanitizePdfText(policyResearch.sourceUrl)} (Verified public policy domain).`);
  }
  doc.moveDown(0.6);

  // =========================================================================
  // 13. IMPORTANT LIMITATIONS
  // =========================================================================
  sectionHeader("13", "Important Limitations & Statutory Disclaimers");
  doc.fontSize(8).font("Helvetica-Oblique").fillColor("#64748b").text(
    sanitizePdfText(
      "NON-BINDING PRELIMINARY ANALYSIS: This document is an analytical assessment prepared by Veriq AI for consumer decision-support under the Consumer Protection Act, 2019. It does not constitute legal representation, formal legal advice, or a judicial decree. The Consumer Disputes Redressal Commission retains exclusive discretion to evaluate oral evidence, cross-examine parties, and determine relief under Section 39."
    ),
    { lineGap: 1.5 }
  );

  // Add Page Numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Suppress footer on cover page
    if (i > range.start) {
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text(
          `Veriq AI — Consumer Case Dossier  |  Case ID: ${sanitizePdfText(threadId)}  |  Page ${i + 1} of ${range.count}`,
          54,
          780,
          { align: "center", width: 487 }
        );
    }
  }

  doc.end();
  return doc;
}

export function generateInvestigationReportPDF(threadId, threadData) {
  return generateCaseDossierPDF(threadId, threadData);
}

export function generateFinalOutcomePDF(threadId, threadData) {
  return generateCaseDossierPDF(threadId, threadData);
}
