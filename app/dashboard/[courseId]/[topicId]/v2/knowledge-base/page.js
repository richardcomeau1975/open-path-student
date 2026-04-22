"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function KnowledgeBasePage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API_URL}/api/topics/${topicId}/learning-asset`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setText(data.text || "");
        }
      } catch (err) {
        console.error("Failed to fetch learning asset:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAsset();
  }, [topicId, getToken]);

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "learning-asset.md";
    a.click();
    URL.revokeObjectURL(url);
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
        <div style={{ position: 'fixed', top: 12, right: 16, background: '#8B6914', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, zIndex: 9999, letterSpacing: '0.5px' }}>v2</div>
        Loading knowledge base...
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: "900px", margin: "0 auto" }}>
      <button onClick={() => router.back()} style={backBtnStyle}>
        &larr; Back
      </button>

      <div
        style={{
          marginTop: "16px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "13px",
              color: "#8B6914",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              letterSpacing: "0.5px",
            }}
          >
            KNOWLEDGE BASE
          </div>
          <h1
            style={{
              fontFamily: "Lora, serif",
              fontWeight: 600,
              fontSize: "28px",
              marginTop: "4px",
            }}
          >
            Knowledge Base
          </h1>
        </div>
        <button
          onClick={handleDownload}
          style={{
            padding: "10px 20px",
            background: "#9B8E82",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          Download
        </button>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #E8E4DA",
          borderRadius: "12px",
          padding: "24px 28px",
          fontFamily: "Inter, sans-serif",
          fontSize: "15px",
          color: "#f5f0e8",
          lineHeight: 1.8,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
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
