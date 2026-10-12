import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import { createInvestigationApi } from "../services/investigationApi";
import { useAuth } from "../context/AuthContext";
import BRAND from "../config/brand";

const COMMON_DISPUTE_CATEGORIES = [
  "Defective Product / Electronics",
  "E-Commerce / Online Delivery Failure",
  "Banking / Financial Service Deficiency",
  "Telecom / Internet Service Deficiency",
  "Travel, Airline & Hospitality Disruption",
  "Automobile Defect / Warranty Denial",
  "Healthcare / Medical Service Dispute",
  "Real Estate / Builder Delay & Possession"
];

export default function NewCase() {
  const [step, setStep] = useState(1);
  const [question, setQuestion] = useState("");
  const [product, setProduct] = useState("");
  const [company, setCompany] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Defective Product / Electronics");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);

  const navigate = useNavigate();
  const { accessToken } = useAuth();

  // Smart keyword detection for category
  const handleTextChange = (text) => {
    setQuestion(text);
    if (fieldErrors.question) {
      setFieldErrors((prev) => ({ ...prev, question: null }));
    }

    const lower = text.toLowerCase();
    if (lower.includes("flight") || lower.includes("airline") || lower.includes("hotel") || lower.includes("booking") || lower.includes("train")) {
      setCategory("Travel, Airline & Hospitality Disruption");
    } else if (lower.includes("bank") || lower.includes("card") || lower.includes("loan") || lower.includes("emi") || lower.includes("charge")) {
      setCategory("Banking / Financial Service Deficiency");
    } else if (lower.includes("car") || lower.includes("bike") || lower.includes("vehicle") || lower.includes("engine") || lower.includes("dealer")) {
      setCategory("Automobile Defect / Warranty Denial");
    } else if (lower.includes("flat") || lower.includes("builder") || lower.includes("apartment") || lower.includes("possession")) {
      setCategory("Real Estate / Builder Delay & Possession");
    } else if (lower.includes("hospital") || lower.includes("doctor") || lower.includes("surgery") || lower.includes("clinic")) {
      setCategory("Healthcare / Medical Service Dispute");
    } else if (lower.includes("delivered") || lower.includes("courier") || lower.includes("order") || lower.includes("amazon") || lower.includes("flipkart") || lower.includes("seller")) {
      setCategory("E-Commerce / Online Delivery Failure");
    } else if (lower.includes("tv") || lower.includes("laptop") || lower.includes("mobile") || lower.includes("screen") || lower.includes("defect") || lower.includes("phone")) {
      setCategory("Defective Product / Electronics");
    }
  };

  const validateStep1 = () => {
    if (!question.trim()) {
      setFieldErrors((prev) => ({ ...prev, question: "Please provide a description of your dispute to proceed." }));
      return false;
    }
    if (question.trim().length < 20) {
      setFieldErrors((prev) => ({ ...prev, question: "Please provide at least a few sentences explaining what happened." }));
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const validateStep2 = () => {
    setFieldErrors({});
    return true;
  };

  const handleStep1Next = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleStep2Next = () => {
    if (validateStep2()) {
      setStep(3);
    }
  };

  const getPecuniaryForum = (valStr) => {
    const val = parseFloat(valStr.replace(/[^0-9.]/g, ""));
    if (!val || isNaN(val)) return "District Consumer Commission (Claims up to ₹50 Lakhs)";
    if (val <= 5000000) return "District Consumer Disputes Redressal Commission (DCDRC)";
    if (val <= 20000000) return "State Consumer Disputes Redressal Commission (SCDRC)";
    return "National Consumer Disputes Redressal Commission (NCDRC)";
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!question.trim()) {
      setStep(1);
      setFieldErrors({ question: "Dispute description is required." });
      return;
    }

    try {
      setIsSubmitting(true);
      setApiError(null);

      const res = await createInvestigationApi(
        {
          complaint: question.trim(),
          product: product.trim(),
          company: company.trim(),
          amount: amount.trim(),
          category: category
        },
        accessToken
      );

      if (res.investigation && res.investigation.threadId) {
        navigate(`/investigation/${res.investigation.threadId}`);
      } else {
        throw new Error("Investigation docket created without a valid thread ID.");
      }
    } catch (err) {
      console.error("Failed to initialize investigation:", err);
      setApiError(err.response?.data?.error || err.message || "Failed to initialize case investigation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ maxWidth: "840px", width: "100%", margin: "0 auto", padding: "48px 24px", flex: 1, boxSizing: "border-box" }}>
        {/* Header & Context */}
        <div style={{ marginBottom: "32px", textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span className="veriq-badge veriq-badge-blue font-sans">
              Guided Case Intake
            </span>
            <span className="font-sans text-muted" style={{ fontSize: "0.8rem" }}>
              {BRAND.jurisdiction}
            </span>
          </div>

          <h1 className="font-sans" style={{ fontSize: "2.2rem", fontWeight: "700", letterSpacing: "-0.02em", margin: "0 0 8px 0", color: "var(--ink)" }}>
            Start Your Consumer Case
          </h1>
          <p className="font-sans" style={{ fontSize: "0.95rem", color: "var(--ink-muted)", margin: 0, lineHeight: "1.5" }}>
            Follow three quick steps to submit your grievance facts. Veriq will benchmark your claims against statutory consumer law and initiate document inspection.
          </p>
        </div>

        {/* Calm Stepped Progress Indicator */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
            marginBottom: "36px"
          }}
        >
          {[
            { num: 1, title: "Complaint & Category", sub: "Grievance details" },
            { num: 2, title: "Product & Merchant", sub: "Opposite party" },
            { num: 3, title: "Claim & Review", sub: "Pecuniary amount" }
          ].map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;

            return (
              <div
                key={s.num}
                onClick={() => {
                  if (s.num < step || (s.num === 2 && validateStep1())) {
                    setStep(s.num);
                  }
                }}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  backgroundColor: isActive ? "var(--veriq-blue-subtle)" : "var(--surface)",
                  border: isActive ? "2px solid var(--veriq-blue)" : isDone ? "1px solid var(--veriq-teal)" : "1px solid var(--line)",
                  cursor: s.num <= step ? "pointer" : "default",
                  transition: "all 0.15s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      backgroundColor: isDone ? "var(--veriq-teal)" : isActive ? "var(--veriq-blue)" : "var(--line)",
                      color: isDone || isActive ? "#ffffff" : "var(--ink-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.8rem",
                      fontWeight: "700",
                      flexShrink: 0
                    }}
                  >
                    {isDone ? "✓" : s.num}
                  </div>
                  <div>
                    <div className="font-sans" style={{ fontSize: "0.86rem", fontWeight: isActive ? "700" : "600", color: "var(--ink)" }}>
                      {s.title}
                    </div>
                    <div className="font-sans text-muted" style={{ fontSize: "0.74rem" }}>
                      {s.sub}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <ErrorBanner message={apiError} onClose={() => setApiError(null)} />

        {/* MAIN FOCUSED FORM CONTAINER */}
        <div className="veriq-card" style={{ padding: "36px 32px", marginBottom: "24px" }}>
          {/* STEP 1: COMPLAINT DESCRIPTION & CATEGORY */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <label className="font-sans" style={{ fontSize: "1.05rem", fontWeight: "700", display: "block", marginBottom: "6px", color: "var(--ink)" }}>
                  1. Describe Your Dispute Facts *
                </label>
                <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                  Explain what happened in chronological order. When did you purchase or receive the product/service? What defect or deficiency occurred? How did the seller or provider respond?
                </p>

                <textarea
                  required
                  rows={7}
                  value={question}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="e.g. Purchased a 55-inch Smart TV on 12-Jan-2024 for Rs. 42,000 from an online seller. Screen started flickering on day 3. An authorized technician verified an internal panel defect on a job sheet. Seller refused replacement or refund despite a 7-day return policy..."
                  style={{
                    width: "100%",
                    padding: "16px 18px",
                    borderRadius: "10px",
                    border: fieldErrors.question ? "2px solid #e11d48" : "1px solid var(--line)",
                    backgroundColor: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "0.94rem",
                    fontFamily: "var(--font-sans)",
                    lineHeight: "1.6",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />

                {fieldErrors.question && (
                  <div className="font-sans" style={{ color: "#e11d48", fontSize: "0.82rem", marginTop: "6px", fontWeight: "500" }}>
                    ⚠️ {fieldErrors.question}
                  </div>
                )}
              </div>

              {/* Dispute Category Selection */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label className="font-sans" style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--ink)" }}>
                    Dispute Category
                  </label>
                  <span className="veriq-badge veriq-badge-teal font-sans">
                    Auto-Detected
                  </span>
                </div>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    backgroundColor: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "0.9rem",
                    fontFamily: "var(--font-sans)",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  {COMMON_DISPUTE_CATEGORIES.map((cat, idx) => (
                    <option key={idx} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <span className="font-sans text-muted" style={{ fontSize: "0.76rem", display: "block", marginTop: "6px" }}>
                  Category is auto-selected based on keywords in your complaint, or you can select manually.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={handleStep1Next}
                  className="btn-veriq-primary font-sans"
                  style={{ padding: "12px 24px", fontSize: "0.92rem", fontWeight: "600" }}
                >
                  Continue to Merchant & Product Details →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: MERCHANT & PRODUCT DETAILS */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <div>
                <h3 className="font-sans" style={{ fontSize: "1.1rem", fontWeight: "700", margin: "0 0 6px 0", color: "var(--ink)" }}>
                  2. Product & Opposite Party Information
                </h3>
                <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>
                  Identifying the opposite party helps Veriq search applicable company warranty policies and statutory obligations.
                </p>
              </div>

              <div>
                <label className="font-sans" style={{ fontSize: "0.86rem", fontWeight: "600", display: "block", marginBottom: "6px", color: "var(--ink)" }}>
                  Product or Service Name
                </label>
                <input
                  type="text"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="e.g. 55-inch 4K OLED Smart Television"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    backgroundColor: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "0.9rem",
                    fontFamily: "var(--font-sans)",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label className="font-sans" style={{ fontSize: "0.86rem", fontWeight: "600", display: "block", marginBottom: "6px", color: "var(--ink)" }}>
                  Opposite Party / Merchant / Company Name
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. MegaRetail India Ltd. (or Brand Manufacturer)"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    backgroundColor: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "0.9rem",
                    fontFamily: "var(--font-sans)",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label className="font-sans" style={{ fontSize: "0.86rem", fontWeight: "600", display: "block", marginBottom: "6px", color: "var(--ink)" }}>
                  Date of Purchase / Incident (Optional)
                </label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    backgroundColor: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "0.9rem",
                    fontFamily: "var(--font-sans)",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />
                <span className="font-sans text-muted" style={{ fontSize: "0.76rem", display: "block", marginTop: "4px" }}>
                  Used to verify Section 69 limitation period (2 years from cause of action).
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-veriq-secondary font-sans"
                  style={{ padding: "10px 18px" }}
                >
                  ← Back to Step 1
                </button>

                <button
                  type="button"
                  onClick={handleStep2Next}
                  className="btn-veriq-primary font-sans"
                  style={{ padding: "12px 24px", fontSize: "0.92rem", fontWeight: "600" }}
                >
                  Continue to Claim Value & Review →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CLAIM VALUE & REVIEW */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <h3 className="font-sans" style={{ fontSize: "1.1rem", fontWeight: "700", margin: "0 0 6px 0", color: "var(--ink)" }}>
                  3. Disputed Amount & Case Review
                </h3>
                <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>
                  Enter the approximate total monetary amount involved (invoice price and any direct financial losses).
                </p>
              </div>

              <div>
                <label className="font-sans" style={{ fontSize: "0.86rem", fontWeight: "600", display: "block", marginBottom: "6px", color: "var(--ink)" }}>
                  Disputed Amount (₹ INR)
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 42000"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    backgroundColor: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "0.92rem",
                    fontFamily: "var(--font-sans)",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />

                <div
                  style={{
                    marginTop: "8px",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    backgroundColor: "var(--veriq-blue-subtle)",
                    border: "1px solid rgba(39, 133, 216, 0.2)",
                    fontSize: "0.8rem",
                    color: "var(--ink)"
                  }}
                >
                  🏛️ <strong>Appropriate Commission Forum:</strong> {getPecuniaryForum(amount)}
                </div>
              </div>

              {/* Case Review Card */}
              <div style={{ padding: "18px 20px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span className="font-sans text-muted" style={{ fontSize: "0.78rem", fontWeight: "700", textTransform: "uppercase" }}>
                    Docket Summary Prior to Investigation
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="font-sans"
                    style={{ background: "none", border: "none", color: "var(--veriq-blue)", fontSize: "0.8rem", cursor: "pointer", fontWeight: "600" }}
                  >
                    Edit Facts
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.84rem" }}>
                  <div>
                    <span className="text-muted" style={{ display: "block", fontSize: "0.74rem" }}>Category:</span>
                    <strong style={{ color: "var(--ink)" }}>{category}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ display: "block", fontSize: "0.74rem" }}>Disputed Value:</span>
                    <strong style={{ color: "var(--veriq-blue)" }}>{amount ? `₹ ${amount}` : "Pending Verification"}</strong>
                  </div>
                  <div>
                    <span className="text-muted" style={{ display: "block", fontSize: "0.74rem" }}>Product/Service:</span>
                    <span style={{ color: "var(--ink)" }}>{product || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="text-muted" style={{ display: "block", fontSize: "0.74rem" }}>Opposite Party:</span>
                    <span style={{ color: "var(--ink)" }}>{company || "Not specified"}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-veriq-secondary font-sans"
                  style={{ padding: "10px 18px" }}
                >
                  ← Back to Step 2
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="btn-veriq-primary font-sans"
                  style={{ padding: "12px 28px", fontSize: "0.95rem", fontWeight: "700" }}
                >
                  {isSubmitting ? "Opening Investigation Room..." : "Launch Case Investigation →"}
                </button>
              </div>

              {isSubmitting && (
                <div style={{ marginTop: "16px" }}>
                  <LoadingSpinner
                    variant="card"
                    size="sm"
                    message="Preparing your investigation…"
                    submessage="Benchmarking complaint particulars against CPA 2019 statutory provisions and opening your secure docket..."
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compact Collapsible Docket Details Toggle */}
        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            onClick={() => setShowSummaryPreview(!showSummaryPreview)}
            className="font-sans text-muted"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.82rem",
              textDecoration: "underline"
            }}
          >
            {showSummaryPreview ? "Hide Investigation Workflow Details ▲" : "View What Happens Next in Investigation Room ▼"}
          </button>

          {showSummaryPreview && (
            <div
              className="veriq-card"
              style={{
                marginTop: "16px",
                padding: "20px",
                textAlign: "left",
                fontSize: "0.82rem",
                color: "var(--ink-muted)",
                lineHeight: "1.6"
              }}
            >
              <strong>Investigation Pipeline:</strong>
              <ol style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                <li><strong>Factual Clarification:</strong> Targeted adaptive follow-ups tailored to your complaint facts.</li>
                <li><strong>Evidence Inspection:</strong> Upload and 7-status inspection of invoices, payment slips, defect reports.</li>
                <li><strong>Company Policy Research:</strong> Automated discovery of merchant return windows and warranty terms.</li>
                <li><strong>Phase 5 Readiness Gate:</strong> Automated verification that all essential dispute dimensions are documented.</li>
                <li><strong>Phase 6 Legal Assessment:</strong> Bilateral argument synthesis, Supreme Court/NCDRC citations, and Section 39 remedies.</li>
              </ol>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
