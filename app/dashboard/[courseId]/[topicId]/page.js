"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../../../lib/api";
import FeatureCard from "../../../../components/FeatureCard";
import BackButton from "../../../../components/BackButton";

export default function TopicDashboard() {
  const { courseId, topicId } = useParams();
  const { getToken, isLoaded } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    async function load() {
      try {
        const token = await getToken();
        const data = await apiFetch(
          `/api/topics/${topicId}/dashboard`,
          {},
          token
        );
        setDashboard(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [topicId, getToken, isLoaded]);

  if (loading) {
    return <p style={{ color: "var(--text-muted)" }}>Loading dashboard...</p>;
  }

  if (error) {
    return <p style={{ color: "var(--status-amber)" }}>Error: {error}</p>;
  }

  if (!dashboard) return null;

  const { topic, features } = dashboard;

  return (
    <div>
      <BackButton href={`/dashboard/${courseId}`} />
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontFamily: "var(--font-display), 'Lora', serif",
            fontSize: "28px",
            fontWeight: 600,
            marginBottom: "4px",
          }}
        >
          {topic.name}
        </h1>
        {topic.week_number && (
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "14px",
            }}
          >
            Week {topic.week_number}
          </p>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
        }}
      >
        {features.map((feature) => (
          <FeatureCard key={feature.key} feature={feature} />
        ))}
      </div>

      {features.find((f) => f.key === "walkthrough" && f.state !== "not_available") && (
        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <a
            href={`/dashboard/${courseId}/${topicId}/knowledge-base`}
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              color: "#8B6914",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            View Knowledge Base
          </a>
        </div>
      )}
    </div>
  );
}
