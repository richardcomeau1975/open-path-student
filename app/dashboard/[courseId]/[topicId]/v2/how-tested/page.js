"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function HowTestedPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [analysis, setAnalysis] = useState(null);
  const [formatDescription, setFormatDescription] = useState(null);
  const [inherited, setInherited] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API_URL}/api/topics/${topicId}/exam/analysis`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.exists) {
            setAnalysis(data.analysis);
            setFormatDescription(data.format_description || null);
            setInherited(data.inherited || false);
            setHasAnalysis(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch analysis:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [topicId, getToken]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${API_URL}/api/topics/${topicId}/exam/upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
        setFormatDescription(data.format_description || null);
        setInherited(false);
        setHasAnalysis(true);
        setShowAnalysis(true);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
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
        <div style={{ position: 'fixed', top: 12, right: 16, background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, zIndex: 9999, letterSpacing: '0.5px' }}>v2</div>
        Loading...
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
          HOW YOU&apos;RE TESTED
        </div>
        <h1
          style={{
            fontFamily: "Lora, serif",
            fontWeight: 600,
            fontSize: "28px",
            marginTop: "4px",
          }}
        >
          How You&apos;re Tested
        </h1>
      </div>

      {/* Upload zone */}
      <div
        style={{
          background: "#ffffff",
          border: "2px dashed #E8E4DA",
          borderRadius: "12px",
          padding: "32px",
          textAlign: "center",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "15px",
            color: "#6B6B6B",
            marginBottom: "16px",
          }}
        >
          {hasAnalysis
            ? inherited
              ? formatDescription
                ? `Your test format: ${formatDescription} (from a previous topic). Upload a new sample exam to customize for this topic.`
                : "Upload a sample exam or past test to customize for this topic."
              : formatDescription
                ? `Your test format: ${formatDescription}. Upload a new one to update.`
                : "Upload a new one to update."
            : "Upload a sample exam or past test to see how you\u2019ll be tested."}
        </p>
        <label
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: uploading ? "#ccc" : "#9B8E82",
            color: "#fff",
            borderRadius: "8px",
            cursor: uploading ? "not-allowed" : "pointer",
            fontFamily: "Inter, sans-serif",
            fontSize: "15px",
            fontWeight: 500,
          }}
        >
          {uploading ? "Analyzing..." : "Choose File"}
          <input
            type="file"
            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: "none" }}
          />
        </label>
        <p
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "#6B6B6B",
            fontFamily: "Inter, sans-serif",
          }}
        >
          PDF, DOCX, PNG, JPG, or TXT
        </p>
      </div>

      {/* Stored analysis toggle */}
      {hasAnalysis && (
        <div>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            style={{
              background: "none",
              border: "1px solid #E8E4DA",
              borderRadius: "8px",
              padding: "10px 20px",
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              color: "#1a1a1a",
              cursor: "pointer",
              marginBottom: "16px",
            }}
          >
            {showAnalysis ? "Hide Analysis" : "View Stored Analysis"}
          </button>

          {showAnalysis && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #E8E4DA",
                borderRadius: "12px",
                padding: "24px",
                fontFamily: "Inter, sans-serif",
                fontSize: "15px",
                color: "#1a1a1a",
                lineHeight: 1.8,
                whiteSpace: "pre-wrap",
              }}
            >
              {analysis}
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
