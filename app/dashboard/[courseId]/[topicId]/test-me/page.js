"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function TestMePage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/topics/${topicId}/quiz`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
        }
      } catch (err) {
        console.error("Failed to fetch quiz:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [topicId, getToken]);

  const currentQ = questions[currentIndex];

  const handleSelect = (letter) => {
    if (answered) return;
    setSelectedAnswer(letter);
    setAnswered(true);

    const isCorrect = letter === currentQ.correct;
    if (isCorrect) setScore((prev) => prev + 1);

    setResults((prev) => [
      ...prev,
      {
        question: currentQ.question,
        selected: letter,
        correct: currentQ.correct,
        isCorrect,
      },
    ]);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    } else {
      setFinished(true);
    }
  };

  const getOptionStyle = (letter) => {
    const base = {
      display: "block",
      width: "100%",
      padding: "14px 20px",
      marginBottom: "10px",
      border: "1px solid #E8E4DA",
      borderRadius: "8px",
      background: "#ffffff",
      fontFamily: "Inter, sans-serif",
      fontSize: "15px",
      color: "#1a1a1a",
      cursor: answered ? "default" : "pointer",
      textAlign: "left",
      transition: "all 0.2s ease",
    };

    if (!answered) {
      if (letter === selectedAnswer) {
        return {
          ...base,
          border: "2px solid #8B6914",
          background: "#FBF8F0",
        };
      }
      return base;
    }

    // After answering
    if (letter === currentQ.correct) {
      return {
        ...base,
        border: "2px solid #4A7C59",
        background: "#F0F7F2",
        color: "#4A7C59",
        fontWeight: 500,
      };
    }
    if (letter === selectedAnswer && letter !== currentQ.correct) {
      return {
        ...base,
        border: "2px solid #C44A2A",
        background: "#FFF0F0",
        color: "#C44A2A",
      };
    }
    return { ...base, opacity: 0.5 };
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          fontFamily: "Inter, sans-serif",
          color: "#6B6B6B",
        }}
      >
        Generating quiz questions — this may take a moment...
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div style={{ padding: "40px" }}>
        <button onClick={() => router.back()} style={backBtnStyle}>
          &larr; Back
        </button>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            color: "#6B6B6B",
            marginTop: "20px",
          }}
        >
          Upload a sample exam first in How You&apos;re Tested, then come back here to test yourself.
        </p>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    let message = "Worth revisiting the material.";
    if (pct === 100) message = "Perfect — you own this material.";
    else if (pct >= 80)
      message = "Strong understanding. A few gaps to tighten up.";
    else if (pct >= 60)
      message = "Decent foundation. Some concepts need more work.";

    return (
      <div
        style={{ padding: "24px 32px", maxWidth: "700px", margin: "0 auto" }}
      >
        <button onClick={() => router.back()} style={backBtnStyle}>
          &larr; Back
        </button>

        <div
          style={{
            marginTop: "24px",
            background: "#ffffff",
            border: "1px solid #E8E4DA",
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#8B6914",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              letterSpacing: "0.5px",
            }}
          >
            YOUR SCORE
          </div>
          <div
            style={{
              fontFamily: "Lora, serif",
              fontSize: "48px",
              fontWeight: 600,
              marginTop: "8px",
              color:
                pct >= 80 ? "#4A7C59" : pct >= 60 ? "#C4972A" : "#C44A2A",
            }}
          >
            {score} / {questions.length}
          </div>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "16px",
              color: "#6B6B6B",
              marginTop: "12px",
            }}
          >
            {message}
          </p>

          <button
            onClick={() => {
              setCurrentIndex(0);
              setSelectedAnswer(null);
              setAnswered(false);
              setScore(0);
              setFinished(false);
              setResults([]);
            }}
            style={{
              marginTop: "24px",
              padding: "12px 28px",
              background: "#9B8E82",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              fontSize: "15px",
              fontWeight: 500,
            }}
          >
            Try Again
          </button>
        </div>

        {/* Results breakdown */}
        <div style={{ marginTop: "24px" }}>
          {results.map((r, i) => (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                marginBottom: "8px",
                background: "#ffffff",
                border: `1px solid ${r.isCorrect ? "#4A7C59" : "#C44A2A"}`,
                borderRadius: "8px",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "18px" }}>
                {r.isCorrect ? "\u2713" : "\u2717"}
              </span>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "14px",
                  color: "#1a1a1a",
                }}
              >
                {r.question}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Active question view
  const letters = ["A", "B", "C", "D"];

  return (
    <div style={{ padding: "24px 32px", maxWidth: "700px", margin: "0 auto" }}>
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
          TEST ME
        </div>
        <h1
          style={{
            fontFamily: "Lora, serif",
            fontWeight: 600,
            fontSize: "28px",
            marginTop: "4px",
          }}
        >
          Test Me
        </h1>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: "6px",
          background: "#E8E4DA",
          borderRadius: "3px",
          marginBottom: "24px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(currentIndex / questions.length) * 100}%`,
            background: "#8B6914",
            borderRadius: "3px",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Question counter */}
      <div
        style={{
          fontSize: "13px",
          color: "#6B6B6B",
          fontFamily: "Inter, sans-serif",
          marginBottom: "16px",
        }}
      >
        Question {currentIndex + 1} of {questions.length}
      </div>

      {/* Question card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #E8E4DA",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "20px",
        }}
      >
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "16px",
            fontWeight: 500,
            color: "#1a1a1a",
            lineHeight: 1.6,
          }}
        >
          {currentQ.question}
        </p>
      </div>

      {/* Options */}
      <div>
        {currentQ.options &&
          currentQ.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleSelect(letters[i])}
              style={getOptionStyle(letters[i])}
            >
              <strong>{letters[i]}.</strong> {option}
            </button>
          ))}
      </div>

      {/* Explanation + Next (shown after answering) */}
      {answered && (
        <div style={{ marginTop: "16px" }}>
          {currentQ.explanation && (
            <div
              style={{
                padding: "14px 18px",
                background: "#F5F3EE",
                borderRadius: "8px",
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
                color: "#1a1a1a",
                lineHeight: 1.6,
                marginBottom: "16px",
              }}
            >
              {currentQ.explanation}
            </div>
          )}

          <button
            onClick={handleNext}
            style={{
              padding: "12px 28px",
              background: "#9B8E82",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              fontSize: "15px",
              fontWeight: 500,
            }}
          >
            {currentIndex < questions.length - 1
              ? "Next Question"
              : "See Results"}
          </button>
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
