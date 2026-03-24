"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../../lib/api";
import { useAdmin } from "../../../lib/admin";
import TopicCard from "../../../components/TopicCard";
import BackButton from "../../../components/BackButton";

export default function TopicsPage() {
  const { courseId } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const { isAdmin } = useAdmin();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [testTopicName, setTestTopicName] = useState("");
  const [creating, setCreating] = useState(false);

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

  async function createTestTopic() {
    if (!testTopicName.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API_URL}/api/admin-topics/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: testTopicName.trim(), course_id: courseId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTestTopicName("");
      setShowCreateTest(false);
      // Reload topics
      const data = await apiFetch(`/api/courses/${courseId}/topics`, {}, token);
      setTopics(data);
    } catch (err) {
      setError(err.message);
    }
    setCreating(false);
  }

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
        {isAdmin && (
          <button
            onClick={() => setShowCreateTest(!showCreateTest)}
            style={{
              backgroundColor: "transparent",
              color: "#9B8E82",
              border: "1px solid #E8E4DA",
              borderRadius: "var(--radius)",
              padding: "10px 20px",
              fontFamily: "var(--font-body), 'Inter', sans-serif",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            + Test Topic
          </button>
        )}
      </div>

      {isAdmin && showCreateTest && (
        <div style={{
          background: "#f5f0e8",
          border: "1px solid #E8E4DA",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}>
          <input
            value={testTopicName}
            onChange={(e) => setTestTopicName(e.target.value)}
            placeholder="Test topic name"
            onKeyDown={(e) => e.key === "Enter" && createTestTopic()}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #E8E4DA",
              borderRadius: 8,
              fontSize: 14,
              fontFamily: "Inter, sans-serif",
            }}
          />
          <button
            onClick={createTestTopic}
            disabled={creating || !testTopicName.trim()}
            style={{
              background: "#9B8E82",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      )}

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
