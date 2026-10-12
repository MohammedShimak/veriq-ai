import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001"
});

/**
 * Generates vector embedding for a given text with automatic 429 retry backoff and fallback vector.
 * @param {string} text
 * @param {number} maxRetries
 * @returns {Promise<number[]>} Array of floating point numbers representing the vector
 */
export async function generateEmbedding(text, maxRetries = 2) {
  if (!text || typeof text !== "string" || !text.trim()) {
    return fallbackEmbedding(text);
  }

  if (!process.env.GEMINI_API_KEY) return fallbackEmbedding(text);

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const result = await embeddingModel.embedContent(text);
      if (!result || !result.embedding || !result.embedding.values) {
        throw new Error("No embedding values returned from Gemini API.");
      }
      return result.embedding.values;
    } catch (error) {
      attempt++;
      const is429 = error.status === 429 || (error.message && error.message.includes("429")) || (error.message && error.message.includes("Quota"));

      if (is429 || attempt >= maxRetries) {
        console.warn(`⚠️ Embedding API quota limit hit. Falling back to zero-vector representation...`);
        return fallbackEmbedding(text);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return fallbackEmbedding(text);
}

function fallbackEmbedding(text = "") {
  const vector = new Array(768).fill(0);
  const tokens = String(text).toLowerCase().match(/[a-z0-9]+/g) || [];

  tokens.forEach((token) => {
    let hash = 2166136261;
    for (let index = 0; index < token.length; index++) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const position = Math.abs(hash) % vector.length;
    vector[position] += 1;
  });

  return vector;
}
