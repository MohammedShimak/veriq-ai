"""
LexAgent Google Colab & Local Python Plot Generation Script
Generates 6 high-resolution (300 DPI) publication-ready figures for your paper:
1. Confusion Matrix (Predicted vs Gold Outcomes)
2. Comparative Performance Bar Chart (Systems A, B, C)
3. 95% Wilson Confidence Interval Error Bar Plot
4. Dataset Pipeline & Deduplication Distribution
5. Submodule Ablation Study Chart
6. Document Rank Retrieval Metrics Plot (Recall@5, Precision@5, MRR, nDCG@5)
"""

import os
import json
import numpy as np
import matplotlib.pyplot as plt

OUTPUT_DIR = "./plots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Set publication-quality plot style
plt.rcParams.update({
    "font.family": "serif",
    "font.size": 11,
    "axes.labelsize": 12,
    "axes.titlesize": 13,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 10,
    "figure.titlesize": 14,
    "savefig.dpi": 300
})

# ---------------------------------------------------------
# DATA INPUT (Verified Real LexAgent Audit Benchmark Data)
# ---------------------------------------------------------

# 1. Confusion Matrix Data (System C Output vs Gold Outcomes)
labels = ["Allowed", "Dismissed", "Inconclusive", "OUT_OF_SCOPE"]
cm = np.array([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 14]
])

# 2. Performance Comparison Data (Systems A, B, C)
systems = ["System A\n(Zero-Shot LLM)", "System B\n(Statutory RAG)", "System C\n(Full LexAgent)"]
metrics = ["Citation Correctness", "Abstention Acc", "Safe Decision Acc", "Hallucination Rate"]
perf_data = np.array([
    [86.67, 85.71, 80.00, 0.00],  # System A
    [100.00, 100.00, 93.33, 0.00], # System B
    [100.00, 100.00, 93.33, 0.00]  # System C
])

# 3. 95% Wilson Confidence Intervals Data
sys_names = ["System A", "System B", "System C"]
safe_acc = [80.00, 93.33, 93.33]
safe_low = [54.81, 70.18, 70.18]
safe_high = [92.95, 98.81, 98.81]

cit_acc = [86.67, 100.00, 100.00]
cit_low = [62.12, 79.61, 79.61]
cit_high = [96.26, 100.00, 100.00]

# 4. Dataset Pipeline Data
dataset_stages = ["Raw Ingested", "Consumer\nFiltered", "Deduplicated\nUnique", "RAG Corpus\n(80%)", "Held-Out\nEval (20%)"]
dataset_counts = [14181, 1413, 664, 531, 133]

# 5. Ablation Study Data
ablation_models = ["Full LexAgent", "w/o Authority\nW_auth", "w/o Multi-Agent\nDebate", "w/o Sec 39\nGuardrail"]
ablation_recall = [1.000, 0.667, 1.000, 1.000]
ablation_acc = [93.33, 93.33, 53.33, 46.67]

# ---------------------------------------------------------
# PLOT 1: CONFUSION MATRIX
# ---------------------------------------------------------
print("Generating Figure 1: Confusion Matrix...")
fig, ax = plt.subplots(figsize=(7, 5.5))
im = ax.imshow(cm, cmap="Blues")

# Add text annotations inside cells
for i in range(len(labels)):
    for j in range(len(labels)):
        val = cm[i, j]
        color = "white" if val > 5 else "black"
        ax.text(j, i, str(val), ha="center", va="center", color=color, fontsize=14, fontweight="bold")

ax.set_xticks(np.arange(len(labels)))
ax.set_yticks(np.arange(len(labels)))
ax.set_xticklabels(labels)
ax.set_yticklabels(labels)
ax.set_title("Figure 1: System C Verdict Confusion Matrix (N=15)", pad=15)
ax.set_xlabel("Predicted Judicial Verdict", labelpad=10)
ax.set_ylabel("Gold Reference Outcome", labelpad=10)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "fig1_confusion_matrix.png"))
plt.close()

# ---------------------------------------------------------
# PLOT 2: COMPARATIVE PERFORMANCE BAR CHART
# ---------------------------------------------------------
print("Generating Figure 2: Comparative Performance Bar Chart...")
fig, ax = plt.subplots(figsize=(10, 5.5))
x = np.arange(len(systems))
width = 0.2

colors = ["#2b5c8f", "#d95f02", "#7570b3", "#e7298a"]
for idx, metric in enumerate(metrics):
    vals = perf_data[:, idx]
    rects = ax.bar(x + (idx - 1.5) * width, vals, width, label=metric, color=colors[idx])
    for p in rects:
        h = p.get_height()
        if h > 0:
            ax.annotate(f"{h:.1f}%", (p.get_x() + p.get_width() / 2., h + 1.5),
                        ha="center", va="bottom", fontsize=8, rotation=0)

ax.set_ylabel("Percentage (%)")
ax.set_title("Figure 2: Performance Comparison Across Baseline Systems (N=15)", pad=15)
ax.set_xticks(x)
ax.set_xticklabels(systems)
ax.set_ylim(0, 118)
ax.legend(loc="upper right", frameon=True)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "fig2_system_comparison.png"))
plt.close()

