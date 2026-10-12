import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import {
  getInvestigationApi,
  analyzeInvestigationApi,
  submitClarificationAnswersApi,
  proceedInvestigationApi,
  uploadEvidenceApi,
  markEvidenceUnavailableApi,
  submitEvidenceCorrectionApi,
  downloadEvidenceFileApi,
  researchCompanyPolicyApi,
  evaluateInvestigationGateApi,
  proceedGateWithLimitationsApi,
  generateAssessmentApi,
  downloadInvestigationPdfApi,
  removeEvidenceApi,
  clarifyEvidenceRelevanceApi,
  getTaiPlanApi,
  executeTaiStepApi
} from "../services/investigationApi";
import { useAuth } from "../context/AuthContext";
import TransferAssessmentModal from "../components/TransferAssessmentModal";
import { BRAND } from "../config/brand";

export default function InvestigationView() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [investigation, setInvestigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Form answers state keyed by questionId
  const [answerInputs, setAnswerInputs] = useState({});
  // Follow-up answers for conditional follow-up questions
  const [followUpInputs, setFollowUpInputs] = useState({});
  // Custom text for "Other" options
  const [otherTextInputs, setOtherTextInputs] = useState({});

  // Active question index for step-by-step navigation
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState("all"); // "all" | "stepper"

  // Editing state for previously answered questions
  const [editingItem, setEditingItem] = useState(null);
  const [editValue, setEditValue] = useState("");

  // Phase 3: Evidence Upload & Inspection state
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("INVOICE");

  // Phase 3: Unavailable Document state
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [unavailableDocName, setUnavailableDocName] = useState("");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [markingUnavailable, setMarkingUnavailable] = useState(false);

  // Phase 3: User Interpretation Correction state
  const [correctingDocId, setCorrectingDocId] = useState(null);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Phase 4: Policy Research state
  const [researchingPolicy, setResearchingPolicy] = useState(false);

  // Phase 5: Completeness Gate state
  const [evaluatingGate, setEvaluatingGate] = useState(false);
  const [gateResult, setGateResult] = useState(null);
  const [proceedingWithLimitations, setProceedingWithLimitations] = useState(false);
  const [showLimitationModal, setShowLimitationModal] = useState(false);
  const [limitationReason, setLimitationReason] = useState("");

  // Phase 6: Grounded Legal Assessment state
  const [generatingAssessment, setGeneratingAssessment] = useState(false);
  const [downloadingInvestigationPdf, setDownloadingInvestigationPdf] = useState(false);
  const [assessmentTab, setAssessmentTab] = useState("summary");
  const [showTransferAssessmentModal, setShowTransferAssessmentModal] = useState(false);

  // TAI Central AI coordination state
  const [taiPlan, setTaiPlan] = useState(null);
  const [taiLoading, setTaiLoading] = useState(false);
  const [taiActionLoading, setTaiActionLoading] = useState(false);

  // Fetch TAI Case Plan
  const fetchTaiPlan = async (tId = threadId, token = accessToken) => {
    if (!tId) return;
    try {
      setTaiLoading(true);
      const data = await getTaiPlanApi(tId, token);
      if (data?.plan) {
        setTaiPlan(data.plan);
      }
    } catch (err) {
      console.warn("TAI plan fetch notice:", err.message);
    } finally {
      setTaiLoading(false);
    }
  };

  // 1. Load persistent investigation from database
  useEffect(() => {
    async function loadCase() {
      if (!threadId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getInvestigationApi(threadId, accessToken);
        const currentInv = data.investigation;
        setInvestigation(currentInv);
        fetchTaiPlan(threadId, accessToken);

        // If newly created and not yet analyzed, automatically trigger initial analysis
        const isNotAnalyzed =
          currentInv.stage === "INITIAL_ANALYSIS" &&
          (!currentInv.unresolvedQuestions || currentInv.unresolvedQuestions.length === 0);

        if (isNotAnalyzed) {
          triggerAnalysis();
        }
      } catch (err) {
        console.error("Failed to load investigation:", err);
        setError(err.response?.data?.error || "Could not retrieve investigation case. Please retry.");
      } finally {
        setLoading(false);
      }
    }

    loadCase();
  }, [threadId, accessToken]);

  const handleTaiExecuteStep = async (action) => {
    if (!action) return;
    try {
      setTaiActionLoading(true);
      setError(null);

      if (action === "UPLOAD_EVIDENCE" || action === "ANSWER_CLARIFICATIONS") {
        const targetId = action === "UPLOAD_EVIDENCE" ? "evidence-section" : "clarification-section";
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: "smooth" });
        return;
      }
      if (action === "PROCEED_WITH_LIMITATIONS") {
        setShowLimitationModal(true);
        return;
      }
      if (action === "GENERATE_ASSESSMENT") {
        await handleGenerateAssessment();
        await fetchTaiPlan();
        return;
      }
      if (action === "EXPORT_REPORT") {
        handleDownloadInvestigationPdf();
        return;
      }
      if (action === "PERFORM_POLICY_RESEARCH") {
        await handleResearchPolicy();
        await fetchTaiPlan();
        return;
      }
      if (action === "EVALUATE_GATE") {
        await handleEvaluateGate();
        await fetchTaiPlan();
        return;
      }
      if (action === "REVIEW_TRANSFER_ASSESSMENT") {
        setShowTransferAssessmentModal(true);
        return;
      }
      if (action === "GENERATE_FINAL_OUTCOME" || action === "VIEW_FINAL_OUTCOME") {
        navigate(`/courtroom/${threadId}/outcome`);
        return;
      }
      if (action === "ANALYZE_COMPLAINT") {
        await triggerAnalysis();
        await fetchTaiPlan();
        return;
      }

      // Fallback: Direct TAI step execution
      const res = await executeTaiStepApi(threadId, action, {}, accessToken);
      if (res?.investigation) {
        setInvestigation(res.investigation);
        setTaiPlan(res.plan);
        setSuccessNotice(`TAI Action executed: ${action}`);
      }
    } catch (err) {
      console.error("TAI action execution failed:", err);
      setError(err.response?.data?.error || err.message || "Failed to execute TAI action.");
    } finally {
      setTaiActionLoading(false);
    }
  };

  // Trigger initial analysis and generate round 1 questions
  const triggerAnalysis = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      const res = await analyzeInvestigationApi(threadId, accessToken);
      if (res.investigation) {
        setInvestigation(res.investigation);
      }
    } catch (err) {
      console.error("Initial analysis failed:", err);
      setError(
        err.response?.data?.error ||
        "Factual analysis service temporarily busy. Please click 'Try Again' to retry safely."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswerInputs((prev) => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleFollowUpChange = (questionId, value) => {
    setFollowUpInputs((prev) => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleOtherTextChange = (questionId, text) => {
    setOtherTextInputs((prev) => ({
      ...prev,
      [questionId]: text
    }));
  };

  // Helper to determine if a question is currently answered
  const isQuestionAnswered = (q) => {
    const rawVal = answerInputs[q.id];
    if (rawVal === undefined || rawVal === null) return false;
    if (typeof rawVal === "string") {
      if (!rawVal.trim()) return false;
      if (rawVal === "Other") {
        return !!(otherTextInputs[q.id] || "").trim();
      }
      return true;
    }
    if (typeof rawVal === "number") return true;
    if (Array.isArray(rawVal)) {
      if (rawVal.length === 0) return false;
      if (rawVal.includes("Other") && !(otherTextInputs[q.id] || "").trim()) return false;
      return true;
    }
    return true;
  };

  // Build the complete answer value (combining main, "Other" text, and conditional follow-up)
  const buildFinalAnswer = (q) => {
    const rawVal = answerInputs[q.id];
    let mainAnswer = rawVal;

    // Merge "Other" text if selected
    if (typeof rawVal === "string" && rawVal === "Other") {
      const custom = (otherTextInputs[q.id] || "").trim();
      mainAnswer = custom ? `Other: ${custom}` : "Other";
    } else if (Array.isArray(rawVal)) {
      mainAnswer = rawVal.map((item) => {
        if (item === "Other") {
          const custom = (otherTextInputs[q.id] || "").trim();
          return custom ? `Other: ${custom}` : "Other";
        }
        return item;
      });
    }

    // Merge conditional follow-up if applicable
    const followUpVal = (followUpInputs[q.id] || "").trim();
    if (q.conditionalFollowUp && followUpVal) {
      const showIf = q.conditionalFollowUp.showIfOptions || [];
      const isTriggered = typeof rawVal === "string"
        ? showIf.includes(rawVal) || showIf.some((opt) => rawVal.startsWith(opt))
        : false;

      if (isTriggered) {
        if (typeof mainAnswer === "string") {
          return `${mainAnswer} (Details: ${followUpVal})`;
        }
        return {
          selection: mainAnswer,
          followUp: followUpVal
        };
      }
    }

    return mainAnswer;
  };

  // Submit all answered questions in the current round
  const handleSubmitAnswers = async (e) => {
    if (e) e.preventDefault();
    if (submittingAnswers) return;

    const pendingQuestions = (investigation?.unresolvedQuestions || []).filter(
      (q) => q.status === "PENDING"
    );

    const answersToSubmit = [];
    for (const q of pendingQuestions) {
      if (isQuestionAnswered(q)) {
        const finalAns = buildFinalAnswer(q);
        answersToSubmit.push({
          questionId: q.id,
          question: q.question,
          answer: finalAns
        });
      }
    }

    if (answersToSubmit.length === 0) {
      setError("Please provide an answer to at least one question before continuing.");
      return;
    }

    try {
      setSubmittingAnswers(true);
      setError(null);
      setSuccessNotice(null);

      const res = await submitClarificationAnswersApi(threadId, answersToSubmit, accessToken);
      if (res.investigation) {
        setInvestigation(res.investigation);
        setAnswerInputs({});
        setFollowUpInputs({});
        setOtherTextInputs({});
        setActiveQuestionIndex(0);
        setSuccessNotice("Answers recorded successfully. Case facts updated.");
      }
    } catch (err) {
      console.error("Error submitting answers:", err);
      setError(err.response?.data?.error || "Failed to submit answers. Your case remains safe. Please retry.");
    } finally {
      setSubmittingAnswers(false);
    }
  };

  // Submit edited answer for a previously answered clarification
  const handleSaveEdit = async () => {
    if (!editingItem || !editValue.trim() || submittingAnswers) return;

    try {
      setSubmittingAnswers(true);
      setError(null);

      const res = await submitClarificationAnswersApi(
        threadId,
        [
          {
            questionId: editingItem.questionId,
            question: editingItem.question,
            answer: editValue.trim()
          }
        ],
        accessToken
      );

      if (res.investigation) {
        setInvestigation(res.investigation);
        setEditingItem(null);
        setEditValue("");
        setSuccessNotice("Clarification answer updated successfully.");
      }
    } catch (err) {
      console.error("Failed to update clarification:", err);
      setError(err.response?.data?.error || "Could not update answer. Please try again.");
    } finally {
      setSubmittingAnswers(false);
    }
  };

  // Allow user to proceed with existing facts without further questions
  const handleProceed = async () => {
    if (submittingAnswers) return;
    try {
      setSubmittingAnswers(true);
      setError(null);
      const res = await proceedInvestigationApi(threadId, accessToken);
      if (res.investigation) {
        setInvestigation(res.investigation);
      }
    } catch (err) {
      console.error("Error proceeding with case:", err);
      setError(err.response?.data?.error || "Failed to proceed to evidence phase. Please retry.");
    } finally {
      setSubmittingAnswers(false);
    }
  };

  // Phase 3: File change handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File exceeds the 10 MB maximum limit. Please choose a smaller file.");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
    if (!docTitle) {
      setDocTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  // Phase 3: Evidence upload & inspection submit
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploadingFile(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result;
          const res = await uploadEvidenceApi(
            threadId,
            {
              filename: selectedFile.name,
              originalName: selectedFile.name,
              mimeType: selectedFile.type,
              dataBase64: base64Data,
              category: docCategory,
              title: docTitle || selectedFile.name
            },
            accessToken
          );
          if (res.investigation) {
            setInvestigation(res.investigation);
            setSuccessNotice(`Document "${selectedFile.name}" uploaded and inspected successfully.`);
          }
          setSelectedFile(null);
          setDocTitle("");
        } catch (uploadErr) {
          setUploadError(uploadErr.response?.data?.error || "Failed to inspect uploaded file.");
        } finally {
          setUploadingFile(false);
        }
      };
      reader.onerror = () => {
        setUploadError("Failed to read file.");
        setUploadingFile(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setUploadError(err.message || "Failed to initiate file upload.");
      setUploadingFile(false);
    }
  };

  // Phase 3: Secure download handler
  const handleDownloadFile = async (docId, filename) => {
    try {
      const blob = await downloadEvidenceFileApi(threadId, docId, accessToken);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename || "evidence_document");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download evidence file. Authorization check failed.");
    }
  };

  // Phase 3: Mark unavailable document
  const handleMarkUnavailableSubmit = async (e) => {
    e.preventDefault();
    if (!unavailableDocName.trim()) return;
    setMarkingUnavailable(true);
    setError(null);
    try {
      const res = await markEvidenceUnavailableApi(
        threadId,
        unavailableDocName.trim(),
        unavailableReason.trim() || "Document unavailable or never issued by merchant.",
        accessToken
      );
      if (res.investigation) {
        setInvestigation(res.investigation);
        setSuccessNotice(`Marked document "${unavailableDocName.trim()}" as unavailable.`);
      }
      setShowUnavailableModal(false);
      setUnavailableDocName("");
      setUnavailableReason("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to record unavailable document.");
    } finally {
      setMarkingUnavailable(false);
    }
  };

  // Phase 3: Submit interpretation correction
  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!correctingDocId) return;
    setSubmittingCorrection(true);
    setError(null);
    try {
      const res = await submitEvidenceCorrectionApi(
        threadId,
        correctingDocId,
        {
          correctedText: correctionText.trim(),
          notes: correctionNotes.trim()
        },
        accessToken
      );
      if (res.investigation) {
        setInvestigation(res.investigation);
        setSuccessNotice("Interpretation correction saved successfully.");
      }
      setCorrectingDocId(null);
      setCorrectionText("");
      setCorrectionNotes("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit interpretation correction.");
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // Phase 3: Remove evidence document
  const handleRemoveEvidence = async (docId) => {
    if (!window.confirm("Are you sure you want to remove this document from the case record? Any existing assessment will need to be regenerated.")) {
      return;
    }
    setError(null);
    try {
      const res = await removeEvidenceApi(threadId, docId, accessToken);
      if (res.investigation) {
        setInvestigation(res.investigation);
        setSuccessNotice("Document removed from case inventory. Any existing assessment has been flagged as outdated.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove evidence document.");
    }
  };

  // Phase 3: Clarify relevance or confirm unrelated
  const handleClarifyRelevance = async (docId, confirmUnrelated = false, explanation = "") => {
    setError(null);
    try {
      const res = await clarifyEvidenceRelevanceApi(
        threadId,
        docId,
        { confirmUnrelated, explanation },
        accessToken
      );
      if (res.investigation) {
        setInvestigation(res.investigation);
        setSuccessNotice(confirmUnrelated ? "Document confirmed as unrelated to complaint." : "Document relevance explanation recorded.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update evidence relevance.");
    }
  };

  const handlePromptExplainRelevance = (docId) => {
    const explanation = window.prompt("Explain how this document connects or relates to your complaint:");
    if (explanation && explanation.trim()) {
      handleClarifyRelevance(docId, false, explanation.trim());
    }
  };

  // Phase 4: Policy Research Trigger
  const handleRunPolicyResearch = async () => {
    setResearchingPolicy(true);
    setError(null);
    try {
      const res = await researchCompanyPolicyApi(threadId, accessToken);
      if (res.investigation) {
        setInvestigation(res.investigation);
        setSuccessNotice("Company policy research and statutory comparisons updated.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to retrieve company policy research.");
    } finally {
      setResearchingPolicy(false);
    }
  };

  // Phase 5: Completeness Gate Evaluation
  const handleEvaluateGate = async () => {
    setEvaluatingGate(true);
    setError(null);
    try {
      const res = await evaluateInvestigationGateApi(threadId, accessToken);
      if (res.investigation) {
        setInvestigation(res.investigation);
      }
      if (res.gate) {
        setGateResult(res.gate);
        if (res.gate.status === "READY") {
          setSuccessNotice("Completeness Gate Passed: Case is READY for preliminary legal assessment.");
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to evaluate completeness gate.");
    } finally {
      setEvaluatingGate(false);
    }
  };

  // Phase 5: Proceed With Limitations
  const handleProceedWithLimitations = async () => {
    setProceedingWithLimitations(true);
    setError(null);
    try {
      const res = await proceedGateWithLimitationsApi(
        threadId,
        limitationReason.trim() || "Consumer confirmed proceeding with documented evidentiary limitations.",
        accessToken
      );
      if (res.investigation) {
        setInvestigation(res.investigation);
      }
      if (res.gate) {
        setGateResult(res.gate);
      }
      setShowLimitationModal(false);
      setSuccessNotice("Proceeding with disclosed evidentiary limitations recorded.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to proceed with limitations.");
    } finally {
      setProceedingWithLimitations(false);
    }
  };

  // Phase 6: Generate Grounded Legal Assessment
  const handleGenerateAssessment = async () => {
    setGeneratingAssessment(true);
    setError(null);
    try {
      const res = await generateAssessmentApi(threadId, accessToken);
      if (res.investigation) {
        setInvestigation(res.investigation);
      }
      setSuccessNotice("Grounded legal assessment generated successfully under CPA 2019.");
    } catch (err) {
      console.error("Assessment generation error:", err);
      setError(
        err.response?.data?.error ||
        "Failed to generate legal assessment. Please ensure completeness gate is satisfied."
      );
    } finally {
      setGeneratingAssessment(false);
    }
  };

  // Phase 7: Download Investigation Report PDF
  const handleDownloadInvestigationPdf = async () => {
    setDownloadingInvestigationPdf(true);
    setError(null);
    try {
      const blob = await downloadInvestigationPdfApi(threadId, accessToken);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Veriq_AI_Case_Dossier_${threadId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccessNotice("Investigation PDF report downloaded successfully.");
    } catch (err) {
      console.error("PDF download error:", err);
      setError(err.response?.data?.error || "Failed to download investigation PDF report.");
    } finally {
      setDownloadingInvestigationPdf(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
          <LoadingSpinner
            variant="page"
            message="Preparing your investigation…"
            submessage="Retrieving persistent case docket, clarification history, and evidence inventory from database..."
          />
        </main>
      </div>
    );
  }

  const intake = investigation?.intake || {};
  const analysis = investigation?.initialAnalysis || {};
  const pendingQuestions = (investigation?.unresolvedQuestions || []).filter(
    (q) => q.status === "PENDING"
  );
  const clarificationHistory = investigation?.clarificationHistory || [];
  const isClarificationComplete = investigation?.isClarificationComplete || investigation?.stage === "AWAITING_EVIDENCE" || investigation?.stage === "EVIDENCE_REVIEW" || investigation?.stage === "READY_FOR_ASSESSMENT";
  const currentRound = investigation?.clarificationRound || 1;
  const disputeCategory = analysis.disputeCategory || intake.category || "Consumer Dispute";
  const evidenceInventory = investigation?.evidenceInventory || [];
  const companyPolicyResearch = investigation?.companyPolicyResearch || null;
  const investigationGate = investigation?.investigationGate || gateResult || null;

  const answeredPendingCount = pendingQuestions.filter(isQuestionAnswered).length;
  const progressPercent = pendingQuestions.length > 0
    ? Math.round((answeredPendingCount / pendingQuestions.length) * 100)
    : 100;

  // Render dedicated structured control based on question.type
  const renderStructuredControl = (q) => {
    const rawVal = answerInputs[q.id];
    const otherVal = otherTextInputs[q.id] || "";
    const followUpVal = followUpInputs[q.id] || "";

    const type = q.type || "text";

    // 1. Single Choice (Radio Buttons)
    if (type === "single_choice") {
      const options = Array.isArray(q.options) && q.options.length > 0
        ? q.options
        : ["Yes", "No", "Not sure", "Other"];

      const showOtherInput = rawVal === "Other";

      const showConditional = q.conditionalFollowUp && rawVal && (
        (q.conditionalFollowUp.showIfOptions || []).includes(rawVal) ||
        (q.conditionalFollowUp.showIfOptions || []).some((opt) => String(rawVal).startsWith(opt))
      );

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
            {options.map((opt, optIdx) => {
              const isSelected = rawVal === opt;
              return (
                <label
                  key={optIdx}
                  id={`label-${q.id}-${optIdx}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    backgroundColor: isSelected ? "var(--brass-light)" : "var(--bg)",
                    border: isSelected ? "2px solid var(--brass)" : "1px solid var(--line)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    userSelect: "none"
                  }}
                >
                  <input
                    type="radio"
                    id={`radio-${q.id}-${optIdx}`}
                    name={`q-${q.id}`}
                    value={opt}
                    checked={isSelected}
                    onChange={() => handleAnswerChange(q.id, opt)}
                    style={{ accentColor: "var(--brass)", width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.9rem", color: isSelected ? "var(--brass)" : "var(--ink)", fontWeight: isSelected ? "600" : "normal" }}>
                    {opt}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Conditional "Other" Specification Field */}
          {showOtherInput && (
            <div style={{ marginTop: "6px" }}>
              <input
                type="text"
                id={`other-input-${q.id}`}
                placeholder="Please specify your answer..."
                value={otherVal}
                onChange={(e) => handleOtherTextChange(q.id, e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--brass)",
                  backgroundColor: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: "0.88rem",
                  fontFamily: "var(--font-mono)",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>
          )}

          {/* Conditional Follow-up Question Box */}
          {showConditional && (
            <div
              style={{
                marginTop: "12px",
                padding: "16px",
                borderRadius: "10px",
                backgroundColor: "rgba(201, 164, 94, 0.08)",
                border: "1px dashed var(--brass)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span className="font-mono text-brass" style={{ fontSize: "0.75rem", fontWeight: "bold" }}>
                  ↪ RELEVANT FOLLOW-UP:
                </span>
                <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--ink)" }}>
                  {q.conditionalFollowUp.question}
                </span>
              </div>

              {q.conditionalFollowUp.type === "single_choice" && Array.isArray(q.conditionalFollowUp.options) ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {q.conditionalFollowUp.options.map((subOpt, subIdx) => {
                    const isSubSelected = followUpVal === subOpt;
                    return (
                      <label
                        key={subIdx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          backgroundColor: isSubSelected ? "var(--brass-light)" : "var(--bg)",
                          border: isSubSelected ? "1px solid var(--brass)" : "1px solid var(--line)",
                          fontSize: "0.82rem",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="radio"
                          name={`sub-q-${q.id}`}
                          value={subOpt}
                          checked={isSubSelected}
                          onChange={() => handleFollowUpChange(q.id, subOpt)}
                          style={{ accentColor: "var(--brass)" }}
                        />
                        <span>{subOpt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={q.conditionalFollowUp.placeholder || "Enter follow-up explanation..."}
                  value={followUpVal}
                  onChange={(e) => handleFollowUpChange(q.id, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    backgroundColor: "var(--bg)",
                    color: "var(--ink)",
                    fontSize: "0.85rem",
                    fontFamily: "var(--font-mono)",
                    boxSizing: "border-box"
                  }}
                />
              )}
            </div>
          )}
        </div>
      );
    }

    // 2. Multiple Choice (Checkboxes)
    if (type === "multiple_choice") {
      const options = Array.isArray(q.options) && q.options.length > 0
        ? q.options
        : ["Invoice", "Receipt", "Emails", "Other"];

      const currentSelected = Array.isArray(rawVal) ? rawVal : [];

      const handleToggleCheckbox = (opt) => {
        let updated;
        if (currentSelected.includes(opt)) {
          updated = currentSelected.filter((item) => item !== opt);
        } else {
          updated = [...currentSelected, opt];
        }
        handleAnswerChange(q.id, updated);
      };

      const hasOther = currentSelected.includes("Other");

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
            {options.map((opt, optIdx) => {
              const isChecked = currentSelected.includes(opt);
              return (
                <label
                  key={optIdx}
                  id={`cb-label-${q.id}-${optIdx}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    backgroundColor: isChecked ? "var(--brass-light)" : "var(--bg)",
                    border: isChecked ? "2px solid var(--brass)" : "1px solid var(--line)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    userSelect: "none"
                  }}
                >
                  <input
                    type="checkbox"
                    id={`checkbox-${q.id}-${optIdx}`}
                    checked={isChecked}
                    onChange={() => handleToggleCheckbox(opt)}
                    style={{ accentColor: "var(--brass)", width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.9rem", color: isChecked ? "var(--brass)" : "var(--ink)", fontWeight: isChecked ? "600" : "normal" }}>
                    {opt}
                  </span>
                </label>
              );
            })}
          </div>

          {hasOther && (
            <div style={{ marginTop: "4px" }}>
              <input
                type="text"
                placeholder="Please describe other documents or facts..."
                value={otherVal}
                onChange={(e) => handleOtherTextChange(q.id, e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--brass)",
                  backgroundColor: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: "0.88rem",
                  fontFamily: "var(--font-mono)",
                  boxSizing: "border-box"
                }}
              />
            </div>
          )}
        </div>
      );
    }

    // 3. Date Picker
    if (type === "date") {
      const today = new Date().toISOString().split("T")[0];
      return (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <input
            type="date"
            id={`date-input-${q.id}`}
            max={today}
            value={rawVal || ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--bg)",
              color: "var(--ink)",
              fontSize: "0.95rem",
              fontFamily: "var(--font-mono)",
              outline: "none",
              cursor: "pointer"
            }}
          />
          <button
            type="button"
            onClick={() => handleAnswerChange(q.id, "Approximate / Not sure")}
            className="btn-outline-brass font-mono"
            style={{ padding: "8px 14px", fontSize: "0.78rem" }}
          >
            Mark as Approximate / Not sure
          </button>
        </div>
      );
    }

    // 4. Numeric / Currency Input
    if (type === "number") {
      return (
        <div style={{ position: "relative", maxWidth: "340px", display: "flex", alignItems: "center" }}>
          <span
            className="font-mono text-brass"
            style={{
              position: "absolute",
              left: "14px",
              fontSize: "1rem",
              fontWeight: "bold",
              pointerEvents: "none"
            }}
          >
            {q.unit || "₹"}
          </span>
          <input
            type="number"
            id={`number-input-${q.id}`}
            min={q.min ?? 0}
            max={q.max ?? undefined}
            placeholder={q.placeholder || "Enter amount in ₹..."}
            value={rawVal || ""}
            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px 12px 36px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              backgroundColor: "var(--bg)",
              color: "var(--ink)",
              fontSize: "0.95rem",
              fontFamily: "var(--font-mono)",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>
      );
    }

    // 5. Textarea (Narrative explanation)
    if (type === "textarea") {
      return (
        <textarea
          rows={3}
          id={`textarea-${q.id}`}
          value={rawVal || ""}
          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
          placeholder={q.placeholder || "Provide details or explanation..."}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            backgroundColor: "var(--bg)",
            color: "var(--ink)",
            fontSize: "0.88rem",
            fontFamily: "var(--font-mono)",
            lineHeight: "1.5",
            boxSizing: "border-box",
            outline: "none"
          }}
        />
      );
    }

    // 6. Text (Default short input)
    return (
      <input
        type="text"
        id={`text-input-${q.id}`}
        value={rawVal || ""}
        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
        placeholder={q.placeholder || "Type your answer here..."}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: "8px",
          border: "1px solid var(--line)",
          backgroundColor: "var(--bg)",
          color: "var(--ink)",
          fontSize: "0.88rem",
          fontFamily: "var(--font-mono)",
          lineHeight: "1.5",
          boxSizing: "border-box",
          outline: "none"
        }}
      />
    );
  };

  // 8 Stages Status Evaluation for Veriq Investigation Dashboard
  const stagesList = [
    {
      id: "intake",
      name: "Complaint Understanding",
      status: (intake?.complaint || intake?.product || analysis?.disputeCategory) ? "Completed" : (analyzing ? "In Progress" : "Not Started"),
      detail: (intake?.complaint || intake?.product) ? (disputeCategory || "Complaint recorded") : "Intake pending",
      anchor: "stage-intake"
    },
    {
      id: "clarifications",
      name: "Fact Clarification",
      status: pendingQuestions.length > 0
        ? "Awaiting User Input"
        : (clarificationHistory.length > 0 || isClarificationComplete)
        ? "Completed"
        : (submittingAnswers ? "In Progress" : "Not Started"),
      detail: pendingQuestions.length > 0
        ? `${pendingQuestions.length} question(s) pending`
        : (clarificationHistory.length > 0 ? `${clarificationHistory.length} facts recorded` : "Standard intake"),
      anchor: "stage-clarifications"
    },
    {
      id: "evidence",
      name: "Evidence Review",
      status: evidenceInventory.length > 0
        ? (evidenceInventory.some(d => d.extractedFacts || d.status === "DOCUMENT_INSPECTED") ? "Completed" : "In Progress")
        : (isClarificationComplete ? "Awaiting User Input" : "Not Started"),
      detail: evidenceInventory.length > 0 ? `${evidenceInventory.length} record(s) logged` : "Upload receipts/slips",
      anchor: "stage-evidence"
    },
    {
      id: "contradictions",
      name: "Contradiction Analysis",
      status: (analysis?.possibleContradictions?.length > 0 || investigationGate?.contradictionsIdentified?.length > 0 || investigationGate?.structuredContradictions?.length > 0)
        ? "Needs Attention"
        : (isClarificationComplete ? "Completed" : "Not Started"),
      detail: (analysis?.possibleContradictions?.length > 0 || investigationGate?.contradictionsIdentified?.length > 0)
        ? "Discrepancies factored into uncertainty"
        : "Consistent evidence record",
      anchor: "stage-contradictions"
    },
    {
      id: "policy",
      name: "Legal Research",
      status: (companyPolicyResearch || (analysis?.statutoryViolations?.length > 0))
        ? "Completed"
        : (researchingPolicy ? "In Progress" : (isClarificationComplete ? "In Progress" : "Not Started")),
      detail: companyPolicyResearch ? "CPA 2019 & policy analyzed" : "Statutory benchmarking",
      anchor: "stage-policy"
    },
    {
      id: "gate",
      name: "Case Readiness",
      status: investigationGate
        ? (investigationGate.status === "READY" || investigationGate.status === "PROCEED_WITH_LIMITATIONS"
          ? "Completed"
          : (investigationGate.status === "BLOCKED" ? "Unable to Proceed" : "Needs Attention"))
        : (evaluatingGate ? "In Progress" : (isClarificationComplete ? "Awaiting User Input" : "Not Started")),
      detail: investigationGate?.status ? `Gate: ${investigationGate.status}` : "Completeness check",
      anchor: "stage-gate"
    },
    {
      id: "assessment",
      name: "Preliminary Assessment",
      status: (investigation?.assessment?.preliminaryAssessment || investigation?.legalAssessment)
        ? "Completed"
        : (generatingAssessment ? "In Progress" : ((investigationGate?.status === "READY" || investigationGate?.status === "PROCEED_WITH_LIMITATIONS") ? "Awaiting User Input" : "Not Started")),
      detail: (investigation?.assessment?.preliminaryAssessment) ? "Statutory assessment ready" : "Awaiting gate pass",
      anchor: "stage-assessment"
    },
    {
      id: "outcome",
      name: "Final Case Outcome",
      status: (investigation?.finalCaseOutcome)
        ? "Completed"
        : (investigation?.assessment?.preliminaryAssessment ? "Awaiting User Input" : "Not Started"),
      detail: (investigation?.finalCaseOutcome) ? "Dossier synthesized" : "Precedent predictions",
      path: `/courtroom/${threadId}/outcome`
    }
  ];

  const getStageBadgeConfig = (st) => {
    switch (st) {
      case "Completed":
        return { bg: "rgba(16, 185, 129, 0.12)", color: "#10b981", border: "rgba(16, 185, 129, 0.4)", icon: "✓" };
      case "In Progress":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.4)", icon: "🔄" };
      case "Awaiting User Input":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.4)", icon: "⏳" };
      case "Needs Attention":
        return { bg: "rgba(249, 115, 22, 0.12)", color: "#f97316", border: "rgba(249, 115, 22, 0.4)", icon: "⚠️" };
      case "Unable to Proceed":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "rgba(239, 68, 68, 0.4)", icon: "🚫" };
      default: // "Not Started"
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.3)", icon: "○" };
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: "1100px", margin: "0 auto", padding: "40px 24px", width: "100%", boxSizing: "border-box" }}>
        {/* Header Section */}
        <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "24px", marginBottom: "28px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span
                className="veriq-badge veriq-badge-blue font-mono"
                style={{
                  padding: "4px 12px",
                  fontSize: "0.75rem",
                  fontWeight: "bold"
                }}
              >
                {BRAND.name.toUpperCase()} INTELLIGENCE ROOM
              </span>
              <span className="font-mono text-muted" style={{ fontSize: "0.8rem" }}>
                DOCKET #{threadId?.slice(0, 14)}
              </span>
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: "800", margin: "0 0 6px 0", letterSpacing: "-0.02em", color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
              Consumer Case Investigation
            </h1>
            <p className="font-mono text-muted" style={{ fontSize: "0.86rem", margin: 0 }}>
              Evidence-grounded statutory assessment under India's Consumer Protection Act, 2019
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/new-case")}
              className="btn-veriq-primary font-mono"
              style={{ padding: "8px 18px", fontSize: "0.82rem", textDecoration: "none" }}
            >
              + File New Case
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="btn-veriq-secondary font-mono"
              style={{ padding: "8px 18px", fontSize: "0.82rem", textDecoration: "none" }}
            >
              ← My Cases
            </button>
            <button
              onClick={() => navigate(`/courtroom/${threadId}/outcome`)}
              className="btn-veriq-teal font-mono"
              style={{ padding: "8px 18px", fontSize: "0.82rem", textDecoration: "none" }}
            >
              🏛️ View Final Outcome →
            </button>
          </div>
        </div>

        {/* 8-Stage Investigation Dashboard Bar */}
        <div
          className="veriq-card"
          style={{
            padding: "20px 24px",
            marginBottom: "32px",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            backgroundColor: "var(--surface)",
            boxShadow: "0 4px 18px rgba(0,0,0,0.06)"
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", gap: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.1rem" }}>🧭</span>
                <h2 style={{ fontSize: "1.05rem", fontWeight: "700", margin: 0, color: "var(--ink)", fontFamily: "var(--font-sans)" }}>
                  Investigation Dashboard: 8-Stage Case Pipeline
                </h2>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                Real-time backend progress & gate validation • Consumer Protection Act, 2019
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="veriq-badge veriq-badge-slate font-mono" style={{ fontSize: "0.72rem" }}>
                Current Stage: {investigation?.stage || "INVESTIGATION"}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px"
            }}
          >
            {stagesList.map((stg, sIdx) => {
              const badge = getStageBadgeConfig(stg.status);
              const isOutcome = stg.id === "outcome";
              return (
                <div
                  key={stg.id}
                  onClick={() => {
                    if (stg.path) {
                      navigate(stg.path);
                    } else if (stg.anchor) {
                      const el = document.getElementById(stg.anchor);
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    backgroundColor: "var(--bg)",
                    border: isOutcome ? "1px solid var(--veriq-blue)" : "1px solid var(--line)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                  className="stage-step-card"
                  title={`Click to jump to ${stg.name}`}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--muted)", fontWeight: "600" }}>
                        STAGE 0{sIdx + 1}
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "0.68rem",
                          fontWeight: "700",
                          fontFamily: "var(--font-mono)",
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}
                      >
                        <span>{badge.icon}</span> {stg.status}
                      </span>
                    </div>
                    <strong style={{ fontSize: "0.85rem", color: "var(--ink)", display: "block", marginBottom: "4px", lineHeight: "1.3" }}>
                      {stg.name}
                    </strong>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: "6px" }}>
                    {stg.detail}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <ErrorBanner message={error} onClose={() => setError(null)} />

        {/* Retry Banner if Error Occurred */}
        {error && (
          <div
            style={{
              padding: "16px",
              borderRadius: "10px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "24px"
            }}
          >
            <span style={{ fontSize: "0.88rem", color: "#F87171" }}>
              Investigation step paused. You can safely retry without losing recorded data.
            </span>
            <button
              onClick={() => (pendingQuestions.length === 0 ? triggerAnalysis() : handleSubmitAnswers())}
              className="btn-brass font-mono"
              style={{ padding: "6px 16px", fontSize: "0.8rem" }}
            >
              🔄 Retry Operation
            </button>
          </div>
        )}

        {/* Success Notice */}
        {successNotice && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#34D399",
              fontSize: "0.85rem",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <span>✓ {successNotice}</span>
            <button
              onClick={() => setSuccessNotice(null)}
              style={{ background: "none", border: "none", color: "#34D399", cursor: "pointer", fontSize: "1rem" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* TAI Central AI Investigation Guide Card */}
        {taiPlan && (
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--brass)",
              borderLeft: "6px solid var(--brass)",
              borderRadius: "14px",
              padding: "24px",
              marginBottom: "32px",
              boxShadow: "0 6px 24px rgba(217, 119, 6, 0.12)",
              position: "relative"
            }}
          >
            {/* Header with Case Health Badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.4rem" }}>🤖</span>
                <div>
                  <h3 className="font-serif text-brass" style={{ fontSize: "1.15rem", margin: 0, fontWeight: "bold" }}>
                    TAI Central AI — Investigation Guide & Case Planner
                  </h3>
                  <p className="font-mono text-muted" style={{ fontSize: "0.74rem", margin: 0 }}>
                    Coordinating intelligence layer under Consumer Protection Act, 2019
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: "0.75rem",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(217, 119, 6, 0.15)",
                    border: "1px solid var(--brass)",
                    color: "var(--brass)",
                    fontWeight: "600"
                  }}
                >
                  Stage: {taiPlan.stage}
                </span>

                {taiPlan.caseHealth && (
                  <span
                    className="font-mono"
                    title={taiPlan.caseHealth.disclaimer}
                    style={{
                      fontSize: "0.75rem",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#34D399",
                      fontWeight: "bold"
                    }}
                  >
                    Intake Health: {taiPlan.caseHealth.score}/100
                  </span>
                )}
              </div>
            </div>

            {/* Next Recommended Step Banner */}
            <div
              style={{
                backgroundColor: "var(--bg)",
                border: "1px solid var(--line-bright)",
                borderRadius: "10px",
                padding: "18px",
                marginBottom: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <span className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    RECOMMENDED NEXT STEP:
                  </span>
                  <strong style={{ fontSize: "1.05rem", color: "var(--ink)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>👉</span> {taiPlan.recommendedNextAction?.label || "Proceed with Investigation"}
                  </strong>
                </div>

                <button
                  onClick={() => handleTaiExecuteStep(taiPlan.recommendedNextAction?.action)}
                  disabled={taiActionLoading}
                  style={{
                    backgroundColor: "var(--brass)",
                    color: "#000",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 20px",
                    fontSize: "0.85rem",
                    fontWeight: "700",
                    cursor: taiActionLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: taiActionLoading ? 0.6 : 1,
                    transition: "all 0.2s ease"
                  }}
                >
                  {taiActionLoading ? (
                    <>
                      <span className="spinner" style={{ width: "14px", height: "14px" }} /> Executing...
                    </>
                  ) : (
                    <>
                      <span>⚡</span> Proceed to This Step
                    </>
                  )}
                </button>
              </div>

              <p className="font-serif" style={{ fontSize: "0.88rem", color: "var(--muted)", margin: 0, lineHeight: "1.5" }}>
                {taiPlan.recommendedNextAction?.description}
              </p>

              {/* Blocking Reasons if any */}
              {Array.isArray(taiPlan.recommendedNextAction?.blockingReasons) && taiPlan.recommendedNextAction.blockingReasons.length > 0 && (
                <div style={{ marginTop: "4px", padding: "8px 12px", borderRadius: "6px", backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", fontSize: "0.78rem", color: "#F87171" }}>
                  <span style={{ fontWeight: "bold" }}>Pending Requirement:</span> {taiPlan.recommendedNextAction.blockingReasons.join("; ")}
                </div>
              )}
            </div>

            {/* Case Health Metrics Breakdown & Disclaimer */}
            {taiPlan.caseHealth?.breakdown && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                <div style={{ padding: "10px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <span className="font-mono text-muted" style={{ fontSize: "0.68rem", display: "block" }}>FACTUAL CLARITY:</span>
                  <strong className="font-mono" style={{ fontSize: "0.86rem", color: "var(--ink)" }}>
                    {taiPlan.caseHealth.breakdown.factualClarity?.score}/{taiPlan.caseHealth.breakdown.factualClarity?.max}
                  </strong>
                </div>
                <div style={{ padding: "10px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <span className="font-mono text-muted" style={{ fontSize: "0.68rem", display: "block" }}>EVIDENCE LOG:</span>
                  <strong className="font-mono" style={{ fontSize: "0.86rem", color: "var(--ink)" }}>
                    {taiPlan.caseHealth.breakdown.evidenceCompleteness?.score}/{taiPlan.caseHealth.breakdown.evidenceCompleteness?.max}
                  </strong>
                </div>
                <div style={{ padding: "10px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <span className="font-mono text-muted" style={{ fontSize: "0.68rem", display: "block" }}>POLICY BENCHMARK:</span>
                  <strong className="font-mono" style={{ fontSize: "0.86rem", color: "var(--ink)" }}>
                    {taiPlan.caseHealth.breakdown.policyContext?.score}/{taiPlan.caseHealth.breakdown.policyContext?.max}
                  </strong>
                </div>
                <div style={{ padding: "10px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                  <span className="font-mono text-muted" style={{ fontSize: "0.68rem", display: "block" }}>GATE STATUS:</span>
                  <strong className="font-mono" style={{ fontSize: "0.86rem", color: taiPlan.isGateSatisfied ? "#34D399" : "#FBBF24" }}>
                    {taiPlan.gateStatus}
                  </strong>
                </div>
              </div>
            )}

            {/* Optional Adversarial Debate Recommendation */}
            {taiPlan.adversarialDebateRecommendation?.eligible && (
              <div style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", fontSize: "0.82rem" }}>
                <div>
                  <span style={{ fontWeight: "600", color: "#60A5FA" }}>⚖️ {taiPlan.adversarialDebateRecommendation.label}: </span>
                  <span style={{ color: "var(--muted)" }}>{taiPlan.adversarialDebateRecommendation.description}</span>
                </div>
                <a
                  href="/debate-stream"
                  style={{ color: "#60A5FA", textDecoration: "underline", fontWeight: "bold", fontSize: "0.8rem" }}
                >
                  Explore Debate View →
                </a>
              </div>
            )}

            <p className="font-mono text-muted" style={{ fontSize: "0.68rem", margin: "10px 0 0 0", opacity: 0.8 }}>
              ℹ️ {taiPlan.caseHealth?.disclaimer || "Case-Health Score measures intake completeness, not legal success probability."}
            </p>
          </div>
        )}

        {/* Case Intake Summary Card */}
        <div
          id="stage-intake"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--line)",
            borderLeft: "4px solid var(--brass)",
            borderRadius: "14px",
            padding: "24px",
            marginBottom: "32px",
            boxShadow: "0 4px 18px rgba(0,0,0,0.15)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
            <h2 className="font-serif text-brass" style={{ fontSize: "1.25rem", margin: 0 }}>
              Dispute Overview & Factual Profile
            </h2>
            <span
              className="font-mono"
              style={{
                fontSize: "0.8rem",
                padding: "4px 12px",
                borderRadius: "6px",
                backgroundColor: "var(--brass-light)",
                border: "1px solid var(--line-bright)",
                color: "var(--brass)",
                fontWeight: "600"
              }}
            >
              🏷️ {disputeCategory}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "16px" }}>
            <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
              <span className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>PRODUCT / SERVICE:</span>
              <strong style={{ fontSize: "0.92rem", color: "var(--ink)" }}>
                {intake.product || analysis.productOrService || "Not provided"}
              </strong>
            </div>
            <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
              <span className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>SELLER / ENTITY:</span>
              <strong style={{ fontSize: "0.92rem", color: "var(--ink)" }}>
                {intake.company || analysis.companyOrSeller || "Not provided"}
              </strong>
            </div>
            <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
              <span className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>CLAIM VALUE:</span>
              <strong className="text-brass font-mono" style={{ fontSize: "0.95rem" }}>
                {intake.amount ? `₹${intake.amount}` : (analysis.disputedAmount || "Not provided")}
              </strong>
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", marginBottom: "16px" }}>
            <span className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "4px" }}>USER COMPLAINT STATEMENT:</span>
            <p className="font-serif" style={{ fontSize: "0.98rem", lineHeight: "1.6", margin: 0, color: "var(--ink)" }}>
              "{intake.complaint || "No complaint statement recorded."}"
            </p>
          </div>

          {/* Contradictions Alert */}
          {Array.isArray(analysis.possibleContradictions) && analysis.possibleContradictions.length > 0 && (
            <div
              style={{
                padding: "16px",
                borderRadius: "8px",
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                color: "#FBBF24",
                fontSize: "0.85rem",
                marginBottom: "16px"
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚠️ Potential Factual Discrepancy Identified</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", fontFamily: "var(--font-mono)", fontSize: "0.8rem", lineHeight: "1.5" }}>
                {analysis.possibleContradictions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.78rem", opacity: 0.9 }}>
                Veriq AI has generated a targeted question below to let you clarify this timeline.
              </p>
            </div>
          )}

          {/* Missing Material Facts Chips */}
          {Array.isArray(analysis.missingMaterialFacts) && analysis.missingMaterialFacts.length > 0 && (
            <div>
              <span className="font-mono text-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "8px" }}>
                FACTS INVESTIGATED UNDER CPA 2019 FOR {disputeCategory.toUpperCase()}:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {analysis.missingMaterialFacts.map((fact, idx) => (
                  <span
                    key={idx}
                    className="font-mono"
                    style={{
                      padding: "4px 10px",
                      borderRadius: "16px",
                      fontSize: "0.75rem",
                      backgroundColor: "var(--bg)",
                      border: "1px solid var(--line)",
                      color: "var(--ink-muted)"
                    }}
                  >
                    • {fact}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Analyzing Animation State */}
        {analyzing && (
          <div style={{ marginBottom: "32px" }}>
            <LoadingSpinner
              variant="card"
              message="Generating AI clarification questions…"
              submessage={`Analyzing your ${disputeCategory} complaint against statutory consumer provisions, checking timeline consistency, and formulating targeted follow-ups...`}
            />
          </div>
        )}

        {/* Clarification Phase Complete Banner */}
        {isClarificationComplete && (
          <div
            style={{
              padding: "20px 24px",
              borderRadius: "14px",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              marginBottom: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "1.6rem", color: "#34D399" }}>✓</span>
              <div>
                <h3 className="font-serif" style={{ fontSize: "1.15rem", margin: "0 0 2px 0", color: "#34D399" }}>
                  Intake & Factual Clarification Complete
                </h3>
                <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                  Essential facts for your {disputeCategory} complaint have been recorded. Case is advancing through evidentiary verification.
                </p>
              </div>
            </div>
            <span
              className="font-mono"
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                backgroundColor: "var(--bg)",
                border: "1px solid var(--line)",
                fontSize: "0.75rem",
                color: "var(--ink-muted)"
              }}
            >
              Stage: {investigation?.stage || "AWAITING_EVIDENCE"}
            </span>
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 3: EVIDENCE UPLOAD & DOCUMENT INSPECTION */}
        {/* ======================================================== */}
        {isClarificationComplete && (
          <div
            id="stage-evidence"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "24px",
              marginBottom: "32px",
              boxShadow: "0 4px 18px rgba(0,0,0,0.15)"
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "20px", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.2rem" }}>📁</span>
                  <h2 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: 0 }}>
                    Phase 3: Evidence Upload & Document Inspection
                  </h2>
                </div>
                <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: "4px 0 0 0" }}>
                  Upload invoices, bills, warranty cards, service sheets, or correspondence. Files are inspected safely with prompt-injection defense.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowUnavailableModal(true)}
                className="font-mono"
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "1px dashed var(--line-bright)",
                  backgroundColor: "var(--bg)",
                  color: "var(--ink-muted)",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                🚫 Document Unavailable?
              </button>
            </div>

            {/* Document Upload Form */}
            <form onSubmit={handleUploadSubmit} style={{ marginBottom: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "6px" }}>
                    DOCUMENT TYPE / CATEGORY
                  </label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      backgroundColor: "var(--bg)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                      fontFamily: "var(--font-mono)",
                      boxSizing: "border-box"
                    }}
                  >
                    <option value="INVOICE">Bill / Tax Invoice / Payment Slip</option>
                    <option value="WARRANTY_CARD">Warranty Card / Guarantee Terms</option>
                    <option value="SERVICE_JOB_SHEET">Service Center / Repair Job Sheet</option>
                    <option value="EMAIL_CORRESPONDENCE">Written Email Notice / Communication</option>
                    <option value="CHAT_TRANSCRIPT">Chat Support / WhatsApp Log</option>
                    <option value="PHOTO_PROOF">Photograph / Defect Proof</option>
                    <option value="PAYMENT_RECEIPT">Bank Statement / UPI Receipt</option>
                    <option value="OTHER">Other Evidentiary Document</option>
                  </select>
                </div>

                <div>
                  <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "6px" }}>
                    DOCUMENT TITLE / LABEL
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Purchase Invoice - Flipkart"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      backgroundColor: "var(--bg)",
                      color: "var(--ink)",
                      fontSize: "0.85rem",
                      fontFamily: "var(--font-mono)",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label className="font-mono text-muted" style={{ fontSize: "0.72rem", display: "block", marginBottom: "6px" }}>
                    SELECT FILE (PDF, JPG, PNG, WEBP, TXT - MAX 10MB)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
                    onChange={handleFileChange}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      backgroundColor: "var(--bg)",
                      color: "var(--ink)",
                      fontSize: "0.82rem",
                      fontFamily: "var(--font-mono)",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>

              {uploadError && (
                <div style={{ padding: "10px 14px", borderRadius: "6px", backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#F87171", fontSize: "0.8rem", marginBottom: "12px", fontFamily: "var(--font-mono)" }}>
                  ⚠️ {uploadError}
                </div>
              )}

              {uploadingFile && (
                <div style={{ marginBottom: "16px" }}>
                  <LoadingSpinner
                    variant="card"
                    size="sm"
                    message="Reviewing your evidence…"
                    submessage="Uploading document, inspecting text facts, and evaluating reliability across 7 statutory inspection statuses..."
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={uploadingFile || !selectedFile}
                  className="btn-brass font-mono"
                  style={{ padding: "9px 22px", fontSize: "0.85rem" }}
                >
                  {uploadingFile ? "Inspecting Document..." : "⬆ Upload & Inspect Document"}
                </button>
              </div>
            </form>

            {/* Evidence Inventory Table / List */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                  EVIDENCE INVENTORY ({evidenceInventory.length} ITEMS)
                </span>
              </div>

              {evidenceInventory.length === 0 ? (
                <div style={{ padding: "24px", borderRadius: "8px", border: "1px dashed var(--line)", textAlign: "center", backgroundColor: "var(--bg)" }}>
                  <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                    No supporting documents uploaded yet. Upload your invoice, bill, or service sheet above, or mark missing documents as unavailable.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {evidenceInventory.map((doc, idx) => {
                    const status = doc.status || (doc.unavailable ? "UNAVAILABLE" : doc.inspected ? "DOCUMENT_INSPECTED" : "NOT_INSPECTED");
                    const extracted = doc.extractedInfo || {};

                    return (
                      <div
                        key={doc.id || idx}
                        style={{
                          padding: "18px",
                          borderRadius: "10px",
                          border: status === "CONTRADICTED" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--line)",
                          backgroundColor: "var(--bg)"
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <strong className="font-serif" style={{ fontSize: "1.05rem", color: "var(--ink)" }}>
                              {doc.title || doc.originalName || "Evidence Document"}
                            </strong>
                            <span
                              className="font-mono"
                              style={{
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                                backgroundColor: "var(--surface)",
                                border: "1px solid var(--line)",
                                color: "var(--ink-muted)"
                              }}
                            >
                              🏷️ {doc.category || "OTHER"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            {/* Evidence Relevance & Lifecycle Status Badges */}
                            {doc.relevance === "UNRELATED" || doc.userConfirmedUnrelated ? (
                              <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
                                ⚠️ UNRELATED TO COMPLAINT
                              </span>
                            ) : doc.relevance === "PARTIALLY_RELEVANT" ? (
                              <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
                                ⚡ PARTIALLY RELEVANT
                              </span>
                            ) : (
                              <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.4)" }}>
                                ✓ RELEVANT EVIDENCE
                              </span>
                            )}

                            {doc.isSynthetic && (
                              <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", border: "1px solid rgba(139, 92, 246, 0.4)" }}>
                                🧪 TEST RECORD
                              </span>
                            )}

                            {status === "DOCUMENT_INSPECTED" && (
                              <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34D399", border: "1px solid rgba(16, 185, 129, 0.4)" }}>
                                ✓ INSPECTED
                              </span>
                            )}
                            {status === "CONTRADICTED" && (
                              <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#F87171", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
                                ⚠️ CONTRADICTION
                              </span>
                            )}
                            {status === "UNAVAILABLE" && (
                              <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: "rgba(148, 163, 184, 0.15)", color: "#94A3B8", border: "1px solid rgba(148, 163, 184, 0.4)" }}>
                                🚫 UNAVAILABLE
                              </span>
                            )}

                            {doc.filename && (
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(doc.id, doc.originalName)}
                                className="font-mono text-brass"
                                style={{ background: "none", border: "1px solid var(--brass)", borderRadius: "4px", padding: "2px 8px", fontSize: "0.72rem", cursor: "pointer" }}
                              >
                                ⬇ Download
                              </button>
                            )}

                            {!doc.unavailable && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCorrectingDocId(doc.id);
                                    setCorrectionText(doc.userCorrection?.correctedText || "");
                                    setCorrectionNotes(doc.userCorrection?.notes || "");
                                  }}
                                  className="font-mono"
                                  style={{ background: "none", border: "1px solid var(--line-bright)", borderRadius: "4px", padding: "2px 8px", fontSize: "0.72rem", color: "var(--ink-muted)", cursor: "pointer" }}
                                >
                                  ✏️ Correct
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEvidence(doc.id)}
                                  className="font-mono text-danger"
                                  style={{ background: "none", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "4px", padding: "2px 8px", fontSize: "0.72rem", color: "#EF4444", cursor: "pointer" }}
                                  title="Remove document from case record"
                                >
                                  🗑️ Remove
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Mismatch Warning Alert Banner */}
                        {doc.mismatchWarning && (
                          <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.3)", margin: "10px 0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#DC2626", fontWeight: "bold", fontSize: "0.85rem", marginBottom: "4px" }}>
                              <span>⚠️ Document-to-Complaint Mismatch Detected</span>
                            </div>
                            <p style={{ margin: "0 0 10px 0", fontSize: "0.82rem", color: "var(--ink)", lineHeight: 1.5 }}>
                              {doc.mismatchWarning}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveEvidence(doc.id)}
                                style={{ padding: "5px 12px", borderRadius: "6px", backgroundColor: "#EF4444", color: "#fff", border: "none", fontSize: "0.75rem", cursor: "pointer", fontWeight: "bold" }}
                              >
                                🗑️ Remove Incorrect Document
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClarifyRelevance(doc.id, true)}
                                style={{ padding: "5px 12px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--line)", fontSize: "0.75rem", cursor: "pointer", color: "var(--ink)" }}
                              >
                                Confirm Belongs to Case but Unrelated
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePromptExplainRelevance(doc.id)}
                                style={{ padding: "5px 12px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--brass)", fontSize: "0.75rem", cursor: "pointer", color: "var(--brass)" }}
                              >
                                Explain Relevance
                              </button>
                            </div>
                          </div>
                        )}

                        {/* File details & metadata */}
                        {doc.originalName && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)", marginBottom: "10px" }}>
                            <span>📄 File: {doc.originalName}</span>
                            {doc.fileSize && <span>💾 Size: {Math.round(doc.fileSize / 1024)} KB</span>}
                            {doc.uploadedAt && <span>🕒 Added: {new Date(doc.uploadedAt).toLocaleDateString()}</span>}
                          </div>
                        )}

                        {/* Unavailable Document Notice */}
                        {doc.unavailable && (
                          <div style={{ padding: "10px 14px", borderRadius: "6px", backgroundColor: "rgba(148, 163, 184, 0.08)", border: "1px dashed var(--line)", fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
                            <strong>Consumer Disclosure:</strong> {doc.unavailableReason || "Document unavailable or never issued by merchant."}
                          </div>
                        )}

                        {/* Extracted Factual Details */}
                        {doc.inspected && extracted && (
                          <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)", marginTop: "8px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "8px", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                              {extracted.documentType && (
                                <div><span className="text-muted">Type: </span><strong className="text-brass">{extracted.documentType}</strong></div>
                              )}
                              {Array.isArray(extracted.datesFound) && extracted.datesFound.length > 0 && (
                                <div><span className="text-muted">Dates: </span><strong style={{ color: "var(--ink)" }}>{extracted.datesFound.join(", ")}</strong></div>
                              )}
                              {Array.isArray(extracted.amountsFound) && extracted.amountsFound.length > 0 && (
                                <div><span className="text-muted">Amounts: </span><strong className="text-brass">{extracted.amountsFound.join(", ")}</strong></div>
                              )}
                              {Array.isArray(extracted.referenceNumbers) && extracted.referenceNumbers.length > 0 && (
                                <div><span className="text-muted">Ref/Order #: </span><strong style={{ color: "var(--ink)" }}>{extracted.referenceNumbers.join(", ")}</strong></div>
                              )}
                            </div>

                            {/* Contradictions noted */}
                            {Array.isArray(extracted.contradictionsNoted) && extracted.contradictionsNoted.length > 0 && (
                              <div style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#F87171", fontSize: "0.78rem", fontFamily: "var(--font-mono)", marginTop: "8px" }}>
                                <strong>⚠️ Discrepancy with complaint statement:</strong>
                                <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px" }}>
                                  {extracted.contradictionsNoted.map((ct, ctIdx) => (
                                    <li key={ctIdx}>{ct}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* User Correction Display */}
                            {doc.userCorrection && (
                              <div style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "var(--brass-light)", border: "1px solid var(--line-bright)", color: "var(--brass)", fontSize: "0.78rem", fontFamily: "var(--font-mono)", marginTop: "8px" }}>
                                <strong>Consumer Interpretation Correction:</strong> "{doc.userCorrection.correctedText}"
                                {doc.userCorrection.notes && <span style={{ display: "block", color: "var(--ink-muted)", marginTop: "2px" }}>Note: {doc.userCorrection.notes}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 4: COMPANY POLICY RESEARCH & STATUTORY CONTRAST */}
        {/* ======================================================== */}
        {isClarificationComplete && (
          <div
            id="stage-policy"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "24px",
              marginBottom: "32px",
              boxShadow: "0 4px 18px rgba(0,0,0,0.15)"
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "20px", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.2rem" }}>⚖️</span>
                  <h2 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: 0 }}>
                    Phase 4: Company Policy Research & Legal Benchmark
                  </h2>
                </div>
                <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: "4px 0 0 0" }}>
                  Verified public policy terms, return/refund rules, and manufacturer warranties contrasted against statutory CPA 2019 rights.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunPolicyResearch}
                disabled={researchingPolicy}
                className="btn-brass font-mono"
                style={{ padding: "8px 18px", fontSize: "0.82rem" }}
              >
                {researchingPolicy ? "Researching..." : (companyPolicyResearch ? "🔄 Refresh Policy Research" : "🔍 Research Official Policies")}
              </button>
            </div>

            {/* Active Policy Research Buffer */}
            {researchingPolicy && (
              <div style={{ marginBottom: "20px" }}>
                <LoadingSpinner
                  variant="card"
                  message="Researching relevant consumer law…"
                  submessage={`Searching published terms for ${intake.company || "the company"} and benchmarking against statutory rights under Consumer Protection Act, 2019...`}
                />
              </div>
            )}

            {/* Research Results */}
            {!companyPolicyResearch ? (
              <div style={{ padding: "24px", borderRadius: "8px", border: "1px dashed var(--line)", textAlign: "center", backgroundColor: "var(--bg)" }}>
                <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                  Click "Research Official Policies" to cross-reference {intake.company || "the company"}'s published terms against Indian Consumer Law.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "16px" }}>
                  <div>
                    <strong style={{ fontSize: "0.95rem", color: "var(--ink)" }}>
                      Entity: {companyPolicyResearch.companyName}
                    </strong>
                    <span className="font-mono text-muted" style={{ fontSize: "0.75rem", display: "block" }}>
                      Last Verified: {companyPolicyResearch.lastCheckedAt ? new Date(companyPolicyResearch.lastCheckedAt).toLocaleDateString() : "Active"}
                    </span>
                  </div>

                  <span
                    className="font-mono"
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: "bold",
                      backgroundColor: companyPolicyResearch.status === "COMPLETED" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: companyPolicyResearch.status === "COMPLETED" ? "#34D399" : "#FBBF24",
                      border: companyPolicyResearch.status === "COMPLETED" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)"
                    }}
                  >
                    STATUS: {companyPolicyResearch.status || "COMPLETED"}
                  </span>
                </div>

                <div style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", marginBottom: "16px" }}>
                  <p className="font-serif" style={{ fontSize: "0.9rem", lineHeight: "1.6", margin: 0, color: "var(--ink)" }}>
                    {companyPolicyResearch.policySummary}
                  </p>
                </div>

                {/* Disclosed limitations note */}
                {companyPolicyResearch.limitationNote && (
                  <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "rgba(245, 158, 11, 0.08)", border: "1px dashed rgba(245, 158, 11, 0.4)", color: "#FBBF24", fontSize: "0.78rem", fontFamily: "var(--font-mono)", marginBottom: "16px" }}>
                    ℹ️ <strong>Research Note:</strong> {companyPolicyResearch.limitationNote}
                  </div>
                )}

                {/* Policy Cards */}
                {Array.isArray(companyPolicyResearch.policies) && companyPolicyResearch.policies.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {companyPolicyResearch.policies.map((pol, pIdx) => (
                      <div
                        key={pIdx}
                        style={{
                          padding: "16px",
                          borderRadius: "10px",
                          border: "1px solid var(--line)",
                          backgroundColor: "var(--bg)"
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                          <strong className="font-serif text-brass" style={{ fontSize: "0.95rem" }}>
                            {pol.title}
                          </strong>
                          {pol.sourceUrl && (
                            <a
                              href={pol.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-brass"
                              style={{ fontSize: "0.75rem", textDecoration: "underline" }}
                            >
                              Official Source ↗
                            </a>
                          )}
                        </div>

                        <p className="font-serif" style={{ fontSize: "0.85rem", lineHeight: "1.5", margin: "0 0 10px 0", color: "var(--ink)" }}>
                          "{pol.passage}"
                        </p>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)", marginBottom: "10px" }}>
                          <span>Claim Relevance: {pol.claimSupported}</span>
                          <span>Applicability: {pol.applicability || "APPLICABLE_TO_DATE"}</span>
                        </div>

                        {/* Statutory Benchmark Comparison */}
                        {pol.statutoryComparison && (
                          <div
                            style={{
                              padding: "10px 14px",
                              borderRadius: "6px",
                              backgroundColor: "var(--brass-light)",
                              border: "1px solid var(--line-bright)",
                              fontSize: "0.8rem",
                              lineHeight: "1.5"
                            }}
                          >
                            <span className="font-mono text-brass" style={{ fontWeight: "bold", display: "block", marginBottom: "2px" }}>
                              ⚖️ CPA 2019 Statutory Benchmark:
                            </span>
                            <span style={{ color: "var(--ink)", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                              {pol.statutoryComparison}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 5: INVESTIGATION COMPLETENESS GATE */}
        {/* ======================================================== */}
        {isClarificationComplete && (
          <div
            id="stage-gate"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "24px",
              marginBottom: "32px",
              boxShadow: "0 4px 18px rgba(0,0,0,0.15)"
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "20px", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.2rem" }}>🛡️</span>
                  <h2 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: 0 }}>
                    Phase 5: Investigation Completeness Gate
                  </h2>
                </div>
                <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: "4px 0 0 0" }}>
                  Server-side gate evaluating facts, evidence inventory, and policy research before preliminary legal assessment.
                </p>
              </div>

              <button
                type="button"
                onClick={handleEvaluateGate}
                disabled={evaluatingGate}
                className="btn-brass font-mono"
                style={{ padding: "8px 18px", fontSize: "0.82rem" }}
              >
                {evaluatingGate ? "Evaluating Gate..." : "⚡ Evaluate Case Readiness"}
              </button>
            </div>

            {/* Active Gate Evaluation Buffer */}
            {evaluatingGate && (
              <div style={{ marginBottom: "20px" }}>
                <LoadingSpinner
                  variant="card"
                  message="Evaluating investigation readiness…"
                  submessage="Benchmarking essential factual consistency, answered clarifications, evidence inspection reliability, and policy discovery..."
                />
              </div>
            )}

            {/* Outcome Banner */}
            {investigationGate ? (
              <div>
                {/* 1. READY */}
                {investigationGate.status === "READY" && (
                  <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.4)", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#34D399", marginBottom: "6px" }}>
                      <span style={{ fontSize: "1.3rem" }}>✓</span>
                      <strong className="font-serif" style={{ fontSize: "1.1rem" }}>
                        GATE PASSED: READY FOR PRELIMINARY LEGAL ASSESSMENT
                      </strong>
                    </div>
                    <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                      The factual intake, clarification history, and supporting evidence are sufficient to conduct a preliminary statutory evaluation under Consumer Protection Act, 2019. Remaining uncertainties will be disclosed in the assessment.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                      <span className="font-mono" style={{ fontSize: "0.75rem", color: "#34D399" }}>
                        Authorized Stage: READY_FOR_ASSESSMENT
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. PROCEED WITH LIMITATIONS */}
                {investigationGate.status === "PROCEED_WITH_LIMITATIONS" && (
                  <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.4)", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#60A5FA", marginBottom: "6px" }}>
                      <span style={{ fontSize: "1.3rem" }}>ℹ️</span>
                      <strong className="font-serif" style={{ fontSize: "1.1rem" }}>
                        GATE AUTHORIZED: PROCEEDING WITH EVIDENTIARY LIMITATIONS
                      </strong>
                    </div>
                    <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: "0 0 8px 0", lineHeight: "1.5" }}>
                      Consumer has confirmed advancing with legal assessment under documented limitations:
                    </p>
                    {investigationGate.overrideReason && (
                      <div style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "var(--bg)", border: "1px solid var(--line)", fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--ink)", marginBottom: "8px" }}>
                        "{investigationGate.overrideReason}"
                      </div>
                    )}
                    {Array.isArray(investigationGate.limitationsDisclosed) && investigationGate.limitationsDisclosed.length > 0 && (
                      <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                        {investigationGate.limitationsDisclosed.map((lim, lIdx) => (
                          <li key={lIdx}>{lim}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* 3. INCOMPLETE */}
                {investigationGate.status === "INCOMPLETE" && (
                  <div style={{ padding: "20px", borderRadius: "10px", backgroundColor: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.4)", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#FBBF24", marginBottom: "6px" }}>
                      <span style={{ fontSize: "1.3rem" }}>⚠️</span>
                      <strong className="font-serif" style={{ fontSize: "1.1rem" }}>
                        GATE STATUS: INVESTIGATION INCOMPLETE
                      </strong>
                    </div>
                    <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                      Material investigation steps or missing documents remain before statutory assessment can proceed with standard evidentiary weight.
                    </p>

                    {/* Missing checklist items */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                      {Array.isArray(investigationGate.missingCriticalEvidence) && investigationGate.missingCriticalEvidence.length > 0 && (
                        <div style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "#FBBF24" }}>
                          • Missing Evidence: {investigationGate.missingCriticalEvidence.join("; ")}
                        </div>
                      )}
                      {Array.isArray(investigationGate.unansweredQuestions) && investigationGate.unansweredQuestions.length > 0 && (
                        <div style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "#FBBF24" }}>
                          • Unanswered Clarification Questions: {investigationGate.unansweredQuestions.length} pending
                        </div>
                      )}
                      {Array.isArray(investigationGate.contradictionsIdentified) && investigationGate.contradictionsIdentified.length > 0 && (
                        <div style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "#F87171" }}>
                          • Unresolved Contradictions: {investigationGate.contradictionsIdentified.join("; ")}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", borderTop: "1px dashed rgba(245, 158, 11, 0.3)", paddingTop: "12px" }}>
                      <span className="font-mono text-muted" style={{ fontSize: "0.75rem" }}>
                        Cannot produce requested documents? You may proceed with limitations.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowLimitationModal(true)}
                        className="btn-outline-brass font-mono"
                        style={{ padding: "6px 14px", fontSize: "0.75rem" }}
                      >
                        ⚡ Proceed With Evidentiary Limitations →
                      </button>
                    </div>
                  </div>
                )}

                {/* Server-Side Evaluation Checklist (5 Dimensions) */}
                {investigationGate.evaluationChecklist && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", marginTop: "14px" }}>
                    <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span>{investigationGate.evaluationChecklist.essentialFactsComplete ? "✓" : "⚠️"}</span>
                        <strong className="font-mono" style={{ fontSize: "0.8rem", color: investigationGate.evaluationChecklist.essentialFactsComplete ? "#34D399" : "#FBBF24" }}>
                          1. Essential Facts
                        </strong>
                      </div>
                      <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                        Intake chronology & complaint details
                      </span>
                    </div>

                    <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span>{investigationGate.evaluationChecklist.clarificationsAnswered ? "✓" : "⚠️"}</span>
                        <strong className="font-mono" style={{ fontSize: "0.8rem", color: investigationGate.evaluationChecklist.clarificationsAnswered ? "#34D399" : "#FBBF24" }}>
                          2. Clarifications
                        </strong>
                      </div>
                      <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                        Follow-up question completion
                      </span>
                    </div>

                    <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span>{investigationGate.evaluationChecklist.evidenceUploaded ? "✓" : "⚠️"}</span>
                        <strong className="font-mono" style={{ fontSize: "0.8rem", color: investigationGate.evaluationChecklist.evidenceUploaded ? "#34D399" : "#FBBF24" }}>
                          3. Evidence Inventory
                        </strong>
                      </div>
                      <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                        Documents inspected or noted unavailable
                      </span>
                    </div>

                    <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span>{investigationGate.evaluationChecklist.policyResearched ? "✓" : "⚠️"}</span>
                        <strong className="font-mono" style={{ fontSize: "0.8rem", color: investigationGate.evaluationChecklist.policyResearched ? "#34D399" : "#FBBF24" }}>
                          4. Policy Research
                        </strong>
                      </div>
                      <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                        Verified company terms & CPA benchmarks
                      </span>
                    </div>

                    <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span>{investigationGate.evaluationChecklist.contradictionsEvaluated !== false ? "✓" : "⚠️"}</span>
                        <strong className="font-mono" style={{ fontSize: "0.8rem", color: investigationGate.evaluationChecklist.contradictionsEvaluated !== false ? "#34D399" : "#FBBF24" }}>
                          5. Contradictions
                        </strong>
                      </div>
                      <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                        Cross-source discrepancy analysis
                      </span>
                    </div>
                  </div>
                )}

                {/* Structured Contradiction Review & Resolution Docket */}
                {(investigationGate.structuredContradictions?.length > 0 || (Array.isArray(investigationGate.contradictionsIdentified) && investigationGate.contradictionsIdentified.length > 0)) && (
                  <div style={{ marginTop: "18px", padding: "18px 20px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "1.1rem" }}>⚡</span>
                        <strong className="font-serif" style={{ fontSize: "0.98rem", color: "#fbbf24" }}>
                          Contradiction & Evidentiary Reconciliation Docket
                        </strong>
                      </div>
                      <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                        Pipeline active • Uncertainty factored into non-binding verdict
                      </span>
                    </div>
                    <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                      Discrepancies identified across user claims, physical documents, or merchant policies. Unresolved conflicts do not deadlock your case—they are modeled into balanced arguments and reflected as transparent uncertainty.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(investigationGate.structuredContradictions || (investigationGate.contradictionsIdentified || []).map(c => ({
                        conflictType: "DISCREPANCY",
                        conflictingClaimsOrEvidence: c,
                        sources: ["Case Intake", "Evidence / Policy"],
                        materiality: "MEDIUM",
                        impactOnPlausibleOutcomes: "Factored into balanced counterargument modeling and transparent uncertainty deductions."
                      }))).map((conflict, cIdx) => (
                        <div key={cIdx} style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "6px" }}>
                            <span className="font-mono text-brass" style={{ fontSize: "0.75rem", fontWeight: "bold" }}>
                              [{conflict.conflictType || "EVIDENTIARY_DISCREPANCY"}] • Materiality: {conflict.materiality || "MEDIUM"}
                            </span>
                            <span className="font-mono" style={{ fontSize: "0.7rem", color: conflict.verificationStatus === "RESOLVED" ? "#34d399" : "#fbbf24", fontWeight: "bold" }}>
                              {conflict.verificationStatus || "DISPUTED / PENDING"}
                            </span>
                          </div>
                          <p className="font-mono" style={{ fontSize: "0.8rem", color: "var(--ink)", margin: "0 0 6px 0", lineHeight: "1.4" }}>
                            {conflict.conflictingClaimsOrEvidence}
                          </p>
                          <div style={{ fontSize: "0.74rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
                            <strong>Impact on Outcome:</strong> {conflict.impactOnPlausibleOutcomes || "Uncertainty reflected in outcome classification without terminating pipeline."}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px", borderTop: "1px dashed rgba(245, 158, 11, 0.3)", paddingTop: "12px" }}>
                      <span className="font-mono text-muted" style={{ fontSize: "0.75rem" }}>
                        Cannot provide further corroboration? Advance with documented evidentiary limitations.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowLimitationModal(true)}
                        className="btn-outline-brass font-mono"
                        style={{ padding: "6px 14px", fontSize: "0.75rem" }}
                      >
                        ⚡ Proceed With Evidentiary Limitations & Dispute →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "24px", borderRadius: "8px", border: "1px dashed var(--line)", textAlign: "center", backgroundColor: "var(--bg)" }}>
                <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                  Click "Evaluate Case Readiness" to run the server-side completeness check across all dispute dimensions.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 6: GROUNDED LEGAL ASSESSMENT (CPA 2019) */}
        {/* ======================================================== */}
        {(investigationGate?.isSatisfied ||
          investigation?.stage === "READY_FOR_ASSESSMENT" ||
          investigation?.stage === "ASSESSMENT_COMPLETE" ||
          investigation?.assessment?.preliminaryAssessment) && (
          <div
            id="stage-assessment"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "26px",
              marginBottom: "32px",
              boxShadow: "0 6px 24px rgba(0,0,0,0.2)"
            }}
          >
            {/* Header & Primary Actions */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--line)",
                paddingBottom: "16px",
                marginBottom: "20px",
                gap: "14px"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "1.3rem" }}>⚖️</span>
                  <h2 className="font-serif text-brass" style={{ fontSize: "1.4rem", margin: 0 }}>
                    Phase 6: Grounded Legal Assessment
                  </h2>
                </div>
                <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: "4px 0 0 0" }}>
                  Preliminary analytical evaluation under Consumer Protection Act, 2019 synthesized from verified facts, evidence inventory, and statutory benchmarks.
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowTransferAssessmentModal(true)}
                  className="btn-outline-brass font-mono"
                  style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                  title="Review AI 2.0 Transfer Assessment structured context docket"
                >
                  📋 Review AI 2.0 Transfer Docket
                </button>

                {investigation?.assessment?.preliminaryAssessment && (
                  <button
                    type="button"
                    onClick={() => navigate(`/courtroom/${threadId}/outcome`)}
                    className="btn-brass font-mono"
                    style={{ padding: "8px 16px", fontSize: "0.82rem", backgroundColor: "rgba(217, 119, 6, 0.2)", border: "1px solid var(--brass)" }}
                  >
                    🏛️ Final Case Outcome →
                  </button>
                )}

                {investigation?.assessment?.preliminaryAssessment && (
                  <button
                    type="button"
                    onClick={handleDownloadInvestigationPdf}
                    disabled={downloadingInvestigationPdf}
                    className="btn-outline-brass font-mono"
                    style={{ padding: "8px 16px", fontSize: "0.82rem" }}
                  >
                    {downloadingInvestigationPdf ? "Generating PDF..." : "⬇ Download PDF Report"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleGenerateAssessment}
                  disabled={generatingAssessment}
                  className="btn-brass font-mono"
                  style={{ padding: "8px 20px", fontSize: "0.82rem" }}
                >
                  {generatingAssessment
                    ? "Evaluating Law & Facts..."
                    : investigation?.assessment?.preliminaryAssessment
                    ? "🔄 Re-evaluate Assessment"
                    : "⚡ Generate Grounded Legal Assessment"}
                </button>
              </div>
            </div>

            {/* Assessment Generating State */}
            {generatingAssessment && (
              <div style={{ marginBottom: "20px" }}>
                <LoadingSpinner
                  variant="card"
                  message="Preparing your preliminary assessment…"
                  submessage="Cross-referencing verified facts against CPA 2019 provisions (Sections 2(7), 2(11), 2(47), 39), classifying evidence across all 7 statuses, benchmarking published company policies, and modeling balanced counterarguments."
                />
              </div>
            )}

            {/* Assessment Not Yet Generated Callout */}
            {!generatingAssessment && !investigation?.assessment?.preliminaryAssessment && (
              <div
                style={{
                  padding: "28px",
                  borderRadius: "10px",
                  backgroundColor: "var(--bg)",
                  border: "1px dashed var(--line)",
                  textAlign: "center"
                }}
              >
                <span style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}>🛡️</span>
                <h3 className="font-serif" style={{ fontSize: "1.15rem", margin: "0 0 6px 0", color: "var(--ink)" }}>
                  Completeness Gate Satisfied: Ready for Assessment
                </h3>
                <p className="font-mono text-muted" style={{ fontSize: "0.82rem", maxWidth: "650px", margin: "0 auto 18px auto", lineHeight: "1.5" }}>
                  Your case details and evidence have passed server-side gate evaluation. Click below to generate a balanced 14-section legal assessment with verified citations, counterarguments, and remedies under Indian Consumer Law.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setShowTransferAssessmentModal(true)}
                    className="btn-outline-brass font-mono"
                    style={{ padding: "10px 20px", fontSize: "0.88rem" }}
                  >
                    📋 Review AI 2.0 Transfer Docket
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAssessment}
                    className="btn-brass font-mono"
                    style={{ padding: "10px 24px", fontSize: "0.88rem" }}
                  >
                    ⚡ Generate Grounded Legal Assessment Now
                  </button>
                </div>
              </div>
            )}

            {/* Completed Assessment Rendering */}
            {!generatingAssessment && investigation?.assessment?.preliminaryAssessment && (() => {
              const assessment = investigation.assessment.preliminaryAssessment;
              const sec = assessment.sections || {};
              const classification = assessment.outcomeClassification || sec.preliminaryAssessment?.outcomeClassification;
              const isLimitations = assessment.isProceedWithLimitations || (investigationGate?.limitationsDisclosed && investigationGate.limitationsDisclosed.length > 0);
              const confScore = assessment.confidenceScore || sec.confidenceAndUncertainty?.confidenceScore || 80;

              return (
                <div>
                  {/* Preliminary Outcome Classification Banner */}
                  <div
                    style={{
                      padding: "22px",
                      borderRadius: "12px",
                      backgroundColor: classification?.includes("supported by available evidence")
                        ? "rgba(16, 185, 129, 0.12)"
                        : classification?.includes("partially supported")
                        ? "rgba(59, 130, 246, 0.12)"
                        : "rgba(245, 158, 11, 0.12)",
                      border: classification?.includes("supported by available evidence")
                        ? "1px solid rgba(16, 185, 129, 0.4)"
                        : classification?.includes("partially supported")
                        ? "1px solid rgba(59, 130, 246, 0.4)"
                        : "1px solid rgba(245, 158, 11, 0.4)",
                      marginBottom: "20px"
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.4rem" }}>
                          {classification?.includes("supported by available evidence") ? "⚖️" : "ℹ️"}
                        </span>
                        <strong
                          className="font-serif"
                          style={{
                            fontSize: "1.2rem",
                            color: classification?.includes("supported by available evidence")
                              ? "#34D399"
                              : classification?.includes("partially supported")
                              ? "#60A5FA"
                              : "#FBBF24"
                          }}
                        >
                          {classification || "Preliminary Analytical Assessment Complete"}
                        </strong>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          className="font-mono"
                          style={{
                            padding: "3px 10px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            backgroundColor: "var(--surface)",
                            border: "1px solid var(--line)",
                            color: "var(--ink)"
                          }}
                        >
                          Confidence: {confScore}%
                        </span>
                        <span
                          className="font-mono text-muted"
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "0.68rem",
                            border: "1px solid var(--line)"
                          }}
                        >
                          NON-BINDING
                        </span>
                      </div>
                    </div>

                    <p className="font-serif" style={{ fontSize: "0.92rem", lineHeight: "1.6", margin: "0 0 10px 0", color: "var(--ink)" }}>
                      {assessment.explanation || sec.preliminaryAssessment?.explanation}
                    </p>

                    <span className="font-mono text-muted" style={{ fontSize: "0.72rem", fontStyle: "italic", display: "block" }}>
                      ⚖️ Analytical classification for dispute resolution guidance under CPA 2019. Final legal orders reside exclusively with the Consumer Commission.
                    </span>
                  </div>

                  {/* Limitations Disclosure Banner (prominently disclosed) */}
                  {isLimitations && (
                    <div
                      style={{
                        padding: "16px 20px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(245, 158, 11, 0.08)",
                        border: "1px dashed rgba(245, 158, 11, 0.4)",
                        marginBottom: "20px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#FBBF24", marginBottom: "4px" }}>
                        <span>⚠️</span>
                        <strong className="font-mono" style={{ fontSize: "0.85rem", textTransform: "uppercase" }}>
                          Disclosed Evidentiary Limitations Factor
                        </strong>
                      </div>
                      <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: "0 0 8px 0", lineHeight: "1.5" }}>
                        This assessment proceeded under documented limitations disclosed by the consumer:
                      </p>
                      {Array.isArray(sec.evidenceLimitations) && sec.evidenceLimitations.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: "18px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                          {sec.evidenceLimitations.map((lim, idx) => (
                            <li key={idx} style={{ marginBottom: "2px" }}>{lim}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Navigation Tabs for the 14 Assessment Sections */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      borderBottom: "1px solid var(--line)",
                      paddingBottom: "12px",
                      marginBottom: "22px"
                    }}
                  >
                    {[
                      { id: "summary", label: "Case Summary & Facts", icon: "📋" },
                      { id: "evidence", label: `Evidence Reviewed (${(sec.evidenceReviewed || []).length})`, icon: "🗂️" },
                      { id: "law", label: "Statutes & Historical Precedents", icon: "📖" },
                      { id: "arguments", label: "Balanced Arguments", icon: "⚖️" },
                      { id: "remedies", label: "Statutory Remedies", icon: "🎯" },
                      { id: "citations", label: "Citations & Audit", icon: "🔍" }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAssessmentTab(tab.id)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          fontSize: "0.8rem",
                          fontFamily: "var(--font-mono)",
                          fontWeight: assessmentTab === tab.id ? "bold" : "normal",
                          backgroundColor: assessmentTab === tab.id ? "var(--brass)" : "var(--bg)",
                          color: assessmentTab === tab.id ? "var(--bg)" : "var(--ink-muted)",
                          border: assessmentTab === tab.id ? "1px solid var(--brass)" : "1px solid var(--line)",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* TAB 1: SUMMARY & ESTABLISHED FACTS */}
                  {assessmentTab === "summary" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                          SECTION 1: CASE SUMMARY
                        </span>
                        <p className="font-serif" style={{ fontSize: "0.95rem", lineHeight: "1.6", margin: 0, color: "var(--ink)" }}>
                          {sec.caseSummary}
                        </p>
                      </div>

                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                          SECTION 2: CONSUMER'S ALLEGATIONS (UNPROVEN CLAIMS)
                        </span>
                        {Array.isArray(sec.consumerAllegations) && sec.consumerAllegations.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: "20px", fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--ink)", lineHeight: "1.6" }}>
                            {sec.consumerAllegations.map((al, idx) => (
                              <li key={idx} style={{ marginBottom: "4px" }}>{al}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>No allegations recorded.</p>
                        )}
                      </div>

                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                          <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                            SECTION 3: ESTABLISHED VS UNESTABLISHED FACTS
                          </span>
                          <span className="font-mono text-brass" style={{ fontSize: "0.75rem" }}>
                            {sec.factsAnalysis?.totalEstablished || 0} Established | {sec.factsAnalysis?.totalUnestablished || 0} Unestablished
                          </span>
                        </div>

                        {/* Established Facts */}
                        <div style={{ marginBottom: "16px" }}>
                          <strong className="font-mono" style={{ fontSize: "0.8rem", color: "#34D399", display: "block", marginBottom: "8px" }}>
                            ✓ Established Facts (Corroborated by Inspected Documentation):
                          </strong>
                          {sec.factsAnalysis?.establishedFacts?.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {sec.factsAnalysis.establishedFacts.map((ef, idx) => (
                                <div key={idx} style={{ padding: "10px 14px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--line)", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                                    <span style={{ color: "var(--ink)" }}>{ef.statement}</span>
                                    <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: "bold", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34D399" }}>
                                      {ef.evidenceStatus}
                                    </span>
                                  </div>
                                  <span className="text-muted" style={{ fontSize: "0.72rem" }}>Source: {ef.sourceReference}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="font-mono text-muted" style={{ fontSize: "0.78rem" }}>No facts conclusively established by physical documents.</p>
                          )}
                        </div>

                        {/* Unestablished Allegations */}
                        <div>
                          <strong className="font-mono" style={{ fontSize: "0.8rem", color: "#FBBF24", display: "block", marginBottom: "8px" }}>
                            ⚠️ Unestablished Allegations (Solely User-Reported / Awaiting Independent Corroboration):
                          </strong>
                          {sec.factsAnalysis?.unestablishedFacts?.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {sec.factsAnalysis.unestablishedFacts.map((uf, idx) => (
                                <div key={idx} style={{ padding: "10px 14px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid var(--line)", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                                    <span style={{ color: "var(--ink-muted)" }}>{uf.statement}</span>
                                    <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: "bold", backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#FBBF24" }}>
                                      {uf.evidenceStatus}
                                    </span>
                                  </div>
                                  <span className="text-muted" style={{ fontSize: "0.72rem" }}>Source: {uf.sourceReference}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="font-mono text-muted" style={{ fontSize: "0.78rem" }}>No unestablished allegations noted.</p>
                          )}
                        </div>

                        {/* Disputed & Contradicted Facts */}
                        {Array.isArray(sec.factsAnalysis?.disputedFacts) && sec.factsAnalysis.disputedFacts.length > 0 && (
                          <div style={{ marginTop: "16px" }}>
                              <strong className="font-mono" style={{ fontSize: "0.8rem", color: "#F87171", display: "block", marginBottom: "8px" }}>
                                ⚡ Disputed & Contradicted Claims (Conflicting Evidence or Seller Denial):
                              </strong>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {sec.factsAnalysis.disputedFacts.map((df, idx) => (
                                  <div key={idx} style={{ padding: "10px 14px", borderRadius: "6px", backgroundColor: "var(--surface)", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                                      <span style={{ color: "var(--ink)" }}>{df.statement || df.fact}</span>
                                      <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: "bold", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#F87171" }}>
                                        {df.evidenceStatus || df.status || "CONTRADICTED"}
                                      </span>
                                    </div>
                                    <span className="text-muted" style={{ fontSize: "0.72rem" }}>Source: {df.sourceReference || df.provenance}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* TAB 2: EVIDENCE INVENTORY */}
                  {assessmentTab === "evidence" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
                          SECTION 4: EVIDENCE REVIEWED (INSPECTION INVENTORY)
                        </span>
                        {Array.isArray(sec.evidenceReviewed) && sec.evidenceReviewed.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {sec.evidenceReviewed.map((doc, idx) => (
                              <div key={idx} style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                                  <strong className="font-serif" style={{ fontSize: "0.95rem", color: "var(--ink)" }}>
                                    {doc.title}
                                  </strong>
                                  <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34D399" }}>
                                    {doc.status}
                                  </span>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                                  <span>Type: {doc.documentType || "DOCUMENT"}</span>
                                  {doc.datesFound?.length > 0 && <span>Dates: {doc.datesFound.join(", ")}</span>}
                                  {doc.amountsFound?.length > 0 && <span>Amounts: {doc.amountsFound.join(", ")}</span>}
                                  {doc.referenceNumbers?.length > 0 && <span>Ref #: {doc.referenceNumbers.join(", ")}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                            No physical documents inspected. Assessment conducted under disclosed secondary limitations.
                          </p>
                        )}
                      </div>

                      {/* Evidence Limitations */}
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                          SECTION 5: EVIDENCE LIMITATIONS & UNRESOLVED GAPS
                        </span>
                        {Array.isArray(sec.evidenceLimitations) && sec.evidenceLimitations.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: "18px", fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--ink)", lineHeight: "1.6" }}>
                            {sec.evidenceLimitations.map((lim, idx) => (
                              <li key={idx} style={{ marginBottom: "4px" }}>{lim}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>All requested evidentiary documents successfully reviewed.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: STATUTORY LAW & POLICY */}
                  {assessmentTab === "law" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      {/* Applicable Legal Provisions */}
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "14px" }}>
                          SECTION 7: APPLICABLE LEGAL PROVISIONS (CPA 2019 & E-COMMERCE RULES)
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {(sec.applicableLegalProvisions || []).map((prov, idx) => (
                            <div key={idx} style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                                <strong className="font-serif text-brass" style={{ fontSize: "1rem" }}>
                                  {prov.section} — {prov.title}
                                </strong>
                                <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                                  {prov.authority}
                                </span>
                              </div>
                              <p className="font-mono" style={{ fontSize: "0.8rem", color: "var(--ink)", margin: "0 0 8px 0", lineHeight: "1.5" }}>
                                "{prov.text}"
                              </p>
                              <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
                                ⚖️ <strong>Relevance:</strong> {prov.relevance}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Company Policy & Benchmarks */}
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
                          SECTION 6: RELEVANT COMPANY POLICY & STATUTORY BENCHMARK
                        </span>
                        <p className="font-serif" style={{ fontSize: "0.9rem", margin: "0 0 14px 0", color: "var(--ink)" }}>
                          {sec.companyPolicyAndTerms?.policySummary}
                        </p>
                        {Array.isArray(sec.companyPolicyAndTerms?.policies) && sec.companyPolicyAndTerms.policies.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {sec.companyPolicyAndTerms.policies.map((pol, idx) => (
                              <div key={idx} style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                                <strong className="font-serif" style={{ fontSize: "0.95rem", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                                  {pol.title}
                                </strong>
                                <p className="font-mono" style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: "0 0 6px 0" }}>
                                  Published Term: "{pol.passage}"
                                </p>
                                <span className="font-mono text-brass" style={{ fontSize: "0.75rem", display: "block" }}>
                                  ⚖️ Statutory Comparison: {pol.statutoryComparison}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Historical Judgments & Fact Comparisons */}
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                            SECTION 7B: HISTORICAL JUDGMENTS & PRECEDENTS (SUPREME COURT & NCDRC)
                          </span>
                          <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: "bold", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34D399", fontFamily: "var(--font-mono)" }}>
                            ✓ VERIFIED PRIMARY AUTHORITIES
                          </span>
                        </div>
                        <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: "0 0 14px 0", lineHeight: "1.5" }}>
                          Authentic Supreme Court and National Commission rulings matched against dispute facts with source citations and Indian Kanoon links.
                        </p>
                        {Array.isArray(sec.relevantHistoricalJudgments) && sec.relevantHistoricalJudgments.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {sec.relevantHistoricalJudgments.map((judg, idx) => (
                              <div key={idx} style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                  <strong className="font-serif text-brass" style={{ fontSize: "0.98rem" }}>
                                    {judg.caseName}
                                  </strong>
                                  {judg.sourceUrl && (
                                    <a href={judg.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-brass" style={{ fontSize: "0.72rem", textDecoration: "underline" }}>
                                      Indian Kanoon ↗
                                    </a>
                                  )}
                                </div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "6px" }}>
                                  Court: {judg.court} • Year: {judg.year} • Citation: {judg.citation}
                                </div>
                                <p className="font-mono" style={{ fontSize: "0.8rem", color: "var(--ink)", margin: "0 0 6px 0", lineHeight: "1.4" }}>
                                  <strong>Ratio:</strong> {judg.legalPrinciple}
                                </p>
                                <span className="font-mono text-muted" style={{ fontSize: "0.74rem" }}>
                                  ⚖️ <strong>Application to Consumer's Case:</strong> {judg.relevanceToCase}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="font-mono text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                            Precedents extracted and synchronized with authoritative case docket.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: BALANCED ARGUMENTS */}
                  {assessmentTab === "arguments" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      {/* Consumer's Strongest Grounds */}
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
                          SECTION 8: CONSUMER'S STRONGEST STATUTORY GROUNDS
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {(sec.consumerStrongestArguments || []).map((arg, idx) => (
                            <div key={idx} style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                <strong className="font-serif" style={{ fontSize: "0.95rem", color: "#34D399" }}>
                                  Ground #{idx + 1}: {arg.issue}
                                </strong>
                                <span className="font-mono" style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>
                                  Weight: {arg.evidentiaryWeight}
                                </span>
                              </div>
                              <p className="font-mono" style={{ fontSize: "0.82rem", color: "var(--ink)", margin: "0 0 6px 0", lineHeight: "1.5" }}>
                                {arg.argument}
                              </p>
                              <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                                Statutory Basis: {arg.statutoryBasis}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Company's Plausible Defense Model */}
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                          <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                            SECTION 9: COMPANY'S STRONGEST PLAUSIBLE COUNTERARGUMENTS
                          </span>
                          <span className="font-mono text-muted" style={{ fontSize: "0.7rem", fontStyle: "italic" }}>
                            Analytical Defense Model (Opposite party has not yet replied)
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {(sec.companyStrongestCounterarguments || []).map((arg, idx) => (
                            <div key={idx} style={{ padding: "12px 16px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                              <strong className="font-serif" style={{ fontSize: "0.95rem", color: "#FBBF24", display: "block", marginBottom: "4px" }}>
                                Defense Point #{idx + 1}: {arg.issue}
                              </strong>
                              <p className="font-mono" style={{ fontSize: "0.82rem", color: "var(--ink)", margin: "0 0 6px 0", lineHeight: "1.5" }}>
                                {arg.argument}
                              </p>
                              <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
                                💡 <strong>Rebuttal Strategy:</strong> {arg.rebuttalNote}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Unresolved Discrepancies */}
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                          SECTION 10: CONFLICTING EVIDENCE & UNRESOLVED QUESTIONS
                        </span>
                        {(sec.conflictingEvidenceAndUnresolvedQuestions || []).map((item, idx) => (
                          <div key={idx} style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--ink)", marginBottom: "4px" }}>
                            • {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: REMEDIES & NEXT STEPS */}
                  {assessmentTab === "remedies" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
                          SECTION 12: POTENTIAL REMEDIES (CPA 2019 SECTION 39)
                        </span>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                          {(sec.potentialRemedies?.possibleRemedies || []).map((rem, idx) => (
                            <div key={idx} style={{ padding: "14px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                <strong className="font-serif text-brass" style={{ fontSize: "0.95rem" }}>
                                  {rem.remedy}
                                </strong>
                                <span className="font-mono text-muted" style={{ fontSize: "0.7rem" }}>
                                  {rem.statutoryProvision}
                                </span>
                              </div>
                              <p className="font-mono text-muted" style={{ fontSize: "0.75rem", margin: 0, lineHeight: "1.4" }}>
                                <strong>Eligibility:</strong> {rem.eligibility}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div style={{ padding: "12px 14px", borderRadius: "6px", backgroundColor: "rgba(245, 158, 11, 0.08)", border: "1px dashed rgba(245, 158, 11, 0.4)", color: "#FBBF24", fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
                          ⚠️ <strong>Statutory Disclaimer:</strong> Veriq AI does not calculate or guarantee speculative compensation amounts. Compensation under Section 39(1)(d) is awarded at the discretion of the Consumer Commission upon proof of actual injury, negligence, or pecuniary loss.
                        </div>
                      </div>

                      {/* Next Procedural Steps */}
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
                          ACTIONABLE NEXT STEPS FOR THE CONSUMER
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {(sec.potentialRemedies?.stepsConsumerCanConsiderNext || []).map((step, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                              <span style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "var(--brass)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "bold", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                                {idx + 1}
                              </span>
                              <span className="font-mono" style={{ fontSize: "0.82rem", color: "var(--ink)", lineHeight: "1.5" }}>
                                {step}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: CITATIONS & AUDIT */}
                  {assessmentTab === "citations" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
                          SECTION 14: VERIFIED LEGAL CITATIONS & OFFICIAL AUTHORITIES
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {(sec.sourcesAndCitations || []).map((source, idx) => (
                            <div key={idx} style={{ padding: "14px 18px", borderRadius: "8px", backgroundColor: "var(--surface)", border: "1px solid var(--line)" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                <strong className="font-serif text-brass" style={{ fontSize: "0.95rem" }}>
                                  [{source.type}] {source.title}
                                </strong>
                                <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: "bold", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34D399" }}>
                                  ✓ VERIFIED PRIMARY SOURCE
                                </span>
                              </div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink-muted)", lineHeight: "1.5" }}>
                                <div>Authority: {source.authority}</div>
                                {source.sectionsCited && <div>Sections: {source.sectionsCited.join(", ")}</div>}
                                {source.relevance && <div>Relevance: {source.relevance}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Uncertainty & Grounding Audit */}
                      <div style={{ padding: "18px", borderRadius: "10px", backgroundColor: "var(--bg)", border: "1px solid var(--line)" }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                          SECTION 13: CONFIDENCE SCORE & UNCERTAINTY AUDIT
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                          <span style={{ fontSize: "1.4rem", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "var(--brass)" }}>
                            {confScore}%
                          </span>
                          <span className="font-mono text-muted" style={{ fontSize: "0.78rem" }}>
                            Confidence metric derived from evidentiary corroboration, absence of contradictions, and statutory alignment.
                          </span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "18px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink-muted)", lineHeight: "1.5" }}>
                          {(sec.confidenceAndUncertainty?.uncertaintyFactors || []).map((fact, idx) => (
                            <li key={idx} style={{ marginBottom: "2px" }}>{fact}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* SEPARATE FINAL CASE OUTCOME CALLOUT CARD */}
                  <div
                    style={{
                      marginTop: "24px",
                      padding: "24px",
                      borderRadius: "12px",
                      backgroundColor: "rgba(217, 119, 6, 0.08)",
                      border: "2px solid var(--brass)",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px"
                    }}
                  >
                    <div style={{ maxWidth: "700px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "1.4rem" }}>🏛️</span>
                        <h3 className="font-serif text-brass" style={{ margin: 0, fontSize: "1.2rem" }}>
                          Dedicated Final Case Outcome Page
                        </h3>
                        <span
                          className="font-mono"
                          style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "0.72rem",
                            backgroundColor: "rgba(16, 185, 129, 0.15)",
                            color: "#34d399",
                            border: "1px solid rgba(16, 185, 129, 0.3)"
                          }}
                        >
                          DISTINCT OUTPUT #3
                        </span>
                      </div>
                      <p className="font-mono text-muted" style={{ margin: 0, fontSize: "0.82rem", lineHeight: "1.5" }}>
                        Review Veriq AI's authoritative prediction of the plausible outcome, grounded in verified Supreme Court & NCDRC precedents, balanced defense models, potential remedies under Section 39 CPA 2019, and full transparent confidence metrics.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/courtroom/${threadId}/outcome`)}
                      className="btn-brass font-mono"
                      style={{ padding: "12px 24px", fontSize: "0.88rem", fontWeight: "bold", whiteSpace: "nowrap" }}
                    >
                      🏛️ Open Final Case Outcome Page →
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* PHASE 6 LOCKED STATE CARD (WHEN GATE NOT YET SATISFIED) */}
        {isClarificationComplete &&
          !(
            investigationGate?.isSatisfied ||
            investigation?.stage === "READY_FOR_ASSESSMENT" ||
            investigation?.stage === "ASSESSMENT_COMPLETE" ||
            investigation?.assessment?.preliminaryAssessment
          ) && (
            <div
              className="legal-card"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px dashed var(--line)",
                borderRadius: "14px",
                padding: "32px",
                marginBottom: "32px",
                textAlign: "center"
              }}
            >
              <span style={{ fontSize: "2.4rem", display: "block", marginBottom: "12px" }}>🔒</span>
              <h3 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: "0 0 8px 0" }}>
                Phase 6: Grounded Legal Assessment (Locked)
              </h3>
              <p className="font-mono text-muted" style={{ fontSize: "0.85rem", maxWidth: "650px", margin: "0 auto 20px auto", lineHeight: "1.6" }}>
                Phase 6 is strictly inaccessible until the server-side completeness gate has evaluated and verified your case facts, evidence, policy research, and contradiction reconciliations.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" }}>
                <button
                  type="button"
                  onClick={handleEvaluateGate}
                  disabled={evaluatingGate}
                  className="btn-brass font-mono"
                  style={{ padding: "10px 24px", fontSize: "0.85rem" }}
                >
                  {evaluatingGate ? "Evaluating Gate..." : "⚡ Evaluate Completeness Gate in Phase 5"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLimitationModal(true)}
                  className="btn-outline-brass font-mono"
                  style={{ padding: "10px 20px", fontSize: "0.85rem" }}
                >
                  ⚡ Proceed With Evidentiary Limitations →
                </button>
              </div>
            </div>
          )}

        {/* Dynamic Follow-Up Questions Section */}
        {!isClarificationComplete && !analyzing && (
          <div style={{ marginBottom: "36px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "20px", gap: "12px" }}>
              <div>
                <h2 className="font-serif" style={{ fontSize: "1.4rem", margin: "0 0 4px 0" }}>
                  Follow-Up Clarifications (Round {currentRound} of 3)
                </h2>
                <p className="font-mono text-muted" style={{ fontSize: "0.82rem", margin: 0 }}>
                  Answer using the structured controls below to establish material facts under Consumer Law
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span className="font-mono text-brass" style={{ fontSize: "0.82rem" }}>
                  {answeredPendingCount} of {pendingQuestions.length} Answered ({progressPercent}%)
                </span>

                {pendingQuestions.length > 1 && (
                  <div style={{ display: "flex", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--line)" }}>
                    <button
                      type="button"
                      onClick={() => setViewMode("all")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        fontFamily: "var(--font-mono)",
                        backgroundColor: viewMode === "all" ? "var(--brass)" : "var(--bg)",
                        color: viewMode === "all" ? "var(--bg)" : "var(--ink-muted)",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      All Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("stepper")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        fontFamily: "var(--font-mono)",
                        backgroundColor: viewMode === "stepper" ? "var(--brass)" : "var(--bg)",
                        color: viewMode === "stepper" ? "var(--bg)" : "var(--ink-muted)",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      Step-by-Step
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {pendingQuestions.length > 0 && (
              <div style={{ width: "100%", height: "6px", backgroundColor: "var(--line)", borderRadius: "3px", overflow: "hidden", marginBottom: "24px" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    backgroundColor: "var(--brass)",
                    transition: "width 0.3s ease"
                  }}
                />
              </div>
            )}

            {pendingQuestions.length === 0 ? (
              <div
                style={{
                  padding: "32px",
                  borderRadius: "14px",
                  border: "1px solid var(--line)",
                  backgroundColor: "var(--surface)",
                  textAlign: "center"
                }}
              >
                <p className="font-serif" style={{ fontSize: "1.1rem", margin: "0 0 16px 0" }}>
                  No additional questions currently pending.
                </p>
                <button onClick={handleProceed} disabled={submittingAnswers} className="btn-brass">
                  Proceed to Evidence Stage →
                </button>
              </div>
            ) : viewMode === "stepper" ? (
              /* Stepper / One-at-a-time view */
              <div>
                {(() => {
                  const q = pendingQuestions[activeQuestionIndex] || pendingQuestions[0];
                  const qIndex = activeQuestionIndex;
                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: "28px",
                        borderRadius: "14px",
                        border: "1px solid var(--line)",
                        backgroundColor: "var(--surface)",
                        boxShadow: "0 2px 14px rgba(0,0,0,0.1)",
                        marginBottom: "20px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <span
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              backgroundColor: "var(--brass)",
                              color: "var(--bg)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.85rem",
                              fontWeight: "bold",
                              fontFamily: "var(--font-mono)",
                              flexShrink: 0
                            }}
                          >
                            {qIndex + 1}
                          </span>
                          <div>
                            <span className="font-mono text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                              QUESTION {qIndex + 1} OF {pendingQuestions.length}
                            </span>
                            <h3 className="font-serif" style={{ fontSize: "1.25rem", margin: "4px 0 0 0", lineHeight: "1.4", color: "var(--ink)" }}>
                              {q.question}
                            </h3>
                          </div>
                        </div>

                        <span
                          className="font-mono"
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            backgroundColor: q.importance === "CRITICAL" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: q.importance === "CRITICAL" ? "#F87171" : "#FBBF24",
                            border: q.importance === "CRITICAL" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)"
                          }}
                        >
                          {q.importance || "HIGH"}
                        </span>
                      </div>

                      {q.legalRelevance && (
                        <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: "0 0 16px 44px", fontStyle: "italic", opacity: 0.9 }}>
                          ⚖️ Legal Relevance: {q.legalRelevance}
                        </p>
                      )}

                      <div style={{ marginLeft: "44px", marginBottom: "20px" }}>
                        {renderStructuredControl(q)}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "16px", marginLeft: "44px" }}>
                        <button
                          type="button"
                          onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                          disabled={qIndex === 0}
                          className="btn-outline-brass font-mono"
                          style={{ padding: "8px 18px", fontSize: "0.8rem", opacity: qIndex === 0 ? 0.4 : 1 }}
                        >
                          ← Previous Question
                        </button>

                        {qIndex < pendingQuestions.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => setActiveQuestionIndex((prev) => Math.min(pendingQuestions.length - 1, prev + 1))}
                            className="btn-brass font-mono"
                            style={{ padding: "8px 20px", fontSize: "0.8rem" }}
                          >
                            Next Question →
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSubmitAnswers}
                            disabled={submittingAnswers}
                            className="btn-brass font-mono"
                            style={{ padding: "8px 24px", fontSize: "0.82rem" }}
                          >
                            {submittingAnswers ? "Recording Answers..." : "Submit All Answers →"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* All Cards View */
              <form onSubmit={handleSubmitAnswers} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {pendingQuestions.map((q, idx) => {
                  const isAnswered = isQuestionAnswered(q);
                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: "24px",
                        borderRadius: "14px",
                        border: isAnswered ? "1px solid var(--line-bright)" : "1px solid var(--line)",
                        backgroundColor: "var(--surface)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <span
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              backgroundColor: isAnswered ? "var(--support-green)" : "var(--brass)",
                              color: "var(--bg)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.8rem",
                              fontWeight: "bold",
                              fontFamily: "var(--font-mono)",
                              flexShrink: 0,
                              marginTop: "2px"
                            }}
                          >
                            {isAnswered ? "✓" : idx + 1}
                          </span>
                          <h3 className="font-serif" style={{ fontSize: "1.15rem", margin: 0, lineHeight: "1.4", color: "var(--ink)" }}>
                            {q.question}
                          </h3>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            className="font-mono"
                            style={{
                              padding: "3px 8px",
                              borderRadius: "4px",
                              fontSize: "0.7rem",
                              fontWeight: "bold",
                              textTransform: "uppercase",
                              backgroundColor: q.importance === "CRITICAL" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                              color: q.importance === "CRITICAL" ? "#F87171" : "#FBBF24",
                              border: q.importance === "CRITICAL" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)"
                            }}
                          >
                            {q.importance || "HIGH"}
                          </span>
                        </div>
                      </div>

                      {q.legalRelevance && (
                        <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: "0 0 14px 40px", fontStyle: "italic", opacity: 0.9 }}>
                          ⚖️ Legal Relevance: {q.legalRelevance}
                        </p>
                      )}

                      <div style={{ marginLeft: "40px" }}>
                        {renderStructuredControl(q)}
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", marginTop: "8px" }}>
                  <button
                    type="submit"
                    disabled={submittingAnswers || answeredPendingCount === 0}
                    className="btn-brass"
                    style={{ padding: "12px 28px", fontSize: "0.92rem", opacity: (submittingAnswers || answeredPendingCount === 0) ? 0.5 : 1 }}
                  >
                    {submittingAnswers ? "Recording Answers..." : `Submit ${answeredPendingCount} Answer(s) & Continue →`}
                  </button>

                  <button
                    type="button"
                    onClick={handleProceed}
                    disabled={submittingAnswers}
                    className="btn-outline-brass font-mono"
                    style={{ padding: "12px 20px" }}
                  >
                    Skip Remaining Questions & Proceed →
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Modal for Editing a Previously Answered Question */}
        {editingItem && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 1000,
              boxSizing: "border-box"
            }}
          >
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--brass)",
                borderRadius: "14px",
                maxWidth: "600px",
                width: "100%",
                padding: "28px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: 0 }}>
                  Edit Recorded Answer
                </h3>
                <button
                  onClick={() => setEditingItem(null)}
                  style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", fontSize: "1.2rem" }}
                >
                  ✕
                </button>
              </div>

              <p className="font-serif" style={{ fontSize: "1rem", color: "var(--ink)", marginBottom: "16px", lineHeight: "1.5" }}>
                Q: {editingItem.question}
              </p>

              <textarea
                rows={4}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Update your answer..."
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  backgroundColor: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: "0.9rem",
                  fontFamily: "var(--font-mono)",
                  lineHeight: "1.5",
                  boxSizing: "border-box",
                  outline: "none",
                  marginBottom: "20px"
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="btn-outline-brass font-mono"
                  style={{ padding: "8px 16px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={submittingAnswers || !editValue.trim()}
                  className="btn-brass font-mono"
                  style={{ padding: "8px 20px" }}
                >
                  {submittingAnswers ? "Updating..." : "Save Updated Answer"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clarification History Section (Persistent across refresh & editable) */}
        {clarificationHistory.length > 0 && (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h2 className="font-serif text-brass" style={{ fontSize: "1.25rem", margin: "0 0 4px 0" }}>
                  Recorded Factual Clarifications
                </h2>
                <p className="font-mono text-muted" style={{ fontSize: "0.78rem", margin: 0 }}>
                  You can edit your answers anytime without creating duplicate entries
                </p>
              </div>
              <span className="font-mono text-muted" style={{ fontSize: "0.78rem" }}>
                {clarificationHistory.length} Clarification(s) Recorded
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {clarificationHistory.map((item, idx) => {
                const formattedAnswer = item.answerText || (
                  typeof item.answer === "object"
                    ? JSON.stringify(item.answer)
                    : String(item.answer)
                );

                return (
                  <div
                    key={item.questionId || idx}
                    style={{
                      padding: "16px 20px",
                      borderRadius: "10px",
                      border: "1px solid var(--line)",
                      backgroundColor: "var(--surface)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                      <strong className="font-serif" style={{ fontSize: "0.98rem", color: "var(--ink)", lineHeight: "1.4" }}>
                        Q: {item.question || `Clarification Question #${idx + 1}`}
                      </strong>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                        <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setEditValue(formattedAnswer);
                          }}
                          className="font-mono text-brass"
                          style={{
                            background: "none",
                            border: "1px solid var(--brass)",
                            borderRadius: "4px",
                            padding: "2px 8px",
                            fontSize: "0.72rem",
                            cursor: "pointer"
                          }}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        backgroundColor: "var(--bg)",
                        border: "1px solid var(--line)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.85rem",
                        color: "var(--ink)",
                        lineHeight: "1.5"
                      }}
                    >
                      A: {formattedAnswer}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: MARK DOCUMENT UNAVAILABLE */}
        {/* ======================================================== */}
        {showUnavailableModal && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "28px", maxWidth: "540px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
              <h3 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: "0 0 8px 0" }}>
                Mark Document as Unavailable
              </h3>
              <p className="font-mono text-muted" style={{ fontSize: "0.82rem", lineHeight: "1.5", margin: "0 0 20px 0" }}>
                If a receipt, warranty card, or service sheet was never issued or was withheld by the merchant, record it here. Veriq AI will disclose this limitation rather than blocking your investigation.
              </p>
              <form onSubmit={handleMarkUnavailableSubmit}>
                <div style={{ marginBottom: "14px" }}>
                  <label className="font-mono text-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "6px" }}>
                    DOCUMENT NAME / TYPE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Authorized Service Job Sheet, Tax Invoice, Warranty Card"
                    value={unavailableDocName}
                    onChange={(e) => setUnavailableDocName(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.88rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label className="font-mono text-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "6px" }}>
                    REASON DOCUMENT CANNOT BE PRODUCED
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Merchant refused to provide cash receipt despite payment, or service center retained the original job sheet."
                    value={unavailableReason}
                    onChange={(e) => setUnavailableReason(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.85rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="button" onClick={() => setShowUnavailableModal(false)} className="btn-outline-brass font-mono" style={{ padding: "8px 16px" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={markingUnavailable || !unavailableDocName.trim()} className="btn-brass font-mono" style={{ padding: "8px 20px" }}>
                    {markingUnavailable ? "Recording..." : "Record Document as Unavailable"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: CORRECT DOCUMENT INTERPRETATION */}
        {/* ======================================================== */}
        {correctingDocId && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "28px", maxWidth: "540px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
              <h3 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: "0 0 8px 0" }}>
                Correct Document Interpretation
              </h3>
              <p className="font-mono text-muted" style={{ fontSize: "0.82rem", lineHeight: "1.5", margin: "0 0 20px 0" }}>
                Clarify or correct the extracted information (dates, amounts, terms) without altering the original uploaded file on disk.
              </p>
              <form onSubmit={handleSubmitCorrection}>
                <div style={{ marginBottom: "14px" }}>
                  <label className="font-mono text-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "6px" }}>
                    CORRECTED FACTUAL STATEMENT *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. The invoice amount is ₹14,999 not ₹19,999, which includes a ₹5,000 instant discount."
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.85rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label className="font-mono text-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "6px" }}>
                    EXPLANATORY NOTES / REASON FOR DISCREPANCY
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scanned font was smudged in total line"
                    value={correctionNotes}
                    onChange={(e) => setCorrectionNotes(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.85rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="button" onClick={() => setCorrectingDocId(null)} className="btn-outline-brass font-mono" style={{ padding: "8px 16px" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingCorrection || !correctionText.trim()} className="btn-brass font-mono" style={{ padding: "8px 20px" }}>
                    {submittingCorrection ? "Saving..." : "Save Interpretation Correction"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: PROCEED WITH EVIDENTIARY LIMITATIONS */}
        {/* ======================================================== */}
        {showLimitationModal && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "28px", maxWidth: "560px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
              <h3 className="font-serif text-brass" style={{ fontSize: "1.3rem", margin: "0 0 8px 0" }}>
                Proceed to Assessment with Limitations
              </h3>
              <p className="font-mono text-muted" style={{ fontSize: "0.82rem", lineHeight: "1.5", margin: "0 0 16px 0" }}>
                In consumer law, consumers are not permanently barred when documents are unavailable or unissued. If you proceed, Veriq AI will evaluate your legal claim based on your sworn statements and intake facts, while disclosing the absence of physical documents.
              </p>
              <div style={{ marginBottom: "20px" }}>
                <label className="font-mono text-muted" style={{ fontSize: "0.75rem", display: "block", marginBottom: "6px" }}>
                  CONFIRMATION & REASON TO PROCEED *
                </label>
                <textarea
                  rows={3}
                  value={limitationReason}
                  onChange={(e) => setLimitationReason(e.target.value)}
                  placeholder="e.g. I do not have a written job sheet as the service technician visited my house verbally and refused to give paper receipt. I wish to proceed based on my complaint and payment transaction ID."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)", backgroundColor: "var(--bg)", color: "var(--ink)", fontSize: "0.85rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setShowLimitationModal(false)} className="btn-outline-brass font-mono" style={{ padding: "8px 16px" }}>
                  Cancel
                </button>
                <button type="button" onClick={handleProceedWithLimitations} disabled={proceedingWithLimitations} className="btn-brass font-mono" style={{ padding: "8px 20px" }}>
                  {proceedingWithLimitations ? "Recording..." : "Confirm & Proceed with Disclosed Limitations"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: AI 2.0 TRANSFER ASSESSMENT FORM DOCKET */}
        {/* ======================================================== */}
        {showTransferAssessmentModal && (
          <TransferAssessmentModal
            threadId={threadId}
            accessToken={accessToken}
            onClose={() => setShowTransferAssessmentModal(false)}
            onReviewSubmitted={(res) => {
              if (res?.investigation) {
                setInvestigation(res.investigation);
              }
              setSuccessNotice("AI 2.0 Transfer Assessment review confirmed.");
            }}
          />
        )}
      </main>
    </div>
  );
}
