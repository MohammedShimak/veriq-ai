/**
 * NeedhiAI Legal Intelligence Engine
 * Contradiction Analysis & Structured Dispute Reconciliation Service
 * 
 * Provides deterministic and auditable analysis when user statements,
 * uploaded documents, seller policies, or chronological facts conflict.
 * Guarantees that contradictions never freeze or terminate the pipeline.
 */

import { EVIDENCE_STATUSES } from "./evidenceService.js";

/**
 * Builds structured contradiction records across all available dispute dimensions:
 * 1. Chronological sequence conflicts in narrative statements
 * 2. Amount and date discrepancies between intake statements and inspected documents
 * 3. Document inspection contradictions (status === "CONTRADICTED")
 * 4. Company policy exclusions conflicting with consumer statutory claims
 * 
 * @param {object} thread Investigation thread document
 * @returns {Array<object>} Structured contradiction records
 */
export function compileStructuredContradictions(thread = {}) {
  const contradictions = [];
  const intake = thread.intake || {};
  const initialAnalysis = thread.initialAnalysis || {};
  const clarificationHistory = thread.clarificationHistory || [];
  const evidenceInventory = thread.evidenceInventory || [];
  const companyPolicyResearch = thread.companyPolicyResearch || {};

  let contraCounter = 1;

  // -------------------------------------------------------------
  // 1. Chronological Contradictions (from complaint or initialAnalysis)
  // -------------------------------------------------------------
  const rawPossibleContradictions = Array.isArray(initialAnalysis.possibleContradictions)
    ? initialAnalysis.possibleContradictions
    : [];

  for (const textDesc of rawPossibleContradictions) {
    if (!textDesc || typeof textDesc !== "string") continue;

    // Check if consumer already answered clarification addressing timeline / discrepancy
    const addressedByClarification = clarificationHistory.find((h) => {
      const q = (h.question || "").toLowerCase();
      const a = String(h.answerText || h.answer || "").trim();
      return (
        (q.includes("discrepancy") || q.includes("sequence") || q.includes("date") || q.includes("timeline")) &&
        a.length > 2
      );
    });

    const isResolved = Boolean(addressedByClarification);
    const resolutionNotes = addressedByClarification
      ? `Clarified by consumer during questioning: "${addressedByClarification.answerText || addressedByClarification.answer}"`
      : null;

    contradictions.push({
      id: `contra_chrono_${contraCounter++}`,
      conflictType: "CHRONOLOGICAL_SEQUENCE",
      title: "Timeline & Sequence Discrepancy in Narrative",
      conflictingClaimsOrEvidence: {
        statementA: {
          claim: "Primary reported purchase / transaction date stated in complaint",
          source: "Consumer Initial Complaint",
          verificationStatus: "USER_REPORTED"
        },
        statementB: {
          claim: "Subsequent incident or defect occurrence stated on earlier / conflicting timeline",
          source: "Consumer Intake Timeline",
          verificationStatus: "USER_REPORTED"
        }
      },
      sources: ["Consumer Complaint Narrative", "Chronological Intake Timeline"],
      verificationStatus: isResolved ? "CLARIFIED_BY_CONSUMER" : "UNRESOLVED",
      materiality: "MATERIAL",
      clarificationNeeded: "Confirmation of exact chronological sequence of purchase vs incident to establish limitation period under Section 69 CPA 2019.",
      impactOnPlausibleOutcomes: isResolved
        ? "Sequence clarified on record; cause of action and limitation period under Section 69 CPA 2019 are established."
        : "Unresolved sequence uncertainty gives opposite party grounds to challenge whether complaint falls within the statutory 2-year limitation window under Section 69 CPA 2019.",
      isResolved,
      resolutionNotes
    });
  }

  // -------------------------------------------------------------
  // 2. Document vs Intake Amount Discrepancies & Contradicted Docs
  // -------------------------------------------------------------
  for (const doc of evidenceInventory) {
    const extracted = doc.extractedInfo || {};
    const contradictionsNoted = Array.isArray(extracted.contradictionsNoted) ? extracted.contradictionsNoted : [];
    const isDocContradicted = doc.status === EVIDENCE_STATUSES.CONTRADICTED || contradictionsNoted.length > 0;

    // Check if user submitted an explicit correction
    const userCorrection = doc.userCorrection || null;
    const isUserCorrected = Boolean(userCorrection && userCorrection.correctionText);

    // Check if addressed in clarification history
    const addressedInQnA = clarificationHistory.find((h) => {
      const q = (h.question || "").toLowerCase();
      return (
        (q.includes(doc.title.toLowerCase()) || q.includes("invoice") || q.includes("amount") || q.includes("receipt")) &&
        Boolean(h.answerText || h.answer)
      );
    });

    if (isDocContradicted || contradictionsNoted.length > 0) {
      const isResolved = isUserCorrected || Boolean(addressedInQnA);
      let resolutionNotes = null;
      if (isUserCorrected) {
        resolutionNotes = `User submitted factual interpretation correction: "${userCorrection.correctionText}"`;
      } else if (addressedInQnA) {
        resolutionNotes = `Consumer clarified in Q&A: "${addressedInQnA.answerText || addressedInQnA.answer}"`;
      }

      const noteText = contradictionsNoted.length > 0
        ? contradictionsNoted.join("; ")
        : `Discrepancy detected between intake statements and document content in "${doc.title}".`;

      contradictions.push({
        id: `contra_doc_${doc.id || contraCounter++}`,
        conflictType: "DOCUMENT_VS_STATEMENT",
        title: `Document Discrepancy: ${doc.title}`,
        conflictingClaimsOrEvidence: {
          statementA: {
            claim: `Consumer stated value/terms: Amount ₹${intake.amount || "N/A"}, Product: ${intake.product || "N/A"}`,
            source: "Consumer Intake Record",
            verificationStatus: "USER_REPORTED"
          },
          statementB: {
            claim: `Extracted figures on document "${doc.title}": ${extracted.amountsFound?.join(", ") || "Discrepant entries"}`,
            source: doc.title,
            verificationStatus: "DOCUMENT_INSPECTED"
          }
        },
        sources: ["Consumer Intake Statement", doc.title],
        verificationStatus: isResolved
          ? (isUserCorrected ? "CORRECTED_BY_USER" : "CLARIFIED_BY_CONSUMER")
          : "UNRESOLVED",
        materiality: "MATERIAL",
        clarificationNeeded: `Reconciliation between claimed transaction details and figures on "${doc.title}" (${noteText}).`,
        impactOnPlausibleOutcomes: isResolved
          ? "Document discrepancy explained and adjusted in factual inventory; pecuniary claim reflects documented consideration."
          : "Consumer Commission will calculate pecuniary relief strictly according to receipted consideration on face of document unless primary bank payment proof is submitted.",
        isResolved,
        resolutionNotes
      });
    }
  }

  // -------------------------------------------------------------
  // 3. Company Published Terms vs Consumer Statutory Claim
  // -------------------------------------------------------------
  const policies = Array.isArray(companyPolicyResearch.policies) ? companyPolicyResearch.policies : [];
  for (const pol of policies) {
    const passage = (pol.passage || "").toLowerCase();
    const title = (pol.title || "").toLowerCase();

    // Check if policy restricts return/refund while consumer seeks full refund
    const restrictsRefund = passage.includes("no refund") || passage.includes("replacement only") || title.includes("replacement") || passage.includes("non-refundable");
    if (restrictsRefund) {
      contradictions.push({
        id: `contra_policy_${contraCounter++}`,
        conflictType: "POLICY_EXCLUSION_CONFLICT",
        title: `Merchant Policy Restriction: ${pol.title}`,
        conflictingClaimsOrEvidence: {
          statementA: {
            claim: "Consumer seeks full refund and relief for defective goods / deficient service",
            source: "Consumer Intake Complaint",
            verificationStatus: "USER_REPORTED"
          },
          statementB: {
            claim: `Opposite party published policy: "${pol.passage}"`,
            source: pol.sourceUrl || "Merchant Published Policy",
            verificationStatus: "INDEPENDENTLY_VERIFIED"
          }
        },
        sources: ["Consumer Claim", pol.title],
        verificationStatus: "POLICY_CONTESTED",
        materiality: "HIGH",
        clarificationNeeded: "Verification of whether defect was reported within statutory limitation and whether product suffered inherent flaw under CPA 2019 Section 2(10).",
        impactOnPlausibleOutcomes: "Opposite party will assert private policy terms in defense. Under Supreme Court precedent, unilateral return exclusions cannot override statutory CPA 2019 protections if inherent defect is proven on balance of probabilities.",
        isResolved: false, // Resolved by statutory law during legal evaluation
        resolutionNotes: "Contested under Section 2(47) (Unfair Trade Practice) and Section 39 CPA 2019."
      });
    }
  }

  return contradictions;
}

