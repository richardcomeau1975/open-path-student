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
  const unlocked = (n) => n === 1 || etStatuses[n - 1] === 'pass';

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
      <Header />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <BackButton href={`/v3/${courseId}`} />
        <h1 style={{ fontFamily: "var(--font-display), 'Lora', serif", fontSize: 26, fontWeight: 600, margin: '16px 0 6px' }}>
          {content?.name || 'Topic'}
        </h1>
        <p style={{ color: '#9B8E82', fontSize: 14, marginBottom: 28 }}>
          Work through each lecture in order. Talk it through in Office Hours, then pass the Exit Ticket to open the next one.
        </p>

        {loading ? (
          <p style={{ color: '#9B8E82' }}>Loading…</p>
        ) : segments.length === 0 ? (
          <p style={{ color: '#6B6B6B' }}>The lectures for this topic haven't been built yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {segments.map((seg) => {
              const open = unlocked(seg.number);
              const passed = etStatuses[seg.number] === 'pass';
              return (
                <div
                  key={seg.number}
                  onClick={() => open && router.push(`/v3/${courseId}/${topicId}/segment/${seg.number}`)}
                  style={{
                    background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
                    padding: '18px 22px', cursor: open ? 'pointer' : 'default',
                    opacity: open ? 1 : 0.45,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      Lecture {seg.number}
                      {passed && <span style={{ color: '#4A7C59', fontSize: 13, marginLeft: 10 }}>✓ done</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B6B6B' }}>{fmt(seg.timestamps?.duration)}</div>
                  </div>
                  {seg.anchors?.[0] && (
                    <div style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>{seg.anchors[0]}</div>
                  )}
                  {!open && (
                    <div style={{ fontSize: 12, color: '#C4972A', marginTop: 6 }}>
                      Finish the previous lecture's Exit Ticket first
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Topic-level tools */}
        <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
          <div
            onClick={() => router.push(`/v3/${courseId}/${topicId}/testme`)}
            style={{
              flex: 1, background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
              padding: '18px 22px', cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600 }}>Test Me</div>
            <div style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>
              Exam-style questions on everything in this topic.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
