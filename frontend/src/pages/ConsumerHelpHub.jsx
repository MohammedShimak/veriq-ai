import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  getHelpHubIntentsApi,
  getHelpHubCategoriesApi,
  getHelpHubProceduralApi,
  generateHelpHubDraftApi,
  searchHelpHubApi
} from "../services/investigationApi";
import BRAND from "../config/brand";

export default function ConsumerHelpHub() {
  const navigate = useNavigate();

  const [intents, setIntents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [procedural, setProcedural] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search & Active Card States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Interactive Section Modals / Tabs
  const [activeModal, setActiveModal] = useState(null); // 'rights' | 'evidence' | 'notice' | 'procedure' | 'faq'
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("ecommerce_retail");
  const [selectedFaqIndex, setSelectedFaqIndex] = useState(null);

  // Legal Notice Draft Form State
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
    remedySought: "Full refund of amount paid with interest and replacement of defective goods"
  });
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [intRes, catRes, procRes] = await Promise.allSettled([
          getHelpHubIntentsApi(),
          getHelpHubCategoriesApi(),
          getHelpHubProceduralApi()
        ]);

        if (intRes.status === "fulfilled" && intRes.value?.intents) {
          setIntents(intRes.value.intents);
        }
        if (catRes.status === "fulfilled" && catRes.value?.categories) {
          setCategories(catRes.value.categories);
        }
        if (procRes.status === "fulfilled" && procRes.value?.procedural) {
          setProcedural(procRes.value.procedural);
        }
      } catch (err) {
        console.warn("Help Hub initial data note:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      setIsSearching(true);
      const res = await searchHelpHubApi(searchQuery.trim());
      if (res?.result) {
        setSearchResults(res.result);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateNotice = async (e) => {
    e.preventDefault();
    try {
      setGeneratingDraft(true);
      const res = await generateHelpHubDraftApi({
        documentType: "LEGAL_NOTICE",
        category: selectedCategoryKey,
        consumerData: draftForm
      });
      if (res?.draft) {
        setGeneratedDraft(res.draft);
      }
    } catch (err) {
      console.error("Notice draft generation failed:", err);
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleCopyNotice = () => {
    if (!generatedDraft) return;
    const textToCopy = typeof generatedDraft === "string" ? generatedDraft : JSON.stringify(generatedDraft, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const STATUTORY_RIGHTS = [
    {
      id: "safety",
      title: "1. Right to Safety",
      provision: "CPA 2019 Section 2(9)(i)",
      summary: "Protection against marketing of goods, products, or services that are hazardous to life and property."
    },
    {
      id: "information",
      title: "2. Right to Information",
      provision: "CPA 2019 Section 2(9)(ii)",
      summary: "Right to know the quantity, potency, purity, standard, and price of goods to protect against unfair trade practices."
    },
    {
      id: "choice",
      title: "3. Right to Choice / Assured Access",
      provision: "CPA 2019 Section 2(9)(iii)",
      summary: "Right to be assured access to a variety of goods and services at competitive and fair prices."
    },
    {
      id: "hearing",
      title: "4. Right to be Heard",
      provision: "CPA 2019 Section 2(9)(iv)",
      summary: "Right to represent consumer interests and receive due consideration in appropriate consumer dispute forums."
    },
    {
      id: "redressal",
      title: "5. Right to Seek Redressal",
      provision: "CPA 2019 Section 2(9)(v)",
      summary: "Right to seek genuine remedies, refunds, replacements, and damages against unfair trade practices or exploitation."
    },
    {
      id: "education",
      title: "6. Right to Consumer Education",
      provision: "CPA 2019 Section 2(9)(vi)",
      summary: "Right to acquire knowledge and skill to be an informed, alert consumer throughout your commercial life."
    },
    {
      id: "advertisements",
      title: "7. Protection Against Misleading Advertisements",
      provision: "CPA 2019 Section 2(28)",
      summary: "Protection against false descriptions, false guarantees, and deceptive endorsements by merchants or influencers."
    },
    {
      id: "unfair-contracts",
      title: "8. Protection Against Unfair Contracts",
      provision: "CPA 2019 Section 2(46)",
      summary: "Statutory invalidation of one-sided, onerous contracts requiring excessive security deposits or unilateral termination."
    }
  ];

  const FAQS = [
    {
      q: "What is the fee to file a consumer complaint in India?",
      a: "Under the Consumer Protection Act, 2019, there is ZERO fee for disputes with claim value up to ₹5,00,000 in District Commissions. For claims above ₹5 Lakhs, a nominal statutory fee applies (ranging from ₹200 to ₹7,500 depending on claim bracket)."
    },
    {
      q: "Do I need to hire a lawyer to represent my case?",
      a: "No. The Consumer Protection Act, 2019 was specifically designed for consumer self-representation. A consumer can file, argue, and represent their case directly in person or through an authorized representative without hiring an advocate."
    },
    {
      q: "What is the limitation period for filing a complaint?",
      a: "A consumer complaint must be filed within 2 years from the date on which the cause of action arose (e.g., date of delivery of defective product, date of refusal of refund, or date of service deficiency)."
    },
    {
      q: "Can I file my consumer complaint online?",
      a: "Yes. The Ministry of Consumer Affairs operates the official 'e-Daakhil' portal (edaakhil.nic.in), allowing online filing, document upload, fee payment, and tracking across District, State, and National Consumer Commissions."
    },
    {
      q: "Can I claim compensation for mental agony and harassment?",
      a: "Yes. Section 39(1)(d) of CPA 2019 empowers Consumer Commissions to award punitive and compensatory damages for loss or injury suffered by the consumer, including mental agony, upon reasonable evidentiary proof."
    },
    {
      q: "How does Veriq assess my case?",
      a: "Veriq organizes your grievance chronology, identifies missing documents, evaluates cross-source contradictions, and benchmarks your facts against CPA 2019 statutory benchmarks and authentic Supreme Court & NCDRC judgments. The resulting evaluation is a transparent, preliminary, non-binding assessment."
    }
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      {/* HERO SECTION */}
      <section
        style={{
          padding: "64px 24px 48px 24px",
          borderBottom: "1px solid var(--line)",
          background: "linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)",
          textAlign: "center"
        }}
      >
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          {/* Brand & Subtitle Pill */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <span
              className="veriq-badge veriq-badge-blue font-sans"
              style={{ fontSize: "0.8rem", padding: "4px 14px", fontWeight: "600" }}
            >
              {BRAND.subTagline}
            </span>
            <span
              className="veriq-badge veriq-badge-teal font-sans"
              style={{ fontSize: "0.8rem", padding: "4px 14px" }}
            >
              CPA 2019 Analytical Framework
            </span>
          </div>

          {/* Main Hero Headline */}
          <h1
            className="font-sans"
            style={{
              fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
              fontWeight: "700",
              letterSpacing: "-0.03em",
              lineHeight: "1.15",
              margin: "0 0 18px 0",
              color: "var(--ink)"
            }}
          >
            {BRAND.headline}
          </h1>

          {/* Supporting Text */}
          <p
            className="font-sans"
            style={{
              fontSize: "1.1rem",
              lineHeight: "1.6",
              color: "var(--ink-muted)",
              maxWidth: "680px",
              margin: "0 auto 32px auto"
            }}
          >
            {BRAND.heroSupport}
          </p>

          {/* Primary & Secondary Call to Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "14px", marginBottom: "40px" }}>
            <button
              onClick={() => navigate("/start-case")}
              className="btn-veriq-primary font-sans"
              style={{ padding: "13px 28px", fontSize: "0.98rem", borderRadius: "8px" }}
            >
              Start Your Case →
            </button>
            <button
              onClick={() => navigate("/consumer-rights")}
              className="btn-veriq-secondary font-sans"
              style={{ padding: "13px 24px", fontSize: "0.98rem", borderRadius: "8px" }}
            >
              Explore Consumer Rights
            </button>
            <button
              onClick={() => setActiveModal("evidence")}
              className="btn-veriq-secondary font-sans"
              style={{ padding: "13px 24px", fontSize: "0.98rem", borderRadius: "8px" }}
            >
              Prepare Your Evidence
            </button>
          </div>

          {/* Search Bar Input */}
          <form
            onSubmit={handleSearch}
            style={{
              maxWidth: "620px",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              backgroundColor: "var(--surface)",
              borderRadius: "10px",
              border: "1px solid var(--line)",
              padding: "6px 8px 6px 16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}
          >
            <span style={{ fontSize: "1.1rem", color: "var(--ink-dim)", marginRight: "10px" }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your issue (e.g. 'e-commerce refund denied', 'flight delayed', 'defective TV')..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                color: "var(--ink)",
                fontFamily: "var(--font-sans)",
                fontSize: "0.92rem"
              }}
            />
            <button
              type="submit"
              disabled={isSearching}
              className="btn-veriq-primary font-sans"
              style={{ padding: "8px 18px", fontSize: "0.85rem", borderRadius: "6px" }}
            >
              {isSearching ? "Searching..." : "Search Guide"}
            </button>
          </form>

          {/* Search Results Display */}
          {searchResults && (
            <div
              className="veriq-card"
              style={{
                maxWidth: "620px",
                margin: "18px auto 0 auto",
                textAlign: "left",
                padding: "18px 20px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span className="veriq-badge veriq-badge-teal font-sans">
                  {searchResults.matchedCategory ? `Category: ${searchResults.matchedCategory}` : "Search Match"}
                </span>
                <button
                  onClick={() => setSearchResults(null)}
                  style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
              <p className="font-sans" style={{ fontSize: "0.9rem", color: "var(--ink)", margin: "0 0 10px 0", lineHeight: "1.5" }}>
                {searchResults.summary || searchResults.explanation || "Grounded procedural guidance matched to your query."}
              </p>
              {searchResults.statutoryProvision && (
                <div className="legal-statute-quote font-sans">
                  <strong>Statutory Basis:</strong> {searchResults.statutoryProvision}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  onClick={() => navigate("/start-case")}
                  className="btn-veriq-primary font-sans"
                  style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                >
                  Launch Full Case Investigation →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* MAIN CONTENT AREA */}
      <main style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "52px 24px", boxSizing: "border-box" }}>
        {/* CONSUMER HELP CARDS GRID (6 CORE CARDS) */}
        <section style={{ marginBottom: "64px" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <h2 className="font-sans" style={{ fontSize: "1.8rem", fontWeight: "700", letterSpacing: "-0.02em", margin: "0 0 8px 0" }}>
              Explore Consumer Legal Support Modules
            </h2>
            <p className="font-sans" style={{ fontSize: "0.95rem", color: "var(--ink-muted)", margin: 0 }}>
              Practical, actionable tools to understand your statutory rights, prepare evidence, and initiate formal redressal.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px"
            }}
          >
            {/* Card 1: Start a Consumer Complaint */}
            <div
              className="veriq-card veriq-card-interactive"
              onClick={() => navigate("/start-case")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.8rem" }}>✍️</span>
                <div>
                  <h3 className="font-sans" style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "var(--ink)" }}>
                    1. Start a Consumer Complaint
                  </h3>
                  <span className="veriq-badge veriq-badge-blue font-sans" style={{ marginTop: "4px" }}>
                    Core AI Investigation
                  </span>
                </div>
              </div>
              <p className="font-sans" style={{ fontSize: "0.86rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                Enter your grievance to launch our multi-turn factual clarification, document inspection, company policy research, and evidence-grounded assessment.
              </p>
              <span className="font-sans" style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--veriq-blue)" }}>
                Start Intake Journey →
              </span>
            </div>

            {/* Card 2: Understand Your Consumer Rights */}
            <div
              className="veriq-card veriq-card-interactive"
              onClick={() => navigate("/consumer-rights")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.8rem" }}>🛡️</span>
                <div>
                  <h3 className="font-sans" style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "var(--ink)" }}>
                    2. Understand Your Consumer Rights
                  </h3>
                  <span className="veriq-badge veriq-badge-teal font-sans" style={{ marginTop: "4px" }}>
                    CPA 2019 Section 2(9)
                  </span>
                </div>
              </div>
              <p className="font-sans" style={{ fontSize: "0.86rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                Learn the statutory consumer rights guaranteed under Indian law, including safety, information, choice, unfair contract invalidation, and redressal.
              </p>
              <span className="font-sans" style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--veriq-teal)" }}>
                Explore Consumer Rights Guide →
              </span>
            </div>

            {/* Card 3: Prepare Your Evidence */}
            <div
              className="veriq-card veriq-card-interactive"
              onClick={() => setActiveModal("evidence")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.8rem" }}>🗂️</span>
                <div>
                  <h3 className="font-sans" style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "var(--ink)" }}>
                    3. Prepare Your Evidence
                  </h3>
                  <span className="veriq-badge veriq-badge-emerald font-sans" style={{ marginTop: "4px" }}>
                    Evidence Inventory
                  </span>
                </div>
              </div>
              <p className="font-sans" style={{ fontSize: "0.86rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                Category-specific evidence checklists: learn what documents, invoices, technician reports, and emails are essential to substantiate your claim.
              </p>
              <span className="font-sans" style={{ fontSize: "0.82rem", fontWeight: "600", color: "#059669" }}>
                Explore Evidence Checklists →
              </span>
            </div>

            {/* Card 4: Explore Legal Notice Preparation */}
            <div
              className="veriq-card veriq-card-interactive"
              onClick={() => setActiveModal("notice")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.8rem" }}>📜</span>
                <div>
                  <h3 className="font-sans" style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "var(--ink)" }}>
                    4. Legal Notice Preparation
                  </h3>
                  <span className="veriq-badge veriq-badge-amber font-sans" style={{ marginTop: "4px" }}>
                    Pre-Litigation Draft
                  </span>
                </div>
              </div>
              <p className="font-sans" style={{ fontSize: "0.86rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                Generate a formal 15-day statutory pre-litigation legal notice to the merchant, detailing facts, statutory provisions, and demand for remedy.
              </p>
              <span className="font-sans" style={{ fontSize: "0.82rem", fontWeight: "600", color: "#d97706" }}>
                Draft Legal Notice →
              </span>
            </div>

            {/* Card 5: Learn About Consumer Procedures */}
            <div
              className="veriq-card veriq-card-interactive"
              onClick={() => navigate("/legal-resources")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.8rem" }}>🏛️</span>
                <div>
                  <h3 className="font-sans" style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "var(--ink)" }}>
                    5. Consumer Complaint Procedures & Portals
                  </h3>
                  <span className="veriq-badge veriq-badge-slate font-sans" style={{ marginTop: "4px" }}>
                    District, State & National
                  </span>
                </div>
              </div>
              <p className="font-sans" style={{ fontSize: "0.86rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                Understand pecuniary jurisdiction (District ≤ 50L, State ≤ 2Cr, National &gt; 2Cr), limitation periods, and official portals like e-Daakhil and NCH 1915.
              </p>
              <span className="font-sans" style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--veriq-blue)" }}>
                Explore Legal Resources Library →
              </span>
            </div>

            {/* Card 6: Frequently Asked Questions */}
            <div
              className="veriq-card veriq-card-interactive"
              onClick={() => setActiveModal("faq")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "1.8rem" }}>💡</span>
                <div>
                  <h3 className="font-sans" style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "var(--ink)" }}>
                    6. Frequently Asked Questions
                  </h3>
                  <span className="veriq-badge veriq-badge-blue font-sans" style={{ marginTop: "4px" }}>
                    Instant Answers
                  </span>
                </div>
              </div>
              <p className="font-sans" style={{ fontSize: "0.86rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                Key answers on court fees, legal notice requirements, limitation timelines, claiming mental agony damages, and self-representation.
              </p>
              <span className="font-sans" style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--veriq-blue)" }}>
                Browse Common FAQs →
              </span>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS (4-STEP PROCESS) */}
        <section
          style={{
            padding: "44px 32px",
            borderRadius: "14px",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--line)",
            marginBottom: "64px"
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span className="veriq-badge veriq-badge-blue font-sans" style={{ marginBottom: "8px" }}>
              Methodology
            </span>
            <h2 className="font-sans" style={{ fontSize: "1.8rem", fontWeight: "700", letterSpacing: "-0.02em", margin: "4px 0 8px 0" }}>
              How Veriq Case Intelligence Works
            </h2>
            <p className="font-sans" style={{ fontSize: "0.92rem", color: "var(--ink-muted)", margin: 0 }}>
              A four-step evidence-based workflow that ensures fairness, legal rigor, and factual integrity.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "24px"
            }}
          >
            {[
              {
                step: "01",
                title: "Describe Your Complaint",
                desc: "Provide the basic chronology of what you purchased, who the seller was, what went wrong, and the disputed amount."
              },
              {
                step: "02",
                title: "Answer Questions & Upload Evidence",
                desc: "Our engine detects your category and asks targeted questions while inspecting your invoices, job sheets, and emails."
              },
              {
                step: "03",
                title: "Review Law & Contradictions",
                desc: "The system matches your case with CPA 2019 sections, company return policies, and detects any conflicting statements."
              },
              {
                step: "04",
                title: "Receive Evidence-Grounded Assessment",
                desc: "Get an authoritative preliminary report distinguishing established vs disputed facts, applicable precedents, and remedies."
              }
            ].map((item, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                <span
                  className="font-sans"
                  style={{
                    fontSize: "2rem",
                    fontWeight: "800",
                    color: "var(--veriq-blue)",
                    opacity: 0.35,
                    display: "block",
                    lineHeight: 1,
                    marginBottom: "8px"
                  }}
                >
                  {item.step}
                </span>
                <h4 className="font-sans" style={{ fontSize: "1.05rem", fontWeight: "600", margin: "0 0 6px 0", color: "var(--ink)" }}>
                  {item.title}
                </h4>
                <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* TRUST AND TRANSPARENCY NOTICE */}
        <section
          style={{
            padding: "32px",
            borderRadius: "12px",
            backgroundColor: "rgba(2, 132, 199, 0.04)",
            border: "1px solid rgba(2, 132, 199, 0.2)",
            marginBottom: "40px"
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>🛡️</span>
            <div>
              <h3 className="font-sans" style={{ margin: "0 0 6px 0", fontSize: "1.1rem", fontWeight: "600", color: "var(--ink)" }}>
                Commitment to Evidence & Transparency
              </h3>
              <p className="font-sans" style={{ fontSize: "0.88rem", color: "var(--ink-muted)", lineHeight: "1.6", margin: "0 0 10px 0" }}>
                Veriq provides preliminary dispute analysis grounded in India’s Consumer Protection Act, 2019 and published precedents. We do not invent case outcomes, fabricate citations, or guarantee judicial verdicts. Discrepancies between your statements and merchant policies are explicitly disclosed rather than buried. Final binding orders reside exclusively with the competent Consumer Disputes Redressal Commission.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <span className="veriq-badge veriq-badge-slate font-sans">
                  Preliminary & Non-Binding
                </span>
                <span className="veriq-badge veriq-badge-teal font-sans">
                  0% Invented Citations
                </span>
                <span className="veriq-badge veriq-badge-blue font-sans">
                  Consumer Protection Act, 2019
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================ */}
      {/* INTERACTIVE MODALS FOR HELP CARDS (RIGHTS, EVIDENCE, ETC.) */}
      {/* ============================================================ */}

      {/* MODAL 1: STATUTORY CONSUMER RIGHTS */}
      {activeModal === "rights" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="veriq-card"
            style={{
              maxWidth: "760px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "28px 32px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <div>
                <span className="veriq-badge veriq-badge-teal font-sans" style={{ marginBottom: "4px" }}>
                  Consumer Protection Act, 2019
                </span>
                <h3 className="font-sans" style={{ margin: "4px 0 0 0", fontSize: "1.3rem", fontWeight: "700" }}>
                  8 Fundamental Statutory Consumer Rights
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--ink-muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {STATUTORY_RIGHTS.map((r) => (
                <div key={r.id} style={{ padding: "14px 16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                    <strong className="font-sans" style={{ fontSize: "0.95rem", color: "var(--ink)" }}>{r.title}</strong>
                    <span className="font-sans text-muted" style={{ fontSize: "0.74rem" }}>{r.provision}</span>
                  </div>
                  <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0, lineHeight: "1.5" }}>
                    {r.summary}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setActiveModal(null); navigate("/new-case"); }}
                className="btn-veriq-primary font-sans"
              >
                Apply Rights to Your Case →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EVIDENCE INVENTORY CHECKLIST */}
      {activeModal === "evidence" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="veriq-card"
            style={{
              maxWidth: "760px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "28px 32px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <div>
                <span className="veriq-badge veriq-badge-emerald font-sans" style={{ marginBottom: "4px" }}>
                  Evidence Preparation Guide
                </span>
                <h3 className="font-sans" style={{ margin: "4px 0 0 0", fontSize: "1.3rem", fontWeight: "700" }}>
                  Checklist of Essential Dispute Documents
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--ink-muted)" }}
              >
                ✕
              </button>
            </div>

            <p className="font-sans" style={{ fontSize: "0.88rem", color: "var(--ink-muted)", margin: "0 0 16px 0" }}>
              Consumer Commissions decide disputes based on documentary corroboration. Gather these materials before filing:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { type: "Proof of Purchase", docs: "Tax Invoice, Retail Cash Memo, or Booking Receipt showing payment, date, GSTIN, and seller name." },
                { type: "Proof of Defect / Non-Performance", docs: "Authorized service center Job Sheet, inspection report, technical diagnosis, or unboxing video." },
                { type: "Merchant Communications", docs: "Emails, grievance portal tickets, WhatsApp chats, or written rejection of replacement/refund." },
                { type: "Proof of Financial Loss", docs: "Bank account statement, credit card slip, UPI transaction ID, or debit advice." },
                { type: "Warranty & Guarantee Terms", docs: "Manufacturer warranty card, terms of service, or e-commerce return policy screenshot." }
              ].map((ev, idx) => (
                <div key={idx} style={{ padding: "14px 16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <strong className="font-sans" style={{ fontSize: "0.92rem", color: "#059669", display: "block", marginBottom: "4px" }}>
                    ✓ {ev.type}
                  </strong>
                  <span className="font-sans" style={{ fontSize: "0.84rem", color: "var(--ink)" }}>
                    {ev.docs}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setActiveModal(null); navigate("/new-case"); }}
                className="btn-veriq-primary font-sans"
              >
                Upload Documents in Case Intake →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: LEGAL NOTICE PREPARATION FORM */}
      {activeModal === "notice" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="veriq-card"
            style={{
              maxWidth: "800px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "28px 32px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <div>
                <span className="veriq-badge veriq-badge-amber font-sans" style={{ marginBottom: "4px" }}>
                  Pre-Litigation Statutory Step
                </span>
                <h3 className="font-sans" style={{ margin: "4px 0 0 0", fontSize: "1.3rem", fontWeight: "700" }}>
                  Draft a 15-Day Statutory Legal Notice
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--ink-muted)" }}
              >
                ✕
              </button>
            </div>

            {!generatedDraft ? (
              <form onSubmit={handleGenerateNotice} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="font-sans" style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>Consumer Name *</label>
                    <input
                      required
                      type="text"
                      value={draftForm.consumerName}
                      onChange={(e) => setDraftForm({ ...draftForm, consumerName: e.target.value })}
                      placeholder="e.g. Ramesh Sharma"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label className="font-sans" style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>Opposite Party (Company Name) *</label>
                    <input
                      required
                      type="text"
                      value={draftForm.companyName}
                      onChange={(e) => setDraftForm({ ...draftForm, companyName: e.target.value })}
                      placeholder="e.g. ElectroWorld India Pvt. Ltd."
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="font-sans" style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>Product / Service Name</label>
                    <input
                      type="text"
                      value={draftForm.productName}
                      onChange={(e) => setDraftForm({ ...draftForm, productName: e.target.value })}
                      placeholder="e.g. 55-Inch OLED Smart TV"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label className="font-sans" style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>Disputed Amount (₹)</label>
                    <input
                      type="text"
                      value={draftForm.disputedAmount}
                      onChange={(e) => setDraftForm({ ...draftForm, disputedAmount: e.target.value })}
                      placeholder="e.g. 64000"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="font-sans" style={{ fontSize: "0.78rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>Dispute Chronology / Problem Statement *</label>
                  <textarea
                    required
                    rows={4}
                    value={draftForm.problemDescription}
                    onChange={(e) => setDraftForm({ ...draftForm, problemDescription: e.target.value })}
                    placeholder="Describe dates, delivery, nature of defect, and seller refusal..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box", fontFamily: "var(--font-sans)" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingDraft}
                  className="btn-veriq-primary font-sans"
                  style={{ alignSelf: "flex-end", padding: "10px 22px" }}
                >
                  {generatingDraft ? "Synthesizing Statutory Notice..." : "Generate 15-Day Notice Draft →"}
                </button>
              </form>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span className="veriq-badge veriq-badge-emerald font-sans">
                    ✓ Notice Draft Ready
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleCopyNotice}
                      className="btn-veriq-secondary font-sans"
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    >
                      {copySuccess ? "✓ Copied!" : "📋 Copy Notice Text"}
                    </button>
                    <button
                      onClick={() => setGeneratedDraft(null)}
                      className="btn-veriq-secondary font-sans"
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    >
                      Edit Inputs
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    backgroundColor: "var(--bg)",
                    border: "1px solid var(--line)",
                    maxHeight: "360px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.82rem",
                    lineHeight: "1.6"
                  }}
                >
                  {typeof generatedDraft === "string" ? generatedDraft : JSON.stringify(generatedDraft, null, 2)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: CONSUMER PROCEDURES & PECUNIARY JURISDICTION */}
      {activeModal === "procedure" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="veriq-card"
            style={{
              maxWidth: "760px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "28px 32px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <div>
                <span className="veriq-badge veriq-badge-slate font-sans" style={{ marginBottom: "4px" }}>
                  Consumer Commission Hierarchy
                </span>
                <h3 className="font-sans" style={{ margin: "4px 0 0 0", fontSize: "1.3rem", fontWeight: "700" }}>
                  Pecuniary Limits & Procedural Rules
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--ink-muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ padding: "14px 16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                <strong className="font-sans text-brass" style={{ fontSize: "0.95rem", display: "block", marginBottom: "4px" }}>
                  1. District Consumer Disputes Redressal Commission (DCDRC)
                </strong>
                <span className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", display: "block", lineHeight: "1.5" }}>
                  <strong>Jurisdiction:</strong> Up to ₹50,00,000 (Fifty Lakhs). Located in every district headquarters across India.
                </span>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                <strong className="font-sans text-brass" style={{ fontSize: "0.95rem", display: "block", marginBottom: "4px" }}>
                  2. State Consumer Disputes Redressal Commission (SCDRC)
                </strong>
                <span className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", display: "block", lineHeight: "1.5" }}>
                  <strong>Jurisdiction:</strong> Exceeding ₹50 Lakhs up to ₹2,00,00,000 (Two Crores). Also hears first appeals against District orders.
                </span>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                <strong className="font-sans text-brass" style={{ fontSize: "0.95rem", display: "block", marginBottom: "4px" }}>
                  3. National Consumer Disputes Redressal Commission (NCDRC)
                </strong>
                <span className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", display: "block", lineHeight: "1.5" }}>
                  <strong>Jurisdiction:</strong> Exceeding ₹2,00,00,000 (Two Crores). Apex consumer forum headquartered in New Delhi; appeals lie to the Supreme Court of India.
                </span>
              </div>
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setActiveModal(null); navigate("/new-case"); }}
                className="btn-veriq-primary font-sans"
              >
                Start Your Case Investigation →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: FAQS ACCORDION */}
      {activeModal === "faq" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="veriq-card"
            style={{
              maxWidth: "760px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "28px 32px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <div>
                <span className="veriq-badge veriq-badge-blue font-sans" style={{ marginBottom: "4px" }}>
                  Practical Legal Knowledge
                </span>
                <h3 className="font-sans" style={{ margin: "4px 0 0 0", fontSize: "1.3rem", fontWeight: "700" }}>
                  Frequently Asked Questions
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--ink-muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {FAQS.map((faq, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "8px",
                    backgroundColor: "var(--bg)",
                    border: "1px solid var(--line)",
                    cursor: "pointer"
                  }}
                  onClick={() => setSelectedFaqIndex(selectedFaqIndex === idx ? null : idx)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong className="font-sans" style={{ fontSize: "0.92rem", color: "var(--ink)" }}>{faq.q}</strong>
                    <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>{selectedFaqIndex === idx ? "▲" : "▼"}</span>
                  </div>
                  {selectedFaqIndex === idx && (
                    <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", marginTop: "10px", lineHeight: "1.5" }}>
                      {faq.a}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setActiveModal(null); navigate("/new-case"); }}
                className="btn-veriq-primary font-sans"
              >
                Start Your Case →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "32px 24px",
          backgroundColor: "var(--surface)",
          textAlign: "center"
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "left" }}>
            <span className="font-sans" style={{ fontWeight: "700", fontSize: "1rem", color: "var(--ink)" }}>
              {BRAND.name}
            </span>
            <span className="font-sans text-muted" style={{ fontSize: "0.8rem", marginLeft: "8px" }}>
              • {BRAND.tagline}
            </span>
          </div>

          <div style={{ display: "flex", gap: "18px", fontSize: "0.82rem", fontFamily: "var(--font-sans)", flexWrap: "wrap" }}>
            <Link to="/" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Home</Link>
            <Link to="/help-hub" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Consumer Help Hub</Link>
            <Link to="/consumer-rights" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Consumer Rights</Link>
            <Link to="/legal-resources" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Legal Resources</Link>
            <Link to="/start-case" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>Start a Case</Link>
            <Link to="/my-cases" style={{ color: "var(--ink-muted)", textDecoration: "none" }}>My Cases</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
