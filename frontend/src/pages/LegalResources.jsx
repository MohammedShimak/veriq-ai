import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import BRAND from "../config/brand";

export default function LegalResources() {
  const [activeSection, setActiveSection] = useState("all");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, padding: "50px 24px", maxWidth: "1140px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Page Header */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span className="veriq-badge veriq-badge-teal font-sans">
              Resource Library
            </span>
            <span className="font-sans text-muted" style={{ fontSize: "0.8rem" }}>
              Official Portals • Procedural Guidance • Legal Standards
            </span>
          </div>

          <h1 className="font-sans" style={{ fontSize: "2.4rem", fontWeight: "800", letterSpacing: "-0.02em", margin: "0 0 10px 0", color: "var(--ink)" }}>
            Consumer Legal Resources
          </h1>
          <p className="font-sans" style={{ fontSize: "1.05rem", color: "var(--ink-muted)", margin: 0, maxWidth: "760px", lineHeight: "1.6" }}>
            A curated directory of authentic government grievance portals, statutory filing guidelines, pecuniary jurisdiction charts, limitation periods, and evidence preparation standards.
          </p>
        </div>

        {/* 1. OFFICIAL GOVERNMENT COMPLAINT PORTALS */}
        <section style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span className="veriq-badge veriq-badge-blue font-sans">Official Government Portals</span>
            <h2 className="font-sans" style={{ fontSize: "1.35rem", fontWeight: "700", margin: 0 }}>
              Official Redressal & Filing Portals
            </h2>
          </div>
          <p className="font-sans" style={{ fontSize: "0.88rem", color: "var(--ink-muted)", margin: "0 0 20px 0" }}>
            Government-run systems for pre-litigation grievance escalation, electronic dispute filing, and case tracking:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" }}>
            {/* e-Daakhil */}
            <div className="veriq-card" style={{ padding: "22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <h3 className="font-sans" style={{ fontSize: "1.1rem", fontWeight: "700", margin: 0 }}>
                    e-Daakhil Portal
                  </h3>
                  <span className="veriq-badge veriq-badge-emerald font-sans">Formal Filing</span>
                </div>
                <p className="font-sans" style={{ fontSize: "0.84rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                  The official NIC portal for filing consumer complaints online before District, State, and National Consumer Commissions across India.
                </p>
                <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "16px" }}>
                  <strong>Key Features:</strong> Online fee payment, document upload, commission selection, digital case tracking.
                </div>
              </div>
              <a
                href="https://edaakhil.nic.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-veriq-primary font-sans"
                style={{ textAlign: "center", fontSize: "0.84rem", padding: "8px 14px" }}
              >
                Visit edaakhil.nic.in ↗
              </a>
            </div>

            {/* National Consumer Helpline (NCH) */}
            <div className="veriq-card" style={{ padding: "22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <h3 className="font-sans" style={{ fontSize: "1.1rem", fontWeight: "700", margin: 0 }}>
                    National Consumer Helpline (NCH)
                  </h3>
                  <span className="veriq-badge veriq-badge-blue font-sans">Pre-Litigation</span>
                </div>
                <p className="font-sans" style={{ fontSize: "0.84rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                  Run by the Department of Consumer Affairs for early dispute mediation between consumers and convergence-registered companies.
                </p>
                <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "16px" }}>
                  <strong>Toll-Free Helpline:</strong> Dial <strong>1915</strong> or SMS <strong>8800001915</strong>.
                </div>
              </div>
              <a
                href="https://consumerhelpline.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-veriq-primary font-sans"
                style={{ textAlign: "center", fontSize: "0.84rem", padding: "8px 14px" }}
              >
                Visit consumerhelpline.gov.in ↗
              </a>
            </div>

            {/* CONFONET */}
            <div className="veriq-card" style={{ padding: "22px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <h3 className="font-sans" style={{ fontSize: "1.1rem", fontWeight: "700", margin: 0 }}>
                    CONFONET
                  </h3>
                  <span className="veriq-badge veriq-badge-slate font-sans">Case Records</span>
                </div>
                <p className="font-sans" style={{ fontSize: "0.84rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 14px 0" }}>
                  Computerisation and Networking of Consumer Fora. Search cause lists, case status, daily proceedings, and commission judgments.
                </p>
                <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "16px" }}>
                  <strong>Coverage:</strong> National, State, and District Consumer Dispute Commissions nationwide.
                </div>
              </div>
              <a
                href="http://confonet.nic.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-veriq-primary font-sans"
                style={{ textAlign: "center", fontSize: "0.84rem", padding: "8px 14px" }}
              >
                Visit confonet.nic.in ↗
              </a>
            </div>
          </div>
        </section>

        {/* 2. PECUNIARY JURISDICTION & LIMITATION PERIOD */}
        <section style={{ marginBottom: "40px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {/* Pecuniary Jurisdiction */}
            <div className="veriq-card" style={{ padding: "26px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span className="veriq-badge veriq-badge-amber font-sans">Jurisdiction Rules</span>
                <h3 className="font-sans" style={{ fontSize: "1.15rem", fontWeight: "700", margin: 0 }}>
                  Pecuniary Limits (2021 Notification)
                </h3>
              </div>
              <p className="font-sans" style={{ fontSize: "0.84rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 16px 0" }}>
                Under the Consumer Protection (Jurisdiction of the District Commission, State Commission and National Commission) Rules, 2021:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.84rem" }}>
                <div style={{ padding: "10px 12px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: "700", color: "var(--ink)" }}>District Commission (DCDRC)</div>
                  <div style={{ color: "var(--ink-muted)" }}>Value of consideration paid up to <strong>₹50 Lakhs</strong></div>
                </div>

                <div style={{ padding: "10px 12px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: "700", color: "var(--ink)" }}>State Commission (SCDRC)</div>
                  <div style={{ color: "var(--ink-muted)" }}>Value of consideration paid exceeding <strong>₹50 Lakhs up to ₹2 Crores</strong></div>
                </div>

                <div style={{ padding: "10px 12px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: "700", color: "var(--ink)" }}>National Commission (NCDRC)</div>
                  <div style={{ color: "var(--ink-muted)" }}>Value of consideration paid exceeding <strong>₹2 Crores</strong></div>
                </div>
              </div>
            </div>

            {/* Statutory Limitation Period */}
            <div className="veriq-card" style={{ padding: "26px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span className="veriq-badge veriq-badge-rose font-sans">Section 69</span>
                <h3 className="font-sans" style={{ fontSize: "1.15rem", fontWeight: "700", margin: 0 }}>
                  Statutory Limitation Period
                </h3>
              </div>
              <p className="font-sans" style={{ fontSize: "0.84rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: "0 0 16px 0" }}>
                A strict statutory deadline applies to consumer disputes under Indian law:
              </p>

              <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", marginBottom: "14px" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--veriq-navy)", marginBottom: "4px" }}>
                  2 Years from Cause of Action
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--ink-muted)", lineHeight: "1.5" }}>
                  The complaint must be instituted within two years from the date on which the cause of action arose (e.g. date of defective product delivery or date of final rejection of service).
                </div>
              </div>

              <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", lineHeight: "1.5" }}>
                <strong>Condonation of Delay:</strong> Under Section 69(2), the Commission may admit a complaint after 2 years only if the consumer shows "sufficient cause" for the delay, recorded in writing.
              </div>
            </div>
          </div>
        </section>

        {/* 3. EVIDENCE PREPARATION & DOCUMENT CHECKLIST */}
        <section style={{ marginBottom: "40px" }}>
          <div className="veriq-card" style={{ padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span className="veriq-badge veriq-badge-teal font-sans">Evidence Standards</span>
              <h2 className="font-sans" style={{ fontSize: "1.35rem", fontWeight: "700", margin: 0 }}>
                Essential Evidentiary Checklist for Consumer Claims
              </h2>
            </div>
            <p className="font-sans" style={{ fontSize: "0.9rem", color: "var(--ink-muted)", lineHeight: "1.6", margin: "0 0 20px 0" }}>
              Consumer dispute adjudicators require documentary proof of consumer standing (Section 2(7)), transaction value, defect/deficiency, and grievance communication:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              {[
                {
                  title: "1. Proof of Consideration & Purchase",
                  items: ["Retail Tax Invoice or Cash Memo", "Online Order Confirmation page", "Booking ID / Ticket Confirmation"]
                },
                {
                  title: "2. Proof of Payment",
                  items: ["Bank statement showing debit", "UPI transaction reference ID", "Credit/Debit card payment slip"]
                },
                {
                  title: "3. Proof of Defect or Failure",
                  items: ["Authorized service center job sheet", "Photographs/videos demonstrating fault", "Independent technician inspection report"]
                },
                {
                  title: "4. Communication & Escalation Log",
                  items: ["Emails sent to merchant customer support", "Customer care ticket numbers & chats", "Written rejection or refusal notice"]
                },
                {
                  title: "5. Pre-Litigation Legal Notice Copy",
                  items: ["Copy of dated legal notice served", "India Post Speed Post tracking proof", "Delivery acknowledgement / Email receipt"]
                },
                {
                  title: "6. Quantified Financial Claim",
                  items: ["Invoice replacement amount requested", "Direct financial losses incurred", "Interest calculation from date of payment"]
                }
              ].map((grp, idx) => (
                <div key={idx} style={{ padding: "16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--ink)", marginBottom: "8px" }}>
                    {grp.title}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.8rem", color: "var(--ink-muted)", lineHeight: "1.5" }}>
                    {grp.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. PRE-LITIGATION LEGAL NOTICE GUIDANCE */}
        <section style={{ marginBottom: "40px" }}>
          <div className="veriq-card" style={{ padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="veriq-badge veriq-badge-blue font-sans">Procedural Notice</span>
                <h2 className="font-sans" style={{ fontSize: "1.35rem", fontWeight: "700", margin: 0 }}>
                  Pre-Litigation Legal Notice Standards
                </h2>
              </div>
              <Link to="/help-hub" className="btn-veriq-secondary font-sans" style={{ fontSize: "0.84rem", padding: "6px 14px" }}>
                Generate Notice Draft on Help Hub →
              </Link>
            </div>
            <p className="font-sans" style={{ fontSize: "0.9rem", color: "var(--ink-muted)", lineHeight: "1.6", margin: "0 0 16px 0" }}>
              While a pre-litigation legal notice is not formally mandatory under CPA 2019, serving a written 15-day notice demonstrates consumer good faith, establishes merchant knowledge of the breach, and prevents opposite parties from claiming ignorance in court.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", fontSize: "0.84rem" }}>
              <div style={{ padding: "14px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                <strong>1. Accurate Chronology:</strong> State date of order, invoice number, delivery date, and when defect was first reported.
              </div>
              <div style={{ padding: "14px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                <strong>2. Specific Violation:</strong> Identify Section 2(10) defect, Section 2(11) deficiency, or Section 2(47) unfair trade practice.
              </div>
              <div style={{ padding: "14px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                <strong>3. Clear Demand:</strong> State exact remedy demanded (replacement, full refund with interest, or compensation).
              </div>
              <div style={{ padding: "14px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                <strong>4. 15-Day Cure Window:</strong> Give 15 days to comply before formal institution of proceedings before the Consumer Commission.
              </div>
            </div>
          </div>
        </section>

        {/* Action Callout */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px", borderRadius: "12px", backgroundColor: "var(--veriq-blue-subtle)", border: "1px solid rgba(39, 133, 216, 0.25)", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h3 className="font-sans" style={{ fontSize: "1.15rem", fontWeight: "700", margin: "0 0 4px 0", color: "var(--veriq-navy)" }}>
              Need AI-Guided Investigation for Your Specific Case?
            </h3>
            <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>
              Start an interactive investigation to evaluate your evidence against these statutory requirements.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/start-case" className="btn-veriq-primary font-sans" style={{ padding: "10px 20px" }}>
              Start Case Investigation →
            </Link>
            <Link to="/consumer-rights" className="btn-veriq-secondary font-sans" style={{ padding: "10px 18px" }}>
              Explore Consumer Rights
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
