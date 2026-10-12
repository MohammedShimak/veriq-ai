import React from "react";
import "./BalanceBar.css";

/**
 * BalanceBar — Module G Signature Scale Component
 * 
 * @param {number} position Float from -1.0 (Full Support/Petitioner) to +1.0 (Full Oppose/Respondent)
 * @param {boolean} animated Whether transition animation is active
 * @param {string} label Optional section or verdict header label
 */
export default function BalanceBar({ position = 0, animated = true, label = "Evidentiary Balance of Probability" }) {
  // Clamp position to [-1.0, 1.0]
  const clampedPos = Math.max(-1.0, Math.min(1.0, typeof position === "number" ? position : 0));
  
  // Calculate horizontal shift percentage: 50% + (clampedPos * 40%)
  const offsetPercent = clampedPos * 42;

  return (
    <div className="balance-bar-container">
      <div className="balance-bar-header">
        <span className="balance-label-left">⚖ Petitioner (Consumer)</span>
        <span className="balance-label-center">{label}</span>
        <span className="balance-label-right">Respondent (Opposite Party) ⚖</span>
      </div>

      <div className="balance-beam-track">
        <div className="balance-beam-line">
          <div className="balance-fulcrum"></div>
          <div
            className="balance-indicator-dot"
            style={{
              transform: `translate(calc(-50% + ${offsetPercent}px), -50%)`,
              transition: animated ? "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)" : "none"
            }}

            title={`Balance: ${(clampedPos * 100).toFixed(0)}%`}
          ></div>
        </div>
      </div>
    </div>
  );
}
