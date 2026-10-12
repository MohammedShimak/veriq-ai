/**
 * Centralized API Base URL configuration for Production & Local Development.
 * Uses VITE_API_BASE_URL environment variable when deployed on Vercel/Render,
 * and falls back to relative /api or http://localhost:5000/api in local dev.
 */
export const API_HOST = import.meta.env.VITE_API_BASE_URL || (typeof window !== "undefined" && window.location.hostname !== "localhost" ? `${window.location.origin}/api` : "http://localhost:5000/api");
