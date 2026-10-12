import fs from "fs";
import path from "path";
import { generateEmbedding } from "../services/embedding.js";
import { createOrUpdateFaissIndex } from "../services/faissService.js";

const CHUNKS_PATH = path.resolve("./data/normalized/chunks.json");

async function embedAndStoreFAISS() {
  console.log("=========================================");
  console.log("LEXAGENT FAISS VECTOR INDEXING");
  console.log("=========================================\n");

  if (!fs.existsSync(CHUNKS_PATH)) {
    throw new Error(`Chunks file not found at: ${CHUNKS_PATH}. Run 'npm run rechunk' first.`);
  }

  const chunks = JSON.parse(fs.readFileSync(CHUNKS_PATH, "utf-8"));
  console.log(`📖 Loaded ${chunks.length} chunks for FAISS embedding...`);

  // Sort chunks so high-priority statutes, rules, and precedents are embedded first
  chunks.sort((a, b) => (a.metadata.authority_level || 5) - (b.metadata.authority_level || 5));

  const embeddedChunks = [];
  const total = chunks.length;

  for (let i = 0; i < total; i++) {
    const chunk = chunks[i];
    if (i === 0 || (i + 1) % 100 === 0 || i === total - 1) {
      console.log(`[${i + 1}/${total}] Generating embeddings...`);
    }

    try {
      const embedding = await generateEmbedding(chunk.text);
      embeddedChunks.push({
        ...chunk,
        embedding
      });

      // Save index to disk after primary statutory/precedent chunks (first 39) are done
      if (i === 39 || (i > 39 && i % 50 === 0)) {
        await createOrUpdateFaissIndex(embeddedChunks);
        console.log(`💾 Progress Checkpoint: ${embeddedChunks.length} vectors saved to FAISS store.`);
      }

      if (process.env.GEMINI_API_KEY) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } catch (err) {
      console.warn(`⚠️ Failed to generate embedding for ${chunk.chunk_id}: ${err.message}. Skipping...`);
    }
  }

  console.log(`\n💾 Finalizing FAISS vector index with ${embeddedChunks.length} vectors...`);
  const indexResult = await createOrUpdateFaissIndex(embeddedChunks);

  console.log("\n=========================================");
  console.log(`✅ FAISS index successfully created at backend/data/faiss_index with ${indexResult.vectors} vectors`);
  console.log("=========================================\n");
}

embedAndStoreFAISS().catch((err) => {
  console.error("🛑 Error in FAISS vector indexing:", err);
  process.exit(1);
});
