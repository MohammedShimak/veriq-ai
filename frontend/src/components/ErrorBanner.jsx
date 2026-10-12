import React from "react";

export default function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      style={{
        width: "100%",
        padding: "10px 14px",
        borderRadius: "8px",
        border: "1px solid rgba(239, 68, 68, 0.4)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        color: "#f87171",
        fontSize: "0.85rem",
        fontFamily: "var(--font-sans)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        marginTop: "8px",
        marginBottom: "8px",
        boxSizing: "border-box"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontWeight: "bold" }}>⚠️ Error:</span>
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#f87171",
            cursor: "pointer",
            fontSize: "0.82rem",
            fontFamily: "var(--font-mono)",
            padding: 0
          }}
          title="Dismiss Error Message"
        >
          Dismiss ✕
        </button>
      )}
    </div>
  );
}
