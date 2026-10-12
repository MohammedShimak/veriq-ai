import React from "react";
import BrandedLoader from "./BrandedLoader";

/**
 * LoadingSpinner — Global Branded Loading Component Adapter
 * Preserves legacy imports while delivering the polished VERIQ branded loading experience.
 */
export default function LoadingSpinner({
  message = "Loading case intelligence...",
  submessage = null,
  variant = "card",
  size = "md",
  error = null,
  onRetry = null,
  className = "",
  style = {}
}) {
  return (
    <BrandedLoader
      message={message}
      submessage={submessage}
      variant={variant}
      size={size}
      error={error}
      onRetry={onRetry}
      className={className}
      style={style}
    />
  );
}
