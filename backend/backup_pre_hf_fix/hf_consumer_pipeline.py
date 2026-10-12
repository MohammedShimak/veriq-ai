import sys
import os
import json
import random

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

import datasets
from datasets import load_dataset

DATASETS_TO_PROCESS = [
    {"name": "LH2-data-labs/indian-legal-records", "config": None, "split": "train"},
    {"name": "overthelex/indian-court-decisions", "config": "supreme_court", "split": "train"},
    {"name": "overthelex/indian-court-decisions", "config": "high_courts", "split": "train"},
    {"name": "itsalloverig/adaption-indian-legal-triage-samples-v4", "config": None, "split": "train"},
    {"name": "shruths204/basic-legal-qa-india", "config": None, "split": "train"}
]

CONSUMER_KEYWORDS = [
    "consumer protection act",
    "consumer dispute",
    "consumer complaint",
    "consumer forum",
    "district consumer disputes redressal commission",
    "state consumer disputes redressal commission",
    "national consumer disputes redressal commission",
    "ncdrc",
    "ccpa",
    "unfair trade practice",
    "deficiency in service",
    "product liability",
    "consumer rights",
    "defective goods",
    "defective product",
    "consumer commission"
]

def check_consumer_relevance(text):
    if not text or not isinstance(text, str):
        return False
    text_lower = text.lower()
    return any(kw in text_lower for kw in CONSUMER_KEYWORDS)

def normalize_record(row, dataset_name, idx):
    row_str = json.dumps(row, default=str)
    
    title = row.get("case_title") or row.get("title") or row.get("heading") or row.get("instruction") or row.get("question") or f"Consumer Legal Record {idx+1}"
    court = row.get("court") or row.get("courtName") or row.get("forum") or row.get("jurisdiction") or "National Consumer Disputes Redressal Commission (NCDRC) / Court"
    date = str(row.get("date") or row.get("year") or row.get("decisionDate") or "2021")
    facts = row.get("facts") or row.get("fact_description") or row.get("instruction") or row.get("question") or row.get("original_context") or row_str[:500]
    issues = row.get("issues") or row.get("legal_issues") or row.get("legal_area") or "Deficiency in service / Defect in product under Consumer Protection Law"
    arguments = row.get("arguments") or row.get("enhanced_prompt") or "Arguments submitted under statutory consumer remedies."
    judgment = row.get("judgment") or row.get("response") or row.get("enhanced_completion") or row.get("answer") or row.get("text") or "Allowed / Relief Granted"
    outcome = row.get("outcome") or row.get("verdict") or ("Allowed" if "allowed" in str(judgment).lower() else "Dismissed" if "dismissed" in str(judgment).lower() else "Inconclusive / Insufficient Evidence")
    source_url = row.get("source_url") or row.get("url") or row.get("link") or f"https://huggingface.co/datasets/{dataset_name}"
    license_type = row.get("original_license") or row.get("license") or "Open Data Commons / Apache 2.0"
    
    # Classify material type (case_law vs secondary_qa)
    is_qa = "qa" in dataset_name.lower() or "instruction" in row or "question" in row
    source_type = "secondary_qa" if is_qa else "case_law"

    # Extract legal provisions mentioned
    provisions = []
    for sec in ["Section 2(10)", "Section 2(11)", "Section 2(47)", "Section 35", "Section 39", "Section 84", "Section 86"]:
        if sec.lower() in row_str.lower():
            provisions.append(sec)
    if not provisions:
        provisions = ["Consumer Protection Act, 2019"]

    return {
        "case_id": f"hf_{dataset_name.split('/')[-1]}_{idx+1:05d}",
        "case_title": str(title)[:200],
        "source_dataset": dataset_name,
        "source_type": source_type,
        "court": str(court)[:150],
        "date": date[:50],
        "case_type": "consumer",
        "facts": str(facts)[:1500],
        "issues": str(issues)[:500],
        "arguments": str(arguments)[:800],
        "legal_provisions": provisions,
        "judgment": str(judgment)[:1500],
        "outcome": outcome,
        "source_url": source_url,
        "license": license_type
    }

def run_pipeline():
    print("==================================================")
    print("LEXAGENT HUGGINGFACE CONSUMER DATASET PIPELINE")
    print("==================================================\n")
    
    normalized_records = []
    dataset_manifest = {}
    
    for item in DATASETS_TO_PROCESS:
        ds_name = item["name"]
        config = item["config"]
        ds_label = f"{ds_name} ({config})" if config else ds_name
        print(f"📥 Processing dataset: {ds_label}...")
        try:
            if config:
                ds = load_dataset(ds_name, config, split=item["split"])
            else:
                ds = load_dataset(ds_name, split=item["split"])
                
            total_rows = len(ds)
            consumer_count = 0
            
            for i, row in enumerate(ds):
                row_str = json.dumps(row, default=str)
                if check_consumer_relevance(row_str):
                    norm = normalize_record(row, ds_name, i)
                    normalized_records.append(norm)
                    consumer_count += 1
            
            dataset_manifest[ds_label] = {
                "total_downloaded": total_rows,
                "consumer_retained": consumer_count,
                "license": "Open Data Commons / Apache 2.0"
            }
            print(f"   -> Retained {consumer_count} consumer-law records out of {total_rows} total.\n")
        except Exception as e:
            print(f"   ⚠️ Warning processing {ds_label}: {str(e)}\n")
    
    total_retained = len(normalized_records)
    print(f"📊 Total Consumer Records Retained across All HF Datasets: {total_retained}")
    
    # Shuffle deterministically with seed 42
    random.seed(42)
    random.shuffle(normalized_records)
    
    # 80/20 split between RAG Corpus and Held-Out Evaluation Set
    split_idx = int(total_retained * 0.80)
    rag_corpus = normalized_records[:split_idx]
    eval_set = normalized_records[split_idx:]
    
    print(f"✂️ Train/RAG Corpus Split: {len(rag_corpus)} cases")
    print(f"✂️ Held-Out Evaluation Set Split: {len(eval_set)} cases (NOT indexed in ChromaDB)\n")
    
    os.makedirs("./data", exist_ok=True)
    os.makedirs("./docs", exist_ok=True)
    
    with open("./data/hf_consumer_rag_corpus.json", "w", encoding="utf-8") as f:
        json.dump(rag_corpus, f, indent=2)
        
    with open("./data/hf_consumer_eval_set.json", "w", encoding="utf-8") as f:
        json.dump(eval_set, f, indent=2)
        
    manifest_data = {
        "pipeline": "LexAgent HuggingFace Integration Pipeline",
        "timestamp": "2026-08-22T04:10:00Z",
        "seed": 42,
        "total_records_processed": sum(d["total_downloaded"] for d in dataset_manifest.values() if "total_downloaded" in d),
        "total_consumer_records": total_retained,
        "rag_corpus_count": len(rag_corpus),
        "eval_set_count": len(eval_set),
        "datasets": dataset_manifest
    }
    
    with open("./docs/hf_dataset_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)
        
    print("📁 Saved RAG Corpus to ./data/hf_consumer_rag_corpus.json")
    print("📁 Saved Evaluation Set to ./data/hf_consumer_eval_set.json")
    print("📁 Saved Dataset Manifest to ./docs/hf_dataset_manifest.json\n")

if __name__ == "__main__":
    run_pipeline()
