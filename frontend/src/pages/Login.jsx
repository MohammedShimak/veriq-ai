import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ErrorBanner from "../components/ErrorBanner";
import BRAND from "../config/brand";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      const redirectPath =
        location.state?.from?.pathname ||
        (loggedUser && loggedUser.role === "admin" ? "/admin" : "/my-cases");
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Invalid login credentials. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div
          className="veriq-card"
          style={{
            width: "100%",
            maxWidth: "440px",
            padding: "36px 32px",
            borderRadius: "14px",
            boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
            boxSizing: "border-box"
          }}
        >
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
            <h1 className="font-sans" style={{ fontSize: "1.7rem", fontWeight: "700", margin: "0 0 6px 0", color: "var(--ink)", letterSpacing: "-0.02em" }}>
              Sign In to {BRAND.name}
            </h1>
            <p className="font-sans" style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>
              Access your consumer case docket and ongoing investigations
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label className="font-sans" style={{ display: "block", fontSize: "0.82rem", fontWeight: "600", marginBottom: "6px", color: "var(--ink)" }}>
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
                  fontSize: "0.92rem",
                  fontFamily: "var(--font-sans)",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="font-sans" style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--ink)" }}>
                  Password
                </label>
              </div>
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
                  fontSize: "0.92rem",
                  fontFamily: "var(--font-sans)",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>

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
              {loading ? "Signing In..." : "Sign In to Veriq →"}
            </button>
          </form>

          <div style={{ textAlign: "center", fontSize: "0.84rem", color: "var(--ink-muted)", marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
            Don't have an account?{" "}
            <Link to="/signup" className="font-sans" style={{ fontWeight: "600", color: "var(--veriq-blue)", textDecoration: "none" }}>
              Create an account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
