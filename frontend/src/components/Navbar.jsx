import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { submitFeedbackApi } from "../services/feedbackApi";
import BRAND from "../config/brand";
import BrandLogo from "./BrandLogo";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout, accessToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [currentTime, setCurrentTime] = useState("");
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackDone, setFeedbackDone] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted =
        now.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }).toUpperCase() +
        " " +
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }) +
        " IST";
      setCurrentTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackRating) return;
    try {
      await submitFeedbackApi(null, 0, feedbackRating, feedbackComment, accessToken);
      setFeedbackDone(true);
    } catch (err) {
      console.warn("Feedback submission warning:", err);
      setFeedbackDone(true);
    }
  };

  const isLinkActive = (path) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path === "/start-case" && (location.pathname === "/start-case" || location.pathname === "/new-case")) return true;
    if (path === "/my-cases" && (location.pathname === "/my-cases" || location.pathname === "/dashboard")) return true;
    if (path !== "/" && path !== "/start-case" && path !== "/my-cases" && (location.pathname === path || location.pathname.startsWith(path + "/"))) return true;
    return false;
  };

  return (
    <>
      <header
        className="docket-topbar font-sans"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          width: "100%",
          maxWidth: "100vw",
          padding: "10px 24px",
          borderBottom: "1px solid var(--line)",
          backgroundColor: "var(--surface)",
          boxSizing: "border-box"
        }}
      >
        {/* Left: Brand Logo & Navigation Drawer Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
          <button
            onClick={() => setIsNavDrawerOpen(!isNavDrawerOpen)}
            className="btn-veriq-secondary font-sans"
            style={{
              padding: "5px 10px",
              fontSize: "0.82rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
            title="Toggle Menu"
          >
            {isNavDrawerOpen ? "✕" : "☰"}
          </button>

          <BrandLogo size="md" to="/" />
        </div>

        {/* Center: Desktop Navigation Bar */}
        <nav
          className="desktop-nav"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <Link
            to="/"
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: isLinkActive("/") ? "600" : "500",
              color: isLinkActive("/") ? "var(--veriq-blue)" : "var(--ink-muted)",
              backgroundColor: isLinkActive("/") ? "var(--veriq-blue-subtle)" : "transparent",
              textDecoration: "none"
            }}
          >
            Home
          </Link>

          <Link
            to="/help-hub"
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: isLinkActive("/help-hub") ? "600" : "500",
              color: isLinkActive("/help-hub") ? "var(--veriq-blue)" : "var(--ink-muted)",
              backgroundColor: isLinkActive("/help-hub") ? "var(--veriq-blue-subtle)" : "transparent",
              textDecoration: "none"
            }}
          >
            Consumer Help Hub
          </Link>

          <Link
            to="/start-case"
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: isLinkActive("/start-case") ? "600" : "500",
              color: isLinkActive("/start-case") ? "var(--veriq-blue)" : "var(--ink-muted)",
              backgroundColor: isLinkActive("/start-case") ? "var(--veriq-blue-subtle)" : "transparent",
              textDecoration: "none"
            }}
          >
            Start a Case
          </Link>

          {user && (
            <Link
              to="/my-cases"
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.85rem",
                fontWeight: isLinkActive("/my-cases") ? "600" : "500",
                color: isLinkActive("/my-cases") ? "var(--veriq-blue)" : "var(--ink-muted)",
                backgroundColor: isLinkActive("/my-cases") ? "var(--veriq-blue-subtle)" : "transparent",
                textDecoration: "none"
              }}
            >
              My Cases
            </Link>
          )}

          <Link
            to="/consumer-rights"
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: isLinkActive("/consumer-rights") ? "600" : "500",
              color: isLinkActive("/consumer-rights") ? "var(--veriq-blue)" : "var(--ink-muted)",
              backgroundColor: isLinkActive("/consumer-rights") ? "var(--veriq-blue-subtle)" : "transparent",
              textDecoration: "none"
            }}
          >
            Consumer Rights
          </Link>

          <Link
            to="/legal-resources"
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: isLinkActive("/legal-resources") ? "600" : "500",
              color: isLinkActive("/legal-resources") ? "var(--veriq-blue)" : "var(--ink-muted)",
              backgroundColor: isLinkActive("/legal-resources") ? "var(--veriq-blue-subtle)" : "transparent",
              textDecoration: "none"
            }}
          >
            Legal Resources
          </Link>
        </nav>

        {/* Right: Clock, Theme, Feedback & User Auth */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <span
            className="font-mono text-muted hide-mobile"
            style={{ fontSize: "0.74rem", opacity: 0.8 }}
          >
            {currentTime}
          </span>

          <button
            onClick={toggleTheme}
            className="btn-veriq-secondary font-sans"
            style={{ padding: "5px 10px", fontSize: "0.8rem", cursor: "pointer" }}
            title="Toggle Light/Dark Theme"
          >
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>

          <button
            onClick={() => setShowFeedbackModal(true)}
            className="btn-veriq-secondary font-sans hide-mobile"
            style={{ padding: "5px 12px", fontSize: "0.8rem", cursor: "pointer" }}
            title="Submit Feedback"
          >
            💬 Feedback
          </button>

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "0.78rem",
                  fontWeight: "600",
                  backgroundColor: "var(--surface-hover)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)"
                }}
              >
                👤 {user.name ? user.name.split(" ")[0] : user.role === "admin" ? "Admin" : "User"}
              </span>
              <button
                onClick={handleLogout}
                className="btn-veriq-secondary font-sans"
                style={{ padding: "5px 10px", fontSize: "0.78rem", cursor: "pointer" }}
              >
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Link
                to="/login"
                className="btn-veriq-primary font-sans"
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* RESPONSIVE MOBILE / FULL NAVIGATION DRAWER */}
      {isNavDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 9998,
            display: "flex",
            justifyContent: "flex-start"
          }}
          onClick={() => setIsNavDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "300px",
              height: "100%",
              backgroundColor: "var(--surface)",
              borderRight: "1px solid var(--line)",
              padding: "24px 20px",
              boxShadow: "10px 0 30px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              boxSizing: "border-box"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <BrandLogo size="sm" showTagline={false} to={null} />
              </div>
              <button
                onClick={() => setIsNavDrawerOpen(false)}
                style={{ background: "none", border: "none", color: "var(--ink-muted)", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => { setIsNavDrawerOpen(false); navigate("/"); }}
                className="btn-veriq-secondary font-sans"
                style={{ width: "100%", textAlign: "left", justifyContent: "flex-start" }}
              >
                🏠 Home
              </button>

              <button
                onClick={() => { setIsNavDrawerOpen(false); navigate("/help-hub"); }}
                className="btn-veriq-secondary font-sans"
                style={{ width: "100%", textAlign: "left", justifyContent: "flex-start" }}
              >
                🛡️ Consumer Help Hub
              </button>

              <button
                onClick={() => { setIsNavDrawerOpen(false); navigate("/start-case"); }}
                className="btn-veriq-primary font-sans"
                style={{ width: "100%", textAlign: "left", justifyContent: "flex-start" }}
              >
                ✍️ Start a Case
              </button>

              {user && (
                <button
                  onClick={() => { setIsNavDrawerOpen(false); navigate("/my-cases"); }}
                  className="btn-veriq-secondary font-sans"
                  style={{ width: "100%", textAlign: "left", justifyContent: "flex-start" }}
                >
                  📊 My Cases
                </button>
              )}

              <button
                onClick={() => { setIsNavDrawerOpen(false); navigate("/consumer-rights"); }}
                className="btn-veriq-secondary font-sans"
                style={{ width: "100%", textAlign: "left", justifyContent: "flex-start" }}
              >
                ⚖️ Consumer Rights
              </button>

              <button
                onClick={() => { setIsNavDrawerOpen(false); navigate("/legal-resources"); }}
                className="btn-veriq-secondary font-sans"
                style={{ width: "100%", textAlign: "left", justifyContent: "flex-start" }}
              >
                📖 Legal Resources
              </button>

              <div style={{ borderTop: "1px solid var(--line)", margin: "8px 0" }} />

              {!user ? (
                <button
                  onClick={() => { setIsNavDrawerOpen(false); navigate("/login"); }}
                  className="btn-veriq-primary font-sans"
                  style={{ width: "100%" }}
                >
                  Sign In
                </button>
              ) : (
                <button
                  onClick={() => { setIsNavDrawerOpen(false); handleLogout(); }}
                  className="btn-veriq-secondary font-sans"
                  style={{ width: "100%" }}
                >
                  🚪 Logout
                </button>
              )}
            </div>

            <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
              <span className="font-sans text-muted" style={{ fontSize: "0.72rem", display: "block" }}>
                {BRAND.legalNotice}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {showFeedbackModal && (
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
          onClick={() => setShowFeedbackModal(false)}
        >
          <div
            className="veriq-card font-sans"
            style={{ maxWidth: "480px", width: "100%", padding: "26px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "700" }}>Share Your Feedback</h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--ink-muted)" }}
              >
                ✕
              </button>
            </div>

            {!feedbackDone ? (
              <form onSubmit={handleFeedbackSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: "600", display: "block", marginBottom: "8px" }}>
                    How helpful was the legal guidance?
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          borderRadius: "6px",
                          border: feedbackRating === star ? "2px solid var(--veriq-blue)" : "1px solid var(--line)",
                          background: feedbackRating === star ? "var(--veriq-blue-subtle)" : "var(--bg)",
                          cursor: "pointer",
                          fontWeight: "600",
                          color: feedbackRating === star ? "var(--veriq-blue)" : "var(--ink)"
                        }}
                      >
                        {star} ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                    Comments or Suggestions (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Tell us what worked well or what we can clarify..."
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      background: "var(--bg)",
                      color: "var(--ink)",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!feedbackRating}
                  className="btn-veriq-primary font-sans"
                  style={{ padding: "10px", marginTop: "4px" }}
                >
                  Submit Feedback
                </button>
              </form>
            ) : (
              <div style={{ textAlign: "center", padding: "18px 0" }}>
                <span style={{ fontSize: "2rem" }}>✓</span>
                <h4 style={{ margin: "10px 0 6px 0", fontSize: "1.1rem" }}>Thank You!</h4>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: "0 0 16px 0" }}>
                  Your feedback helps us refine our consumer dispute reasoning engine.
                </p>
                <button
                  onClick={() => { setShowFeedbackModal(false); setFeedbackDone(false); }}
                  className="btn-veriq-primary font-sans"
                  style={{ padding: "8px 20px" }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
