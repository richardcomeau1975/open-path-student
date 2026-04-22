"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../../../../lib/api";
import { useAdmin } from "../../../../../lib/admin";
import FeatureCard from "../../../../../components/V2FeatureCard";
import BackButton from "../../../../../components/BackButton";
import AdminToolbar from "../../../../../components/AdminToolbar";

export default function TopicDashboard() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const { isAdmin } = useAdmin();
  const [dashboard, setDashboard] = useState(null);
  const [segments, setSegments] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    async function load() {
      try {
        const token = await getToken();
        const [data, content] = await Promise.all([
          apiFetch(`/api/topics/${topicId}/dashboard`, {}, token),
          apiFetch(`/api/topics/${topicId}/content`, {}, token).catch(() => null),
        ]);
        setDashboard(data);
        setSegments(content?.lecture_segments || []);
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

  // Filter Visual Overview out of the FeatureCard grid — it's replaced by the Topic Introduction section below.
  const gridFeatures = features.filter((f) => f.key !== "visual_overview");

  return (
    <div>
        <div style={{ position: 'fixed', top: 12, right: 16, background: '#8B6914', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, zIndex: 9999, letterSpacing: '0.5px' }}>v2</div>
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

      {isAdmin && (
        <AdminToolbar topicId={topicId} outputType="learning_asset" label="Learning Asset"
          showTestPrompt={true} downstreamLabel="Generate all downstream ↓" accept=".txt,.md,.yaml,.yml"
          onRefresh={() => setRefreshKey(k => k + 1)} />
      )}

      {/* ──────── Topic Introduction ──────── */}
      <div style={{
        background: '#ffffff', border: '1px solid #E8E4DA', borderRadius: 12,
        padding: '28px 32px', marginBottom: 32,
      }}>
        <div style={{ fontSize: 13, color: '#8B6914', fontWeight: 500, letterSpacing: '0.5px', marginBottom: 16 }}>
          TOPIC INTRODUCTION
        </div>

        {/* Layer 1: Children's Question */}
        <div style={{
          fontFamily: "var(--font-display), 'Lora', serif",
          fontSize: 22, fontWeight: 600, fontStyle: 'italic',
          color: '#1a1a1a', lineHeight: 1.4,
          marginBottom: 20,
        }}>
          [Children's question TBD — e.g. "What's at the bottom of the ocean — and why was everyone wrong about it for centuries?"]
        </div>

        {/* Layer 2: What Knowing This Means */}
        <div style={{
          fontSize: 15, color: '#4a4a4a', lineHeight: 1.7,
          marginBottom: 24, paddingBottom: 20,
          borderBottom: '1px solid #E8E4DA',
        }}>
          [Capability statement TBD — e.g. "After this, you'll be able to explain why the deepest part of the ocean isn't in the middle — and what that tells you about how the entire ocean floor moves."]
        </div>

        {/* Layer 3: Segment Map */}
        {segments.length === 0 ? (
          <p style={{ color: '#6B6B6B', fontSize: 14 }}>
            Segment map will appear here once segments are generated.
          </p>
        ) : (
          segments.map((seg, i) => (
            <div key={seg.number} style={{ marginBottom: i < segments.length - 1 ? 24 : 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 8,
              }}>
                Segment {seg.number}: [Question TBD]
              </div>
              <div style={{ paddingLeft: 16 }}>
                <div style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 1.6 }}>
                  • [Topic bullet TBD]
                </div>
                <div style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 1.6 }}>
                  • [Topic bullet TBD]
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
        }}
      >
        {gridFeatures.map((feature) => (
          <FeatureCard key={feature.key} feature={feature} />
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <span
          onClick={() => router.push(`/dashboard/${courseId}/${topicId}/v2/progress`)}
          style={{ fontSize: 13, color: "#8B6914", cursor: "pointer", textDecoration: "underline" }}
        >
          View Progress
        </span>
      </div>
    </div>
  );
}
