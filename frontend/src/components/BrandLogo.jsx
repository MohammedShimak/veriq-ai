import React from "react";
import { Link } from "react-router-dom";
import BRAND from "../config/brand";

/**
 * BrandLogo — Global Reusable VERIQ Logo & Wordmark Component
 *
 * Uses the exact supplied VERIQ logo image without redrawing, recolouring, or cropping.
 * Preserves original proportions and appearance.
 * Aligns the logo image and the "Veriq" wordmark horizontally.
 */
export default function BrandLogo({
  size = "md", // "sm" (26px), "md" (32px), "lg" (44px), "xl" (56px)
  showWordmark = true,
  showTagline = true,
  to = "/",
  className = "",
  style = {}
}) {
  const sizeMap = {
    sm: { imgHeight: 24, fontSize: "1rem", tagSize: "0.62rem" },
    md: { imgHeight: 32, fontSize: "1.15rem", tagSize: "0.68rem" },
    lg: { imgHeight: 40, fontSize: "1.35rem", tagSize: "0.74rem" },
    xl: { imgHeight: 52, fontSize: "1.6rem", tagSize: "0.82rem" }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const content = (
    <div
      className={`veriq-brand-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size === "sm" ? "8px" : "10px",
        userSelect: "none",
        ...style
      }}
    >
      {/* Exact Supplied VERIQ Logo Asset */}
      <div
        className="veriq-logo-frame"
        style={{
          backgroundColor: "#ffffff",
          padding: "2px 6px",
          borderRadius: "6px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          flexShrink: 0
        }}
      >
        <img
          src="/assets/veriq-logo.png"
          alt="Veriq Logo"
          className="veriq-logo-image"
          style={{
            height: `${currentSize.imgHeight}px`,
            width: "auto",
            maxWidth: "100%",
            objectFit: "contain",
            display: "block"
          }}
          loading="eager"
        />
      </div>

      {/* Horizontally Aligned Wordmark & Subtitle */}
      {showWordmark && (
        <div
          className="veriq-brand-text-group"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            lineHeight: 1.15
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className="veriq-wordmark font-sans"
              style={{
                fontSize: currentSize.fontSize,
                fontWeight: "700",
                letterSpacing: "-0.02em",
                color: "var(--ink)",
                transition: "color 0.15s ease"
              }}
            >
              {BRAND.name}
            </span>
          </div>

          {showTagline && (
            <span
              className="veriq-brand-subtagline font-sans"
              style={{
                fontSize: currentSize.tagSize,
                color: "var(--ink-muted)",
                letterSpacing: "0.01em",
                marginTop: "2px",
                display: "block",
                whiteSpace: "nowrap"
              }}
            >
              AI Case Intelligence
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="veriq-brand-link"
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          outline: "none"
        }}
        aria-label={`${BRAND.name} Home`}
      >
        {content}
      </Link>
    );
  }

  return content;
}