# ---------------------------------------------------------
# PLOT 3: 95% WILSON CONFIDENCE INTERVAL ERROR BARS
# ---------------------------------------------------------
print("Generating Figure 3: 95% Wilson Confidence Intervals Plot...")
fig, ax = plt.subplots(figsize=(8, 5))
x = np.arange(len(sys_names))
width = 0.35

y_safe = np.array(safe_acc)
err_safe = [y_safe - np.array(safe_low), np.array(safe_high) - y_safe]

y_cit = np.array(cit_acc)
err_cit = [y_cit - np.array(cit_low), np.array(cit_high) - y_cit]

rects1 = ax.bar(x - width/2, y_safe, width, label="Safe Decision Acc (%)", yerr=err_safe, capsize=5, color="#2b5c8f")
rects2 = ax.bar(x + width/2, y_cit, width, label="Citation Correctness (%)", yerr=err_cit, capsize=5, color="#d95f02")

ax.set_ylabel("Percentage (%)")
ax.set_title("Figure 3: Point Estimates with 95% Wilson Confidence Intervals", pad=15)
ax.set_xticks(x)
ax.set_xticklabels(sys_names)
ax.set_ylim(0, 118)
ax.legend(loc="upper left")
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "fig3_confidence_intervals.png"))
plt.close()

# ---------------------------------------------------------
# PLOT 4: DATASET PIPELINE DISTRIBUTION
# ---------------------------------------------------------
print("Generating Figure 4: Dataset Pipeline & Deduplication Chart...")
fig, ax = plt.subplots(figsize=(9, 5))
bar_colors = ["#08306b", "#08519c", "#2171b5", "#4292c6", "#6baed6"]

bars = ax.bar(dataset_stages, dataset_counts, color=bar_colors, width=0.55)
ax.set_yscale("log")
ax.set_title("Figure 4: Benchmark Dataset Curation & Filtering Pipeline (Log Scale)", pad=15)
ax.set_ylabel("Number of Cases (Log Scale)")

for bar, count in zip(bars, dataset_counts):
    ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() * 1.18,
            f"{count:,}", ha="center", va="bottom", fontsize=10, fontweight="bold")

ax.set_ylim(1, 60000)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "fig4_dataset_pipeline.png"))
plt.close()

# ---------------------------------------------------------
# PLOT 5: SUBMODULE ABLATION STUDY CHART
# ---------------------------------------------------------
print("Generating Figure 5: Submodule Ablation Study Chart...")
fig, ax1 = plt.subplots(figsize=(8.5, 5))

color = "#1f77b4"
ax1.set_xlabel("Ablation Configuration", labelpad=10)
ax1.set_ylabel("Safe Decision Accuracy (%)", color=color)
bars1 = ax1.bar(np.arange(len(ablation_models)) - 0.15, ablation_acc, width=0.3, color=color, label="Safe Accuracy (%)")
ax1.tick_params(axis="y", labelcolor=color)
ax1.set_xticks(np.arange(len(ablation_models)))
ax1.set_xticklabels(ablation_models)
ax1.set_ylim(0, 118)

ax2 = ax1.twinx()
color = "#ff7f0e"
ax2.set_ylabel("Precedent Recall@5", color=color)
bars2 = ax2.bar(np.arange(len(ablation_models)) + 0.15, ablation_recall, width=0.3, color=color, label="Precedent Recall@5")
ax2.tick_params(axis="y", labelcolor=color)
ax2.set_ylim(0, 1.25)

plt.title("Figure 5: Submodule Ablation Impact on Accuracy & Retrieval", pad=15)
fig.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "fig5_ablation_analysis.png"))
plt.close()

# ---------------------------------------------------------
# PLOT 6: DOCUMENT RANK RETRIEVAL METRICS
# ---------------------------------------------------------
print("Generating Figure 6: Document Rank Retrieval Metrics...")
retrieval_metrics = ["Recall@5", "Precision@5", "MRR", "nDCG@5"]
sysA_ret = [0.0, 0.0, 0.0, 0.0]
sysB_ret = [0.0, 0.0, 0.0, 0.0]
sysC_ret_online = [1.0, 0.2, 1.0, 1.0]

x = np.arange(len(retrieval_metrics))
width = 0.25

fig, ax = plt.subplots(figsize=(8.5, 5))
rects1 = ax.bar(x - width, sysA_ret, width, label="System A (Zero-Shot)", color="#d9d9d9")
rects2 = ax.bar(x, sysB_ret, width, label="System B (Statutory RAG)", color="#969696")
rects3 = ax.bar(x + width, sysC_ret_online, width, label="System C (Full LexAgent RAG)", color="#2ca02c")

ax.set_ylabel("Score Ratio (0.0 - 1.0)")
ax.set_title("Figure 6: Document-Rank Retrieval Metrics on Landmark Precedents", pad=15)
ax.set_xticks(x)
ax.set_xticklabels(retrieval_metrics)
ax.set_ylim(0, 1.25)
ax.legend(loc="upper right")

for p in rects3:
    h = p.get_height()
    if h > 0:
        ax.annotate(f"{h:.2f}", (p.get_x() + p.get_width() / 2., h + 0.03),
                    ha="center", va="bottom", fontsize=9, fontweight="bold")

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "fig6_retrieval_metrics.png"))
plt.close()

print("==================================================================")
print(f"SUCCESS: All 6 publication-ready figures saved to: {OUTPUT_DIR}/")
print("==================================================================")
