import { ChromaClient } from "chromadb";

const client = new ChromaClient({
  host: "localhost",
  port: 8000
});

const COLLECTION_NAME = "consumer_protection_act";

const dummyEmbeddingFunction = {
  generate: async (texts) => texts.map(() => [])
};

/**
 * Gets or creates the 'consumer_protection_act' collection in ChromaDB.
 */
export async function getCollection() {
  try {
    const collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      embeddingFunction: dummyEmbeddingFunction
    });
    return collection;
  } catch (error) {
    console.error(`Error connecting to ChromaDB or accessing collection '${COLLECTION_NAME}':`, error.message);
    throw error;
  }
}

/**
 * Stores chunks with their embeddings, text documents, and metadata in ChromaDB.
 * @param {Array<{id: string, text: string, embedding: number[], metadata: object}>} chunks 
 */
export async function storeChunks(chunks) {
  if (!chunks || chunks.length === 0) return;

  const collection = await getCollection();

  const ids = chunks.map((c) => c.id);
  const embeddings = chunks.map((c) => c.embedding);
  const documents = chunks.map((c) => c.text);
  const metadatas = chunks.map((c) => c.metadata);

  await collection.upsert({
    ids,
    embeddings,
    documents,
    metadatas
  });
}

/**
 * Queries ChromaDB using a vector embedding.
 * @param {number[]} queryVector 
 * @param {number} topK 
 */
export async function queryCollection(queryVector, topK = 3) {
  const collection = await getCollection();
  const results = await collection.query({
    queryEmbeddings: [queryVector],
    nResults: topK
  });

  return results;
}