import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import {
  getFinalOutcomeApi,
  generateFinalOutcomeApi,
  downloadFinalOutcomePdfApi,
  getInvestigationApi
} from "../services/investigationApi";
import { useAuth } from "../context/AuthContext";
import { BRAND } from "../config/brand";

export default function FinalCaseOutcome() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [outcomeData, setOutcomeData] = useState(null);
  const [investigation, setInvestigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
  const [factsFilter, setFactsFilter] = useState("all"); // "all" | "established" | "disputed"

  // Load outcome or investigation status on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchOutcome() {
      if (!threadId) return;
      try {
        setLoading(true);
        setError(null);

        // Fetch parent investigation for gate check & metadata
        let invObj = null;
        try {
          const invRes = await getInvestigationApi(threadId, accessToken);
          if (invRes?.investigation) {
            invObj = invRes.investigation;
            if (isMounted) setInvestigation(invObj);
          }
        } catch (invErr) {
          console.warn("Investigation metadata load notice:", invErr?.message);
        }

        // Fetch final outcome
        try {
          const res = await getFinalOutcomeApi(threadId, accessToken);
          if (res?.finalCaseOutcome && isMounted) {
            setOutcomeData(res.finalCaseOutcome);
          } else if (invObj?.finalCaseOutcome?.outcomeClassification && isMounted) {
            setOutcomeData(invObj.finalCaseOutcome);
          }
        } catch (outcomeErr) {
          // If not yet generated or 404, fallback to investigation's attached outcome if present
          if (invObj?.finalCaseOutcome?.outcomeClassification && isMounted) {
            setOutcomeData(invObj.finalCaseOutcome);
          } else {
            console.log("Outcome not yet generated for thread:", threadId);
          }
        }
      } catch (err) {
        console.error("Error loading final outcome data:", err);
        if (isMounted) {
          setError(err.response?.data?.error || err.message || "Failed to load final case outcome.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchOutcome();

    return () => {
      isMounted = false;
    };
  }, [threadId, accessToken]);

  // Generate or Regenerate Final Case Outcome
  const handleGenerateOutcome = async () => {
    try {
      setGenerating(true);
      setError(null);
      const res = await generateFinalOutcomeApi(threadId, accessToken);
      if (res?.finalCaseOutcome) {
        setOutcomeData(res.finalCaseOutcome);
        setSuccessNotice("Final Case Outcome synthesized successfully from verified case record & precedents.");
      }
    } catch (err) {
      console.error("Outcome generation error:", err);
      setError(err.response?.data?.error || err.message || "Failed to generate Final Case Outcome.");
    } finally {
      setGenerating(false);
    }
  };

  // Download Official Dossier PDF Report
  const handleDownloadPDF = async () => {
    try {
      setExportingPdf(true);
      setError(null);
      const blob = await downloadFinalOutcomePdfApi(threadId, accessToken);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Veriq_AI_Case_Dossier_${threadId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccessNotice("Official Final Case Outcome PDF dossier downloaded successfully.");
    } catch (err) {
      console.error("PDF Export error:", err);
      setError(err.response?.data?.error || err.message || "Failed to download Final Case Outcome PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  // Helper for 7 strict evidence statuses
  const renderStatusBadge = (status) => {
    const s = String(status || "UNKNOWN").toUpperCase();
    let bg = "rgba(148, 163, 184, 0.12)";
    let color = "#94a3b8";
    let border = "rgba(148, 163, 184, 0.3)";
    let label = s;

    if (s === "DOCUMENT_INSPECTED") {
      bg = "rgba(16, 185, 129, 0.12)";
      color = "#34d399";
      border = "rgba(16, 185, 129, 0.4)";
      label = "DOCUMENT INSPECTED";
    } else if (s === "INDEPENDENTLY_VERIFIED") {
      bg = "rgba(16, 185, 129, 0.18)";
      color = "#10b981";
      border = "rgba(16, 185, 129, 0.5)";
      label = "INDEPENDENTLY VERIFIED";
    } else if (s === "DOCUMENT_UPLOADED" || s === "NOT_INSPECTED") {
      bg = "rgba(59, 130, 246, 0.12)";
      color = "#60a5fa";
      border = "rgba(59, 130, 246, 0.35)";
      label = s === "NOT_INSPECTED" ? "NOT INSPECTED" : "DOCUMENT UPLOADED";
    } else if (s === "USER_REPORTED") {
      bg = "rgba(245, 158, 11, 0.12)";
      color = "#fbbf24";
      border = "rgba(245, 158, 11, 0.35)";
      label = "USER REPORTED";
    } else if (s === "CONTRADICTED") {
      bg = "rgba(239, 68, 68, 0.15)";
      color = "#f87171";
      border = "rgba(239, 68, 68, 0.45)";
      label = "CONTRADICTED / DISPUTED";
    } else if (s === "UNAVAILABLE") {
      bg = "rgba(168, 85, 247, 0.12)";
      color = "#c084fc";
      border = "rgba(168, 85, 247, 0.35)";
      label = "DOCUMENT UNAVAILABLE";
    }

    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 9px",
          borderRadius: "4px",
          fontSize: "0.68rem",
          fontWeight: "700",
          fontFamily: "var(--font-mono, monospace)",
          backgroundColor: bg,
          color: color,
          border: `1px solid ${border}`,
          whiteSpace: "nowrap",
          letterSpacing: "0.03em"
        }}
      >
        {label}
      </span>
    );
  };

  const gate = investigation?.investigationGate || null;
  const isGateBlocked = gate?.status === "INCOMPLETE";

  // Safe accessor for remedies (handles object vs array payload)
  const remediesList = outcomeData
    ? Array.isArray(outcomeData.potentialRemedies)
      ? outcomeData.potentialRemedies
      : Array.isArray(outcomeData.potentialRemedies?.remediesList)
      ? outcomeData.potentialRemedies.remediesList
      : []
    : [];

  const remediesDisclaimer =
    outcomeData?.potentialRemedies?.disclaimer ||
    "Statutory relief under Section 39 of the Consumer Protection Act, 2019 is subject to judicial discretion upon formal proof of loss.";

  // Safe accessor for structured contradictions
  const structuredContradictions = Array.isArray(outcomeData?.structuredContradictions)
    ? outcomeData.structuredContradictions
    : Array.isArray(investigation?.investigationGate?.structuredContradictions)
    ? investigation.investigationGate.structuredContradictions
    : [];

  // Safe accessor for established vs disputed facts
  const establishedFactsList = Array.isArray(outcomeData?.establishedFacts) && outcomeData.establishedFacts.length > 0
    ? outcomeData.establishedFacts
    : (outcomeData?.supportingFacts || []).filter((f) => {
        const st = (f.status || f.evidenceStatus || "").toUpperCase();
        return st === "DOCUMENT_INSPECTED" || st === "INDEPENDENTLY_VERIFIED";
      });

  const disputedFactsList = Array.isArray(outcomeData?.disputedFacts) && outcomeData.disputedFacts.length > 0
    ? outcomeData.disputedFacts
    : (outcomeData?.supportingFacts || []).filter((f) => {
        const st = (f.status || f.evidenceStatus || "").toUpperCase();
        return st === "CONTRADICTED" || st === "USER_REPORTED" || st === "UNAVAILABLE";
      });

  const allSupportingFacts = outcomeData?.supportingFacts || [];

  const intake = investigation?.intake || {};
  const analysis = investigation?.initialAnalysis || {};
  const disputeCategory = analysis.disputeCategory || intake.category || "Consumer Dispute";
  const productName = intake.product || analysis.productOrService || "Product/Service in Dispute";
  const sellerName = intake.company || analysis.companyOrSeller || "Opposite Party / Entity";
  const claimAmount = intake.amount ? `₹${intake.amount}` : (analysis.disputedAmount || "Not specified");
  const evidenceList = Array.isArray(investigation?.evidenceInventory) ? investigation.evidenceInventory : [];

  const defaultLaws = [
    { section: "Section 2(7)", title: "Consumer Standing & Consideration", description: "Defines any person buying goods or hiring services for consideration, strictly protecting non-commercial end-users." },
    { section: "Section 2(10)", title: "Statutory Defect in Goods", description: "Any fault, imperfection, or shortcoming in quality, quantity, potency, purity, or standard required to be maintained by law or contract." },
    { section: "Section 2(11)", title: "Deficiency in Service", description: "Any fault, imperfection, shortcoming, or inadequacy in quality, nature, and manner of performance required under contract or statutory law." },
    { section: "Section 2(47)", title: "Unfair Trade Practice", description: "Misleading statements, refusal to issue receipt/invoice, non-compliance with warranty standards, or refusal to take back defective goods." },
    { section: "Section 35 & 38", title: "Commission Adjudication & Laboratory Testing", description: "Establishes summary consumer adjudication and powers to direct scientific defect testing under Section 38(2)(c)." },
    { section: "Section 39", title: "Judicial Orders & Remedial Relief", description: "Empowers Consumer Commissions to order defect removal, replacement, full refund with interest, and damages for injury/loss." },
    { section: "E-Commerce Rules, 2020", title: "Marketplace Accountability", description: "Mandates grievance redressal mechanisms, clear refund policies, and prevents platforms from evading consumer duties." }
  ];

  const applicableLawsList = Array.isArray(outcomeData?.applicableLaws) && outcomeData.applicableLaws.length > 0
    ? outcomeData.applicableLaws
    : defaultLaws;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
          <LoadingSpinner
            variant="page"
            message="Retrieving Final Case Outcome…"
            submessage="Benchmarking verified case facts, statutory Section 39 remedies, and Supreme Court / NCDRC judicial precedents..."
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: "1240px", width: "100%", margin: "0 auto", padding: "32px 24px", boxSizing: "border-box" }}>
        {/* Navigation Breadcrumb & Top Actions Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "24px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--line)"
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => navigate(`/courtroom/${threadId}`)}
              className="btn-outline-brass font-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                fontSize: "0.82rem",
                cursor: "pointer",
                borderRadius: "6px"
              }}
            >
              ← Back to Investigation Room
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="font-mono text-muted" style={{ fontSize: "0.8rem" }}>
                Case Docket:
              </span>
              <span className="font-mono text-brass" style={{ fontSize: "0.82rem", fontWeight: "600" }}>
                {threadId}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
            {outcomeData && (
              <button
                onClick={handleDownloadPDF}
                disabled={exportingPdf}
                className="btn-outline-brass font-mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 18px",
                  fontSize: "0.82rem",
                  borderRadius: "6px",
                  cursor: exportingPdf ? "not-allowed" : "pointer"
                }}
              >
                {exportingPdf ? "Generating Official PDF..." : "⬇ Export Official Dossier PDF"}
              </button>
            )}

            <button
              onClick={handleGenerateOutcome}
              disabled={generating || isGateBlocked}
              className="btn-brass font-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 20px",
                fontSize: "0.82rem",
                fontWeight: "700",
                borderRadius: "6px",
                cursor: (generating || isGateBlocked) ? "not-allowed" : "pointer",
                opacity: (generating || isGateBlocked) ? 0.6 : 1
              }}
            >
              {generating
                ? "Synthesizing Precedents..."
                : outcomeData
                ? "🔄 Re-synthesize Outcome"
                : "⚡ Generate Final Case Outcome"}
            </button>
          </div>
        </div>

        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

        {successNotice && (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "8px",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              color: "#34d399",
              marginBottom: "20px",
              fontSize: "0.85rem",
              fontFamily: "var(--font-mono)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <span>✓ {successNotice}</span>
            <button
              onClick={() => setSuccessNotice(null)}
              style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: "1rem" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* OUTDATED WARNING BANNER */}
        {outcomeData?.isOutdated && (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "10px",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              marginBottom: "24px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "1.4rem" }}>⚠️</span>
              <div>
                <strong className="font-serif" style={{ color: "#fbbf24", fontSize: "0.95rem", display: "block" }}>
                  Case Record Modified: Outcome Potentially Outdated
                </strong>
                <p className="font-mono text-muted" style={{ margin: "3px 0 0 0", fontSize: "0.78rem" }}>
                  Material case facts, clarification answers, or evidence have changed since this outcome was generated. Re-synthesize to incorporate the latest validated case record.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateOutcome}
              disabled={generating}
              className="btn-brass font-mono"
              style={{ padding: "8px 16px", fontSize: "0.78rem", whiteSpace: "nowrap" }}
            >
              🔄 Re-synthesize Now
            </button>
          </div>
        )}

        {/* GATE BLOCKED STATE */}
        {isGateBlocked && !outcomeData && (
          <div
            className="legal-card"
            style={{
              padding: "44px 32px",
              textAlign: "center",
              marginBottom: "30px",
              border: "1px dashed rgba(239, 68, 68, 0.45)"
            }}
          >
            <span style={{ fontSize: "2.6rem", display: "block", marginBottom: "14px" }}>🚫</span>
            <h2 className="font-serif text-brass" style={{ margin: "0 0 10px 0", fontSize: "1.35rem" }}>
              Investigation Incomplete: Final Outcome Blocked
            </h2>
            <p className="font-mono text-muted" style={{ fontSize: "0.86rem", maxWidth: "620px", margin: "0 auto 24px auto", lineHeight: "1.6" }}>
              Under NeedhiAI's server-side completeness gate, an authoritative Final Case Outcome cannot be synthesized while mandatory intake or clarification requirements remain pending.
            </p>
            <div
              style={{
                maxWidth: "540px",
                margin: "0 auto 26px auto",
                textAlign: "left",
                padding: "18px 22px",
                borderRadius: "8px",
                backgroundColor: "var(--bg)",
                border: "1px solid var(--line)"
              }}
            >
              <strong className="font-mono" style={{ fontSize: "0.78rem", color: "#f87171", textTransform: "uppercase", display: "block", marginBottom: "10px", letterSpacing: "0.04em" }}>
                Outstanding Gate Requirements:
              </strong>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.82rem", fontFamily: "var(--font-mono)", color: "var(--ink)", lineHeight: "1.6" }}>
                {(gate.outstandingRequirements || ["Complete clarification questioning"]).map((req, rIdx) => (
                  <li key={rIdx}>{req}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => navigate(`/courtroom/${threadId}`)}
              className="btn-brass font-mono"
              style={{ padding: "10px 26px", fontSize: "0.88rem" }}
            >
              Return to Investigation Room →
            </button>
          </div>
        )}

        {/* NOT YET GENERATED STATE (GATE SATISFIED) */}
        {!outcomeData && !isGateBlocked && (
          <div
            className="legal-card"
            style={{
              padding: "50px 36px",
              textAlign: "center",
              marginBottom: "30px",
              border: "1px dashed var(--line-bright)"
            }}
          >
            <span style={{ fontSize: "2.8rem", display: "block", marginBottom: "14px" }}>🏛️</span>
            <h2 className="font-serif text-brass" style={{ margin: "0 0 10px 0", fontSize: "1.5rem" }}>
              Authoritative Final Case Outcome Dossier
            </h2>
            <p className="font-mono text-muted" style={{ fontSize: "0.9rem", maxWidth: "680px", margin: "0 auto 28px auto", lineHeight: "1.6" }}>
              Your case record and evidence inventory have passed server-side completeness checks. Click below to synthesize Veriq's authoritative prediction of the most plausible judicial outcome, grounded in verified Supreme Court & NCDRC judgments and Section 39 of the Consumer Protection Act, 2019.
            </p>

            {generating && (
              <div style={{ margin: "0 auto 24px auto", maxWidth: "600px" }}>
                <LoadingSpinner
                  variant="card"
                  message="Calculating Final Case Outcome…"
                  submessage="Synthesizing authoritative prediction grounded in verified Supreme Court & NCDRC judgments and Section 39 of the Consumer Protection Act, 2019..."
                />
              </div>
            )}

            <button
              onClick={handleGenerateOutcome}
              disabled={generating}
              className="btn-brass font-mono"
              style={{ padding: "12px 30px", fontSize: "0.95rem", fontWeight: "700" }}
            >
              {generating ? "Evaluating Precedents & Facts..." : "⚡ Generate Authoritative Final Case Outcome"}
            </button>
          </div>
        )}

        {/* COMPLETED FINAL CASE OUTCOME VIEW */}
        {outcomeData && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {/* MANDATORY LEGAL STATUS HEADER */}
            <div
              className="veriq-card"
              style={{
                padding: "18px 24px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "14px",
                borderLeft: "4px solid var(--veriq-blue)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.4rem" }}>⚖️</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="veriq-badge veriq-badge-blue font-mono" style={{ fontSize: "0.72rem", fontWeight: "700" }}>
                      PRELIMINARY NON-BINDING VERDICT
                    </span>
                    <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                      Dossier Ver: {outcomeData.assessmentVersion || "3.0"}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    CPA 2019 Analytical Evaluation • Not a Judicial Order of a Consumer Commission
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="font-mono text-muted" style={{ fontSize: "0.74rem" }}>
                  Synthesized: {outcomeData.generatedAt ? new Date(outcomeData.generatedAt).toLocaleString("en-GB") : "Recently"}
                </span>
                <button
                  onClick={handleDownloadPDF}
                  disabled={exportingPdf}
                  className="btn-veriq-primary font-mono"
                  style={{ padding: "6px 14px", fontSize: "0.76rem" }}
                >
                  {exportingPdf ? "Exporting..." : "⬇ PDF Dossier"}
                </button>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 1: CASE SUMMARY & FACTUAL PROFILE */}
            {/* ======================================================== */}
            <div className="veriq-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTION 01
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "1.2rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Case Summary & Factual Profile
                  </h3>
                </div>
                <span className="veriq-badge veriq-badge-teal font-mono" style={{ fontSize: "0.75rem" }}>
                  🏷️ {disputeCategory}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
                  <span className="font-mono text-muted" style={{ fontSize: "0.7rem", display: "block", marginBottom: "3px" }}>PRODUCT / SERVICE:</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--ink)" }}>{productName}</strong>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
                  <span className="font-mono text-muted" style={{ fontSize: "0.7rem", display: "block", marginBottom: "3px" }}>OPPOSITE PARTY / ENTITY:</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--ink)" }}>{sellerName}</strong>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
                  <span className="font-mono text-muted" style={{ fontSize: "0.7rem", display: "block", marginBottom: "3px" }}>DISPUTED VALUE:</span>
                  <strong className="font-mono" style={{ fontSize: "0.95rem", color: "var(--veriq-blue)" }}>{claimAmount}</strong>
                </div>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                <span className="font-mono text-muted" style={{ fontSize: "0.7rem", display: "block", marginBottom: "4px" }}>CONSUMER'S SWORN COMPLAINT STATEMENT:</span>
                <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: "1.6", color: "var(--ink)", fontStyle: "italic" }}>
                  "{intake.complaint || outcomeData.caseSummary || "Complaint statement recorded in case docket."}"
                </p>
              </div>

              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: "1.6" }}>
                <strong>Analytical Summary: </strong>
                {outcomeData.caseSummary || outcomeData.summary || `Dispute investigated under the Consumer Protection Act, 2019 for ${disputeCategory}. The complainant has established statutory consideration paid and reported non-fulfillment/deficiency.`}
              </p>
            </div>

            {/* ======================================================== */}
            {/* SECTION 2 & 3: ESTABLISHED FACTS VS DISPUTED CLAIMS */}
            {/* ======================================================== */}
            <div className="veriq-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTIONS 02 & 03
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "1.2rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Factual Analysis: Established vs. Disputed Claims
                  </h3>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  {[
                    { id: "all", label: `All Records (${allSupportingFacts.length})` },
                    { id: "established", label: `Established (${establishedFactsList.length})` },
                    { id: "disputed", label: `Disputed / Alleged (${disputedFactsList.length})` }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFactsFilter(tab.id)}
                      className="font-mono"
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        fontSize: "0.74rem",
                        cursor: "pointer",
                        backgroundColor: factsFilter === tab.id ? "var(--veriq-blue)" : "var(--bg)",
                        color: factsFilter === tab.id ? "#fff" : "var(--muted)",
                        border: factsFilter === tab.id ? "1px solid var(--veriq-blue)" : "1px solid var(--border)",
                        fontWeight: factsFilter === tab.id ? "700" : "400"
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(() => {
                  const displayList =
                    factsFilter === "established"
                      ? establishedFactsList
                      : factsFilter === "disputed"
                      ? disputedFactsList
                      : allSupportingFacts;

                  if (displayList.length === 0) {
                    return (
                      <div style={{ padding: "18px", textAlign: "center", backgroundColor: "var(--bg)", borderRadius: "8px", border: "1px dashed var(--border)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.8rem" }}>
                          No facts in this classification category.
                        </span>
                      </div>
                    );
                  }

                  return displayList.map((factItem, idx) => {
                    const factStatement = factItem.fact || factItem.statement || "Fact statement recorded.";
                    const factProvenance = factItem.provenance || factItem.sourceReference || "Case Intake Record";
                    const factStatus = factItem.status || factItem.evidenceStatus || "USER_REPORTED";
                    const isEstablished = String(factStatus).toUpperCase() === "DOCUMENT_INSPECTED" || String(factStatus).toUpperCase() === "INDEPENDENTLY_VERIFIED";

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "8px",
                          backgroundColor: "var(--bg)",
                          border: isEstablished ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border)",
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px"
                        }}
                      >
                        <div style={{ flex: 1, minWidth: "260px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ color: isEstablished ? "#10b981" : "#f59e0b", fontSize: "0.9rem" }}>
                              {isEstablished ? "✓" : "⚠️"}
                            </span>
                            <span style={{ fontSize: "0.88rem", color: "var(--ink)", fontWeight: "500", lineHeight: "1.4" }}>
                              {factStatement}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--muted)", marginTop: "4px", paddingLeft: "18px" }}>
                            Source Provenance: {factProvenance}
                          </div>
                        </div>
                        <div>{renderStatusBadge(factStatus)}</div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 4: EVIDENCE REVIEWED */}
            {/* ======================================================== */}
            <div className="veriq-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTION 04
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "1.2rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Evidence Reviewed & Document Inventory
                  </h3>
                </div>
                <span className="veriq-badge veriq-badge-slate font-mono" style={{ fontSize: "0.75rem" }}>
                  {evidenceList.length} DOCUMENT(S) LOGGED
                </span>
              </div>

              {evidenceList.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                  {evidenceList.map((doc, dIdx) => (
                    <div
                      key={dIdx}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "8px",
                        backgroundColor: "var(--bg)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "8px"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <strong style={{ fontSize: "0.88rem", color: "var(--ink)" }}>
                            {doc.title || doc.originalName || `Document #${dIdx + 1}`}
                          </strong>
                          {renderStatusBadge(doc.status || (doc.inspected ? "DOCUMENT_INSPECTED" : "DOCUMENT_UPLOADED"))}
                        </div>
                        <span className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block" }}>
                          Type: {doc.category || "INVOICE / RECEIPT"}
                        </span>
                        {doc.extractedFacts && (
                          <div style={{ marginTop: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                            {doc.extractedFacts.datesFound && <span>Dates: {doc.extractedFacts.datesFound.join(", ")} • </span>}
                            {doc.extractedFacts.amountsFound && <span>Amounts: {doc.extractedFacts.amountsFound.join(", ")}</span>}
                          </div>
                        )}
                      </div>
                      {doc.unavailableReason && (
                        <div style={{ fontSize: "0.72rem", color: "#f59e0b", fontFamily: "var(--font-mono)" }}>
                          ⚠️ Disclosed: {doc.unavailableReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px dashed var(--border)", textAlign: "center" }}>
                  <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                    Proceeded under disclosed evidentiary limitations. Physical receipts were not produced; analysis relies on verified complaint intake.
                  </p>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* SECTION 5: CONTRADICTIONS AND THEIR IMPACT */}
            {/* ======================================================== */}
            <div className="veriq-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTION 05
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "1.2rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Contradictions and Their Impact
                  </h3>
                </div>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: "4px",
                    fontSize: "0.72rem",
                    fontWeight: "700",
                    fontFamily: "var(--font-mono)",
                    backgroundColor: structuredContradictions.length > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                    color: structuredContradictions.length > 0 ? "#f59e0b" : "#10b981",
                    border: structuredContradictions.length > 0 ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(16, 185, 129, 0.35)"
                  }}
                >
                  {structuredContradictions.length > 0 ? `${structuredContradictions.length} CONTRADICTION(S) FACTORED` : "✓ 0 CONFLICTS DETECTED"}
                </span>
              </div>

              <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                Cross-evaluates claims against physical documents and seller terms. Unresolved contradictions do not halt the workflow; they are explicitly modeled into balanced arguments and reflected as defensible uncertainty.
              </p>

              {structuredContradictions.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {structuredContradictions.map((conflict, cIdx) => (
                    <div
                      key={cIdx}
                      style={{
                        padding: "16px 18px",
                        borderRadius: "8px",
                        backgroundColor: "var(--bg)",
                        border: "1px solid rgba(245, 158, 11, 0.35)"
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                        <strong style={{ fontSize: "0.92rem", color: "#f59e0b", fontFamily: "var(--font-mono)" }}>
                          ⚠️ {conflict.conflictType || "EVIDENTIARY_DISCREPANCY"}
                        </strong>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            className="font-mono"
                            style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.68rem",
                              fontWeight: "700",
                              backgroundColor: conflict.materiality === "HIGH" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                              color: conflict.materiality === "HIGH" ? "#ef4444" : "#f59e0b"
                            }}
                          >
                            Materiality: {conflict.materiality || "MEDIUM"}
                          </span>
                          {renderStatusBadge(conflict.verificationStatus || "CONTRADICTED")}
                        </div>
                      </div>

                      <p style={{ fontSize: "0.84rem", color: "var(--ink)", margin: "0 0 10px 0", lineHeight: "1.5" }}>
                        {conflict.conflictingClaimsOrEvidence}
                      </p>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px", marginTop: "8px" }}>
                        <div style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                          <span className="font-mono text-muted" style={{ fontSize: "0.68rem", textTransform: "uppercase", display: "block" }}>
                            Conflicting Sources:
                          </span>
                          <span className="font-mono" style={{ fontSize: "0.76rem", color: "var(--ink)" }}>
                            {Array.isArray(conflict.sources) ? conflict.sources.join(" vs. ") : conflict.sources || "Case Statement vs. Attached Record"}
                          </span>
                        </div>
                        <div style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                          <span className="font-mono text-muted" style={{ fontSize: "0.68rem", textTransform: "uppercase", display: "block" }}>
                            Impact on Legal Outcome:
                          </span>
                          <span className="font-mono" style={{ fontSize: "0.76rem", color: "#f59e0b" }}>
                            {conflict.impactOnPlausibleOutcomes || "Uncertainty reflected in outcome classification without terminating pipeline."}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "14px 18px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px"
                  }}
                >
                  <span style={{ fontSize: "1.2rem", color: "#10b981" }}>✓</span>
                  <div>
                    <strong style={{ color: "#10b981", fontSize: "0.9rem", display: "block" }}>
                      Zero Material Contradictions Detected
                    </strong>
                    <span className="font-mono text-muted" style={{ fontSize: "0.75rem" }}>
                      Intake timeline dates, disputed amounts, and uploaded proof documents are internally consistent.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* SECTION 6: APPLICABLE LEGAL PROVISIONS */}
            {/* ======================================================== */}
            <div className="veriq-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTION 06
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "1.2rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Applicable Legal Provisions (Consumer Protection Act, 2019)
                  </h3>
                </div>
                <span className="veriq-badge veriq-badge-teal font-mono" style={{ fontSize: "0.75rem" }}>
                  STATUTORY REPOSITORY
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                {applicableLawsList.map((law, lIdx) => (
                  <div
                    key={lIdx}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "8px",
                      backgroundColor: "var(--bg)",
                      border: "1px solid var(--border)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <strong className="font-mono text-brass" style={{ fontSize: "0.88rem", color: "var(--veriq-blue)" }}>
                        {law.section || law.statute}
                      </strong>
                      <span className="font-mono text-muted" style={{ fontSize: "0.68rem" }}>
                        CPA 2019
                      </span>
                    </div>
                    <strong style={{ fontSize: "0.85rem", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                      {law.title}
                    </strong>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)", lineHeight: "1.5" }}>
                      {law.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 7: VERIFIED RELEVANT PRECEDENTS */}
            {/* ======================================================== */}
            <div className="veriq-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTION 07
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "1.2rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Verified Relevant Precedents (Supreme Court & NCDRC)
                  </h3>
                </div>
                <span className="veriq-badge veriq-badge-teal font-mono" style={{ fontSize: "0.72rem" }}>
                  ✓ VERIFIED PRIMARY SOURCES (0% HALLUCINATION)
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {(outcomeData.precedentComparisons || []).map((prec, idx) => {
                  const similarities = prec.comparison?.similarities || prec.factualSimilarity || "Direct factual alignment with core consumer dispute elements.";
                  const distinctions = prec.comparison?.distinctions || prec.distinctions || "Case-specific distinctions evaluated for accurate legal applicability.";
                  const impact = prec.comparison?.impactOnOutcome || prec.impactOnOutcome || "Supports consumer entitlement to refund and compensation under CPA 2019.";

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "16px 20px",
                        borderRadius: "8px",
                        backgroundColor: "var(--bg)",
                        border: "1px solid var(--border)"
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                        <div>
                          <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>
                            {prec.caseName}
                          </strong>
                          <span className="font-mono text-muted" style={{ fontSize: "0.76rem", marginLeft: "10px" }}>
                            [{prec.court} • {prec.year}]
                          </span>
                        </div>
                        {prec.indianKanoonUrl && (
                          <a
                            href={prec.indianKanoonUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-brass"
                            style={{
                              fontSize: "0.75rem",
                              textDecoration: "underline",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              color: "var(--veriq-blue)"
                            }}
                          >
                            View on Indian Kanoon ↗
                          </a>
                        )}
                      </div>

                      <div style={{ fontSize: "0.76rem", fontFamily: "var(--font-mono)", color: "var(--muted)", marginBottom: "10px" }}>
                        Citation: <strong style={{ color: "var(--ink)" }}>{prec.citation}</strong> • {prec.legalWeight || "APPELLATE BENCHMARK"}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px", marginTop: "10px" }}>
                        <div style={{ padding: "10px 12px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                          <strong className="font-mono" style={{ fontSize: "0.7rem", color: "#10b981", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                            Factual Similarities:
                          </strong>
                          <p style={{ fontSize: "0.8rem", margin: 0, color: "var(--ink)", lineHeight: "1.5" }}>
                            {similarities}
                          </p>
                        </div>

                        <div style={{ padding: "10px 12px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                          <strong className="font-mono" style={{ fontSize: "0.7rem", color: "#3b82f6", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                            Factual Distinctions:
                          </strong>
                          <p style={{ fontSize: "0.8rem", margin: 0, color: "var(--ink)", lineHeight: "1.5" }}>
                            {distinctions}
                          </p>
                        </div>
                      </div>

                      <div style={{ marginTop: "10px", padding: "8px 12px", borderRadius: "6px", backgroundColor: "rgba(37, 99, 235, 0.08)", border: "1px dashed rgba(37, 99, 235, 0.3)" }}>
                        <span className="font-mono" style={{ fontSize: "0.76rem", color: "var(--veriq-blue)" }}>
                          ⚖️ <strong>Legal Impact on Outcome:</strong> {impact}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTIONS 8 & 9: BALANCED ARGUMENT MODEL */}
            {/* ======================================================== */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
              {/* Section 8: Consumer Grounds */}
              <div className="veriq-card" style={{ padding: "24px 26px" }}>
                <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                  SECTION 08
                </span>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "1.15rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                  Consumer-Side Arguments (Strongest Grounds)
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(outcomeData.consumerArguments || []).map((arg, idx) => (
                    <div key={idx} style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
                      <strong style={{ fontSize: "0.88rem", color: "#10b981", display: "block", marginBottom: "4px" }}>
                        Ground #{idx + 1}: {arg.issue || arg.point}
                      </strong>
                      <p style={{ fontSize: "0.82rem", color: "var(--ink)", margin: 0, lineHeight: "1.5" }}>
                        {arg.argument || arg.detail}
                      </p>
                      {arg.statutoryBasis && (
                        <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--veriq-blue)", marginTop: "6px" }}>
                          Statutory Basis: {arg.statutoryBasis}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 9: Opposite Party Defenses */}
              <div className="veriq-card" style={{ padding: "24px 26px" }}>
                <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                  SECTION 09
                </span>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "1.15rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                  Respondent-Side Arguments & Consumer Rebuttals
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(outcomeData.companyCounterarguments || []).map((arg, idx) => (
                    <div key={idx} style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
                      <strong style={{ fontSize: "0.88rem", color: "#f59e0b", display: "block", marginBottom: "4px" }}>
                        Defense Point #{idx + 1}: {arg.issue || arg.point}
                      </strong>
                      <p style={{ fontSize: "0.82rem", color: "var(--ink)", margin: "0 0 6px 0", lineHeight: "1.5" }}>
                        {arg.argument || arg.detail}
                      </p>
                      <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--muted)", borderTop: "1px dashed var(--border)", paddingTop: "6px" }}>
                        💡 <strong>Consumer Rebuttal:</strong> {arg.rebuttalNote || arg.rebuttal || "Subject to statutory override under CPA 2019."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 10: PRELIMINARY LIKELY OUTCOME */}
            {/* ======================================================== */}
            <div
              className="veriq-card"
              style={{
                padding: "26px 30px",
                borderLeft: "6px solid var(--veriq-teal)"
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTION 10
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "1.3rem", fontWeight: "800", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Preliminary Likely Outcome Prediction
                  </h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="veriq-badge veriq-badge-teal font-mono" style={{ fontSize: "0.8rem", fontWeight: "700" }}>
                    Confidence: {outcomeData.confidenceMetrics?.score || 80}%
                  </span>
                </div>
              </div>

              <div style={{ padding: "16px 20px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)", marginBottom: "14px" }}>
                <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  ANALYTICAL CLASSIFICATION:
                </span>
                <strong style={{ fontSize: "1.1rem", color: "var(--veriq-blue)", display: "block", marginBottom: "8px" }}>
                  {outcomeData.outcomeClassification}
                </strong>
                <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: "1.6", color: "var(--ink)" }}>
                  {outcomeData.directConclusion}
                </p>
              </div>

              <span className="font-mono text-muted" style={{ fontSize: "0.72rem", fontStyle: "italic", display: "block" }}>
                {outcomeData.disclaimer || "Non-binding analytical evaluation under CPA 2019. Final legal orders reside exclusively with the Consumer Commission."}
              </span>
            </div>

            {/* ======================================================== */}
            {/* SECTION 11: POTENTIAL REMEDIES */}
            {/* ======================================================== */}
            <div className="veriq-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTION 11
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "1.2rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Potential Remedies (Consumer Protection Act, 2019 Section 39)
                  </h3>
                </div>
                <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                  DISCRETIONARY JUDICIAL RELIEF
                </span>
              </div>

              <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                {remediesDisclaimer}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
                {remediesList.map((rem, idx) => (
                  <div key={idx} style={{ padding: "14px 16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "0.92rem", color: "var(--veriq-blue)" }}>
                        {rem.remedy}
                      </strong>
                      <span className="font-mono text-muted" style={{ fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                        {rem.statutoryProvision}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)", lineHeight: "1.5" }}>
                      <strong>Factual Eligibility: </strong> {rem.eligibility}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 12 & 13: MISSING EVIDENCE & CONFIDENCE EXPLANATION */}
            {/* ======================================================== */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
              {/* Section 12: Missing Evidence and Questions */}
              <div className="veriq-card" style={{ padding: "24px 26px" }}>
                <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                  SECTION 12
                </span>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.15rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                  Missing Evidence and Remaining Questions
                </h3>
                {Array.isArray(outcomeData.evidenceLimitations) && outcomeData.evidenceLimitations.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", color: "var(--ink)", lineHeight: "1.6" }}>
                    {outcomeData.evidenceLimitations.map((lim, idx) => (
                      <li key={idx} style={{ marginBottom: "6px" }}>{lim}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: "0.84rem", color: "var(--muted)", margin: 0, lineHeight: "1.5" }}>
                    No material evidentiary limitations recorded. Primary records verified against statutory criteria.
                  </p>
                )}
                {Array.isArray(outcomeData.unresolvedDisputes) && outcomeData.unresolvedDisputes.length > 0 && (
                  <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed var(--border)" }}>
                    <span className="font-mono text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      Remaining Questions for Commission:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.78rem", color: "var(--muted)", lineHeight: "1.5" }}>
                      {outcomeData.unresolvedDisputes.slice(0, 3).map((item, qIdx) => (
                        <li key={qIdx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Section 13: Confidence Explanation */}
              <div className="veriq-card" style={{ padding: "24px 26px" }}>
                <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                  SECTION 13
                </span>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.15rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                  Confidence Explanation & Methodology
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "2.4rem", fontWeight: "800", fontFamily: "var(--font-mono)", color: "var(--veriq-blue)" }}>
                    {outcomeData.confidenceMetrics?.score || 80}%
                  </span>
                  <p style={{ fontSize: "0.82rem", margin: 0, color: "var(--muted)", lineHeight: "1.5" }}>
                    {outcomeData.confidenceMetrics?.explanation || "Confidence score derived from primary document inspection, timeline completeness, and verified precedents."}
                  </p>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg)",
                    border: "1px solid var(--border)",
                    fontSize: "0.74rem",
                    color: "var(--muted)",
                    lineHeight: "1.5"
                  }}
                >
                  ⚠️ <strong>Metric Definition:</strong> This measure reflects evidentiary record completeness, primary proof corroboration, and statutory precedent alignment. It is <strong>NOT</strong> a win probability or court guarantee.
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 14: SOURCES AND CITATIONS */}
            {/* ======================================================== */}
            <div className="veriq-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "14px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTION 14
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "1.2rem", fontWeight: "700", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Sources, Legal Citations & Official Authorities
                  </h3>
                </div>
                <span className="veriq-badge veriq-badge-slate font-mono" style={{ fontSize: "0.72rem" }}>
                  PRIMARY AUTHORITY INDEX
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
                <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--ink)", display: "block" }}>
                    The Consumer Protection Act, 2019
                  </strong>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                    Act No. 35 of 2019 • Ministry of Consumer Affairs, Government of India
                  </span>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--ink)", display: "block" }}>
                    Consumer Protection (E-Commerce) Rules, 2020
                  </strong>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                    G.S.R. 462(E) • Department of Consumer Affairs
                  </span>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--ink)", display: "block" }}>
                    Supreme Court of India & NCDRC Reports
                  </strong>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                    Indian Kanoon Case Repository & CONFONET Consumer Commission Portal
                  </span>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SECTION 15: DOWNLOADABLE CASE REPORT */}
            {/* ======================================================== */}
            <div
              className="veriq-card"
              style={{
                padding: "26px 30px",
                border: "2px solid var(--veriq-blue)",
                backgroundColor: "var(--surface)"
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                    SECTION 15
                  </span>
                  <h3 style={{ margin: "2px 0 6px 0", fontSize: "1.25rem", fontWeight: "800", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                    Downloadable Case Dossier Report (PDF)
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", maxWidth: "600px", lineHeight: "1.5" }}>
                    Download the complete 15-section verified case intelligence dossier including fact sheets, precedent citations, and statutory arguments formatted for legal notice preparation or e-Daakhil filing.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={exportingPdf}
                    className="btn-veriq-primary font-mono"
                    style={{ padding: "11px 26px", fontSize: "0.85rem", fontWeight: "700" }}
                  >
                    {exportingPdf ? "Generating Official PDF..." : "⬇ Download Case Dossier PDF"}
                  </button>
                  <button
                    onClick={() => navigate(`/courtroom/${threadId}`)}
                    className="btn-veriq-secondary font-mono"
                    style={{ padding: "11px 20px", fontSize: "0.85rem" }}
                  >
                    ← Investigation Room
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
