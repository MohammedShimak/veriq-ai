import LiveLawBadge from "./LiveLawBadge";
export default function JudgeCard({ data }) {
  if (!data) return null;

  const keyIssues = Array.isArray(data.key_legal_issues) ? data.key_legal_issues : [];
  const availableEv = Array.isArray(data.available_evidence) ? data.available_evidence : [];
  const notProvidedEv = Array.isArray(data.not_provided_evidence) ? data.not_provided_evidence : [];
  const outcomeChangingEv = Array.isArray(data.outcome_changing_evidence) ? data.outcome_changing_evidence : [];
  const sourcesList = Array.isArray(data.sources) ? data.sources : [];

  const assessment = data.current_assessment || data.decision || "🟢 Consumer case stronger";
  
  const assessmentColor =
    assessment.includes("Consumer")
      ? "#52B788"
      : assessment.includes("Respondent")
      ? "#E63946"
      : "#C9A961";

  const predJudgment = data.predicted_judgment || {
    verdict_title: assessment.includes("Respondent") || assessment.includes("gap")
      ? "🔴 Preliminary AI-Assisted Case Assessment: Evidentiary Gaps Noted in Claim"
      : assessment.includes("depends") || assessment.includes("proof")
      ? "🟡 Preliminary AI-Assisted Case Assessment: Outcome Depends on Evidence and Technical Proof"
      : "🟢 Preliminary AI-Assisted Case Assessment: Consumer Position Supported on Intake Facts",
    ruling_summary: data.assessment_explanation || "Preliminary analytical assessment indicates potential deficiency or defect under Consumer Protection Act, 2019, subject to formal documentary proof.",
    relief_awarded: Array.isArray(data.relief) && data.relief.length > 0 ? data.relief : [
      "1. Potential refund of purchase consideration under Section 39(1)(c), subject to proof of irreparable defect.",
      "2. Potential repair or replacement under Section 39(1)(a)/(b), subject to technical inspection.",
      "3. Reasonable compensation for distress under Section 39(1)(d), subject to proof of actual pecuniary loss and Commission discretion (no specific amount can be determined prior to formal adjudication)."
    ],
    statutory_sections_applied: ["Section 2(10) Defect in Goods", "Section 2(11) Deficiency of Service", "Section 39 Orders of District Commission"],
    final_orders: "Procedural Note: This assessment is an analytical aid for consumer dispute resolution under CPA 2019 and does not constitute a judicial order or decree. Binding relief and compensation reside exclusively with the competent Consumer Commission."
  };

  const reliefList = Array.isArray(predJudgment.relief_awarded) ? predJudgment.relief_awarded : (Array.isArray(data.relief) ? data.relief : []);

  return (
    <div className="docket-card bench-panel" style={{ marginTop: "24px", borderTop: `4px solid ${assessmentColor}` }}>
      
      {/* ⚖️ CASE SUMMARY */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ fontSize: "1.4rem" }}>⚖️</span>
          <h3 className="font-serif text-brass" style={{ margin: 0, fontSize: "1.2rem", letterSpacing: "0.5px" }}>
            CASE SUMMARY
          </h3>
        </div>
        <p style={{ fontSize: "0.98rem", color: "var(--text-parchment)", lineHeight: "1.6", margin: 0, fontStyle: "italic", backgroundColor: "var(--surface-hover)", padding: "12px 14px", borderRadius: "6px", borderLeft: "3px solid var(--accent-brass)" }}>
          "{data.case_summary || "Consumer dispute submitted under Consumer Protection Act, 2019."}"
        </p>
      </div>

      {/* 📌 KEY LEGAL ISSUES */}
      {keyIssues.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div className="font-mono text-brass" style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
            📌 KEY LEGAL ISSUES ANALYZED
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {keyIssues.map((issue, idx) => (
              <div key={idx} style={{ padding: "8px 12px", backgroundColor: "var(--surface)", borderRadius: "6px", border: "1px solid var(--border-hairline)", fontSize: "0.92rem", color: "var(--text-parchment)" }}>
                <strong>{idx + 1}.</strong> {issue}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DUAL COUNSEL ARGUMENTS (🟢 CONSUMER vs 🔴 RESPONDENT) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        
        {/* 🟢 CONSUMER ARGUMENT */}
        <div style={{ padding: "14px", backgroundColor: "var(--support-bg)", borderRadius: "6px", border: "1px solid var(--support-green)" }}>
          <div className="font-mono" style={{ color: "var(--support-green-bright)", fontSize: "0.82rem", textTransform: "uppercase", marginBottom: "6px", fontWeight: "bold" }}>
            🟢 PETITIONER ARGUMENT SUMMARY
          </div>
          <p style={{ fontSize: "0.92rem", color: "var(--text-parchment)", margin: 0, lineHeight: "1.5" }}>
            {data.consumer_argument || "Asserts statutory remedy under Consumer Protection Act, 2019."}
          </p>
        </div>

        {/* 🔴 RESPONDENT ARGUMENT */}
        <div style={{ padding: "14px", backgroundColor: "var(--oppose-bg)", borderRadius: "6px", border: "1px solid var(--oppose-oxblood)" }}>
          <div className="font-mono" style={{ color: "var(--oppose-oxblood-bright)", fontSize: "0.82rem", textTransform: "uppercase", marginBottom: "6px", fontWeight: "bold" }}>
            🔴 RESPONDENT ARGUMENT SUMMARY
          </div>
          <p style={{ fontSize: "0.92rem", color: "var(--text-parchment)", margin: 0, lineHeight: "1.5" }}>
            {data.respondent_argument || "Asserts warranty terms exclusion or evidentiary failure by complainant."}
          </p>
        </div>

      </div>

      {/* 📄 EVIDENCE STATUS */}
      <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border-hairline)" }}>
        <div className="font-mono text-brass" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
          📄 EVIDENCE STATUS & EVALUATION
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "14px", fontSize: "0.88rem" }}>
          {/* ✅ Available */}
          <div>
            <strong style={{ color: "var(--support-green-bright)" }}>✅ Available Evidence:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0, color: "var(--text-parchment)" }}>
              {availableEv.length > 0 ? availableEv.map((item, i) => <li key={i}>{item}</li>) : <li>Factually asserted in claim statement.</li>}
            </ul>
          </div>

          {/* ❌ Not Provided */}
          <div>
            <strong style={{ color: "var(--oppose-oxblood-bright)" }}>❌ Not Provided:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0, color: "var(--text-muted)" }}>
              {notProvidedEv.length > 0 ? (
                notProvidedEv.map((item, i) => <li key={i}>{item}</li>)
              ) : (
                <li>Unsupplied key evidence items.</li>
              )}
            </ul>
          </div>
        </div>

        {/* ⚠️ OUTCOME-CHANGING EVIDENCE */}
        {outcomeChangingEv.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: "12px", marginTop: "8px", fontSize: "0.88rem" }}>
            <strong style={{ color: "var(--brass)" }}>⚠️ OUTCOME-CHANGING EVIDENCE:</strong>
            <ul style={{ margin: "6px 0 0 16px", padding: 0, color: "var(--text-parchment)" }}>
              {outcomeChangingEv.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* ⚖️ PREDICTED JUDGMENT & FINAL VERDICT CARD */}
      <div
        style={{
          padding: "24px",
          backgroundColor: "var(--surface)",
          borderRadius: "14px",
          border: `2px solid ${assessmentColor}`,
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
          marginBottom: "24px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: `1px solid ${assessmentColor}`, paddingBottom: "10px" }}>
          <h3 className="font-serif" style={{ fontSize: "1.3rem", color: assessmentColor, margin: 0, fontWeight: "bold" }}>
            ⚖️ PRELIMINARY AI-ASSISTED CASE ASSESSMENT
          </h3>
          <span className="font-mono" style={{ backgroundColor: "var(--brass-light)", color: assessmentColor, padding: "4px 12px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold", border: `1px solid ${assessmentColor}` }}>
            PRELIMINARY EVALUATION
          </span>
        </div>

        <div className="font-serif text-brass" style={{ fontSize: "1.15rem", fontWeight: "bold", marginBottom: "10px" }}>
          {predJudgment.verdict_title || assessment}
        </div>

        <p style={{ fontSize: "0.98rem", color: "var(--text-parchment)", margin: "0 0 16px 0", lineHeight: "1.6" }}>
          {predJudgment.ruling_summary || data.assessment_explanation || data.decision_explanation}
        </p>

        {/* STATUTORY RELIEF / REMEDIES LIST */}
        {reliefList.length > 0 && (
          <div style={{ marginBottom: "16px", padding: "14px", backgroundColor: "var(--brass-light)", borderRadius: "8px", border: "1px solid var(--border-hairline-bright)" }}>
            <div className="font-mono text-brass" style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", fontWeight: "bold" }}>
              🎯 POSSIBLE REMEDIES FOR CONSIDERATION (UNDER SECTION 39 CPA 2019):
            </div>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.92rem", color: "var(--text-parchment)", lineHeight: "1.6" }}>
              {reliefList.map((r, i) => (
                <li key={i} style={{ marginBottom: "6px" }}>
                  <strong>{typeof r === "string" ? r : `Possible Remedy ${i + 1}`}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PROCEDURAL NOTE & NON-JUDICIAL DISCLAIMER */}
        <div className="font-mono text-muted" style={{ fontSize: "0.84rem", fontStyle: "italic", borderLeft: `3px solid ${assessmentColor}`, paddingLeft: "12px" }}>
          <strong>ℹ️ Procedural Notice:</strong> {predJudgment.final_orders || "NeedhiAI provides preliminary decision support and does not issue court orders or binding judicial decrees. Relief, compensation amounts, and interest are subject to the exclusive jurisdiction of the competent Consumer Disputes Redressal Commission."}
        </div>
      </div>

      {/* Verified Legal Sources Traceability */}
      {sourcesList.length > 0 && (
        <div style={{ padding: "12px 14px", backgroundColor: "var(--surface)", borderRadius: "6px", border: "1px solid var(--border-hairline)" }}>
          <div className="font-mono text-brass" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
            📚 Verified Legal Sources & Statutory Provisions ({sourcesList.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {sourcesList.map((src, i) => (
              <span key={i} className="font-mono" style={{ backgroundColor: "var(--brass-light)", color: "var(--accent-brass)", padding: "3px 8px", borderRadius: "4px", fontSize: "0.78rem", border: "1px solid var(--accent-brass)" }}>
                📖 {src.title || src.identifier} ({src.identifier || "CPA 2019"})
                {src.live && <LiveLawBadge url={src.source_url} />}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}