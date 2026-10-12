import React from "react";
import "./BrandedLoader.css";

/**
 * BrandedLoader — Reusable VERIQ Branded Loading Component
 *
 * Displays the supplied VERIQ logo asset with restrained, accessible animation
 * and authentic context-specific operational messaging.
 *
 * Supports variants:
 * - "page": Centered layout for route/page initial API fetches.
 * - "card": Framed card layout for in-page operations (AI questions, evidence inspection, gate evaluation).
 * - "inline": Compact indicator for buttons or dense UI elements.
 */
export default function BrandedLoader({
  message = "Loading legal intelligence...",
  submessage = null,
  variant = "card", // "page" | "card" | "inline"
  size = "md", // "sm" | "md" | "lg"
  error = null,
  onRetry = null,
  className = "",
  style = {}
}) {
  // If an error state is provided, render the error & retry UI
  if (error) {
    return (
      <div
        className={`veriq-loader-container veriq-loader-error ${variant} ${className}`}
        role="alert"
        style={style}
      >
        <div className="veriq-loader-error-icon">⚠️</div>
        <div className="veriq-loader-text-group">
          <h4 className="veriq-loader-error-title font-sans">Operation Could Not Complete</h4>
          <p className="veriq-loader-error-desc font-sans">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn-veriq-primary font-sans"
              style={{ marginTop: "12px", padding: "8px 18px", fontSize: "0.85rem" }}
            >
              Retry Operation
            </button>
          )}
        </div>
      </div>
    );
  }

  // Inline Variant (Compact)
  if (variant === "inline") {
    return (
      <div
        className={`veriq-loader-inline ${className}`}
        role="status"
        aria-live="polite"
        style={style}
      >
        <div className="veriq-spinner-ring-small" aria-hidden="true" />
        <span className="veriq-loader-inline-text font-sans">{message}</span>
        <span className="sr-only">Loading: {message}</span>
      </div>
    );
  }

  // Card or Page Variant
  const isPage = variant === "page";
  const logoHeight = isPage ? 40 : size === "sm" ? 26 : size === "lg" ? 44 : 32;

  return (
    <div
      className={`veriq-loader-container veriq-loader-${variant} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={style}
    >
      {/* Branded Logo Badge with Restrained Glow */}
      <div className="veriq-loader-brand-wrapper">
        <div className="veriq-loader-aura" aria-hidden="true" />
        <div className="veriq-loader-logo-frame">
          <img
            src="/assets/veriq-logo.png"
            alt="Veriq AI"
            className="veriq-loader-logo-img"
            style={{
              height: `${logoHeight}px`,
              width: "auto",
              objectFit: "contain",
              display: "block"
            }}
          />
        </div>
        {/* Subtle spinning accent arc that does NOT distort the logo */}
        <div className="veriq-loader-orbital-ring" aria-hidden="true" />
      </div>

      {/* Progress Bar Shimmer */}
      <div className="veriq-loader-progress-track" aria-hidden="true">
        <div className="veriq-loader-progress-bar" />
      </div>

      {/* Context-Specific Operational Message */}
      <div className="veriq-loader-text-group">
        <h4 className="veriq-loader-title font-sans">{message}</h4>
        {submessage && (
          <p className="veriq-loader-submessage font-sans">{submessage}</p>
        )}
      </div>

      <span className="sr-only">Currently active: {message}</span>
    </div>
  );
}
