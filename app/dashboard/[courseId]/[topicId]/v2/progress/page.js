'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

export default function ProgressPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    async function loadProgress() {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/walkthrough/${topicId}/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setProgress(data);
      } catch (err) {
        console.error('Failed to load progress:', err);
      }
      setLoading(false);
    }
    loadProgress();
  }, []);

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const ar = progress?.active_recall || {};
  const wt = progress?.walkthrough || {};

  return (
    <div style={{ padding: '2rem', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ position: 'fixed', top: 12, right: 16, background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, zIndex: 9999, letterSpacing: '0.5px' }}>v2</div>
      <div onClick={() => router.back()} style={{ fontSize: 13, color: '#6B6B6B', cursor: 'pointer', marginBottom: '1rem' }}>
        &larr; Back
      </div>

      <div style={{ fontSize: 13, color: '#8B6914', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        Progress Tracker
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: '2rem' }}>
        Where You Are
      </h1>

      {/* Walkthrough progress */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: '#8B6914', marginBottom: '0.75rem' }}>
        Knowledge Walkthrough
      </h2>
      <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        {wt.sessions > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: '#6B6B6B' }}>Sessions</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{wt.sessions}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: '#6B6B6B' }}>Exchanges</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>~{wt.total_exchanges}</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, color: '#6B6B6B' }}>Not started yet.</div>
        )}
      </div>

      {/* Active Recall progress */}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: '#8B6914', marginBottom: '0.75rem' }}>
        Active Recall
      </h2>
      <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        {ar.total_questions > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: '#6B6B6B' }}>Questions answered</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{ar.answered} / {ar.total_questions}</span>
            </div>
            {ar.evaluated && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#6B6B6B' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4A7C59', display: 'inline-block' }} />
                    Solid
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{ar.solid}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#6B6B6B' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#C4972A', display: 'inline-block' }} />
                    Needs work
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{ar.fuzzy}</span>
                </div>
              </>
            )}
            {!ar.evaluated && (
              <div style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>
                Not evaluated yet — click Evaluate on the Active Recall page.
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 14, color: '#6B6B6B' }}>Not started yet.</div>
        )}
      </div>
    </div>
  );
}
