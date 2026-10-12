import React, { useState } from "react";
import BalanceBar from "../components/BalanceBar.jsx";

export default function StyleGuide() {
  const [theme, setTheme] = useState("dark");

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const colors = [
    { name: "--bg", label: "Background", hex: "var(--bg)" },
    { name: "--surface", label: "Surface Card", hex: "var(--surface)" },
    { name: "--surface-hover", label: "Surface Hover", hex: "var(--surface-hover)" },
    { name: "--brass", label: "Brass Accent", hex: "var(--brass)" },
    { name: "--support-green", label: "Support Green", hex: "var(--support-green)" },
    { name: "--oppose-oxblood", label: "Oppose Oxblood", hex: "var(--oppose-oxblood)" },
    { name: "--ink", label: "Primary Ink Text", hex: "var(--ink)" },
    { name: "--ink-muted", label: "Muted Text", hex: "var(--ink-muted)" },
    { name: "--line", label: "Hairline Border", hex: "var(--line)" }
  ];

  return (
    <div className="min-h-screen p-8 transition-colors duration-300" style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold">Module G — LexAgent Design System</h1>
            <p className="text-sm text-[var(--ink-muted)] mt-1 font-mono">
              Theme: <span className="uppercase text-[var(--brass)]">{theme}</span>
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-md font-mono text-sm font-semibold border border-[var(--brass)] text-[var(--brass)] hover:bg-[var(--brass-light)] transition"
          >
            Toggle {theme === "dark" ? "☀️ Light" : "🌙 Dark"} Mode
          </button>
        </div>

        {/* Color Palette Swatches */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif border-b border-[var(--line)] pb-2">1. Color Palette Swatches</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {colors.map((c) => (
              <div key={c.name} className="p-4 rounded-lg border border-[var(--line)] space-y-2" style={{ backgroundColor: "var(--surface)" }}>
                <div className="h-12 rounded border border-[var(--line)]" style={{ backgroundColor: c.hex }}></div>
                <div>
                  <div className="font-semibold text-sm">{c.label}</div>
                  <div className="font-mono text-xs text-[var(--ink-muted)]">{c.name}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography Showcase */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif border-b border-[var(--line)] pb-2">2. Typography Scale</h2>
          <div className="space-y-3 p-6 rounded-lg border border-[var(--line)]" style={{ backgroundColor: "var(--surface)" }}>
            <h1 className="text-3xl font-serif">Heading 1 — Consumer Disputes Adjudication</h1>
            <h2 className="text-2xl font-serif">Heading 2 — Statutory Analysis under CPA 2019</h2>
            <h3 className="text-xl font-serif">Heading 3 — Petitioner vs. Respondent Claims</h3>
            <p className="text-base font-sans">
              Body text: Section 2(10) defines a defect as any fault, imperfection, or shortcoming in quality or purity required under statutory law.
            </p>
            <p className="font-mono text-sm text-[var(--brass)]">
              Monospace text: [Section 39 Orders] — Citation Verified (✓ 100%)
            </p>
          </div>
        </section>

        {/* Signature Balance Bar Showcase */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif border-b border-[var(--line)] pb-2">3. Signature Balance Bar Component</h2>
          <div className="space-y-6">
            <BalanceBar position={-0.75} label="Favors Petitioner / Consumer (-0.75)" />
            <BalanceBar position={0.0} label="Balanced / Inconclusive Evidence (0.0)" />
            <BalanceBar position={0.6} label="Favors Respondent / Company (+0.60)" />
          </div>
        </section>

        {/* Card Component Samples */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif border-b border-[var(--line)] pb-2">4. Counsel Argument Cards</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Support Card */}
            <div className="p-6 rounded-xl border-l-4 border-l-[var(--support-green)] border border-[var(--line)] space-y-3" style={{ backgroundColor: "var(--surface)" }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-[var(--support-green)]">PETITIONER COUNSEL</span>
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--support-bg)] text-[var(--support-green-bright)]">SUPPORT</span>
              </div>
              <h3 className="text-lg font-serif">Manufacturing Defect under Section 2(10)</h3>
              <p className="text-sm text-[var(--ink-muted)]">
                The product encountered severe operational failure within 5 days of delivery, establishing a strong statutory defect claim.
              </p>
            </div>

            {/* Oppose Card */}
            <div className="p-6 rounded-xl border-l-4 border-l-[var(--oppose-oxblood)] border border-[var(--line)] space-y-3" style={{ backgroundColor: "var(--surface)" }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-[var(--oppose-oxblood)]">RESPONDENT COUNSEL</span>
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--oppose-bg)] text-[var(--oppose-oxblood-bright)]">OPPOSE</span>
              </div>
              <h3 className="text-lg font-serif">Absence of Certified Expert Technical Report</h3>
              <p className="text-sm text-[var(--ink-muted)]">
                The complainant has failed to submit a certified technical inspection report under Section 87 to prove factory fault.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