/**
 * Separates factual inventory into Established Facts vs Disputed Facts
 * 
 * @param {object} thread Investigation thread
 * @param {Array<object>} [structuredContradictions] Pre-compiled contradiction records
 * @returns {object} { establishedFacts: Array, disputedFacts: Array }
 */
export function categorizeEstablishedVsDisputedFacts(thread = {}, structuredContradictions = null) {
  const contradictions = structuredContradictions || compileStructuredContradictions(thread);
  const establishedFacts = [];
  const disputedFacts = [];

  const evidenceInventory = Array.isArray(thread.evidenceInventory) ? thread.evidenceInventory : [];
  const userReportedFacts = Array.isArray(thread.userReportedFacts) ? thread.userReportedFacts : [];
  const intake = thread.intake || {};

  // 1. Inspected documents without contradiction are established
  evidenceInventory.forEach((doc) => {
    const isContradicted = doc.status === EVIDENCE_STATUSES.CONTRADICTED;
    const hasUnresolvedContra = contradictions.some(
      (c) => c.sources.includes(doc.title) && !c.isResolved
    );

    if (doc.inspected && !isContradicted && !hasUnresolvedContra) {
      establishedFacts.push({
        statement: `Documentary record "${doc.title}" inspected: ${doc.extractedInfo?.amountsFound?.length ? `Amounts ${doc.extractedInfo.amountsFound.join(", ")}, ` : ""}${doc.extractedInfo?.datesFound?.length ? `Dates ${doc.extractedInfo.datesFound.join(", ")}` : "Verified transaction record."}`,
        evidenceStatus: "DOCUMENT_INSPECTED",
        sourceReference: doc.title,
        isVerified: true
      });
    } else if (isContradicted || hasUnresolvedContra) {
      disputedFacts.push({
        statement: `Documentary record "${doc.title}" contains factual variance: ${doc.extractedInfo?.contradictionsNoted?.join("; ") || "Contradicted claimed amount/date"}.`,
        evidenceStatus: "CONTRADICTED",
        sourceReference: doc.title,
        isVerified: false,
        disputeDetail: "Requires reconciliation or affidavit evidence before Consumer Commission."
      });
    } else if (doc.uploaded && !doc.inspected) {
      disputedFacts.push({
        statement: `Uploaded document "${doc.title}" not yet OCR-verified.`,
        evidenceStatus: "NOT_INSPECTED",
        sourceReference: doc.title,
        isVerified: false,
        disputeDetail: "Document uploaded but technical inspection pending."
      });
    } else if (doc.unavailable) {
      disputedFacts.push({
        statement: `Primary document "${doc.title}" is unavailable: ${doc.unavailableReason || "Not issued by seller"}.`,
        evidenceStatus: "UNAVAILABLE",
        sourceReference: doc.title,
        isVerified: false,
        disputeDetail: "Disclosed evidentiary limitation; requires secondary corroboration."
      });
    }
  });

  // 2. Verified published policies are established
  const policies = Array.isArray(thread.companyPolicyResearch?.policies) ? thread.companyPolicyResearch.policies : [];
  policies.forEach((pol) => {
    establishedFacts.push({
      statement: `Published policy terms for ${thread.companyPolicyResearch.companyName || "Opposite Party"} (${pol.title}) verified.`,
      evidenceStatus: "INDEPENDENTLY_VERIFIED",
      sourceReference: pol.sourceUrl || "Official Company Portal",
      isVerified: true
    });
  });

  // 3. User Reported Facts - check if involved in unresolved contradiction
  userReportedFacts.forEach((uf) => {
    const isDisputed = contradictions.some(
      (c) => !c.isResolved && c.conflictType === "CHRONOLOGICAL_SEQUENCE"
    );

    if (isDisputed) {
      disputedFacts.push({
        statement: uf.text,
        evidenceStatus: "USER_REPORTED",
        sourceReference: uf.source || "Consumer Statement",
        isVerified: false,
        disputeDetail: "Timeline discrepancy identified; requires affidavit or proof of date."
      });
    } else {
      establishedFacts.push({
        statement: uf.text,
        evidenceStatus: "USER_REPORTED",
        sourceReference: uf.source || "Consumer Statement",
        isVerified: false
      });
    }
  });

  // 4. Core intake facts
  if (intake.complaint && !userReportedFacts.some((f) => f.text === intake.complaint)) {
    establishedFacts.push({
      statement: `Complainant filed consumer dispute regarding ${intake.product || "product/service"} purchased from ${intake.company || "opposite party"}.`,
      evidenceStatus: "USER_REPORTED",
      sourceReference: "Intake Complaint",
      isVerified: false
    });
  }

  return { establishedFacts, disputedFacts };
}
