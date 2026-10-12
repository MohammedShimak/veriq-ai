import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import { generateEmbedding } from "../services/embedding.js";
import { storeChunks } from "../services/chroma.js";
import { retrieveRelevantSections } from "../services/retriever.js";

const PDF_PATH = path.join(process.cwd(), "docs", "Consumer_Protection_Act_2019.pdf");

async function main() {
  console.log("====================================");
  console.log("LexAgent Legal RAG Indexer (Controlled Batching)");
  console.log("====================================\n");

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ PDF file not found at: ${PDF_PATH}`);
    process.exit(1);
  }

  console.log("Reading PDF...");
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const parser = new pdf.PDFParse({ data: dataBuffer, verbosity: 0 });
  const pdfData = await parser.getText();

  console.log(`Pages: ${pdfData.total || 104}\n`);

  console.log("Extracting legal sections...");
  const pages = pdfData.text.split("\n\n");
  const sections = [];

  const sectionRegex = /^SECTION\s+(\d+[A-Z]?)\.\s*(.*)/i;

  let currentSection = null;

  pages.forEach((pageText, pageIndex) => {
    const lines = pageText.split("\n");
    lines.forEach((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(sectionRegex);

      if (match) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          section: `Section ${match[1]}`,
          title: match[2] || "General Provision",
          page: pageIndex + 1,
          textLines: [trimmed]
        };
      } else if (currentSection) {
        currentSection.textLines.push(trimmed);
      }
    });
  });

  if (currentSection) {
    sections.push(currentSection);
  }

  console.log(`Sections found: ${sections.length}\n`);

  console.log("Creating chunks...");
  const chunks = [];
  const MAX_CHUNK_SIZE = 1500;
  const OVERLAP = 200;

  sections.forEach((sec) => {
    const fullText = sec.textLines.join("\n").trim();
    const cleanSecId = sec.section.toLowerCase().replace(/\s+/g, "_");

    if (fullText.length <= MAX_CHUNK_SIZE) {
      chunks.push({
        id: `cpa_${cleanSecId}_p${sec.page}_idx${chunks.length + 1}`,
        text: fullText,
        metadata: {
          act: "Consumer Protection Act, 2019",
          section: sec.section,
          title: sec.title,
          page: sec.page,
          source: "Consumer_Protection_Act_2019.pdf"
        }
      });
    } else {
      let start = 0;
      let subIdx = 1;
      const header = `${sec.section}. ${sec.title}\n\n`;

      while (start < fullText.length) {
        let end = start + MAX_CHUNK_SIZE;
        if (end < fullText.length) {
          const lastNewline = fullText.lastIndexOf("\n", end);
          if (lastNewline > start + 500) end = lastNewline;
        }

        const partText = fullText.substring(start, end).trim();
        const chunkText = partText.startsWith(sec.section)
          ? partText
          : header + partText;

        chunks.push({
          id: `cpa_${cleanSecId}_p${sec.page}_part${subIdx}_idx${chunks.length + 1}`,
          text: chunkText,
          metadata: {
            act: "Consumer Protection Act, 2019",
            section: sec.section,
            title: sec.title,
            page: sec.page,
            source: "Consumer_Protection_Act_2019.pdf"
          }
        });

        subIdx++;
        start = end - OVERLAP;
        if (start >= fullText.length - OVERLAP) break;
      }
    }
  });

  console.log(`Chunks created: ${chunks.length}\n`);

  console.log("Generating embeddings in controlled batches...\n");
  const processedChunks = [];
  const BATCH_SIZE = 4;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    console.log(`[Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}] Processing chunks ${i + 1} to ${Math.min(i + BATCH_SIZE, chunks.length)}...`);

    const batchResults = await Promise.all(
      batch.map(async (chunk) => {
        try {
          const embedding = await generateEmbedding(chunk.text);
          return { ...chunk, embedding };
        } catch (err) {
          console.error(`  ⚠️ Skipped chunk ${chunk.id}: ${err.message}`);
          return null;
        }
      })
    );

    batchResults.filter(Boolean).forEach((c) => processedChunks.push(c));
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("\nStoring vectors in ChromaDB...");
  await storeChunks(processedChunks);

  console.log("\nIndexing completed successfully.");
  console.log("====================================");
  console.log("Collection: consumer_protection_act");
  console.log(`Documents stored: ${processedChunks.length}`);
  console.log("====================================\n");

  // Perform a test retrieval check
  console.log("🔍 Running test retrieval check...");
  const testQuery = "What rights does a consumer have when a product is defective?";
  console.log(`Query: "${testQuery}"\n`);
  const results = await retrieveRelevantSections(testQuery, 2);

  console.log("Results retrieved:");
  results.forEach((r, idx) => {
    console.log(`\n--- Result [${idx + 1}] (Score: ${r.score || "N/A"}) ---`);
    console.log(`Section: ${r.metadata.section} | Title: ${r.metadata.title} | Page: ${r.metadata.page}`);
    console.log(`Text snippet:\n${r.text.substring(0, 250)}...`);
  });

  console.log("\n✅ RAG Indexing and Verification Complete!");
}

main().catch((err) => {
  console.error("❌ Indexing failed with error:", err);
  process.exit(1);
});