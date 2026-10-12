import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import ErrorBanner from "../components/ErrorBanner";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { updatePasswordApi } from "../services/authApi";
import { getUserStatsApi } from "../services/historyApi";

export default function Profile() {
  const { user, accessToken } = useAuth();

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getUserStatsApi(accessToken);
        setStats(data);
      } catch (err) {
        console.warn("⚠️ Failed to load user metrics.");
      } finally {
        setLoadingStats(false);
      }
    }
    if (accessToken) loadStats();
  }, [accessToken]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    setUpdating(true);
    try {
      await updatePasswordApi(currentPassword, newPassword, accessToken);
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update password.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: "1000px", margin: "0 auto", padding: "40px 24px", width: "100%", boxSizing: "border-box" }}>
        {/* Title Header */}
        <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "24px", marginBottom: "28px" }}>
          <h1 className="font-serif text-brass" style={{ fontSize: "2.2rem", margin: "0 0 6px 0", letterSpacing: "0.5px" }}>
            User Account Profile
          </h1>
          <p className="font-mono text-muted" style={{ fontSize: "0.88rem", margin: 0 }}>
            Manage credentials and view legal intelligence usage metrics
          </p>
        </div>

        <ErrorBanner message={error} onClose={() => setError("")} />

        {success && (
          <div
            className="font-mono"
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--support-green)",
              backgroundColor: "var(--support-bg)",
              color: "var(--support-green-bright)",
              fontSize: "0.85rem",
              marginBottom: "20px"
            }}
          >
            ✓ {success}
          </div>
        )}

        {/* User Info & Stats Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "28px" }}>
          {/* User Account Info Card */}
          <div
            style={{
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              borderTop: "4px solid var(--brass)",
              backgroundColor: "var(--surface)",
              boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", borderBottom: "1px solid var(--line)", paddingBottom: "14px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "var(--brass-light)",
                  color: "var(--brass)",
                  fontSize: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--line-bright)"
                }}
              >
                {user?.role === "admin" ? "👑" : "👤"}
              </div>
              <div>
                <h3 className="font-serif" style={{ fontSize: "1.2rem", margin: "0 0 2px 0", color: "var(--ink)" }}>
                  {user?.name || "Courtroom User"}
                </h3>
                <span
                  className="font-mono text-brass"
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "0.72rem",
                    fontWeight: "bold",
                    backgroundColor: "var(--brass-light)",
                    border: "1px solid var(--line-bright)",
                    textTransform: "uppercase"
                  }}
                >
                  Role: {user?.role || "User"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <span className="font-mono text-muted" style={{ display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
                  FULL NAME
                </span>
                <p className="font-serif text-brass" style={{ fontSize: "1.05rem", margin: 0, fontWeight: "600" }}>
                  {user?.name}
                </p>
              </div>

              <div>
                <span className="font-mono text-muted" style={{ display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
                  EMAIL ADDRESS
                </span>
                <p className="font-mono text-muted" style={{ fontSize: "0.9rem", margin: 0 }}>
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* User Usage Statistics Card */}
          <div
            style={{
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--surface)",
              boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
          >
            <h3 className="font-serif text-brass" style={{ fontSize: "1.2rem", margin: 0 }}>
              📊 Usage Statistics
            </h3>

            {loadingStats ? (
              <LoadingSpinner message="Calculating user metrics..." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", textAlign: "center" }}>
                <div style={{ padding: "20px 12px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div className="font-serif text-brass" style={{ fontSize: "2rem", fontWeight: "bold" }}>
                    {stats?.totalCases || 0}
                  </div>
                  <p className="font-mono text-muted" style={{ fontSize: "0.75rem", margin: "6px 0 0 0" }}>Total Cases</p>
                </div>

                <div style={{ padding: "20px 12px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div className="font-serif text-brass" style={{ fontSize: "2rem", fontWeight: "bold" }}>
                    {stats?.totalTurns || 0}
                  </div>
                  <p className="font-mono text-muted" style={{ fontSize: "0.75rem", margin: "6px 0 0 0" }}>Debate Turns</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Account Password Card */}
        <div
          style={{
            padding: "28px",
            borderRadius: "14px",
            border: "1px solid var(--line)",
            backgroundColor: "var(--surface)",
            boxShadow: "0 4px 18px rgba(0,0,0,0.12)"
          }}
        >
          <h3 className="font-serif text-brass" style={{ fontSize: "1.25rem", margin: "0 0 16px 0" }}>
            🔑 Change Account Password
          </h3>

          <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "440px" }}>
            <div>
              <label className="font-mono text-muted" style={{ display: "block", fontSize: "0.78rem", marginBottom: "6px" }}>
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  backgroundColor: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>

            <div>
              <label className="font-mono text-muted" style={{ display: "block", fontSize: "0.78rem", marginBottom: "6px" }}>
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  backgroundColor: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>

            <div>
              <label className="font-mono text-muted" style={{ display: "block", fontSize: "0.78rem", marginBottom: "6px" }}>
                Confirm New Password
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
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={updating}
              className="btn-brass font-mono"
              style={{
                alignSelf: "flex-start",
                padding: "12px 24px",
                fontSize: "0.85rem",
                fontWeight: "bold",
                marginTop: "4px",
                boxShadow: "0 4px 14px rgba(201, 164, 94, 0.3)"
              }}
            >
              {updating ? "Updating Password..." : "Update Password →"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
