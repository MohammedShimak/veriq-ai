import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BRAND from "../config/brand";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1 }}>
        {/* HERO SECTION */}
        <section
          style={{
            padding: "72px 24px 60px",
            maxWidth: "1160px",
            margin: "0 auto",
            boxSizing: "border-box"
          }}
        >
          <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <span className="veriq-badge veriq-badge-blue font-sans">
                {BRAND.name} • Consumer Legal Intelligence
              </span>
              <span className="font-sans text-muted" style={{ fontSize: "0.8rem" }}>
                Under India's Consumer Protection Act, 2019
              </span>
            </div>

            <h1
              className="font-sans"
              style={{
                fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)",
                fontWeight: "800",
                lineHeight: "1.15",
                letterSpacing: "-0.03em",
                color: "var(--ink)",
                margin: "0 0 20px 0"
              }}
            >
              {BRAND.headline}
            </h1>

            <p
              className="font-sans"
              style={{
                fontSize: "1.1rem",
                lineHeight: "1.6",
                color: "var(--ink-muted)",
                margin: "0 0 32px 0",
                maxWidth: "680px",
                marginLeft: "auto",
                marginRight: "auto"
              }}
            >
              {BRAND.heroSupport}
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", flexWrap: "wrap", marginBottom: "36px" }}>
              <Link
                to="/start-case"
                className="btn-veriq-primary font-sans"
                style={{ padding: "14px 28px", fontSize: "0.98rem", fontWeight: "600" }}
              >
                Start Your Case →
              </Link>

              <Link
                to="/consumer-rights"
                className="btn-veriq-secondary font-sans"
                style={{ padding: "14px 24px", fontSize: "0.95rem" }}
              >
                Explore Consumer Rights
              </Link>
            </div>

            {/* Quick trust metrics line */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "24px",
                padding: "10px 20px",
                borderRadius: "30px",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--line)",
                fontSize: "0.82rem",
                color: "var(--ink-muted)"
              }}
            >
              <span>⚖️ Statutory CPA 2019 Analysis</span>
              <span>•</span>
              <span>📄 Multi-Document Verification</span>
              <span>•</span>
              <span>🔍 Transparent Contradiction Handling</span>
            </div>
          </div>
        </section>

        {/* METHODOLOGY: HOW THE INVESTIGATION WORKS */}
        <section
          style={{
            padding: "64px 24px",
            backgroundColor: "var(--surface)",
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)"
          }}
        >
          <div style={{ maxWidth: "1140px", margin: "0 auto", boxSizing: "border-box" }}>
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <span className="veriq-badge veriq-badge-teal font-sans" style={{ marginBottom: "8px" }}>
                Methodology
              </span>
              <h2 className="font-sans" style={{ fontSize: "2rem", fontWeight: "700", margin: "0 0 10px 0", letterSpacing: "-0.02em" }}>
                How Veriq Investigates Your Consumer Grievance
              </h2>
              <p className="font-sans" style={{ fontSize: "0.95rem", color: "var(--ink-muted)", margin: 0, maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>
                Our 4-step investigation engine combines factual clarification, document inspection, and statutory research into an objective preliminary legal assessment.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
              {[
                {
                  step: "01",
                  title: "Describe the Complaint",
                  desc: "Submit your dispute chronology, opposite party details, purchase date, and claim value through our guided intake.",
                  tag: "Fact Intake"
                },
                {
                  step: "02",
                  title: "Answer Questions & Provide Evidence",
                  desc: "Veriq formulates complaint-specific follow-ups and inspects tax invoices, payment slips, defect photos, and communication logs.",
                  tag: "Multi-Document Inspection"
                },
                {
                  step: "03",
                  title: "Review Law, Policies & Contradictions",
                  desc: "We research seller policies, cross-reference CPA 2019 provisions, and isolate factual discrepancies with balanced evaluation.",
                  tag: "Materiality Analysis"
                },
                {
                  step: "04",
                  title: "Receive Grounded Assessment",
                  desc: "Access a 15-section case dossier detailing established facts, bilateral arguments, statutory remedies under Section 39, and next steps.",
                  tag: "Actionable Outcome"
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="veriq-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "24px"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <span
                        className="font-sans"
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: "800",
                          color: "var(--veriq-blue)"
                        }}
                      >
                        {item.step}
                      </span>
                      <span className="veriq-badge veriq-badge-slate font-sans">
                        {item.tag}
                      </span>
                    </div>
                    <h3 className="font-sans" style={{ fontSize: "1.08rem", fontWeight: "700", margin: "0 0 8px 0" }}>
                      {item.title}
                    </h3>
                    <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* EVIDENCE TRANSPARENCY, BALANCED ANALYSIS & LIMITATIONS */}
        <section
          style={{
            padding: "64px 24px",
            maxWidth: "1140px",
            margin: "0 auto",
            boxSizing: "border-box"
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "44px" }}>
            <span className="veriq-badge veriq-badge-blue font-sans" style={{ marginBottom: "8px" }}>
              Core Principles
            </span>
            <h2 className="font-sans" style={{ fontSize: "2rem", fontWeight: "700", margin: "0 0 10px 0", letterSpacing: "-0.02em" }}>
              Designed for Evidentiary Rigor & Objectivity
            </h2>
            <p className="font-sans" style={{ fontSize: "0.95rem", color: "var(--ink-muted)", margin: 0, maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>
              Veriq avoids superficial AI summaries. Every finding is tied to verified documents, statutory definitions, and transparent limits.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            <div className="veriq-card" style={{ padding: "28px" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: "14px" }}>📋</div>
              <h3 className="font-sans" style={{ fontSize: "1.15rem", fontWeight: "700", margin: "0 0 8px 0" }}>
                Strict Evidentiary Provenance
              </h3>
              <p className="font-sans" style={{ fontSize: "0.88rem", color: "var(--ink-muted)", lineHeight: "1.55", margin: 0 }}>
                Allegations are kept distinct from verified documentation. If an essential fact lacks documentary proof, Veriq explicitly tags it as unverified rather than assuming validity.
              </p>
            </div>

            <div className="veriq-card" style={{ padding: "28px" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: "14px" }}>⚖️</div>
              <h3 className="font-sans" style={{ fontSize: "1.15rem", fontWeight: "700", margin: "0 0 8px 0" }}>
                Balanced Bilateral Arguments
              </h3>
              <p className="font-sans" style={{ fontSize: "0.88rem", color: "var(--ink-muted)", lineHeight: "1.55", margin: 0 }}>
                Strong consumer advocacy requires anticipating opposing arguments. Veriq analyzes merchant defenses, return window limits, and warranty conditions to evaluate realistic case merit.
              </p>
            </div>

            <div className="veriq-card" style={{ padding: "28px" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: "14px" }}>🔄</div>
              <h3 className="font-sans" style={{ fontSize: "1.15rem", fontWeight: "700", margin: "0 0 8px 0" }}>
                Uncertainty & Contradiction Handling
              </h3>
              <p className="font-sans" style={{ fontSize: "0.88rem", color: "var(--ink-muted)", lineHeight: "1.55", margin: 0 }}>
                When claims and seller records conflict, our engine evaluates materiality. Unresolved contradictions temper the outcome confidence rather than causing system deadlock or false certainty.
              </p>
            </div>
          </div>
        </section>

        {/* CALL TO ACTION & TRANSPARENCY NOTICE */}
        <section
          style={{
            padding: "50px 24px 64px",
            backgroundColor: "var(--surface)",
            borderTop: "1px solid var(--line)"
          }}
        >
          <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center", boxSizing: "border-box" }}>
            <h2 className="font-sans" style={{ fontSize: "1.85rem", fontWeight: "700", margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>
              Ready to Investigate Your Consumer Dispute?
            </h2>
            <p className="font-sans" style={{ fontSize: "0.95rem", color: "var(--ink-muted)", margin: "0 0 28px 0", maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>
              Organize your evidence, examine statutory consumer rights under CPA 2019, and understand your preliminary legal standing.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginBottom: "36px" }}>
              <Link to="/start-case" className="btn-veriq-primary font-sans" style={{ padding: "12px 26px" }}>
                Start a Case Now →
              </Link>
              <Link to="/help-hub" className="btn-veriq-secondary font-sans" style={{ padding: "12px 22px" }}>
                Browse Consumer Help Hub
              </Link>
            </div>

            {/* Non-Binding Disclaimer Notice */}
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "10px",
                backgroundColor: "var(--veriq-blue-subtle)",
                border: "1px solid rgba(39, 133, 216, 0.25)",
                fontSize: "0.8rem",
                color: "var(--ink-muted)",
                lineHeight: "1.5",
                textAlign: "left"
              }}
            >
              <strong style={{ color: "var(--veriq-blue)" }}>Important Legal Notice:</strong> {BRAND.name} is an AI-powered dispute intelligence and preliminary analytical platform. Assessments are informational, non-binding evaluations grounded in the Consumer Protection Act, 2019 and available evidence. Veriq does not provide formal legal representation, guarantee judicial verdicts, or substitute for consultation with an enrolled advocate.
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "32px 24px",
          backgroundColor: "var(--bg)",
          fontSize: "0.82rem",
          color: "var(--ink-muted)"
        }}
      >
        <div
          style={{
            maxWidth: "1140px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px"
          }}
        >
          <div>
            <span style={{ fontWeight: "700", color: "var(--ink)" }}>{BRAND.name}</span> • {BRAND.subTagline}
          </div>
          <div style={{ display: "flex", gap: "18px" }}>
            <Link to="/" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Home</Link>
            <Link to="/help-hub" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Consumer Help Hub</Link>
            <Link to="/consumer-rights" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Consumer Rights</Link>
            <Link to="/legal-resources" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Legal Resources</Link>
            <Link to="/start-case" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Start a Case</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}