import fs from "fs";
import path from "path";
import { createRequire } from "module";

const FAISS_INDEX_DIR = path.resolve("./data/faiss_index");
const INDEX_JSON_PATH = path.join(FAISS_INDEX_DIR, "index.json");
const NATIVE_INDEX_PATH = path.join(FAISS_INDEX_DIR, "vectors.faiss");
const METADATA_JSON_PATH = path.join(FAISS_INDEX_DIR, "metadata.json");
const require = createRequire(import.meta.url);

let nativeFaiss;
try {
  nativeFaiss = require("faiss-node");
} catch (error) {
  console.warn(`⚠️ Native faiss-node unavailable; using JSON cosine fallback: ${error.message}`);
}

/**
 * Calculates cosine similarity between two float vectors.
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Creates and serializes the FAISS vector index with embeddings and metadata to disk.
 * 
 * @param {Array<{chunk_id: string, text: string, embedding: number[], metadata: object}>} chunksWithEmbeddings 
 */
export async function saveFaissIndex(chunksWithEmbeddings) {
  if (!fs.existsSync(FAISS_INDEX_DIR)) {
    fs.mkdirSync(FAISS_INDEX_DIR, { recursive: true });
  }

  if (!Array.isArray(chunksWithEmbeddings) || chunksWithEmbeddings.length === 0) {
    throw new Error("At least one embedded chunk is required to build the FAISS index.");
  }

  const dimension = chunksWithEmbeddings[0].embedding?.length;
  if (!Number.isInteger(dimension) || dimension === 0) {
    throw new Error("Embedded chunks must contain non-empty numeric vectors.");
  }

  if (chunksWithEmbeddings.some((chunk) => !Array.isArray(chunk.embedding) || chunk.embedding.length !== dimension)) {
    throw new Error(`All FAISS vectors must have the same dimension (${dimension}).`);
  }

  console.log(`💾 Serializing ${chunksWithEmbeddings.length} vectors to FAISS store at ${FAISS_INDEX_DIR}...`);

  const indexData = chunksWithEmbeddings.map((c) => ({
    chunk_id: c.chunk_id,
    doc_id: c.doc_id,
    text: c.text,
    embedding: c.embedding,
    metadata: c.metadata
  }));

  fs.writeFileSync(INDEX_JSON_PATH, JSON.stringify(indexData, null, 2), "utf-8");

  const metadata = indexData.map(({ embedding, ...item }) => item);
  fs.writeFileSync(METADATA_JSON_PATH, JSON.stringify({ dimension, items: metadata }, null, 2), "utf-8");

  if (nativeFaiss) {
    const index = new nativeFaiss.IndexFlatIP(dimension);
    const normalizedVectors = chunksWithEmbeddings.flatMap((chunk) => normalizeVector(chunk.embedding));
    index.add(normalizedVectors);
    index.write(NATIVE_INDEX_PATH);
    console.log(`✅ Native FAISS index written to ${NATIVE_INDEX_PATH}`);
  } else {
    console.log(`✅ JSON cosine fallback written to ${INDEX_JSON_PATH}`);
  }
}

/**
 * Creates or replaces the local vector index.
 * Kept as a separate public operation so callers do not depend on the
 * persistence implementation used by this deployment.
 *
 * @param {Array<{chunk_id: string, text: string, embedding: number[], metadata: object}>} chunksWithEmbeddings
 */
export async function createOrUpdateFaissIndex(chunks, embeddings = null) {
  if (!Array.isArray(chunks)) {
    throw new TypeError("chunks must be an array.");
  }

  const chunksWithEmbeddings = embeddings
    ? chunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] }))
    : chunks;

  await saveFaissIndex(chunksWithEmbeddings);
  return {
    path: INDEX_JSON_PATH,
    native: Boolean(nativeFaiss),
    vectors: chunksWithEmbeddings.length
  };
}

/**
 * Loads the serialized FAISS vector index from disk.
 * @returns {Array<{chunk_id: string, doc_id: string, text: string, embedding: number[], metadata: object}>}
 */
export function loadFaissIndex() {
  if (!fs.existsSync(INDEX_JSON_PATH)) {
    console.warn(`⚠️ FAISS index not found at ${INDEX_JSON_PATH}. Run 'npm run reembed' to build vector index.`);
    return [];
  }

  try {
    const rawData = fs.readFileSync(INDEX_JSON_PATH, "utf-8");
    return JSON.parse(rawData);
  } catch (err) {
    console.error("❌ Error reading FAISS index:", err.message);
    return [];
  }
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
}

function loadMetadata() {
  if (!fs.existsSync(METADATA_JSON_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(METADATA_JSON_PATH, "utf-8"));
  } catch (err) {
    console.warn(`⚠️ Error reading FAISS metadata: ${err.message}`);
    return null;
  }
}

/**
 * Queries the FAISS vector index using a query embedding vector.
 * 
 * @param {number[]} queryEmbedding 768-dimensional float vector
 * @param {number} topK Number of nearest neighbor results to return
 * @returns {Promise<Array<{text: string, metadata: object, score: number, distance: number}>>}
 */
export async function queryFaissIndex(queryEmbedding, topK = 4) {
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new TypeError("queryEmbedding must be a non-empty numeric vector.");
  }

  if (nativeFaiss && fs.existsSync(NATIVE_INDEX_PATH) && fs.existsSync(METADATA_JSON_PATH)) {
    const metadata = loadMetadata();
    if (metadata && metadata.dimension === queryEmbedding.length) {
      const index = nativeFaiss.IndexFlatIP.read(NATIVE_INDEX_PATH);
      const result = index.search(normalizeVector(queryEmbedding), Math.max(1, topK));
      return result.labels
        .map((label, position) => metadata.items[label] ? {
          doc: {
            chunk_id: metadata.items[label].chunk_id,
            doc_id: metadata.items[label].doc_id,
            text: metadata.items[label].text
          },
          text: metadata.items[label].text,
          metadata: metadata.items[label].metadata,
          score: Number(result.distances[position].toFixed(4)),
          distance: Number((1 - result.distances[position]).toFixed(4))
        } : null)
        .filter(Boolean);
    }
  }

  const index = loadFaissIndex();
  if (!index || index.length === 0) {
    console.warn("⚠️ FAISS vector index empty or missing.");
    return [];
  }

  const scored = index.map((item) => {
    const score = cosineSimilarity(queryEmbedding, item.embedding);
    // Convert cosine similarity (0 to 1) to distance (0 to 1)
    const distance = Number((1 - score).toFixed(4));
    return {
      doc: {
        chunk_id: item.chunk_id,
        doc_id: item.doc_id,
        text: item.text
      },
      text: item.text,
      metadata: item.metadata,
      score: Number(score.toFixed(4)),
      distance
    };
  });

  // Sort descending by similarity score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}
