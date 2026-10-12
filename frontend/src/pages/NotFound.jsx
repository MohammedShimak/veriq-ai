import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <span className="font-mono text-4xl text-[var(--brass)] font-bold">404</span>
        <h1 className="text-3xl font-serif">Page Not Found</h1>
        <p className="text-sm font-mono text-[var(--ink-muted)] max-w-md">
          The requested legal page or case route does not exist in the NeedhiAI (நீதி) system.
        </p>

        <Link
          to="/"
          className="px-6 py-3 rounded-lg font-mono text-xs font-semibold bg-[var(--brass)] text-[var(--bg)] hover:bg-[var(--brass-hover)] transition shadow-md"
        >
          Return to Portal Landing →
        </Link>
      </main>
    </div>
  );
}
