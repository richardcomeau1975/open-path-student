"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useAdmin } from "../../../../../../lib/admin";
import AdminToolbar from "../../../../../../components/AdminToolbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function NoteChartPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const { isAdmin } = useAdmin();
  const [refreshKey, setRefreshKey] = useState(0);

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimerRef = useRef(null);
  const questionsRef = useRef(questions);

  // Evaluation state
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [showEvaluation, setShowEvaluation] = useState(false);

  // Keep ref in sync with state
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API_URL}/api/topics/${topicId}/notechart/questions`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
        }
      } catch (err) {
        console.error("Failed to fetch active recall:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [topicId, getToken, refreshKey]);

  // Check for existing evaluation on mount
  useEffect(() => {
    async function checkEvaluation() {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API_URL}/api/topics/${topicId}/notechart/evaluation`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (data.exists) {
          setEvaluation(data.evaluation);
        }
      } catch (err) {}
    }
    checkEvaluation();
  }, [topicId, getToken]);

  const saveAnswers = async () => {
    const current = questionsRef.current;
    setSaving(true);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/topics/${topicId}/notechart/save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers: current.map((q) => ({
            section: q.section,
            question: q.question,
            answer: q.answer || "",
          })),
        }),
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save answers:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAnswerChange = (index, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], answer: value };
    setQuestions(updated);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAnswers(), 2000);
  };

  async function evaluateAnswers() {
    setEvaluating(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${API_URL}/api/topics/${topicId}/notechart/evaluate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setEvaluation(data.evaluation);
      setShowEvaluation(true);
    } catch (err) {
      console.error("Evaluation failed:", err);
    }
    setEvaluating(false);
  }

  // Group questions by section
  const sections = [];
  const sectionMap = new Map();
  questions.forEach((q, idx) => {
    const sec = q.section || "Questions";
    if (!sectionMap.has(sec)) {
      sectionMap.set(sec, []);
      sections.push(sec);
    }
    sectionMap.get(sec).push({ ...q, _index: idx });
  });

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          fontFamily: "Inter, sans-serif",
          color: "#6B6B6B",
        }}
      >
        <div style={{ position: 'fixed', top: 12, right: 16, background: '#8B6914', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, zIndex: 9999, letterSpacing: '0.5px' }}>v2</div>
        Loading active recall...
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: "900px", margin: "0 auto" }}>
      <button onClick={() => router.back()} style={backBtnStyle}>
        &larr; Back
      </button>

      {isAdmin && (
        <AdminToolbar topicId={topicId} outputType="notechart" label="Note Chart"
          showTestPrompt={true} downstreamLabel={null} accept=".json,.txt,.md,.yaml,.yml"
          onRefresh={() => setRefreshKey(k => k + 1)} />
      )}

      <div style={{ marginTop: "16px", marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "13px",
            color: "#8B6914",
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            letterSpacing: "0.5px",
          }}
        >
          ACTIVE RECALL
        </div>
        <h1
          style={{
            fontFamily: "Lora, serif",
            fontWeight: 600,
            fontSize: "28px",
            marginTop: "4px",
          }}
        >
          Active Recall
        </h1>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            color: "#6B6B6B",
            fontSize: "14px",
            marginTop: "8px",
          }}
        >
          Answer each question from memory. When you&apos;re done, click
          Evaluate to see where you stand.
        </p>
      </div>

      {/* Save status */}
      <div
        style={{
          fontSize: "12px",
          color: "#6B6B6B",
          fontFamily: "Inter, sans-serif",
          marginBottom: "16px",
        }}
      >
        {saving
          ? "Saving..."
          : lastSaved
          ? `Auto-saved at ${lastSaved.toLocaleTimeString()}`
          : "Your answers auto-save as you type"}
      </div>

      {/* Question sections */}
      {sections.map((sectionName) => (
        <div key={sectionName} style={{ marginBottom: "32px" }}>
          <h2
            style={{
              fontFamily: "Lora, serif",
              fontWeight: 600,
              fontSize: "18px",
              color: "#8B6914",
              marginBottom: "16px",
              paddingBottom: "8px",
              borderBottom: "1px solid #E8E4DA",
            }}
          >
            {sectionName}
          </h2>

          {sectionMap.get(sectionName).map((q) => (
            <div
              key={q._index}
              style={{
                background: "#ffffff",
                border: "1px solid #E8E4DA",
                borderRadius: "12px",
                padding: "16px 20px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "#1a1a1a",
                  marginBottom: "10px",
                }}
              >
                {q.question}
              </div>
              <textarea
                value={q.answer || ""}
                onChange={(e) => handleAnswerChange(q._index, e.target.value)}
                placeholder="Type your answer here..."
                style={{
                  width: "100%",
                  minHeight: "80px",
                  padding: "12px",
                  border: "1px solid #E8E4DA",
                  borderRadius: "8px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "14px",
                  color: "#1a1a1a",
                  resize: "vertical",
                  outline: "none",
                  background: "#FDFBF7",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Evaluate button */}
      <div
        style={{
          textAlign: "center",
          marginTop: "24px",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={evaluateAnswers}
          disabled={evaluating}
          style={{
            padding: "14px 36px",
            background: evaluating ? "#E8E4DA" : "#9B8E82",
            color: evaluating ? "#6B6B6B" : "#fff",
            border: "none",
            borderRadius: "8px",
            fontFamily: "Inter, sans-serif",
            fontSize: "16px",
            fontWeight: 500,
            cursor: evaluating ? "not-allowed" : "pointer",
          }}
        >
          {evaluating ? "Evaluating..." : "Evaluate My Recall"}
        </button>
      </div>

      {/* View Previous Evaluation toggle */}
      {evaluation && !showEvaluation && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <button
            onClick={() => setShowEvaluation(true)}
            style={{
              background: "transparent",
              border: "1px solid #E8E4DA",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            View Previous Evaluation
          </button>
        </div>
      )}

      {/* Evaluation results */}
      {showEvaluation && evaluation && (
        <div style={{ marginTop: "2rem", marginBottom: "40px" }}>
          <div style={{ textAlign: "right", marginBottom: "1rem" }}>
            <button
              onClick={() => setShowEvaluation(false)}
              style={{
                background: "transparent",
                border: "1px solid #E8E4DA",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                color: "#6B6B6B",
              }}
            >
              Hide Evaluation
            </button>
          </div>

          {/* What you've built */}
          <h2
            style={{
              fontFamily: "Lora, serif",
              fontSize: 18,
              fontWeight: 500,
              color: "#8B6914",
              marginBottom: "0.75rem",
            }}
          >
            What you&apos;ve built
          </h2>
          <div
            style={{
              background: "#fff",
              border: "1px solid #E8E4DA",
              borderRadius: 12,
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            {evaluation.filter((e) => e.status === "solid").length > 0 ? (
              evaluation
                .filter((e) => e.status === "solid")
                .map((item, i, arr) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom:
                        i < arr.length - 1 ? "1px solid #f1efe8" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#4A7C59",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ fontSize: 14 }}>{item.got}</div>
                  </div>
                ))
            ) : (
              <div style={{ fontSize: 14, color: "#6B6B6B" }}>
                Nothing solid yet — keep working at it.
              </div>
            )}
          </div>

          {/* Where to tighten up */}
          <h2
            style={{
              fontFamily: "Lora, serif",
              fontSize: 18,
              fontWeight: 500,
              color: "#8B6914",
              marginBottom: "0.75rem",
            }}
          >
            Where to tighten up
          </h2>
          <div
            style={{
              background: "#fff",
              border: "1px solid #E8E4DA",
              borderRadius: 12,
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            {evaluation.filter((e) => e.status === "fuzzy").length > 0 ? (
              evaluation
                .filter((e) => e.status === "fuzzy")
                .map((item, i, arr) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 0",
                      borderBottom:
                        i < arr.length - 1 ? "1px solid #f1efe8" : "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        marginBottom: 6,
                      }}
                    >
                      {item.question}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "#4A7C59",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ fontSize: 13, color: "#6B6B6B" }}>
                        {item.got}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "#C4972A",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ fontSize: 13, color: "#6B6B6B" }}>
                        {item.missing}
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div style={{ fontSize: 14, color: "#4A7C59" }}>
                Everything looks solid.
              </div>
            )}
          </div>

          {/* Walk Through the Gaps button */}
          {evaluation.filter((e) => e.status === "fuzzy").length > 0 && (
            <div style={{ textAlign: "center" }}>
              <button
                onClick={() =>
                  router.push(
                    `/dashboard/${courseId}/${topicId}/v2/walk-gaps`
                  )
                }
                style={{
                  background: "#9B8E82",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 24px",
                  fontSize: 15,
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Walk Through the Gaps
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const backBtnStyle = {
  background: "none",
  border: "none",
  color: "#6B6B6B",
  fontFamily: "Inter, sans-serif",
  fontSize: "15px",
  cursor: "pointer",
  padding: "4px 0",
};
