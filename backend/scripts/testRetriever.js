import { retrieveRelevantSections } from "../services/retriever.js";

async function main() {
  const query = "What rights does a consumer have when a product is defective?";
  console.log("====================================");
  console.log(`Testing Legal RAG Retriever`);
  console.log(`Query: "${query}"`);
  console.log("====================================\n");

  try {
    const results = await retrieveRelevantSections(query, 3);
    console.log(`Found ${results.length} relevant sections:\n`);
    
    results.forEach((res, i) => {
      console.log(`--- Match #${i + 1} ---`);
      console.log(`Section : ${res.metadata.section} - ${res.metadata.title}`);
      console.log(`Act     : ${res.metadata.act}`);
      console.log(`Page    : ${res.metadata.page}`);
      console.log(`Score   : ${res.score}`);
      console.log(`Excerpt :\n${res.text.substring(0, 250)}...\n`);
    });
  } catch (err) {
    console.error("Retriever error:", err);
  }
}

main();
