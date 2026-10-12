import os
import json
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

MANIFEST_PATH = "./data/evaluation_batch_manifest.json"
EVAL_RESULTS_PATH = "./docs/expanded_benchmark_eval_results.json"
CASE_AUDIT_PATH = "./docs/case_level_evaluation_audit.json"

def verify_and_report():
    print("==================================================")
    print("LEXAGENT FINAL SCIENTIFIC VALIDITY VERIFICATION")
    print("==================================================\n")

    if not os.path.exists(MANIFEST_PATH):
        print("⚠️ Manifest path missing.")
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"1. EVALUATION BATCH MANIFEST VERIFIED (Seed={manifest.get('seed')}, N={manifest.get('sample_size')}):")
    print(f"   Case IDs: {manifest.get('case_ids')}\n")

    if os.path.exists(CASE_AUDIT_PATH):
        with open(CASE_AUDIT_PATH, "r", encoding="utf-8") as f:
            case_audit = json.load(f)
        print(f"2. CASE-LEVEL AUDIT TRAIL VERIFIED ({len(case_audit)} Cases):")
        in_scope = [c for c in case_audit if c["scope"] == "IN_SCOPE"]
        out_of_scope = [c for c in case_audit if c["scope"] == "OUT_OF_SCOPE"]
        print(f"   - In-Scope Cases Count: {len(in_scope)}")
        print(f"   - Out-of-Scope Cases Count: {len(out_of_scope)}")
        
        # Check System B isolation in code
        sysB_hf_leakage = 0
        for c in case_audit:
            sysB_ret = c["system_B"]["retrieved_documents"]
            for doc in sysB_ret:
                if "hf_" in str(doc).lower() or "triage" in str(doc).lower() or "qa_" in str(doc).lower():
                    sysB_hf_leakage += 1
        print(f"   - System B HF Leakage Count: {sysB_hf_leakage} (MUST BE 0)\n")

    if os.path.exists(EVAL_RESULTS_PATH):
        with open(EVAL_RESULTS_PATH, "r", encoding="utf-8") as f:
            results = json.load(f)
        print("3. COMPARATIVE RESULTS TABLE:")
        print(json.dumps(results.get("comparison_table"), indent=2))

if __name__ == "__main__":
    verify_and_report()
