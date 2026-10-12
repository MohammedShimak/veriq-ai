export default function OpposeCard({ data }) {
  if (!data) return null;

  const debatePoints = Array.isArray(data.debate_points) ? data.debate_points : [];
  const argsList = Array.isArray(data.arguments) ? data.arguments : [];
  const strengths = Array.isArray(data.overall_strengths) ? data.overall_strengths : [];
  const weaknesses = Array.isArray(data.overall_weaknesses) ? data.overall_weaknesses : [];
  const missingEv = Array.isArray(data.missing_evidence) ? data.missing_evidence : [];

  return (
    <div className="docket-card respondent-panel">
      {/* Panel Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--border-hairline)" }}>
        <h3 className="font-serif" style={{ color: "#F87171", fontSize: "1.15rem", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🔴</span> RESPONDENT COUNSEL (Company Counsel)
        </h3>
        <span className="font-mono" style={{ backgroundColor: "rgba(139, 46, 46, 0.3)", color: "#F87171", padding: "3px 10px", borderRadius: "12px", fontSize: "0.8rem", border: "1px solid rgba(248, 113, 113, 0.4)" }}>
          COUNTER-POINTS ({debatePoints.length || argsList.length})
        </span>
      </div>

      {/* Position */}
      {data.position && (
        <div style={{ marginBottom: "16px" }}>
          <div className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
            Respondent Defense Position
          </div>
          <p style={{ fontSize: "0.95rem", color: "var(--text-parchment)", fontStyle: "italic", margin: 0, lineHeight: "1.5" }}>
            "{data.position}"
          </p>
        </div>
      )}

      {/* Numbered Counter-Debate Points Summary Banner */}
      {debatePoints.length > 0 && (
        <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "rgba(139, 46, 46, 0.18)", borderRadius: "6px", border: "1px solid rgba(248, 113, 113, 0.35)" }}>
          <div className="font-mono" style={{ color: "#F87171", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", fontWeight: "bold" }}>
            🛡️ NUMBERED COUNTER-DEBATE POINTS
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--text-parchment)", fontSize: "0.9rem", lineHeight: "1.6" }}>
            {debatePoints.map((pt, i) => (
              <li key={i} style={{ marginBottom: "4px" }}>
                <strong>{typeof pt === "string" ? pt : `Counter-Point ${i + 1}`}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Arguments List */}
      {argsList.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "16px" }}>
          {argsList.map((arg, idx) => (
            <div key={idx} style={{ padding: "14px", backgroundColor: "rgba(139, 46, 46, 0.12)", borderRadius: "6px", border: "1px solid rgba(248, 113, 113, 0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span className="font-mono" style={{ color: "#F87171", fontSize: "0.85rem", fontWeight: "bold", textTransform: "uppercase" }}>
                  {arg.point_number || `Counter-Point ${idx + 1}`}: {arg.issue || "Defense Rebuttal"}
                </span>
              </div>

              <p style={{ fontSize: "0.95rem", color: "var(--text-parchment)", margin: "0 0 10px 0", lineHeight: "1.5" }}>
                "{arg.argument}"
              </p>

              {/* Legal Basis Badges */}
              {Array.isArray(arg.legal_basis) && arg.legal_basis.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                  {arg.legal_basis.map((lb, i) => (
                    <span key={i} className="font-mono" style={{ backgroundColor: "rgba(139, 46, 46, 0.3)", color: "#F87171", padding: "2px 8px", borderRadius: "4px", fontSize: "0.78rem" }}>
                      📖 {typeof lb === "string" ? lb : lb.section}
                    </span>
                  ))}
                </div>
              )}

              {/* Strengths & Weaknesses */}
              {arg.strength && (
                <div style={{ fontSize: "0.82rem", color: "#fca5a5", marginTop: "4px" }}>
                  🛡️ <strong>Defense Strength:</strong> {arg.strength}
                </div>
              )}
              {arg.weakness && (
                <div style={{ fontSize: "0.82rem", color: "#fcd34d", marginTop: "2px" }}>
                  ⚠️ <strong>Defense Weakness:</strong> {arg.weakness}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Overall Strengths & Weaknesses */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px", fontSize: "0.85rem" }}>
        {strengths.length > 0 && (
          <div style={{ padding: "10px", backgroundColor: "rgba(139, 46, 46, 0.15)", borderRadius: "4px", border: "1px solid rgba(248, 113, 113, 0.3)" }}>
            <strong style={{ color: "#F87171" }}>🛡️ Overall Strengths:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0, color: "var(--text-parchment)" }}>
              {strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {weaknesses.length > 0 && (
          <div style={{ padding: "10px", backgroundColor: "rgba(201, 169, 97, 0.12)", borderRadius: "4px", border: "1px solid var(--border-hairline)" }}>
            <strong style={{ color: "#C9A961" }}>⚠️ Overall Weaknesses:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0, color: "var(--text-parchment)" }}>
              {weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Missing Evidence Required */}
      {missingEv.length > 0 && (
        <div style={{ padding: "10px 14px", backgroundColor: "rgba(139, 46, 46, 0.12)", borderRadius: "4px", border: "1px solid rgba(248, 113, 113, 0.3)" }}>
          <div className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "4px" }}>
            🔍 Documentary Defenses Exploit Gap
          </div>
          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {missingEv.map((me, i) => <li key={i}>{me}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}