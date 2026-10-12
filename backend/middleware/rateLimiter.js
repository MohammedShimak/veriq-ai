import rateLimit from "express-rate-limit";

/**
 * Debate Rate Limiter — Protects API key cost & server resources (10 requests / 1 min per IP)
 */
export const debateRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: "Too many debate requests. Please wait 1 minute before submitting another case." },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Auth Rate Limiter — Protects login & signup endpoints against brute-force (30 requests / 15 mins per IP)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many authentication attempts. Please try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Global Rate Limiter — Protects all backend routes (120 requests / 1 min per IP)
 */
export const globalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { error: "Global API rate limit exceeded. Please slow down your requests." },
  standardHeaders: true,
  legacyHeaders: false
});
