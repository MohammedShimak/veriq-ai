import React, { useState } from "react";
import Navbar from "../components/Navbar";
import BalanceBar from "../components/BalanceBar";

export default function HowItWorks() {
  const [sliderPos, setSliderPos] = useState(0.0);

  const modules = [
    {
      icon: "🎯",
      title: "1. Intent Classifier Agent",
      desc: "Analyzes user query and maps dispute facts into the Consumer Protection Act, 2019 legal ontology and jurisdiction."
    },
    {
      icon: "📋",
      title: "2. Case Reasoning Agent",
      desc: "Extracts key legal issues, material facts, and required statutory elements prior to hybrid vector knowledge retrieval."
    },
    {
      icon: "🔍",
      title: "3. Closed-Book FAISS RAG",
      desc: "Searches 3,638 normalized statutory chunks and precedents to guarantee factual grounding and prevent LLM hallucinations."
    },
    {
      icon: "⚖️",
      title: "4. Petitioner Counsel Agent (Support)",
      desc: "Constructs statutory claims and precedent arguments advocating for the consumer under Section 39."
    },
    {
      icon: "🛡️",
      title: "5. Respondent Counsel Agent (Oppose)",
      desc: "Constructs defense arguments invoking statutory liability exceptions under Section 87."
    },
    {
      icon: "📜",
      title: "6. Judicial Bench Agent (Judge)",
      desc: "Weighs opposing claims using IRAC reasoning, applies grounding audits, and issues the final court order."
    }
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: "1100px", margin: "0 auto", padding: "40px 24px", width: "100%", boxSizing: "border-box" }}>
        {/* Title Header */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <span
            className="font-mono text-brass"
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: "20px",
              backgroundColor: "var(--brass-light)",
              border: "1px solid var(--line-bright)",
              fontSize: "0.78rem",
              fontWeight: "bold",
              marginBottom: "12px"
            }}
          >
            ⚖️ SYSTEM TECHNICAL ARCHITECTURE
          </span>

          <h1 className="font-serif text-brass" style={{ fontSize: "2.5rem", margin: "4px 0 10px 0", letterSpacing: "0.5px" }}>
            How NeedhiAI (நீதி) Works
          </h1>

          <p className="font-serif text-muted" style={{ fontSize: "1.05rem", maxWidth: "680px", margin: "0 auto", lineHeight: "1.6" }}>
            A multi-agent adversarial debate system for consumer dispute adjudication, built on closed-book FAISS RAG and 2-layer statutory grounding.
          </p>
        </div>

        {/* Interactive Balance Bar Demo Card */}
        <div
          style={{
            padding: "32px",
            borderRadius: "16px",
            border: "1px solid var(--line)",
            borderTop: "4px solid var(--brass)",
            backgroundColor: "var(--surface)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            marginBottom: "36px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "20px" }}>
            <h2 className="font-serif text-brass" style={{ fontSize: "1.35rem", margin: 0 }}>
              ⚖️ Interactive Judicial Scale Demo
            </h2>
            <span className="font-mono text-muted" style={{ fontSize: "0.82rem" }}>
              Adjudicated Balance: <strong className="text-brass">{(sliderPos * 100).toFixed(0)}%</strong>
            </span>
          </div>

          <BalanceBar position={sliderPos} label={`Current Position: ${(sliderPos * 100).toFixed(0)}%`} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
              marginTop: "24px",
              padding: "16px 20px",
              borderRadius: "10px",
              backgroundColor: "var(--bg)",
              border: "1px solid var(--line)"
            }}
          >
            <span className="font-mono" style={{ fontSize: "0.78rem", color: "var(--support-green-bright)", fontWeight: "bold" }}>
              ← Petitioner Favored (-1.0)
            </span>

            <input
              type="range"
              min="-1.0"
              max="1.0"
              step="0.05"
              value={sliderPos}
              onChange={(e) => setSliderPos(parseFloat(e.target.value))}
              style={{
                width: "55%",
                height: "8px",
                borderRadius: "4px",
                backgroundColor: "var(--line)",
                accentColor: "var(--brass)",
                cursor: "pointer"
              }}
            />

            <span className="font-mono" style={{ fontSize: "0.78rem", color: "var(--oppose-oxblood-bright)", fontWeight: "bold" }}>
              Respondent Favored (+1.0) →
            </span>
          </div>
        </div>

        {/* 6 Core Modules Breakdown */}
        <div style={{ marginBottom: "36px" }}>
          <h2 className="font-serif text-brass" style={{ fontSize: "1.6rem", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "24px" }}>
            🤖 6 Specialized Sub-Agents Architecture
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            {modules.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: "24px",
                  borderRadius: "14px",
                  border: "1px solid var(--line)",
                  borderLeft: "4px solid var(--brass)",
                  backgroundColor: "var(--surface)",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.5rem" }}>{m.icon}</span>
                  <h3 className="font-serif text-brass" style={{ fontSize: "1.15rem", margin: 0, fontWeight: "600" }}>
                    {m.title}
                  </h3>
                </div>

                <p className="font-sans text-muted" style={{ fontSize: "0.92rem", lineHeight: "1.6", margin: 0 }}>
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Layer Statutory Validation Overview */}
        <div
          style={{
            padding: "28px",
            borderRadius: "14px",
            border: "1px solid var(--line)",
            backgroundColor: "var(--surface)",
            boxShadow: "0 4px 18px rgba(0,0,0,0.12)"
          }}
        >
          <h2 className="font-serif text-brass" style={{ fontSize: "1.35rem", margin: "0 0 16px 0" }}>
            🛡️ 2-Layer Statutory Grounding & Anti-Hallucination Pipeline
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
              <span className="font-mono text-brass" style={{ fontSize: "0.78rem", fontWeight: "bold", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                Layer 1: NLI Entailment
              </span>
              <p className="font-sans text-muted" style={{ fontSize: "0.88rem", margin: 0, lineHeight: "1.5" }}>
                Validates argument premises against retrieved statutory sections using Natural Language Inference entailment scores.
              </p>
            </div>

            <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
              <span className="font-mono text-brass" style={{ fontSize: "0.78rem", fontWeight: "bold", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                Layer 2: Grounding Verification
              </span>
              <p className="font-sans text-muted" style={{ fontSize: "0.88rem", margin: 0, lineHeight: "1.5" }}>
                Audits all citations and precedent case references against the verified FAISS vector database to prevent invented legal claims.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
