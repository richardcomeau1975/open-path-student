'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../../../lib/api';
import Header from '../../../../components/Header';
import BackButton from '../../../../components/BackButton';

export default function V3Topic() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const [content, setContent] = useState(null);
  const [etStatuses, setEtStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch(`/api/topics/${topicId}/content`, {}, token);
        setContent(data);
        try {
          const et = await apiFetch(`/api/exit-ticket/${topicId}/status/all`, {}, token);
          setEtStatuses(et?.statuses || {});
        } catch {}
      } catch (e) {
        console.error('Failed to load topic:', e);
      }
      setLoading(false);
    })();
  }, [isLoaded, topicId]);

  const segments = content?.lecture_segments || [];
  const fmt = (s) => (s ? `~${Math.round(s / 60)} min` : '');

  const tools = [
    { label: 'Visual Overview', desc: 'Get the lay of the land before anything plays.', href: `/v3/${courseId}/${topicId}/overview` },
    { label: "How You're Tested", desc: 'Upload a real test so practice matches the real thing.', href: `/v3/${courseId}/${topicId}/howtested` },
    { label: 'Test Me', desc: 'Exam-style questions on everything in this topic.', href: `/v3/${courseId}/${topicId}/testme` },
    { label: 'My Notes', desc: 'Every note you earned, in one chart.', href: `/v3/${courseId}/${topicId}/notes` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
      <Header />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <BackButton href={`/v3/${courseId}`} />
        <h1 style={{ fontFamily: "var(--font-display), 'Lora', serif", fontSize: 26, fontWeight: 600, margin: '16px 0 6px' }}>
          {content?.name || 'Topic'}
        </h1>
        <p style={{ color: '#9B8E82', fontSize: 14, marginBottom: 28 }}>
          Start anywhere. Each lecture has its own walkthrough, gate, and notes.
        </p>

        {loading ? (
          <p style={{ color: '#9B8E82' }}>Loading…</p>
        ) : segments.length === 0 ? (
          <p style={{ color: '#6B6B6B' }}>The lectures for this topic haven't been built yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {segments.map((seg) => {
              const passed = etStatuses[seg.number] === 'pass';
              const isOpen = !!expanded[seg.number];
              return (
                <div
                  key={seg.number}
                  onClick={() => router.push(`/v3/${courseId}/${topicId}/segment/${seg.number}`)}
                  style={{
                    background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
                    padding: '18px 22px', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      {seg.title && (
                        <div style={{ fontSize: 11, color: '#9B8E82', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                          Lecture {seg.number}
                        </div>
                      )}
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {seg.title || `Lecture ${seg.number}`}
                        {passed && <span style={{ color: '#4A7C59', fontSize: 13, marginLeft: 10 }}>✓ done</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6B6B6B', flexShrink: 0, marginLeft: 12 }}>{fmt(seg.timestamps?.duration)}</div>
                  </div>
                  {seg.outcomes?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded((prev) => ({ ...prev, [seg.number]: !prev[seg.number] }));
                        }}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          fontSize: 13, color: '#8B6914', display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <span style={{
                          display: 'inline-block', transition: 'transform 0.15s',
                          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}>›</span>
                        By the end of this, you'll be able to…
                      </button>
                      {isOpen && (
                        <div style={{ marginTop: 8, paddingLeft: 14 }}>
                          {seg.outcomes.map((o, i) => (
                            <div key={i} style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.6 }}>{o}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Topic-level tools */}
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {tools.map((tool) => (
            <div
              key={tool.label}
              onClick={() => router.push(tool.href)}
              style={{
                background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
                padding: '18px 22px', cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600 }}>{tool.label}</div>
              <div style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>{tool.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
