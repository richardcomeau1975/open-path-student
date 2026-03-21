"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function NoteChartPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimerRef = useRef(null);
  const questionsRef = useRef(questions);

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
        console.error("Failed to fetch note chart:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
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
        Loading note chart...
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: "900px", margin: "0 auto" }}>
      <button onClick={() => router.back()} style={backBtnStyle}>
        &larr; Back
      </button>

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
          NOTE CHART
        </div>
        <h1
          style={{
            fontFamily: "Lora, serif",
            fontWeight: 600,
            fontSize: "28px",
            marginTop: "4px",
          }}
        >
          Note Chart
        </h1>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            color: "#6B6B6B",
            fontSize: "14px",
            marginTop: "8px",
          }}
        >
          Answer each question from memory. When you&apos;re done, click Evaluate to see where you stand.
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

      {/* Evaluate button (non-functional until Phase 4) */}
      <div
        style={{
          textAlign: "center",
          marginTop: "24px",
          marginBottom: "40px",
        }}
      >
        <button
          disabled
          style={{
            padding: "14px 36px",
            background: "#E8E4DA",
            color: "#6B6B6B",
            border: "none",
            borderRadius: "8px",
            fontFamily: "Inter, sans-serif",
            fontSize: "16px",
            fontWeight: 500,
            cursor: "not-allowed",
          }}
        >
          Evaluate My Recall
        </button>
      </div>
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
