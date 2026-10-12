import React, { useState, useEffect } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { getTransferAssessmentApi, submitTransferAssessmentReviewApi } from "../services/investigationApi";

export default function TransferAssessmentModal({ threadId, accessToken, onClose, onReviewSubmitted }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // User correction form state
  const [correctionNote, setCorrectionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    async function fetchData() {
      if (!threadId) return;
      try {
        setLoading(true);
        setError(null);
        const res = await getTransferAssessmentApi(threadId, accessToken);
        setData(res.transferAssessment || res);
      } catch (err) {
        console.error("Failed to load Transfer Assessment Form:", err);
        setError(err.response?.data?.error || "Failed to load Transfer Assessment Form data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [threadId, accessToken]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const res = await submitTransferAssessmentReviewApi(
        threadId,
        {
          notes: correctionNote,
          confirmedByConsumer: true
        },
        accessToken
      );
      setSuccessMsg("AI 2.0 Transfer Assessment review saved. Authoritative case record updated.");
      if (onReviewSubmitted) {
        onReviewSubmitted(res);
      }
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err) {
      console.error("Failed to submit review:", err);
      setError(err.response?.data?.error || "Failed to save Transfer Assessment review.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || "UNKNOWN").toUpperCase();
    let bg = "rgba(100, 116, 139, 0.15)";
    let color = "#94a3b8";
    let border = "rgba(100, 116, 139, 0.3)";

    if (s === "DOCUMENT_INSPECTED" || s === "INDEPENDENTLY_VERIFIED") {
      bg = "rgba(16, 185, 129, 0.15)";
      color = "#34d399";
      border = "rgba(16, 185, 129, 0.4)";
    } else if (s === "DOCUMENT_UPLOADED" || s === "NOT_INSPECTED") {
      bg = "rgba(59, 130, 246, 0.15)";
      color = "#60a5fa";
      border = "rgba(59, 130, 246, 0.4)";
    } else if (s === "USER_REPORTED") {
      bg = "rgba(245, 158, 11, 0.15)";
      color = "#fbbf24";
      border = "rgba(245, 158, 11, 0.4)";
    } else if (s === "CONTRADICTED") {
      bg = "rgba(239, 68, 68, 0.15)";
      color = "#f87171";
      border = "rgba(239, 68, 68, 0.4)";
    } else if (s === "UNAVAILABLE") {
      bg = "rgba(168, 85, 247, 0.15)";
      color = "#c084fc";
      border = "rgba(168, 85, 247, 0.4)";
    }

    return (
      <span
        style={{
          padding: "3px 8px",
          borderRadius: "4px",
          fontSize: "0.68rem",
          fontWeight: "bold",
          fontFamily: "var(--font-mono, monospace)",
          backgroundColor: bg,
          color: color,
          border: `1px solid ${border}`,
          whiteSpace: "nowrap"
        }}
      >
        {s}
      </span>
    );
  };

  const sections = data?.sections || {};

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          maxHeight: "92vh",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--line-bright, #334155)",
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--surface-header, var(--surface))"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.4rem" }}>📋</span>
              <h2 className="font-serif text-brass" style={{ margin: 0, fontSize: "1.25rem" }}>
                AI 2.0 Transfer Assessment Form
              </h2>
              <span
                className="font-mono"
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "0.72rem",
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.3)"
                }}
              >
                AUTHORITATIVE DOCKET
              </span>
            </div>
            <p className="font-mono text-muted" style={{ margin: "4px 0 0 0", fontSize: "0.78rem" }}>
              Synchronized context transfer between TAI Coordinator and AI 2.0 Assessment Pipeline. Review allegations, verified evidence, and legal benchmarks before synthesis.
            </p>
          </div>

          <button
            onClick={onClose}
            className="btn-outline-brass font-mono"
            style={{ padding: "6px 12px", fontSize: "0.82rem" }}
            title="Close Transfer Docket"
          >
            ✕ Close
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {loading ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <LoadingSpinner />
              <p className="font-mono text-muted" style={{ marginTop: "16px", fontSize: "0.85rem" }}>
                Loading authoritative case docket for AI 2.0 transfer...
              </p>
            </div>
          ) : error ? (
            <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171" }}>
              <strong>Error:</strong> {error}
            </div>
          ) : (
            <div>
              {successMsg && (
                <div style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#34d399", marginBottom: "16px", fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}>
                  ✓ {successMsg}
                </div>
              )}

              {/* Sub-Tabs Navigation */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "12px",
                  marginBottom: "20px"
                }}
              >
                {[
                  { id: "overview", label: "Docket Overview & Facts", icon: "📊" },
                  { id: "clarifications", label: `Clarifications (${(sections.clarificationQuestionsAndAnswers || []).length})`, icon: "💬" },
                  { id: "evidence", label: `Evidence Inventory (${(sections.uploadedFilesAndInspections || []).length})`, icon: "🗂️" },
                  { id: "policy_law", label: "Company Policy & Law", icon: "⚖️" },
                  { id: "readiness", label: "Readiness & Limitations", icon: "🛡️" },
                  { id: "review", label: "User Corrections & Audit", icon: "✍️" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: activeTab === tab.id ? "600" : "normal",
                      backgroundColor: activeTab === tab.id ? "var(--brass, #d97706)" : "var(--bg, #0f172a)",
                      color: activeTab === tab.id ? "var(--bg, #0f172a)" : "var(--ink, #f8fafc)",
                      border: activeTab === tab.id ? "1px solid var(--brass, #d97706)" : "1px solid var(--line, #334155)",
                      cursor: "pointer"
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: OVERVIEW & USER-REPORTED FACTS */}
              {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Section 1: Dispute Classification & Intake
                      </span>
                      <span className="font-mono text-brass" style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
                        Category: {sections.complaintSummary?.category || "CONSUMER_DISPUTE"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.88rem", fontFamily: "var(--font-serif)", color: "var(--ink)", lineHeight: "1.6" }}>
                      <strong>Summary:</strong> {sections.complaintSummary?.complaintText || "No text available."}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "12px", fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
                      <span>Product: <strong>{sections.complaintSummary?.productOrService || "N/A"}</strong></span>
                      <span>Opposite Party: <strong>{sections.complaintSummary?.sellerOrServiceEntity || "N/A"}</strong></span>
                      <span>Disputed Amount: <strong>₹{sections.complaintSummary?.disputedAmount || 0}</strong></span>
                    </div>
                  </div>

                  {/* Section 3: User Reported Facts */}
                  <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Section 3: User-Reported Facts (Separated From Verified Documents)
                      </span>
                      <span className="font-mono text-muted" style={{ fontSize: "0.75rem" }}>
                        {sections.userReportedFacts?.length || 0} Reported Facts
                      </span>
                    </div>
                    {Array.isArray(sections.userReportedFacts) && sections.userReportedFacts.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {sections.userReportedFacts.map((fact, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "0.85rem" }}>💬</span>
                              <span style={{ fontSize: "0.84rem", color: "var(--ink)" }}>
                                <strong>{fact.fact}</strong>: {fact.details}
                              </span>
                            </div>
                            {getStatusBadge(fact.status || "USER_REPORTED")}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                        No specific intake facts recorded.
                      </p>
                    )}
                  </div>

                  {/* Section 5: Extracted Facts with Provenance */}
                  <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Section 5: Extracted Facts with Provenance
                      </span>
                      <span className="font-mono text-muted" style={{ fontSize: "0.75rem" }}>
                        {sections.extractedFactsWithProvenance?.length || 0} Provenance Records
                      </span>
                    </div>
                    {Array.isArray(sections.extractedFactsWithProvenance) && sections.extractedFactsWithProvenance.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {sections.extractedFactsWithProvenance.map((item, idx) => (
                          <div key={idx} style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                              <strong className="font-serif" style={{ fontSize: "0.88rem", color: "var(--ink)" }}>
                                {item.fact}
                              </strong>
                              {getStatusBadge(item.status || "DOCUMENT_INSPECTED")}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
                              <span>Source: <strong>{item.provenance}</strong></span>
                              <span>Method: {item.verificationMethod}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                        No physical document facts extracted yet.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CLARIFICATION QUESTIONS & ANSWERS */}
              {activeTab === "clarifications" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", marginBottom: "4px" }}>
                    <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Section 2: Clarification Q&A Audit Trail (Round {data.clarificationRound || 1})
                    </span>
                    <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: "4px 0 0 0" }}>
                      Chronological history of structured questions asked to resolve material facts under Consumer Law.
                    </p>
                  </div>

                  {Array.isArray(sections.clarificationQuestionsAndAnswers) && sections.clarificationQuestionsAndAnswers.length > 0 ? (
                    sections.clarificationQuestionsAndAnswers.map((item, idx) => (
                      <div key={idx} style={{ padding: "14px 16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                          <span className="font-mono text-brass" style={{ fontSize: "0.78rem", fontWeight: "bold" }}>
                            Q{idx + 1} [{item.category || "GENERAL"}]
                          </span>
                          <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                            Round {item.round} • {new Date(item.answeredAt).toLocaleString("en-GB")}
                          </span>
                        </div>
                        <p className="font-serif" style={{ fontSize: "0.9rem", color: "var(--ink)", margin: "0 0 8px 0" }}>
                          {item.question}
                        </p>
                        <div style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--line-bright)" }}>
                          <span className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block" }}>
                            RECORDED ANSWER:
                          </span>
                          <span className="font-mono" style={{ fontSize: "0.85rem", color: "var(--ink)", fontWeight: "600" }}>
                            {item.answer}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="font-mono text-muted" style={{ fontSize: "0.85rem", textAlign: "center", padding: "40px" }}>
                      No clarification questions answered yet.
                    </p>
                  )}
                </div>
              )}

              {/* TAB 3: EVIDENCE INVENTORY & INSPECTIONS */}
              {activeTab === "evidence" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                      Section 4: Evidence Inventory & Inspection Status
                    </span>
                    <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: "4px 0 0 0" }}>
                      Strict separation across all 7 evidence states. Uploaded documents are not assumed authentic without inspection.
                    </p>
                  </div>

                  {Array.isArray(sections.uploadedFilesAndInspections) && sections.uploadedFilesAndInspections.length > 0 ? (
                    sections.uploadedFilesAndInspections.map((doc, idx) => (
                      <div key={idx} style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <div>
                            <strong className="font-serif" style={{ fontSize: "0.95rem", color: "var(--ink)" }}>
                              {doc.name}
                            </strong>
                            <span className="font-mono text-muted" style={{ fontSize: "0.75rem", marginLeft: "8px" }}>
                              [{doc.category}]
                            </span>
                          </div>
                          {getStatusBadge(doc.status)}
                        </div>

                        {doc.inspectionOutcome && (
                          <div style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)", marginBottom: "6px" }}>
                            <strong>Inspection Summary:</strong> {doc.inspectionOutcome}
                          </div>
                        )}

                        {Array.isArray(doc.extractedFacts) && doc.extractedFacts.length > 0 && (
                          <div style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                            <span className="font-mono text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                              Extracted Points ({doc.extractedFacts.length}):
                            </span>
                            <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                              {doc.extractedFacts.map((f, fIdx) => (
                                <li key={fIdx}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="font-mono text-muted" style={{ fontSize: "0.85rem", textAlign: "center", padding: "40px" }}>
                      No documents currently uploaded or inspected.
                    </p>
                  )}

                  {/* Unavailable Evidence List */}
                  {Array.isArray(sections.missingOrUnavailableEvidence) && sections.missingOrUnavailableEvidence.length > 0 && (
                    <div style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "rgba(168, 85, 247, 0.08)", border: "1px dashed rgba(168, 85, 247, 0.4)" }}>
                      <span className="font-mono" style={{ fontSize: "0.78rem", color: "#c084fc", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                        Declared Unavailable Documents:
                      </span>
                      {sections.missingOrUnavailableEvidence.map((un, uIdx) => (
                        <div key={uIdx} style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--ink)", marginBottom: "4px" }}>
                          • <strong>{un.name}</strong>: {un.reason || "Not available"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: COMPANY POLICY & LAW */}
              {activeTab === "policy_law" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* Company Policy */}
                  <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                      Section 8: Company Policy Findings & Verification
                    </span>
                    <p className="font-serif" style={{ fontSize: "0.9rem", color: "var(--ink)", margin: "0 0 10px 0" }}>
                      {sections.companyPolicyFindings?.summary || "Policy research synthesized from public seller documentation."}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
                      <span>Source: <strong>{sections.companyPolicyFindings?.sourceUrl || "Public Records"}</strong></span>
                      <span>Status: <strong>{sections.companyPolicyFindings?.verificationStatus || "VERIFIED"}</strong></span>
                    </div>
                  </div>

                  {/* Applicable Law & Precedents */}
                  <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
                      Section 9: Applicable Statutory Provisions & Real Historical Judgments
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(sections.applicableLawsAndPrecedents || []).map((item, idx) => (
                        <div key={idx} style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <strong className="font-serif text-brass" style={{ fontSize: "0.92rem" }}>
                              {item.title}
                            </strong>
                            <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "#34d399" }}>
                              ✓ {item.source}
                            </span>
                          </div>
                          <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: 0, lineHeight: "1.4" }}>
                            {item.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: READINESS GATE & LIMITATIONS */}
              {activeTab === "readiness" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Section 10: Investigation Readiness Gate Result
                      </span>
                      <span
                        className="font-mono"
                        style={{
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontWeight: "bold",
                          fontSize: "0.8rem",
                          backgroundColor: sections.readinessGateResult?.status === "READY"
                            ? "rgba(16, 185, 129, 0.15)"
                            : sections.readinessGateResult?.status === "PROCEED_WITH_LIMITATIONS"
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                          color: sections.readinessGateResult?.status === "READY"
                            ? "#34d399"
                            : sections.readinessGateResult?.status === "PROCEED_WITH_LIMITATIONS"
                            ? "#fbbf24"
                            : "#f87171"
                        }}
                      >
                        {sections.readinessGateResult?.status || "PENDING_EVALUATION"}
                      </span>
                    </div>

                    <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                      <strong>Evaluation Reason:</strong> {sections.readinessGateResult?.reason || "Pending gate check."}
                    </p>

                    {Array.isArray(sections.readinessGateResult?.limitationsDisclosed) && sections.readinessGateResult.limitationsDisclosed.length > 0 && (
                      <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "rgba(245, 158, 11, 0.08)", border: "1px dashed rgba(245, 158, 11, 0.4)", marginBottom: "12px" }}>
                        <strong className="font-mono" style={{ fontSize: "0.78rem", color: "#fbbf24", display: "block", marginBottom: "6px" }}>
                          Disclosed Evidentiary Limitations:
                        </strong>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                          {sections.readinessGateResult.limitationsDisclosed.map((lim, lIdx) => (
                            <li key={lIdx}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: USER REVIEW & SUBMISSION */}
              {activeTab === "review" && (
                <form onSubmit={handleSubmitReview} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                      Section 11: Consumer Review & Docket Corrections
                    </span>
                    <p className="font-mono text-muted" style={{ fontSize: "0.82rem", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                      You may add explanatory notes or factual corrections to this structured docket before AI 2.0 generates the Grounded Legal Assessment and Final Case Outcome. If material answers change later, downstream findings will be automatically flagged as outdated.
                    </p>

                    <label className="font-mono text-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "6px" }}>
                      FACTUAL CORRECTION NOTES / REVIEW CONFIRMATION
                    </label>
                    <textarea
                      rows={4}
                      value={correctionNote}
                      onChange={(e) => setCorrectionNote(e.target.value)}
                      placeholder="e.g. Verified: The technician verbal rejection occurred on 15-Jan. Invoice reference is INV-2024-99881. I confirm that all submitted facts are accurate to the best of my knowledge."
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--line)",
                        backgroundColor: "var(--surface)",
                        color: "var(--ink)",
                        fontSize: "0.85rem",
                        fontFamily: "var(--font-mono)",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-outline-brass font-mono"
                      style={{ padding: "10px 20px" }}
                    >
                      Close Without Saving
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-brass font-mono"
                      style={{ padding: "10px 24px", fontWeight: "bold" }}
                    >
                      {submitting ? "Saving Docket..." : "✓ Confirm & Save Transfer Review"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
