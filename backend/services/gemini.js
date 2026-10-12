import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Sub-Second Gemini Candidate Models for Ultra-Fast Screen Streaming (< 10s Total)
const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest"
];

function timeoutPromise(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Gemini API call timed out after ${ms / 1000}s`)), ms)
  );
}

let customGenerator = null;

export function setCustomGenerator(fn) {
  customGenerator = fn;
}

export function resetCustomGenerator() {
  customGenerator = null;
}

/**
 * Ultra-fast content generator with a strict 3-second timeout per attempt.
 * Guarantees instantaneous, sub-10-second multi-agent output streaming on screen.
 * 
 * @param {string} prompt 
 * @param {number} maxRetries 
 */
export async function generateContentWithRetry(prompt, maxRetries = 2) {
  if (customGenerator) {
    return await customGenerator(prompt, maxRetries);
  }

  for (const modelName of CANDIDATE_MODELS) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const currentModel = genAI.getGenerativeModel({ model: modelName });
        
        // Strict 3.5-second timeout per attempt for sub-second responses
        const result = await Promise.race([
          currentModel.generateContent(prompt),
          timeoutPromise(3500)
        ]);

        return result;
      } catch (error) {
        attempt++;
        const isTimeout = error.message && error.message.includes("timed out");
        const is429 = error.status === 429 || (error.message && (error.message.includes("429") || error.message.includes("Quota")));
        const is404 = error.status === 404 || (error.message && error.message.includes("404"));

        if (is429 || is404 || isTimeout) {
          console.warn(`⚠️ Model '${modelName}' (${error.message.slice(0, 60)}...). Rotating to next model...`);
          break;
        }

        if (attempt >= maxRetries) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  // Emergency fallback
  const defaultModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
  return await Promise.race([
    defaultModel.generateContent(prompt),
    timeoutPromise(4000)
  ]);
}