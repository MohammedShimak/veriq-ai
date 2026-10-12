import sys
import os
import json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

RAG_CORPUS_PATH = "./data/hf_consumer_rag_corpus.json"
EVAL_SET_PATH = "./data/hf_consumer_eval_set.json"
MANIFEST_PATH = "./docs/hf_dataset_manifest.json"
EVAL_RESULTS_PATH = "./docs/hf_eval_results.json"

def audit():
    print("==================================================")
    print("LEXAGENT HUGGINGFACE DATASET AUDIT")
    print("==================================================\n")
    
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    with open(RAG_CORPUS_PATH, "r", encoding="utf-8") as f:
        rag_corpus = json.load(f)
        
    with open(EVAL_SET_PATH, "r", encoding="utf-8") as f:
        eval_set = json.load(f)

    print("1. DATASET MANIFEST AUDIT:")
    print(json.dumps(manifest, indent=2))
    print("\n--------------------------------------------------")
    
    # 2. Sample records from each retained dataset
    triage_samples = [r for r in rag_corpus if "triage" in r["source_dataset"].lower()][:5]
    qa_samples = [r for r in rag_corpus if "qa" in r["source_dataset"].lower()][:5]
    
    print("\n2. SAMPLE RECORDS FROM LEGAL TRIAGE DATASET (5 Samples):")
    for idx, s in enumerate(triage_samples):
        print(f"\n--- Triage Sample [{idx+1}] ---")
        print(f"ID: {s['case_id']}")
        print(f"Title: {s['case_title']}")
        print(f"Court: {s['court']}")
        print(f"Facts Snippet: {s['facts'][:200]}...")
        print(f"Provisions: {s['legal_provisions']}")
        
    print("\n--------------------------------------------------")
    print("\n3. SAMPLE RECORDS FROM BASIC LEGAL QA DATASET (5 Samples):")
    for idx, s in enumerate(qa_samples):
        print(f"\n--- Legal QA Sample [{idx+1}] ---")
        print(f"ID: {s['case_id']}")
        print(f"Title: {s['case_title']}")
        print(f"Question/Facts Snippet: {s['facts'][:200]}...")
        print(f"Answer/Judgment Snippet: {s['judgment'][:200]}...")
        
    # 4. Check for duplicates
    all_records = rag_corpus + eval_set
    seen_facts = set()
    duplicates_count = 0
    for r in all_records:
        fact_key = r['facts'].strip().lower()
        if fact_key in seen_facts:
            duplicates_count += 1
        else:
            seen_facts.add(fact_key)
            
    print("\n--------------------------------------------------")
    print(f"4. DEDUPLICATION AUDIT:")
    print(f"Total Combined Records: {len(all_records)}")
    print(f"Unique Case Texts: {len(seen_facts)}")
    print(f"Duplicates Detected: {duplicates_count}")
    
    # 5. ChromaDB Exclusion Check
    print("\n--------------------------------------------------")
    print("5. CHROMADB EVALUATION SET EXCLUSION AUDIT:")
    eval_ids = set(r["case_id"] for r in eval_set)
    rag_ids = set(r["case_id"] for r in rag_corpus)
    overlap = eval_ids.intersection(rag_ids)
    print(f"RAG Corpus IDs: {len(rag_ids)}")
    print(f"Evaluation Set IDs: {len(eval_ids)}")
    print(f"ID Overlap Count: {len(overlap)} (Must be 0)")
    
if __name__ == "__main__":
    audit()
