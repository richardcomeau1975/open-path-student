"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../../../lib/api";
import { useAdmin } from "../../../../lib/admin";
import FeatureCard from "../../../../components/FeatureCard";
import BackButton from "../../../../components/BackButton";
import AdminToolbar from "../../../../components/AdminToolbar";

export default function TopicDashboard() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const { isAdmin } = useAdmin();
  const [dashboard, setDashboard] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
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
  }, [topicId, getToken, isLoaded, refreshKey]);

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
      {/* v1/v2 toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        marginBottom: 8, gap: 8,
      }}>
        <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>v1</span>
        <div
          onClick={() => router.push(`/dashboard/${courseId}/${topicId}/v2`)}
          style={{
            width: 44, height: 24, borderRadius: 12,
            background: '#8B6914', cursor: 'pointer',
            position: 'relative',
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff', border: '1px solid #8B6914',
            position: 'absolute', top: 3, left: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }} />
        </div>
        <span style={{ fontSize: 12, color: '#9B8E82', fontWeight: 500 }}>v2</span>
      </div>
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

      {isAdmin && (
        <AdminToolbar topicId={topicId} outputType="learning_asset" label="Learning Asset"
          showTestPrompt={true} downstreamLabel="Generate all downstream ↓" accept=".txt,.md,.yaml,.yml"
          onRefresh={() => setRefreshKey(k => k + 1)} />
      )}

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

      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <span
          onClick={() => router.push(`/dashboard/${courseId}/${topicId}/progress`)}
          style={{ fontSize: 13, color: "#8B6914", cursor: "pointer", textDecoration: "underline" }}
        >
          View Progress
        </span>
      </div>

    </div>
  );
}
