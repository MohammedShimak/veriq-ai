import fs from "fs";
import path from "path";

const filesToBackup = [
  "./scripts/hf_consumer_pipeline.py",
  "./scripts/runHFEvaluation.js",
  "./services/hybridRetriever.js",
  "./data/hf_consumer_rag_corpus.json",
  "./data/hf_consumer_eval_set.json",
  "./docs/hf_dataset_manifest.json"
];

const backupDir = "./backup_pre_hf_fix";
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

filesToBackup.forEach(file => {
  if (fs.existsSync(file)) {
    const dest = path.join(backupDir, path.basename(file));
    fs.copyFileSync(file, dest);
    console.log(`Backed up: ${file} -> ${dest}`);
  }
});

console.log("✅ Backup complete!");
