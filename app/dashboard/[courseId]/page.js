"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../../lib/api";
import TopicCard from "../../../components/TopicCard";
import BackButton from "../../../components/BackButton";

export default function TopicsPage() {
  const { courseId } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    async function load() {
      try {
        const token = await getToken();
        const data = await apiFetch(
          `/api/courses/${courseId}/topics`,
          {},
          token
        );
        setTopics(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, getToken, isLoaded]);

  if (loading) {
    return <p style={{ color: "var(--text-muted)" }}>Loading topics...</p>;
  }

  if (error) {
    return <p style={{ color: "var(--status-amber)" }}>Error: {error}</p>;
  }

  return (
    <div>
      <BackButton href="/dashboard" />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display), 'Lora', serif",
            fontSize: "28px",
            fontWeight: 600,
          }}
        >
          Topics
        </h1>
        <button
          onClick={() => router.push(`/dashboard/${courseId}/upload`)}
          style={{
            backgroundColor: "var(--btn-normal)",
            color: "#ffffff",
            border: "none",
            borderRadius: "var(--radius)",
            padding: "10px 20px",
            fontFamily: "var(--font-body), 'Inter', sans-serif",
            fontWeight: 500,
            fontSize: "14px",
            cursor: "pointer",
          }}
          onMouseOver={(e) =>
            (e.target.style.backgroundColor = "var(--btn-hover)")
          }
          onMouseOut={(e) =>
            (e.target.style.backgroundColor = "var(--btn-normal)")
          }
        >
          Upload New Materials
        </button>
      </div>

      {topics.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <p style={{ color: "var(--text-muted)" }}>
            No topics yet. Upload materials to get started.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} courseId={courseId} />
          ))}
        </div>
      )}
    </div>
  );
}
