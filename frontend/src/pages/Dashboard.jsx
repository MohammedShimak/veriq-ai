import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import { getThreadsApi, deleteThreadApi } from "../services/historyApi";
import { useAuth } from "../context/AuthContext";
import BRAND from "../config/brand";

export default function Dashboard() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await getThreadsApi(accessToken);
        setThreads(data.threads || []);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load case history.");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [accessToken]);

  const handleDelete = async (threadId) => {
    if (!window.confirm("Are you sure you want to delete this case docket record?")) return;
    setDeletingId(threadId);
    try {
      await deleteThreadApi(threadId, accessToken);
      setThreads(threads.filter((t) => t.threadId !== threadId));
    } catch (err) {
      setError("Failed to delete case record.");
    } finally {
      setDeletingId(null);
    }
  };

  const categories = Array.from(new Set(threads.map((t) => t.category).filter(Boolean)));

  const filteredThreads = threads.filter((t) => {
    const matchesSearch =
      (t.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.firstQuestion || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.threadId || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === "all" || t.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalCases = threads.length;
  const activeCases = threads.filter((t) => t.stage !== "ASSESSMENT_COMPLETE" && t.stage !== "FINAL_OUTCOME").length;
  const completedCases = threads.filter((t) => t.stage === "ASSESSMENT_COMPLETE" || t.stage === "FINAL_OUTCOME").length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: "1140px", margin: "0 auto", padding: "48px 24px", width: "100%", boxSizing: "border-box" }}>
        {/* Header Title Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid var(--line)", paddingBottom: "24px", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span className="veriq-badge veriq-badge-blue font-sans">
                Case Management
              </span>
              <span className="font-sans text-muted" style={{ fontSize: "0.8rem" }}>
                {BRAND.jurisdiction}
              </span>
            </div>
            <h1 className="font-sans" style={{ fontSize: "2.1rem", fontWeight: "700", margin: "0 0 6px 0", letterSpacing: "-0.02em", color: "var(--ink)" }}>
              My Cases
            </h1>
            <p className="font-sans" style={{ fontSize: "0.92rem", color: "var(--ink-muted)", margin: 0 }}>
              Review, continue, and track your ongoing consumer dispute investigations and preliminary legal dossiers.
            </p>
          </div>

          <Link
            to="/start-case"
            className="btn-veriq-primary font-sans"
            style={{ padding: "10px 20px", fontSize: "0.88rem", fontWeight: "600" }}
          >
            + Start New Case
          </Link>
        </div>

        <ErrorBanner message={error} onClose={() => setError(null)} />

        {/* Real Summary Metrics Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          <div className="veriq-card" style={{ padding: "20px" }}>
            <div className="font-sans text-muted" style={{ fontSize: "0.76rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              Total Cases In Docket
            </div>
            <div className="font-sans" style={{ fontSize: "2rem", fontWeight: "700", color: "var(--ink)" }}>
              {totalCases}
            </div>
          </div>

          <div className="veriq-card" style={{ padding: "20px" }}>
            <div className="font-sans text-muted" style={{ fontSize: "0.76rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              Active Investigations
            </div>
            <div className="font-sans" style={{ fontSize: "2rem", fontWeight: "700", color: "var(--veriq-blue)" }}>
              {activeCases}
            </div>
          </div>

          <div className="veriq-card" style={{ padding: "20px" }}>
            <div className="font-sans text-muted" style={{ fontSize: "0.76rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              Assessments Ready
            </div>
            <div className="font-sans" style={{ fontSize: "2rem", fontWeight: "700", color: "var(--veriq-teal)" }}>
              {completedCases}
            </div>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by case ID, category, or grievance facts..."
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                backgroundColor: "var(--surface)",
                color: "var(--ink)",
                fontSize: "0.9rem",
                fontFamily: "var(--font-sans)",
                boxSizing: "border-box",
                outline: "none"
              }}
            />
          </div>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                backgroundColor: "var(--surface)",
                color: "var(--ink)",
                fontSize: "0.88rem",
                fontFamily: "var(--font-sans)",
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value="all">All Categories ({threads.length})</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>

        {/* Case List Content */}
        {loading ? (
          <LoadingSpinner message="Retrieving your case docket history..." />
        ) : filteredThreads.length === 0 ? (
          <div
            className="veriq-card"
            style={{
              padding: "56px 24px",
              textAlign: "center",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)"
            }}
          >
            <div style={{ fontSize: "2.8rem", marginBottom: "12px" }}>📂</div>
            <h3 className="font-sans" style={{ fontSize: "1.25rem", fontWeight: "700", margin: "0 0 6px 0", color: "var(--ink)" }}>
              No Case Records Found
            </h3>
            <p className="font-sans" style={{ fontSize: "0.88rem", color: "var(--ink-muted)", margin: "0 0 20px 0", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
              {searchTerm || categoryFilter !== "all"
                ? "No cases match your active search or category filters."
                : "You have not started any consumer dispute investigations yet."}
            </p>
            <Link
              to="/start-case"
              className="btn-veriq-primary font-sans"
              style={{ padding: "11px 22px", fontSize: "0.88rem", fontWeight: "600" }}
            >
              Start Your First Case →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredThreads.map((t) => {
              const isCompleted = t.stage === "ASSESSMENT_COMPLETE" || t.stage === "FINAL_OUTCOME";

              return (
                <div
                  key={t.threadId}
                  className="veriq-card"
                  style={{
                    padding: "24px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "18px",
                    transition: "border-color 0.15s ease"
                  }}
                >
                  <div style={{ flex: 1, minWidth: "300px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                      <span className="veriq-badge veriq-badge-blue font-sans">
                        {t.category || "Consumer Dispute"}
                      </span>
                      <span
                        className={`veriq-badge ${isCompleted ? "veriq-badge-teal" : "veriq-badge-amber"} font-sans`}
                      >
                        {isCompleted ? "✓ Assessment Ready" : "Investigation Active"}
                      </span>
                      <span className="font-sans text-muted" style={{ fontSize: "0.75rem" }}>
                        Docket ID: {t.threadId}
                      </span>
                    </div>

                    <h3
                      onClick={() => {
                        navigate(isCompleted ? `/investigation/${t.threadId}/outcome` : `/investigation/${t.threadId}`);
                      }}
                      className="font-sans"
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: "600",
                        margin: "0 0 10px 0",
                        cursor: "pointer",
                        lineHeight: "1.4",
                        color: "var(--ink)"
                      }}
                    >
                      {t.firstQuestion || "Consumer dispute claim"}
                    </h3>

                    <div className="font-sans text-muted" style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: "0.8rem" }}>
                      <span>🔄 Turns: <strong>{t.turnCount || 1}</strong></span>
                      <span>📅 Date: <strong>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "Recent"}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        navigate(isCompleted ? `/investigation/${t.threadId}/outcome` : `/investigation/${t.threadId}`);
                      }}
                      className={isCompleted ? "btn-veriq-teal font-sans" : "btn-veriq-primary font-sans"}
                      style={{
                        padding: "9px 16px",
                        fontSize: "0.84rem",
                        fontWeight: "600"
                      }}
                    >
                      {isCompleted ? "View Final Case Outcome →" : "Resume Investigation →"}
                    </button>

                    <button
                      onClick={() => handleDelete(t.threadId)}
                      disabled={deletingId === t.threadId}
                      className="btn-veriq-secondary font-sans"
                      style={{
                        padding: "9px 14px",
                        fontSize: "0.82rem",
                        color: "#e11d48"
                      }}
                    >
                      {deletingId === t.threadId ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
