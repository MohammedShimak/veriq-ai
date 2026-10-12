# LexAgent Research Evaluation & Benchmark Report

Automated empirical evaluation comparing **System A (Plain LLM Baseline)** vs **System B (LexAgent Multi-Agent Pipeline)** on a labeled benchmark dataset of Indian Consumer Protection Act, 2019 legal dispute judgments.

---

## 📊 Executive Summary Comparison Table

| Metric | Plain LLM Baseline (System A) | LexAgent Full Pipeline (System B) | Delta / Absolute Gain |
| :--- | :---: | :---: | :---: |
| **Outcome Accuracy** | 100.0% | **100.0%** | +0.0% |
| **Section Citation Macro-F1** | 0.540 | **0.050** | +-0.490 |
| **Section Citation Precision** | 0.425 | **0.050** | +-0.375 |
| **Section Citation Recall** | 0.750 | **0.050** | +-0.700 |
| **Citation Hallucination Rate** | 0.0% | **0.0%** | -0.0% |
| **Expected Calibration Error (ECE)** | 0.520 | **0.520** | -0.000 |
| **Average Model Confidence** | 48.0% | 48.0% | - |

---

## 📂 Category-Wise Accuracy Breakdown

| Dispute Category | Plain LLM Baseline | LexAgent Pipeline | Total Test Cases |
| :--- | :---: | :---: | :---: |
| **Defective Product** | 100.0% | **100.0%** | 10 |

---

## 🔬 Module C: Semantic Grounding & Entailment Fact-Checking Analysis

The Semantic Grounding Layer (semanticValidator.js) performs LLM-based semantic entailment checks on statutory section-citing sentences across Support, Oppose, and Judicial Bench outputs against retrieved statutory text.

- **Total Claim Sentences Fact-Checked**: 54
- **Entailment Rate**: **5.6%** (Claims directly supported by retrieved CPA 2019 statutory text)
- **Contradiction Rate**: 0.0% (Claims directly conflicting with statutory text)
- **Unsupported Rate**: 94.4% (Claims exceeding statutory context window)

---

## 🧪 Ablation Study Results

Evaluating the contribution of key architectural modules:

| System Variant | Outcome Accuracy | Section Citation F1 | Hallucination Rate | ECE |
| :--- | :---: | :---: | :---: | :---: |
| **Full LexAgent Pipeline** | **100.0%** | **0.050** | **0.0%** | **0.520** |
| **Ablation: No RAG (Empty Context)** | 0.0% | 0.000 | 0.0% | 0.650 |
| **Ablation: No Adversarial Debate** | 0.0% | 1.000 | 0.0% | 0.750 |
| **Ablation: No Grounding Layer** | 0.0% | 0.800 | 33.3% | 0.800 |

---

## 📋 Case-by-Case Detailed Prediction Log (First 15 Cases)

| Case ID | Category | Ground Truth Outcome | Baseline Prediction | LexAgent Prediction | Baseline Match | LexAgent Match |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| `triage_hf_0175` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |
| `triage_hf_0505` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |
| `triage_hf_0556` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |
| `sc_ncdrc_1995_a7358e` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |
| `triage_hf_0592` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |
| `triage_hf_0154` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |
| `triage_hf_0438` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |
| `triage_hf_0605` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |
| `triage_hf_0655` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |
| `triage_hf_0625` | Defective Product | Inconclusive | Inconclusive | Inconclusive | ✅ | ✅ |