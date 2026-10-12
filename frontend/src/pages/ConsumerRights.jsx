import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import BRAND from "../config/brand";

export default function ConsumerRights() {
  const [activeTab, setActiveTab] = useState("six_rights");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, padding: "50px 24px", maxWidth: "1140px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Page Header */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span className="veriq-badge veriq-badge-blue font-sans">
              Statutory Legal Information
            </span>
            <span className="font-sans text-muted" style={{ fontSize: "0.8rem" }}>
              Consumer Protection Act, 2019 (Act No. 35 of 2019)
            </span>
          </div>

          <h1 className="font-sans" style={{ fontSize: "2.4rem", fontWeight: "800", letterSpacing: "-0.02em", margin: "0 0 10px 0", color: "var(--ink)" }}>
            Consumer Rights in India
          </h1>
          <p className="font-sans" style={{ fontSize: "1.05rem", color: "var(--ink-muted)", margin: 0, maxWidth: "760px", lineHeight: "1.6" }}>
            A verified guide to statutory consumer protections, definitions of defect and deficiency, unfair trade practices, product liability, and legal remedies under the Consumer Protection Act, 2019.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            borderBottom: "1px solid var(--line)",
            marginBottom: "32px",
            overflowX: "auto",
            paddingBottom: "2px"
          }}
        >
          {[
            { id: "six_rights", label: "1. The 6 Consumer Rights (Sec 2(9))" },
            { id: "defect_deficiency", label: "2. Defect vs. Deficiency (Sec 2(10) & 2(11))" },
            { id: "utp", label: "3. Unfair Trade Practices (Sec 2(47))" },
            { id: "product_liability", label: "4. Product Liability (Sec 82–87)" },
            { id: "remedies", label: "5. Available Legal Remedies (Sec 39)" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="font-sans"
              style={{
                padding: "10px 16px",
                fontSize: "0.88rem",
                fontWeight: activeTab === tab.id ? "600" : "500",
                color: activeTab === tab.id ? "var(--veriq-blue)" : "var(--ink-muted)",
                backgroundColor: activeTab === tab.id ? "var(--veriq-blue-subtle)" : "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid var(--veriq-blue)" : "2px solid transparent",
                borderRadius: "6px 6px 0 0",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: THE 6 STATUTORY CONSUMER RIGHTS */}
        {activeTab === "six_rights" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="veriq-card" style={{ padding: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span className="veriq-badge veriq-badge-teal font-sans">Section 2(9)</span>
                <h2 className="font-sans" style={{ fontSize: "1.4rem", fontWeight: "700", margin: 0 }}>
                  Statutory Consumer Rights Recognized by Law
                </h2>
              </div>
              <p className="font-sans" style={{ fontSize: "0.92rem", color: "var(--ink-muted)", lineHeight: "1.6", margin: "0 0 20px 0" }}>
                Section 2(9) of the Consumer Protection Act, 2019 codifies six fundamental consumer rights enforceable across Indian consumer commissions.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                {[
                  {
                    num: "I",
                    title: "Right to Safety",
                    statute: "Section 2(9)(i)",
                    desc: "Protection against the marketing of goods, products, or services that are hazardous to life, health, or property. Applies to defective electrical equipment, expired medications, unsafe vehicle components, and hazardous food items."
                  },
                  {
                    num: "II",
                    title: "Right to Information",
                    statute: "Section 2(9)(ii)",
                    desc: "The right to be informed about the quality, quantity, potency, purity, standard, and price of goods or services. Protects consumers from misleading advertisements, hidden terms, undisclosed fees, and deceptive claims."
                  },
                  {
                    num: "III",
                    title: "Right to Choose",
                    statute: "Section 2(9)(iii)",
                    desc: "Assurance of access to a variety of competitive goods and services at fair prices. Prohibits restrictive trade agreements, predatory bundling, and arbitrary merchant monopolies."
                  },
                  {
                    num: "IV",
                    title: "Right to be Heard",
                    statute: "Section 2(9)(iv)",
                    desc: "Assurance that consumer grievances will receive due consideration at appropriate statutory forums, dispute tribunals, and internal corporate grievance mechanisms."
                  },
                  {
                    num: "V",
                    title: "Right to Redressal",
                    statute: "Section 2(9)(v)",
                    desc: "The right to seek effective remedy against unfair trade practices, restrictive trade practices, or unscrupulous consumer exploitation through District, State, and National Consumer Commissions."
                  },
                  {
                    num: "VI",
                    title: "Right to Consumer Awareness",
                    statute: "Section 2(9)(vi)",
                    desc: "The right to acquire consumer knowledge and skill to make informed purchasing decisions throughout life, supported through official central and state initiatives like the Jago Grahak Jago mission."
                  }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "20px",
                      borderRadius: "10px",
                      backgroundColor: "var(--bg)",
                      border: "1px solid var(--line)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span className="font-sans" style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--veriq-blue)" }}>
                        RIGHT #{item.num} • {item.statute}
                      </span>
                    </div>
                    <h3 className="font-sans" style={{ fontSize: "1.05rem", fontWeight: "700", margin: "0 0 6px 0" }}>
                      {item.title}
                    </h3>
                    <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEFECT VS. DEFICIENCY */}
        {activeTab === "defect_deficiency" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="veriq-card" style={{ padding: "28px" }}>
              <h2 className="font-sans" style={{ fontSize: "1.4rem", fontWeight: "700", margin: "0 0 12px 0" }}>
                Understanding "Defect" in Goods vs. "Deficiency" in Services
              </h2>
              <p className="font-sans" style={{ fontSize: "0.92rem", color: "var(--ink-muted)", lineHeight: "1.6", margin: "0 0 24px 0" }}>
                Under Indian consumer jurisprudence, complaints against physical items fall under "Defect" (Section 2(10)), while complaints against service providers fall under "Deficiency" (Section 2(11)).
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {/* Defect Column */}
                <div style={{ padding: "22px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span className="veriq-badge veriq-badge-teal font-sans">Goods</span>
                    <span className="font-sans" style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--ink)" }}>Section 2(10)</span>
                  </div>
                  <h3 className="font-sans" style={{ fontSize: "1.15rem", fontWeight: "700", margin: "0 0 8px 0" }}>
                    Defect in Goods
                  </h3>
                  <blockquote style={{ margin: "0 0 12px 0", padding: "10px 14px", backgroundColor: "var(--surface)", borderLeft: "3px solid var(--veriq-teal)", borderRadius: "4px", fontSize: "0.82rem", color: "var(--ink)", fontStyle: "italic" }}>
                    "Any fault, imperfection or shortcoming in the quality, quantity, potency, purity or standard which is required to be maintained by or under any law... or under any contract, express or implied, or as is claimed by the trader."
                  </blockquote>
                  <div className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", lineHeight: "1.5" }}>
                    <strong>Common Examples:</strong>
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
                      <li>Mobile screen malfunction or display flicker upon delivery</li>
                      <li>Automobile engine transmission breakdown under warranty</li>
                      <li>Substandard materials in furniture or household appliances</li>
                      <li>Foreign particles or contamination in packaged food items</li>
                    </ul>
                  </div>
                </div>

                {/* Deficiency Column */}
                <div style={{ padding: "22px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span className="veriq-badge veriq-badge-blue font-sans">Services</span>
                    <span className="font-sans" style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--ink)" }}>Section 2(11)</span>
                  </div>
                  <h3 className="font-sans" style={{ fontSize: "1.15rem", fontWeight: "700", margin: "0 0 8px 0" }}>
                    Deficiency in Service
                  </h3>
                  <blockquote style={{ margin: "0 0 12px 0", padding: "10px 14px", backgroundColor: "var(--surface)", borderLeft: "3px solid var(--veriq-blue)", borderRadius: "4px", fontSize: "0.82rem", color: "var(--ink)", fontStyle: "italic" }}>
                    "Any fault, imperfection, shortcoming or inadequacy in the quality, nature and manner of performance... including any act of negligence or omission or deliberate withholding of relevant information."
                  </blockquote>
                  <div className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", lineHeight: "1.5" }}>
                    <strong>Common Examples:</strong>
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
                      <li>Airlines cancelling flights without statutory refund or hotel accommodation</li>
                      <li>Banks improperly debiting fraudulent unauthorized charges</li>
                      <li>Insurance companies wrongfully repudiating legitimate health claims</li>
                      <li>Builders delaying apartment possession beyond the contractual date</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: UNFAIR TRADE PRACTICES */}
        {activeTab === "utp" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="veriq-card" style={{ padding: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span className="veriq-badge veriq-badge-rose font-sans">Section 2(47)</span>
                <h2 className="font-sans" style={{ fontSize: "1.4rem", fontWeight: "700", margin: 0 }}>
                  Unfair Trade Practices (UTP)
                </h2>
              </div>
              <p className="font-sans" style={{ fontSize: "0.92rem", color: "var(--ink-muted)", lineHeight: "1.6", margin: "0 0 20px 0" }}>
                Section 2(47) targets deceptive, unfair, and exploitative merchant practices in commerce, including e-commerce platforms.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                {[
                  {
                    title: "Misleading Advertisements",
                    desc: "Falsely claiming performance characteristics, accessories, uses, or benefits that goods or services do not possess."
                  },
                  {
                    title: "Refusal to Issue Invoices",
                    desc: "Failing to issue a tax invoice, bill, or cash memo for goods sold or services rendered."
                  },
                  {
                    title: "Refusal to Take Back Defective Goods",
                    desc: "Refusing to accept return of defective goods or refund the consideration within the period stipulated on the bill (or within 30 days if unspecified)."
                  },
                  {
                    title: "Bait Advertising & Artificial Scarcity",
                    desc: "Advertising goods at bargain prices without intending to supply them in reasonable quantities, or fabricating false urgency."
                  },
                  {
                    title: "Unauthorized Data Disclosure",
                    desc: "Disclosing personal consumer information provided during a transaction to third parties without prior consent."
                  },
                  {
                    title: "E-Commerce Dark Patterns",
                    desc: "Drip pricing, forced continuity, disguised ads, and deceptive cancellation friction prohibited under CPA 2019 guidelines."
                  }
                ].map((item, idx) => (
                  <div key={idx} style={{ padding: "18px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <h3 className="font-sans" style={{ fontSize: "0.98rem", fontWeight: "700", margin: "0 0 6px 0", color: "var(--ink)" }}>
                      {item.title}
                    </h3>
                    <p className="font-sans" style={{ fontSize: "0.82rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PRODUCT LIABILITY */}
        {activeTab === "product_liability" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="veriq-card" style={{ padding: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span className="veriq-badge veriq-badge-amber font-sans">Chapter VI • Sections 82–87</span>
                <h2 className="font-sans" style={{ fontSize: "1.4rem", fontWeight: "700", margin: 0 }}>
                  Statutory Product Liability
                </h2>
              </div>
              <p className="font-sans" style={{ fontSize: "0.92rem", color: "var(--ink-muted)", lineHeight: "1.6", margin: "0 0 20px 0" }}>
                The 2019 Act introduced strict product liability into Indian consumer law, holding manufacturers, service providers, and sellers accountable for harm caused by defective products.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
                <div style={{ padding: "20px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <h3 className="font-sans" style={{ fontSize: "1.05rem", fontWeight: "700", margin: "0 0 6px 0" }}>
                    Liability of Product Manufacturer (Sec 84)
                  </h3>
                  <p className="font-sans" style={{ fontSize: "0.84rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: 0 }}>
                    A manufacturer is liable if the product has a manufacturing defect, design defect, deviates from manufacturing specifications, lacks adequate usage warnings, or fails an express warranty.
                  </p>
                </div>

                <div style={{ padding: "20px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <h3 className="font-sans" style={{ fontSize: "1.05rem", fontWeight: "700", margin: "0 0 6px 0" }}>
                    Liability of Product Service Provider (Sec 85)
                  </h3>
                  <p className="font-sans" style={{ fontSize: "0.84rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: 0 }}>
                    A service provider is liable if the service provided was faulty, imperfect, deficient, or rendered without adequate safety warnings to prevent harm.
                  </p>
                </div>

                <div style={{ padding: "20px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <h3 className="font-sans" style={{ fontSize: "1.05rem", fontWeight: "700", margin: "0 0 6px 0" }}>
                    Liability of Product Seller (Sec 86)
                  </h3>
                  <p className="font-sans" style={{ fontSize: "0.84rem", color: "var(--ink-muted)", lineHeight: "1.5", margin: 0 }}>
                    A seller or e-commerce marketplace is liable if they exercised substantial control over design/testing, altered the product, or failed to identify the original manufacturer upon notice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AVAILABLE LEGAL REMEDIES */}
        {activeTab === "remedies" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="veriq-card" style={{ padding: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span className="veriq-badge veriq-badge-emerald font-sans">Section 39 Reliefs</span>
                <h2 className="font-sans" style={{ fontSize: "1.4rem", fontWeight: "700", margin: 0 }}>
                  Remedies Available Under Section 39
                </h2>
              </div>
              <p className="font-sans" style={{ fontSize: "0.92rem", color: "var(--ink-muted)", lineHeight: "1.6", margin: "0 0 20px 0" }}>
                Where the District Consumer Commission is satisfied that the goods or services were defective or deficient, Section 39 empowers the bench to issue binding orders:
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
                {[
                  { title: "Removal of Defects", desc: "Order the merchant to repair and remove defects from the goods without cost to the consumer." },
                  { title: "Replacement with New Goods", desc: "Replace the defective item with a new product of similar description, free from any fault." },
                  { title: "Refund of Price with Interest", desc: "Return to the complainant the entire purchase price or fee paid, along with statutory interest." },
                  { title: "Compensation for Loss & Injury", desc: "Award compensation for any mental agony, financial loss, or physical injury suffered due to negligence." },
                  { title: "Punitive Damages", desc: "Grant punitive damages in appropriate circumstances to deter continuous merchant malpractices." },
                  { title: "Cease & Desist Orders", desc: "Order the immediate cessation of unfair trade practices and withdrawal of hazardous products." },
                  { title: "Litigation Costs", desc: "Award reasonable costs incurred by the consumer in preparing notices and pursuing the dispute." }
                ].map((item, idx) => (
                  <div key={idx} style={{ padding: "16px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                    <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "var(--veriq-navy)", marginBottom: "4px" }}>
                      ✓ {item.title}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", lineHeight: "1.4" }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* OFFICIAL SOURCES & EXTERNAL CITATIONS */}
        <div style={{ marginTop: "36px", padding: "24px", borderRadius: "10px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
          <h3 className="font-sans" style={{ fontSize: "1.1rem", fontWeight: "700", margin: "0 0 10px 0" }}>
            Official Statutory Sources & References
          </h3>
          <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: "0 0 16px 0" }}>
            The provisions detailed above are codified in Act No. 35 of 2019 passed by the Parliament of India:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "0.85rem" }}>
            <a
              href="https://consumeraffairs.nic.in/acts-and-rules/consumer-protection"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--veriq-blue)", textDecoration: "none", fontWeight: "500" }}
            >
              ↗ Department of Consumer Affairs (consumeraffairs.nic.in)
            </a>
            <span className="text-muted">•</span>
            <a
              href="http://ncdrc.nic.in/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--veriq-blue)", textDecoration: "none", fontWeight: "500" }}
            >
              ↗ National Consumer Disputes Redressal Commission (ncdrc.nic.in)
            </a>
            <span className="text-muted">•</span>
            <a
              href="https://consumerhelpline.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--veriq-blue)", textDecoration: "none", fontWeight: "500" }}
            >
              ↗ National Consumer Helpline (consumerhelpline.gov.in)
            </a>
          </div>
        </div>

        {/* Action Callout */}
        <div style={{ marginTop: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px", borderRadius: "12px", backgroundColor: "var(--veriq-blue-subtle)", border: "1px solid rgba(39, 133, 216, 0.25)", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h3 className="font-sans" style={{ fontSize: "1.15rem", fontWeight: "700", margin: "0 0 4px 0", color: "var(--veriq-navy)" }}>
              Have a dispute involving these rights?
            </h3>
            <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>
              Veriq evaluates your factual timeline and evidence against these exact provisions.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/start-case" className="btn-veriq-primary font-sans" style={{ padding: "10px 20px" }}>
              Start Case Investigation →
            </Link>
            <Link to="/legal-resources" className="btn-veriq-secondary font-sans" style={{ padding: "10px 18px" }}>
              View Legal Resources
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
