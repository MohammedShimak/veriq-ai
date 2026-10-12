import React, { useState } from "react";
import Navbar from "../components/Navbar";
import ErrorBanner from "../components/ErrorBanner";
import { submitFeedbackApi } from "../services/feedbackApi";
import { useAuth } from "../context/AuthContext";

export default function AboutUs() {
  const { accessToken } = useAuth();

  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!rating) return;
    setLoading(true);
    setError(null);
    try {
      await submitFeedbackApi("general", 0, rating, comment, accessToken);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: "1000px", margin: "0 auto", padding: "48px 24px", width: "100%", boxSizing: "border-box" }}>
        {/* Page Hero Header */}
        <div style={{ textAlign: "center", marginBottom: "42px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <span
              className="font-mono text-brass"
              style={{
                display: "inline-block",
                padding: "5px 16px",
                borderRadius: "20px",
                backgroundColor: "var(--brass-light)",
                border: "1px solid var(--line-bright)",
                fontSize: "0.82rem",
                fontWeight: "bold"
              }}
            >
              ⚖️ ABOUT NEEDHIAI (நீதி AI)
            </span>
            <span
              className="font-serif text-muted"
              style={{ fontSize: "0.82rem", fontStyle: "italic", opacity: 0.9 }}
            >
              "அறநெறி முதற்றே அரசின் கொற்றம்"
            </span>
          </div>

          <h1 className="font-serif text-brass" style={{ fontSize: "2.6rem", margin: "6px 0 14px 0", letterSpacing: "0.5px" }}>
            NeedhiAI: Legal Intelligence & Dispute Adjudication
          </h1>

          <p className="font-serif text-muted" style={{ fontSize: "1.1rem", maxWidth: "750px", margin: "0 auto", lineHeight: "1.7" }}>
            An autonomous multi-agent adversarial debate and statutory grounding system built for 
            the <strong>Indian Consumer Protection Act, 2019</strong>.
          </p>
        </div>

        <ErrorBanner message={error} onClose={() => setError(null)} />

        {/* Mission Statement Hero Card */}
        <div
          style={{
            padding: "32px",
            borderRadius: "16px",
            border: "1px solid var(--line)",
            borderTop: "4px solid var(--brass)",
            backgroundColor: "var(--surface)",
            boxShadow: "0 6px 22px rgba(0,0,0,0.12)",
            marginBottom: "32px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <span style={{ fontSize: "1.6rem" }}>🏛️</span>
            <h2 className="font-serif text-brass" style={{ fontSize: "1.4rem", margin: 0 }}>
              Our Mission & Philosophy
            </h2>
          </div>
          <p className="font-sans text-muted" style={{ fontSize: "1rem", lineHeight: "1.8", margin: "0 0 18px 0" }}>
            In traditional legal workflows, consumer disputes often suffer from evidentiary ambiguity, procedural delays, and high representation costs. 
            <strong> NeedhiAI (நீதி)</strong> was developed to democratize statutory dispute assessment by transforming complex legal statutes into an interactive, dialectical courtroom simulation.
          </p>
          <p className="font-sans text-muted" style={{ fontSize: "0.98rem", lineHeight: "1.8", margin: "0 0 20px 0" }}>
            By deploying dual adversarial counsel agents — a <strong>Petitioner Counsel (Support Agent)</strong> and a <strong>Respondent Counsel (Oppose Agent)</strong> — overseen by an impartial <strong>Judicial Bench Engine</strong>, NeedhiAI balances the evidentiary scales of justice and provides grounded, hallucination-free legal guidance.
          </p>
          
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px solid var(--line)" }}>
            <span className="font-mono text-brass" style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", fontSize: "0.8rem" }}>
              📜 CPA 2019 Statutory Corpus
            </span>
            <span className="font-mono text-brass" style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", fontSize: "0.8rem" }}>
              🔍 Closed-Book FAISS RAG (768-dim)
            </span>
            <span className="font-mono text-brass" style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", fontSize: "0.8rem" }}>
              🛡️ 2-Layer Grounding Validator
            </span>
            <span className="font-mono text-brass" style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", fontSize: "0.8rem" }}>
              ⚡ Live Indian Kanoon Integration
            </span>
          </div>
        </div>

        {/* 3 Core Architecture Pillars */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "20px", marginBottom: "36px" }}>
          <div
            style={{
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--surface)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
            }}
          >
            <div style={{ fontSize: "1.8rem", marginBottom: "12px" }}>⚔️</div>
            <h3 className="font-serif text-brass" style={{ fontSize: "1.15rem", margin: "0 0 8px 0" }}>
              Adversarial Debate
            </h3>
            <p className="font-sans text-muted" style={{ fontSize: "0.88rem", lineHeight: "1.6", margin: 0 }}>
              Eliminates single-agent bias by pitting opposing statutory arguments against each other using IRAC (Issue, Rule, Application, Conclusion) legal reasoning.
            </p>
          </div>

          <div
            style={{
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--surface)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
            }}
          >
            <div style={{ fontSize: "1.8rem", marginBottom: "12px" }}>🔬</div>
            <h3 className="font-serif text-brass" style={{ fontSize: "1.15rem", margin: "0 0 8px 0" }}>
              Zero-Hallucination Grounding
            </h3>
            <p className="font-sans text-muted" style={{ fontSize: "0.88rem", lineHeight: "1.6", margin: 0 }}>
              Layer 1 regex cross-reference and Layer 2 Natural Language Inference (NLI) entailment ensure all section citations match authentic consumer protection statutes.
            </p>
          </div>

          <div
            style={{
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--surface)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
            }}
          >
            <div style={{ fontSize: "1.8rem", marginBottom: "12px" }}>⚖️</div>
            <h3 className="font-serif text-brass" style={{ fontSize: "1.15rem", margin: "0 0 8px 0" }}>
              Judicial Bench Synthesis
            </h3>
            <p className="font-sans text-muted" style={{ fontSize: "0.88rem", lineHeight: "1.6", margin: 0 }}>
              An impartial judicial agent calculates probabilistic weight, identifies proof deficits, and produces enforceable, PDF-exportable court decisions.
            </p>
          </div>
        </div>

        {/* Developer & Creator Profile Card (Customizable) */}
        <div
          style={{
            padding: "28px 32px",
            borderRadius: "16px",
            border: "1px solid var(--line)",
            borderLeft: "5px solid var(--brass)",
            backgroundColor: "var(--surface)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
            marginBottom: "32px"
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
            <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  backgroundColor: "var(--brass-light)",
                  border: "2px solid var(--brass)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                  flexShrink: 0
                }}
              >
                ⚖️
              </div>
              <div>
                <span className="font-mono text-brass" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold" }}>
                  Creator & Lead Developer
                </span>
                <h3 className="font-serif text-brass" style={{ fontSize: "1.45rem", margin: "4px 0 6px 0" }}>
                  NeedhiAI Research & Engineering Team
                </h3>
                <p className="font-sans text-muted" style={{ fontSize: "0.92rem", margin: 0, lineHeight: "1.5" }}>
                  Full-Stack AI Engineering & Indian Legal Tech Innovation
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span
                className="font-mono"
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  color: "var(--support-green-bright)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  fontSize: "0.78rem",
                  fontWeight: "bold"
                }}
              >
                ● ACTIVE PROJECT
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid var(--line)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px"
            }}
          >
            <div>
              <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", display: "block" }}>
                Primary Focus
              </span>
              <span className="font-sans" style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--ink)" }}>
                Multi-Agent RAG & Legal Reasoning
              </span>
            </div>
            <div>
              <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", display: "block" }}>
                Target Jurisdiction
              </span>
              <span className="font-sans" style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--ink)" }}>
                Consumer Protection Act, 2019 (India)
              </span>
            </div>
            <div>
              <span className="font-mono text-muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", display: "block" }}>
                Stack Architecture
              </span>
              <span className="font-sans" style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--ink)" }}>
                React 19 • Express 5 • FAISS • Gemini
              </span>
            </div>
          </div>
        </div>

        {/* Contact Info Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "36px" }}>
          <div
            style={{
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--surface)",
              boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              gap: "16px"
            }}
          >
            <div style={{ fontSize: "2rem" }}>📧</div>
            <div>
              <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>
                Official Project Contact
              </span>
              <a href="mailto:contact@needhiai.dev" className="font-mono text-brass" style={{ fontSize: "0.92rem", textDecoration: "none", fontWeight: "bold" }}>
                contact@needhiai.dev
              </a>
            </div>
          </div>

          <div
            style={{
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--surface)",
              boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              gap: "16px"
            }}
          >
            <div style={{ fontSize: "2rem" }}>📞</div>
            <div>
              <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>
                National Consumer Helpline (NCH)
              </span>
              <span className="font-mono text-brass" style={{ fontSize: "0.92rem", fontWeight: "bold" }}>
                1915 / 1800-11-4000
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--surface)",
              boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              gap: "16px"
            }}
          >
            <div style={{ fontSize: "2rem" }}>📍</div>
            <div>
              <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>
                Jurisdiction & Region
              </span>
              <span className="font-sans text-brass" style={{ fontSize: "0.92rem", fontWeight: "bold" }}>
                Tamil Nadu & All-India Consumer Fora
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Section at the Bottom */}
        <div
          style={{
            padding: "32px",
            borderRadius: "16px",
            border: "1px solid var(--line)",
            borderTop: "4px solid var(--brass)",
            backgroundColor: "var(--surface)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)"
          }}
        >
          <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "20px" }}>
            <h2 className="font-serif text-brass" style={{ fontSize: "1.35rem", margin: "0 0 4px 0" }}>
              💬 Submit User Feedback to NeedhiAI
            </h2>
            <p className="font-mono text-muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              Your feedback is audited continuously by administrators to align model adjudication accuracy.
            </p>
          </div>

          {submitted ? (
            <div
              className="font-mono"
              style={{
                padding: "20px",
                borderRadius: "10px",
                backgroundColor: "var(--support-bg)",
                border: "1px solid var(--support-green)",
                color: "var(--support-green-bright)",
                textAlign: "center",
                fontSize: "0.95rem"
              }}
            >
              ✓ Thank you! Your feedback has been recorded and submitted to the Admin portal.
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label className="font-mono text-muted" style={{ display: "block", fontSize: "0.82rem", marginBottom: "10px" }}>
                  How would you rate your legal debate experience with NeedhiAI? *
                </label>
                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setRating("up")}
                    className="font-mono"
                    style={{
                      flex: 1,
                      minWidth: "160px",
                      padding: "12px 18px",
                      borderRadius: "8px",
                      border: rating === "up" ? "2px solid var(--support-green)" : "1px solid var(--line)",
                      backgroundColor: rating === "up" ? "var(--support-bg)" : "var(--bg)",
                      color: rating === "up" ? "var(--support-green-bright)" : "var(--ink-muted)",
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    👍 Positive (Statutorily Accurate)
                  </button>

                  <button
                    type="button"
                    onClick={() => setRating("down")}
                    className="font-mono"
                    style={{
                      flex: 1,
                      minWidth: "160px",
                      padding: "12px 18px",
                      borderRadius: "8px",
                      border: rating === "down" ? "2px solid var(--oppose-oxblood)" : "1px solid var(--line)",
                      backgroundColor: rating === "down" ? "var(--oppose-bg)" : "var(--bg)",
                      color: rating === "down" ? "var(--oppose-oxblood-bright)" : "var(--ink-muted)",
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    👎 Needs Improvement
                  </button>
                </div>
              </div>

              <div>
                <label className="font-mono text-muted" style={{ display: "block", fontSize: "0.82rem", marginBottom: "8px" }}>
                  Comments / Suggestions for Admin Review
                </label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience, feature requests, or legal reasoning feedback..."
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid var(--line)",
                    backgroundColor: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "0.92rem",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!rating || loading}
                className="btn-brass font-mono"
                style={{
                  alignSelf: "flex-start",
                  padding: "12px 28px",
                  fontSize: "0.88rem",
                  fontWeight: "bold",
                  opacity: (!rating || loading) ? 0.5 : 1,
                  boxShadow: "0 4px 14px rgba(201, 164, 94, 0.3)"
                }}
              >
                {loading ? "Submitting..." : "Submit Feedback to Admin →"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
