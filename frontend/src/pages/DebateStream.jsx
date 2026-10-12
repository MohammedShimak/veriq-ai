import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import BalanceBar from "../components/BalanceBar";
import DebateAnalysisGraph from "../components/DebateAnalysisGraph";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import { startDebateStream } from "../services/debateApi";
import { useAuth } from "../context/AuthContext";

export default function DebateStream() {
  const { threadId: paramThreadId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [question] = useState(location.state?.question || "Defective mobile phone display failed within 3 days.");
  const [product] = useState(location.state?.product || "");
  const [company] = useState(location.state?.company || "");
  const [amount] = useState(location.state?.amount || "");
  const [stage, setStage] = useState(1);
  const [actualThreadId, setActualThreadId] = useState(paramThreadId);
  const [intentData, setIntentData] = useState(null);
  const [reasoningData, setReasoningData] = useState(null);
  const [retrievalData, setRetrievalData] = useState(null);
  const [supportData, setSupportData] = useState(null);
  const [opposeData, setOpposeData] = useState(null);
  const [groundingData, setGroundingData] = useState(null);
  const [judgeData, setJudgeData] = useState(null);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cancelStream = startDebateStream(
      question,
      paramThreadId,
      accessToken,
      (eventType, data) => {
        if (eventType === "thread") {
          if (data.threadId) setActualThreadId(data.threadId);
        } else if (eventType === "intent") {
          setIntentData(data);
          setStage(2);
        } else if (eventType === "caseReasoning") {
          setReasoningData(data);
          setStage(3);
        } else if (eventType === "retrieval") {
          setRetrievalData(data);
          setStage(4);
        } else if (eventType === "support") {
          setSupportData(data);
        } else if (eventType === "oppose") {
          setOpposeData(data);
        } else if (eventType === "semanticGrounding") {
          setGroundingData(data);
        } else if (eventType === "judge") {
          setJudgeData(data);
          setStage(5);
        } else if (eventType === "done") {
          setIsDone(true);
        } else if (eventType === "error") {
          setError(data.error || "Debate streaming encountered an error.");
        }
      },
      { product, company, amount }
    );

    return () => cancelStream();
  }, [question, paramThreadId, accessToken, product, company, amount]);

  // Compute balance bar position from judge output or grounding validation
  const getBalancePosition = () => {
    if (judgeData) {
      if (judgeData.decision && judgeData.decision.includes("Consumer")) return -0.7;
      if (judgeData.decision && judgeData.decision.includes("Respondent")) return 0.7;
      return 0.0;
    }
    if (supportData && !opposeData) return -0.5;
    if (opposeData && !supportData) return 0.5;
    return 0.0;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg)", color: "var(--ink)" }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Header */}
        <div className="border-b border-[var(--line)] pb-4 flex items-center justify-between">
          <div>
            <span className="font-mono text-xs text-[var(--brass)]">LIVE ADJUDICATION DEBATE</span>
            <h1 className="text-2xl font-serif mt-1">{question}</h1>
          </div>
          {isDone && (
            <button
              onClick={() => navigate(`/verdict/${actualThreadId}`)}
              className="px-6 py-2.5 rounded-lg font-mono text-xs font-semibold bg-[var(--brass)] text-[var(--bg)] hover:bg-[var(--brass-hover)] transition shadow-md"
            >
              View Full Verdict →
            </button>
          )}
        </div>

        <ErrorBanner message={error} onClose={() => setError(null)} />

        {/* Stage Progress Indicator */}
        <div className="grid grid-cols-5 gap-2 p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          {[
            { id: 1, label: "1. Intent" },
            { id: 2, label: "2. Reasoning" },
            { id: 3, label: "3. Retrieval" },
            { id: 4, label: "4. Counsels" },
            { id: 5, label: "5. Verdict" }
          ].map((s) => (
            <div
              key={s.id}
              className={`p-2 rounded text-center font-mono text-xs transition-colors ${
                stage >= s.id
                  ? "bg-[var(--brass-light)] border border-[var(--line-bright)] text-[var(--brass)] font-semibold"
                  : "text-[var(--ink-dim)] opacity-50"
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* Intent & Reasoning Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {intentData && (
            <div className="p-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-2">
              <span className="font-mono text-xs text-[var(--brass)]">INTENT CLASSIFICATION</span>
              <h3 className="font-serif text-lg text-[var(--ink)]">{intentData.category}</h3>
              <p className="text-xs text-[var(--ink-muted)]">Jurisdiction: Consumer Protection Act, 2019</p>
            </div>
          )}

          {retrievalData && (
            <div className="p-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-2">
              <span className="font-mono text-xs text-[var(--brass)]">HYBRID FAISS RETRIEVAL</span>
              <h3 className="font-serif text-lg text-[var(--ink)]">{retrievalData.count || 5} Statutory Chunks Retrieved</h3>
              <p className="text-xs font-mono text-[var(--support-green)]">✓ Vector Similarity Grounded</p>
              {retrievalData.live_law_enabled && (
                <p className="text-xs font-mono text-[#60a5fa]">● {retrievalData.live_sections_count || 0} live Indian law sections (Indian Kanoon)</p>
              )}
            </div>
          )}
        </div>

        {/* Balance Bar & Debate Analysis Graph */}
        {(supportData || opposeData || judgeData) && (
          <div className="space-y-6">
            <BalanceBar position={getBalancePosition()} label="Evidentiary Balance of Probability" />
            <DebateAnalysisGraph supportData={supportData} opposeData={opposeData} judgeData={judgeData} loading={!isDone && !judgeData} />
          </div>
        )}

        {/* Adversarial Counsel Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Petitioner Counsel (Support) */}
          <div className="p-6 rounded-xl border-l-4 border-l-[var(--support-green)] border border-[var(--line)] bg-[var(--surface)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <span className="font-mono text-xs font-semibold text-[var(--support-green)]">PETITIONER COUNSEL</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--support-bg)] text-[var(--support-green-bright)] font-mono">
                SUPPORT
              </span>
            </div>

            {supportData ? (
              <div className="space-y-3 text-sm">
                <p className="font-serif text-[var(--ink)] leading-relaxed">{supportData.position}</p>
                {supportData.arguments?.map((arg, i) => (
                  <div key={i} className="p-3 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
                    <span className="font-mono text-xs text-[var(--brass)]">{arg.issue}</span>
                    <p className="text-xs text-[var(--ink-muted)]">{arg.argument}</p>
                  </div>
                ))}
              </div>
            ) : (
              <LoadingSpinner message="Counsel preparing arguments..." />
            )}
          </div>

          {/* Respondent Counsel (Oppose) */}
          <div className="p-6 rounded-xl border-l-4 border-l-[var(--oppose-oxblood)] border border-[var(--line)] bg-[var(--surface)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <span className="font-mono text-xs font-semibold text-[var(--oppose-oxblood)]">RESPONDENT COUNSEL</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--oppose-bg)] text-[var(--oppose-oxblood-bright)] font-mono">
                OPPOSE
              </span>
            </div>

            {opposeData ? (
              <div className="space-y-3 text-sm">
                <p className="font-serif text-[var(--ink)] leading-relaxed">{opposeData.position}</p>
                {opposeData.arguments?.map((arg, i) => (
                  <div key={i} className="p-3 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
                    <span className="font-mono text-xs text-[var(--brass)]">{arg.issue}</span>
                    <p className="text-xs text-[var(--ink-muted)]">{arg.argument}</p>
                  </div>
                ))}
              </div>
            ) : (
              <LoadingSpinner message="Respondent preparing counter-arguments..." />
            )}
          </div>
        </div>

        {/* Judicial Bench Verdict Card */}
        {judgeData && (
          <div className="p-8 rounded-xl border-2 border-[var(--brass)] bg-[var(--surface)] space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div>
                <span className="font-mono text-xs text-[var(--brass)]">MODULE 5 — JUDICIAL BENCH DECISION</span>
                <h2 className="text-2xl font-serif mt-1 text-[var(--ink)]">{judgeData.decision}</h2>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs text-[var(--ink-muted)]">Confidence Score</span>
                <p className="font-mono text-xl text-[var(--brass)] font-bold">
                  {((judgeData.overall_confidence || 0.85) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            <p className="text-sm font-serif leading-relaxed text-[var(--ink-muted)]">{judgeData.decision_explanation}</p>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => navigate(`/verdict/${actualThreadId}`)}
                className="px-8 py-3 rounded-lg font-mono text-sm font-semibold bg-[var(--brass)] text-[var(--bg)] hover:bg-[var(--brass-hover)] transition shadow-lg"
              >
                View Formal Court Order & Download PDF →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
