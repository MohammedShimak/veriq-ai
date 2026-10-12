import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  getHelpHubIntentsApi,
  getHelpHubCategoriesApi,
  getHelpHubProceduralApi,
  generateHelpHubDraftApi,
  searchHelpHubApi
} from "../services/investigationApi";

export default function HelpHub() {
  const navigate = useNavigate();

  const [intents, setIntents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [procedural, setProcedural] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active state
  const [selectedIntent, setSelectedIntent] = useState("UNDERSTAND_MY_PROBLEM");
  const [selectedCategory, setSelectedCategory] = useState("ecommerce_retail");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Document Drafting State
  const [docType, setDocType] = useState("CONSUMER_COMPLAINT");
  const [draftForm, setDraftForm] = useState({
    consumerName: "",
    consumerAddress: "",
    phone: "",
    email: "",
    companyName: "",
    companyAddress: "",
    productName: "",
    orderId: "",
    transactionDate: "",
    disputedAmount: "",
    problemDescription: "",
    remedySought: "Full refund of amount paid with interest"
  });
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load initial data
  useEffect(() => {
    async function loadHubData() {
      try {
        setLoading(true);
        const [intentsRes, categoriesRes, procRes] = await Promise.all([
          getHelpHubIntentsApi(),
          getHelpHubCategoriesApi(),
          getHelpHubProceduralApi()
        ]);
        if (intentsRes.intents) setIntents(intentsRes.intents);
        if (categoriesRes.categories) setCategories(categoriesRes.categories);
        if (procRes.procedural) setProcedural(procRes.procedural);
      } catch (err) {
        console.error("Error loading Help Hub data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadHubData();
  }, []);

  // Search handler
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      setIsSearching(true);
      const res = await searchHelpHubApi(searchQuery.trim());
      if (res.result) {
        setSearchResults(res.result);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Draft generation handler
  const handleGenerateDraft = async (e) => {
    if (e) e.preventDefault();
    try {
      setGeneratingDraft(true);
      const res = await generateHelpHubDraftApi({
        documentType: docType,
        category: selectedCategory,
        consumerData: draftForm
      });
      if (res.draft) {
        setGeneratedDraft(res.draft);
      }
    } catch (err) {
      console.error("Draft generation failed:", err);
    } finally {
      setGeneratingDraft(false);
    }
  };

  // Copy to clipboard
  const handleCopyDraft = () => {
    if (!generatedDraft?.draftText) return;
    navigator.clipboard.writeText(generatedDraft.draftText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Download draft text
  const handleDownloadDraft = () => {
    if (!generatedDraft?.draftText) return;
    const blob = new Blob([generatedDraft.draftText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `NeedhiAI_${docType}_Draft.txt`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeCategoryObj = categories.find((c) => c.id === selectedCategory) || categories[0] || {};

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "32px 20px" }}>
        {/* Hub Banner */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "4px 14px", borderRadius: "20px", backgroundColor: "rgba(217, 119, 6, 0.12)", border: "1px solid rgba(217, 119, 6, 0.3)", color: "var(--brass)", fontSize: "0.78rem", fontFamily: "var(--font-mono)", marginBottom: "12px" }}>
            <span>🏛️</span>
            <span>INDIAN CONSUMER PROTECTION ACT, 2019 COMPASS</span>
          </div>
          <h1 className="font-serif text-brass" style={{ fontSize: "2.3rem", margin: "0 0 10px 0", letterSpacing: "-0.5px" }}>
            Consumer Help Hub
          </h1>
          <p className="font-mono text-muted" style={{ fontSize: "0.92rem", maxWidth: "680px", margin: "0 auto", lineHeight: "1.6" }}>
            Grounded procedural intelligence, legal document drafting, and multi-stage case investigation for Indian consumer disputes.
          </p>
        </div>

        {/* Global Question / Search Bar */}
        <div
          style={{
            maxWidth: "760px",
            margin: "0 auto 36px auto",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            padding: "8px 12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >
          <span style={{ fontSize: "1.2rem", marginLeft: "6px" }}>🔍</span>
          <input
            type="text"
            placeholder="Search procedures, filing rules, or ask a question (e.g. 'Can I file from home?', 'Limitation deadline')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(e)}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              color: "var(--ink)",
              fontSize: "0.9rem",
              fontFamily: "var(--font-mono)",
              outline: "none"
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="btn-brass font-mono"
            style={{ padding: "8px 18px", fontSize: "0.82rem", borderRadius: "8px" }}
          >
            {isSearching ? "Searching..." : "Search Hub"}
          </button>
        </div>

        {/* Quick Search Chips */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", margin: "-20px 0 32px 0" }}>
          {[
            "Where to file for ₹15 Lakh claim?",
            "What is the limitation deadline?",
            "Can I file online via e-Daakhil?",
            "Is there a court fee for claims under ₹5L?"
          ].map((prompt, pIdx) => (
            <button
              key={pIdx}
              type="button"
              onClick={() => {
                setSearchQuery(prompt);
                setSelectedIntent("LEARN_THE_PROCESS");
              }}
              style={{
                background: "none",
                border: "1px solid var(--line)",
                borderRadius: "16px",
                padding: "3px 12px",
                fontSize: "0.74rem",
                fontFamily: "var(--font-mono)",
                color: "var(--ink-muted)",
                cursor: "pointer"
              }}
            >
              💡 {prompt}
            </button>
          ))}
        </div>

        {/* Search Results Drawer if active */}
        {searchResults && (
          <div
            style={{
              marginBottom: "36px",
              padding: "24px",
              borderRadius: "14px",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--brass)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.2rem" }}>🎯</span>
                <h3 className="font-serif text-brass" style={{ fontSize: "1.15rem", margin: 0 }}>
                  Search Results for "{searchResults.query}"
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSearchResults(null)}
                style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            {/* Matched Categories */}
            {searchResults.matchedCategories?.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                  Relevant Dispute Categories:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {searchResults.matchedCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(c.id);
                        setSelectedIntent("UNDERSTAND_MY_PROBLEM");
                        setSearchResults(null);
                      }}
                      className="font-mono text-brass"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        backgroundColor: "var(--bg)",
                        border: "1px solid var(--brass)",
                        fontSize: "0.78rem",
                        cursor: "pointer"
                      }}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Grounded Procedural Match */}
            {searchResults.proceduralGuidance?.jurisdiction && (
              <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", marginBottom: "12px", fontSize: "0.82rem", fontFamily: "var(--font-mono)" }}>
                <strong style={{ color: "#34D399", display: "block", marginBottom: "4px" }}>
                  ⚖️ {searchResults.proceduralGuidance.jurisdiction.title}:
                </strong>
                <p style={{ margin: "0 0 6px 0", color: "var(--ink)" }}>
                  {searchResults.proceduralGuidance.jurisdiction.territorialRule}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                  {searchResults.proceduralGuidance.jurisdiction.tiers?.map((t, i) => (
                    <span key={i}>• {t.forum}: {t.claimLimit}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4 PRIMARY INTENT CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "36px" }}>
          {[
            { id: "UNDERSTAND_MY_PROBLEM", title: "Understand My Problem", icon: "🔍", desc: "Identify legal rights, violations & evidence to collect by category." },
            { id: "LEARN_THE_PROCESS", title: "Learn The Process", icon: "📖", desc: "Jurisdiction limits, filing fees, limitation deadlines & official portals." },
            { id: "PREPARE_A_DOCUMENT", title: "Prepare a Document", icon: "📝", desc: "Generate structured complaint drafts, grievance emails & notices." },
            { id: "INVESTIGATE_MY_CASE", title: "Investigate My Case", icon: "⚖️", desc: "Start or continue a multi-stage AI factual case investigation." }
          ].map((intent) => {
            const isSelected = selectedIntent === intent.id;
            return (
              <div
                key={intent.id}
                onClick={() => {
                  if (intent.id === "INVESTIGATE_MY_CASE") {
                    navigate("/new-case");
                  } else {
                    setSelectedIntent(intent.id);
                  }
                }}
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  backgroundColor: isSelected ? "var(--surface)" : "var(--bg)",
                  border: isSelected ? "2px solid var(--brass)" : "1px solid var(--line)",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 4px 18px rgba(0,0,0,0.2)" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ fontSize: "1.8rem", marginBottom: "10px" }}>{intent.icon}</div>
                <h3 className="font-serif" style={{ fontSize: "1.1rem", margin: "0 0 6px 0", color: isSelected ? "var(--brass)" : "var(--ink)" }}>
                  {intent.title}
                </h3>
                <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: 0, lineHeight: "1.5" }}>
                  {intent.desc}
                </p>
                {intent.id === "INVESTIGATE_MY_CASE" && (
                  <span className="font-mono text-brass" style={{ fontSize: "0.72rem", display: "block", marginTop: "10px", fontWeight: "bold" }}>
                    Start Formal Investigation →
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* INTENT 1: UNDERSTAND MY PROBLEM */}
        {/* ======================================================== */}
        {selectedIntent === "UNDERSTAND_MY_PROBLEM" && (
          <div>
            <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "20px" }}>
              <h2 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: "0 0 4px 0" }}>
                Select Dispute Category to View Rights & Evidence Checklist
              </h2>
              <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                Every consumer sector has distinct statutory rules, authorities, and evidentiary standards under Indian Law.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontFamily: "var(--font-mono)",
                    backgroundColor: selectedCategory === cat.id ? "var(--brass)" : "var(--surface)",
                    color: selectedCategory === cat.id ? "var(--bg)" : "var(--ink-muted)",
                    border: selectedCategory === cat.id ? "1px solid var(--brass)" : "1px solid var(--line)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            {/* Selected Category Details Card */}
            {activeCategoryObj.name && (
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "26px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.8rem" }}>{activeCategoryObj.icon}</span>
                    <div>
                      <h3 className="font-serif text-brass" style={{ fontSize: "1.35rem", margin: 0 }}>
                        {activeCategoryObj.name}
                      </h3>
                      <span className="font-mono text-muted" style={{ fontSize: "0.78rem" }}>
                        Governing Law: {activeCategoryObj.governingRules}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/new-case")}
                    className="btn-brass font-mono"
                    style={{ padding: "8px 18px", fontSize: "0.82rem" }}
                  >
                    Investigate Case in {activeCategoryObj.name} →
                  </button>
                </div>

                <p className="font-serif" style={{ fontSize: "0.95rem", lineHeight: "1.6", color: "var(--ink)", marginBottom: "20px" }}>
                  {activeCategoryObj.description}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                  {/* Evidence Checklist */}
                  <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <strong className="font-mono text-brass" style={{ fontSize: "0.82rem", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>
                      📋 Essential Documents to Collect:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink)", lineHeight: "1.6" }}>
                      {activeCategoryObj.evidenceChecklist?.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Common Scenarios */}
                  <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <strong className="font-mono text-brass" style={{ fontSize: "0.82rem", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>
                      ⚠️ Common Dispute Scenarios:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink-muted)", lineHeight: "1.6" }}>
                      {activeCategoryObj.commonScenarios?.map((scen, idx) => (
                        <li key={idx} style={{ marginBottom: "4px" }}>{scen}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.3)", fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                  🏛️ <strong>Primary Redressal Authority:</strong> {activeCategoryObj.primaryAuthority}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* INTENT 2: LEARN THE PROCESS (PROCEDURAL KNOWLEDGE) */}
        {/* ======================================================== */}
        {selectedIntent === "LEARN_THE_PROCESS" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <h2 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: "0 0 4px 0" }}>
                Indian Consumer Dispute Redressal Procedure (CPA 2019)
              </h2>
              <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                Official statutory provisions governing pecuniary limits, territorial jurisdiction, fee slabs, and limitation periods.
              </p>
            </div>

            {/* Jurisdiction Slabs */}
            <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
              <h3 className="font-serif text-brass" style={{ fontSize: "1.15rem", margin: "0 0 8px 0" }}>
                1. Pecuniary Jurisdiction: Where Does Your Claim Belong?
              </h3>
              <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                Under the amended Consumer Protection (Jurisdiction of District, State, and National Commission) Rules, 2021:
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                {procedural?.jurisdiction?.tiers?.map((tier, idx) => (
                  <div key={idx} style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--brass)", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
                      TIER {idx + 1}
                    </span>
                    <strong className="font-serif" style={{ fontSize: "1rem", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                      {tier.forum}
                    </strong>
                    <div style={{ fontSize: "0.82rem", fontFamily: "var(--font-mono)", color: "#34D399", fontWeight: "bold", marginBottom: "6px" }}>
                      Claim Value: {tier.claimLimit}
                    </div>
                    <p style={{ margin: 0, fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)", lineHeight: "1.4" }}>
                      {tier.location}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                💡 <strong>Section 34(2) Territorial Jurisdiction Advantage:</strong> Consumers are no longer required to travel to the company's head office city. You can file at your local District Commission where you reside or work for gain.
              </div>
            </div>

            {/* Filing Fees & Limitation Period */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
              {/* Fee Slabs */}
              <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
                <h3 className="font-serif text-brass" style={{ fontSize: "1.1rem", margin: "0 0 8px 0" }}>
                  2. Schedule of Filing Fees
                </h3>
                <p className="font-mono text-muted" style={{ fontSize: "0.75rem", margin: "0 0 14px 0" }}>
                  No fee is charged for consumer claims up to ₹5,00,000 (Free of cost).
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {procedural?.filingFees?.slabs?.map((slab, sIdx) => (
                    <div key={sIdx} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}>
                      <span style={{ color: "var(--ink)" }}>{slab.amountRange}</span>
                      <strong style={{ color: slab.fee.includes("NIL") ? "#34D399" : "var(--brass)" }}>{slab.fee}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Limitation Period */}
              <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
                <h3 className="font-serif text-brass" style={{ fontSize: "1.1rem", margin: "0 0 8px 0" }}>
                  3. Limitation Deadline (Section 69)
                </h3>
                <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", marginBottom: "14px" }}>
                  <span className="font-mono" style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#FBBF24", display: "block", marginBottom: "4px" }}>
                    2 YEARS
                  </span>
                  <p className="font-mono" style={{ fontSize: "0.78rem", color: "var(--ink)", margin: 0, lineHeight: "1.5" }}>
                    {procedural?.limitationPeriod?.rule || "A complaint must be filed within 2 years from the date on which cause of action arose."}
                  </p>
                </div>
                <p className="font-mono text-muted" style={{ fontSize: "0.75rem", lineHeight: "1.5", margin: 0 }}>
                  <strong>Condonation of Delay:</strong> Under Section 69(2), the Commission may admit a complaint after 2 years only if the consumer establishes sufficient, genuine cause for the delay with documentary proof.
                </p>
              </div>
            </div>

            {/* Official Filing Portals */}
            <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
              <h3 className="font-serif text-brass" style={{ fontSize: "1.15rem", margin: "0 0 14px 0" }}>
                4. Official Government Redressal Portals
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
                {procedural?.officialPortals?.map((portal, pIdx) => (
                  <div key={pIdx} style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <strong className="font-serif" style={{ fontSize: "1rem", color: "var(--ink)" }}>
                        {portal.name}
                      </strong>
                      <a
                        href={portal.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-brass"
                        style={{ fontSize: "0.72rem", textDecoration: "none" }}
                      >
                        Visit Portal ↗
                      </a>
                    </div>
                    <p style={{ margin: "0 0 8px 0", fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)", lineHeight: "1.4" }}>
                      {portal.purpose}
                    </p>
                    {portal.phone && (
                      <span className="font-mono text-brass" style={{ fontSize: "0.75rem", display: "block" }}>
                        📞 Toll-Free Helpline: {portal.phone}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* INTENT 3: PREPARE A DOCUMENT (STRUCTURED DRAFTING) */}
        {/* ======================================================== */}
        {selectedIntent === "PREPARE_A_DOCUMENT" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px" }}>
            {/* Left: Input Form */}
            <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
              <h3 className="font-serif text-brass" style={{ fontSize: "1.2rem", margin: "0 0 6px 0" }}>
                Draft Structured Legal Document
              </h3>
              <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: "0 0 20px 0" }}>
                Enter your dispute particulars. NeedhiAI will format a clean draft with clear placeholders and statutory grounds.
              </p>

              <form onSubmit={handleGenerateDraft}>
                {/* Document Type Selector */}
                <div style={{ marginBottom: "14px" }}>
                  <label className="font-mono text-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "6px" }}>
                    DOCUMENT TYPE *
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}
                  >
                    <option value="CONSUMER_COMPLAINT">District Consumer Complaint Petition (Section 35)</option>
                    <option value="GRIEVANCE_EMAIL">Formal Grievance Email to Nodal Officer</option>
                    <option value="REFUND_REQUEST">Formal Demand Notice for Refund / Replacement</option>
                    <option value="LEGAL_NOTICE">Pre-Litigation Legal Notice Draft (Subject to Legal Review)</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>
                      YOUR FULL NAME
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={draftForm.consumerName}
                      onChange={(e) => setDraftForm({ ...draftForm, consumerName: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>
                      COMPANY / SELLER NAME
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Amazon India / ABC Electronics"
                      value={draftForm.companyName}
                      onChange={(e) => setDraftForm({ ...draftForm, companyName: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>
                      PRODUCT / SERVICE
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Smart LED Television 55-inch"
                      value={draftForm.productName}
                      onChange={(e) => setDraftForm({ ...draftForm, productName: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>
                      ORDER / INVOICE ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 408-9876543-1234567"
                      value={draftForm.orderId}
                      onChange={(e) => setDraftForm({ ...draftForm, orderId: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>
                      TRANSACTION DATE
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 15-01-2026"
                      value={draftForm.transactionDate}
                      onChange={(e) => setDraftForm({ ...draftForm, transactionDate: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>
                      AMOUNT PAID (INR)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ₹38,990"
                      value={draftForm.disputedAmount}
                      onChange={(e) => setDraftForm({ ...draftForm, disputedAmount: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>
                    DEFECT / DEFICIENCY DESCRIPTION
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Television screen developed vertical black lines within 3 days. Service center technician visited, took original job sheet, but company refused replacement citing non-existent terms."
                    value={draftForm.problemDescription}
                    onChange={(e) => setDraftForm({ ...draftForm, problemDescription: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>
                    REMEDY SOUGHT
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Full refund of ₹38,990 or immediate replacement"
                    value={draftForm.remedySought}
                    onChange={(e) => setDraftForm({ ...draftForm, remedySought: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingDraft}
                  className="btn-brass font-mono"
                  style={{ width: "100%", padding: "10px", fontSize: "0.88rem" }}
                >
                  {generatingDraft ? "Formatting Draft..." : "Generate Structured Draft →"}
                </button>
              </form>
            </div>

            {/* Right: Draft Preview & Actions */}
            <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div>
                  <h3 className="font-serif text-brass" style={{ fontSize: "1.15rem", margin: 0 }}>
                    {generatedDraft ? generatedDraft.title : "Draft Document Preview"}
                  </h3>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                    Standardized format with clear placeholders
                  </span>
                </div>

                {generatedDraft && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handleCopyDraft}
                      className="btn-outline-brass font-mono"
                      style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                    >
                      {copySuccess ? "✓ Copied!" : "📋 Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadDraft}
                      className="btn-brass font-mono"
                      style={{ padding: "6px 14px", fontSize: "0.75rem" }}
                    >
                      ⬇ Download (.txt)
                    </button>
                  </div>
                )}
              </div>

              {/* Disclaimer Notice */}
              <div style={{ padding: "10px 14px", borderRadius: "6px", backgroundColor: "rgba(245, 158, 11, 0.08)", border: "1px dashed rgba(245, 158, 11, 0.4)", color: "#FBBF24", fontSize: "0.72rem", fontFamily: "var(--font-mono)", marginBottom: "14px" }}>
                ⚠️ <strong>DRAFT NOTICE:</strong> Generated for consumer preparation. Not officially filed or vetted by a lawyer. Review and replace bracketed placeholders before sending.
              </div>

              {/* Draft Content Box */}
              <div
                style={{
                  flex: 1,
                  minHeight: "350px",
                  maxHeight: "550px",
                  overflowY: "auto",
                  padding: "16px",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg)",
                  border: "1px solid var(--line)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.78rem",
                  color: "var(--ink)",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap"
                }}
              >
                {generatedDraft ? (
                  generatedDraft.draftText
                ) : (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)", textAlign: "center" }}>
                    <span style={{ fontSize: "2rem", marginBottom: "8px" }}>📝</span>
                    <p style={{ margin: 0 }}>
                      Complete the details on the left and click "Generate Structured Draft" to create your formal legal document.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
