"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import UploadZone from "../../../../components/UploadZone";
import BackButton from "../../../../components/BackButton";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function UploadPage() {
  const { courseId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const [files, setFiles] = useState([]);
  const [topicName, setTopicName] = useState("");
  const [weekNumber, setWeekNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!topicName.trim()) {
      setError("Please enter a topic name.");
      return;
    }
    if (files.length === 0) {
      setError("Please add at least one file.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("course_id", courseId);
      formData.append("name", topicName.trim());
      if (weekNumber) {
        formData.append("week_number", weekNumber);
      }
      files.forEach((file) => {
        formData.append("files", file);
      });

      const res = await fetch(`${API_URL}/api/topics`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Upload failed");
      }

      const data = await res.json();
      router.push(`/dashboard/${courseId}/${data.topic.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <BackButton href={`/dashboard/${courseId}`} />
      <h1
        style={{
          fontFamily: "var(--font-display), 'Lora', serif",
          fontSize: "28px",
          fontWeight: 600,
          marginBottom: "24px",
        }}
      >
        Upload New Materials
      </h1>

      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          borderRadius: "var(--radius-lg)",
          padding: "32px",
          maxWidth: "640px",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 500,
              marginBottom: "6px",
              color: "var(--text-primary)",
            }}
          >
            Topic Name
          </label>
          <input
            type="text"
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            placeholder="e.g. Intelligence — What IQ Actually Measures"
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid var(--border-card)",
              borderRadius: "var(--radius)",
              fontSize: "14px",
              fontFamily: "var(--font-body), 'Inter', sans-serif",
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 500,
              marginBottom: "6px",
              color: "var(--text-primary)",
            }}
          >
            Week Number{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <input
            type="number"
            value={weekNumber}
            onChange={(e) => setWeekNumber(e.target.value)}
            placeholder="e.g. 7"
            style={{
              width: "120px",
              padding: "10px 14px",
              border: "1px solid var(--border-card)",
              borderRadius: "var(--radius)",
              fontSize: "14px",
              fontFamily: "var(--font-body), 'Inter', sans-serif",
              outline: "none",
            }}
          />
        </div>

        <UploadZone files={files} setFiles={setFiles} />

        {error && (
          <p
            style={{
              color: "var(--status-amber)",
              fontSize: "14px",
              marginTop: "16px",
            }}
          >
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={uploading}
          style={{
            marginTop: "24px",
            width: "100%",
            backgroundColor: uploading
              ? "var(--text-muted)"
              : "var(--btn-normal)",
            color: "#ffffff",
            border: "none",
            borderRadius: "var(--radius)",
            padding: "12px 24px",
            fontFamily: "var(--font-body), 'Inter', sans-serif",
            fontWeight: 500,
            fontSize: "16px",
            cursor: uploading ? "not-allowed" : "pointer",
          }}
          onMouseOver={(e) => {
            if (!uploading)
              e.target.style.backgroundColor = "var(--btn-hover)";
          }}
          onMouseOut={(e) => {
            if (!uploading)
              e.target.style.backgroundColor = "var(--btn-normal)";
          }}
        >
          {uploading ? "Uploading..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
