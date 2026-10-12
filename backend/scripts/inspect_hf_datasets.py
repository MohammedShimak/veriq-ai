import sys
import os
import json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

import datasets
from datasets import load_dataset

DATASETS_TO_INSPECT = [
    "ShuvBan/SycoLex",
    "LH2-data-labs/indian-legal-records",
    "overthelex/indian-court-decisions",
    "itsalloverig/adaption-indian-legal-triage-samples-v4",
    "shruths204/basic-legal-qa-india"
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

def check_text_consumer_relevance(text):
    if not text or not isinstance(text, str):
        return False
    text_lower = text.lower()
    return any(kw in text_lower for kw in CONSUMER_KEYWORDS)

def inspect_datasets():
    results = {}
    for ds_name in DATASETS_TO_INSPECT:
        print(f"\n==================================================")
        print(f"INSPECTING HUGGINGFACE DATASET: {ds_name}")
        print(f"==================================================")
        try:
            ds = load_dataset(ds_name, trust_remote_code=True)
            split_names = list(ds.keys())
            first_split = split_names[0]
            num_rows = len(ds[first_split])
            features = list(ds[first_split].features.keys())
            
            print(f"Loaded successfully! Splits: {split_names}")
            print(f"Total Rows ({first_split}): {num_rows}")
            print(f"Features/Fields: {features}")
            
            sample_preview = []
            consumer_count = 0
            
            for i, row in enumerate(ds[first_split]):
                row_str = json.dumps(row, default=str)
                is_consumer = check_text_consumer_relevance(row_str)
                if is_consumer:
                    consumer_count += 1
                if i < 2:
                    sample_preview.append({k: str(v)[:150] for k, v in row.items()})
            
            results[ds_name] = {
                "status": "SUCCESS",
                "splits": split_names,
                "total_rows": num_rows,
                "features": features,
                "consumer_rows_found": consumer_count,
                "sample_preview": sample_preview
            }
            print(f"Consumer-Relevant Cases Found in {first_split}: {consumer_count} / {num_rows}")
        except Exception as e:
            print(f"Error loading {ds_name}: {str(e)}")
            results[ds_name] = {
                "status": "ERROR",
                "error": str(e)
            }
            
    os.makedirs("./docs", exist_ok=True)
    with open("./docs/hf_inspection_summary.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("\nSaved inspection summary to ./docs/hf_inspection_summary.json")

if __name__ == "__main__":
    inspect_datasets()
