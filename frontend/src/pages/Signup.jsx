import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ErrorBanner from "../components/ErrorBanner";
import BRAND from "../config/brand";

export default function Signup() {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [role, setRole] = useState("user"); // "user" or "admin"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup, login, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");

    if (!isLoginMode) {
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify your passwords.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
    }

    setLoading(true);
    try {
      let authUser;
      if (isLoginMode) {
        authUser = await login(email, password);
      } else {
        authUser = await signup(name, email, password, role);
      }

      const redirectPath =
        location.state?.from?.pathname ||
        (authUser && authUser.role === "admin" ? "/admin" : "/my-cases");
      navigate(redirectPath, { replace: true });
    } catch (err) {
      const serverMsg = err.response?.data?.error;
      if (serverMsg === "Email already registered.") {
        setError("This email address is already registered. Please switch to the Log In tab below.");
      } else if (serverMsg === "Invalid email or password.") {
        setError("Invalid email or password. Please verify your credentials or create a new account.");
      } else {
        setError(serverMsg || err.message || "Authentication failed. Please verify your details.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", maxWidth: "600px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Header Branding */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "var(--veriq-blue)",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "800",
              fontSize: "1.25rem",
              marginBottom: "12px"
            }}
          >
            V
          </div>
          <h1 className="font-sans" style={{ fontSize: "1.9rem", fontWeight: "700", margin: "0 0 6px 0", letterSpacing: "-0.02em", color: "var(--ink)" }}>
            Welcome to {BRAND.name}
          </h1>
          <p className="font-sans" style={{ fontSize: "0.88rem", margin: 0, color: "var(--ink-muted)", maxWidth: "480px" }}>
            Create an account or sign in to start consumer dispute investigations and review evidence assessments.
          </p>
        </div>

        {/* If user is already logged in */}
        {user ? (
          <div
            className="veriq-card"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "32px",
              textAlign: "center",
              boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)"
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                backgroundColor: "var(--veriq-blue-subtle)",
                color: "var(--veriq-blue)",
                fontSize: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontWeight: "700"
              }}
            >
              {user.name ? user.name[0].toUpperCase() : "U"}
            </div>
            <h2 className="font-sans" style={{ fontSize: "1.3rem", fontWeight: "700", margin: "0 0 4px 0", color: "var(--ink)" }}>
              {user.name}
            </h2>
            <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: "0 0 14px 0" }}>
              {user.email}
            </p>
            <span
              className="veriq-badge veriq-badge-blue font-sans"
              style={{ display: "inline-block", marginBottom: "20px" }}
            >
              Role: {user.role}
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => navigate(user.role === "admin" ? "/admin" : "/my-cases")}
                className="btn-veriq-primary font-sans"
                style={{ width: "100%", padding: "12px", fontSize: "0.92rem" }}
              >
                Go to {user.role === "admin" ? "Admin Analytics Portal" : "My Cases Dashboard"} →
              </button>
              <button
                onClick={logout}
                className="btn-veriq-secondary font-sans"
                style={{ width: "100%", padding: "11px", fontSize: "0.88rem" }}
              >
                Sign Out & Switch Account
              </button>
            </div>
          </div>
        ) : (
          /* Main Auth Form Card */
          <div
            className="veriq-card"
            style={{
              width: "100%",
              padding: "32px 30px",
              boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
              boxSizing: "border-box"
            }}
          >
            {/* Mode Switcher Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--line)", marginBottom: "22px" }}>
              <button
                type="button"
                onClick={() => { setIsLoginMode(false); setError(""); }}
                className="font-sans"
                style={{
                  flex: 1,
                  padding: "10px",
                  fontSize: "0.88rem",
                  fontWeight: !isLoginMode ? "600" : "500",
                  background: "none",
                  border: "none",
                  borderBottom: !isLoginMode ? "2px solid var(--veriq-blue)" : "2px solid transparent",
                  color: !isLoginMode ? "var(--veriq-blue)" : "var(--ink-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                Sign Up (New Account)
              </button>
              <button
                type="button"
                onClick={() => { setIsLoginMode(true); setError(""); }}
                className="font-sans"
                style={{
                  flex: 1,
                  padding: "10px",
                  fontSize: "0.88rem",
                  fontWeight: isLoginMode ? "600" : "500",
                  background: "none",
                  border: "none",
                  borderBottom: isLoginMode ? "2px solid var(--veriq-blue)" : "2px solid transparent",
                  color: isLoginMode ? "var(--veriq-blue)" : "var(--ink-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                Log In (Existing)
              </button>
            </div>

            {/* Role Selection (Only shown on signup) */}
            {!isLoginMode && (
              <div style={{ marginBottom: "20px" }}>
                <label
                  className="font-sans"
                  style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "8px", color: "var(--ink)" }}
                >
                  Account Access Type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setRole("user")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: role === "user" ? "2px solid var(--veriq-blue)" : "1px solid var(--line)",
                      backgroundColor: role === "user" ? "var(--veriq-blue-subtle)" : "var(--bg)",
                      color: "var(--ink)",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div className="font-sans" style={{ fontSize: "0.88rem", fontWeight: "600", color: role === "user" ? "var(--veriq-blue)" : "var(--ink)" }}>
                      Consumer / Advocate
                    </div>
                    <div className="font-sans" style={{ fontSize: "0.74rem", color: "var(--ink-muted)", marginTop: "2px" }}>
                      Dispute Investigation
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: role === "admin" ? "2px solid var(--veriq-blue)" : "1px solid var(--line)",
                      backgroundColor: role === "admin" ? "var(--veriq-blue-subtle)" : "var(--bg)",
                      color: "var(--ink)",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div className="font-sans" style={{ fontSize: "0.88rem", fontWeight: "600", color: role === "admin" ? "var(--veriq-blue)" : "var(--ink)" }}>
                      Administrator
                    </div>
                    <div className="font-sans" style={{ fontSize: "0.74rem", color: "var(--ink-muted)", marginTop: "2px" }}>
                      Commission Analytics
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {!isLoginMode && (
                <div>
                  <label className="font-sans" style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "6px", color: "var(--ink)" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
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
              )}

              <div>
                <label className="font-sans" style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "6px", color: "var(--ink)" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
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
                <label className="font-sans" style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "6px", color: "var(--ink)" }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

              {!isLoginMode && (
                <div>
                  <label className="font-sans" style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "6px", color: "var(--ink)" }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
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
              )}

              <ErrorBanner message={error} onClose={() => setError("")} />

              <button
                type="submit"
                disabled={loading}
                className="btn-veriq-primary font-sans"
                style={{
                  width: "100%",
                  padding: "13px",
                  fontSize: "0.92rem",
                  fontWeight: "600",
                  marginTop: "6px"
                }}
              >
                {loading
                  ? "Processing..."
                  : isLoginMode
                  ? "Sign In to Veriq →"
                  : "Create Account →"}
              </button>
            </form>

            <div style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--ink-muted)", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
              {isLoginMode ? (
                <>
                  Need an account?{" "}
                  <button
                    onClick={() => setIsLoginMode(false)}
                    className="font-sans"
                    style={{ background: "none", border: "none", fontWeight: "600", color: "var(--veriq-blue)", cursor: "pointer", padding: 0 }}
                  >
                    Register here
                  </button>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <button
                    onClick={() => setIsLoginMode(true)}
                    className="font-sans"
                    style={{ background: "none", border: "none", fontWeight: "600", color: "var(--veriq-blue)", cursor: "pointer", padding: 0 }}
                  >
                    Sign in here
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
