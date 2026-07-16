'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../../../../lib/api';
import Header from '../../../../../components/Header';
import BackButton from '../../../../../components/BackButton';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function NotesChartPage() {
  const { courseId, topicId } = useParams();
  const { getToken, isLoaded } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch(`/api/notes/${topicId}/chart`, {}, token);
        setNotes(data?.notes || []);
      } catch (e) {
        console.error('Failed to load notes:', e);
      }
      setLoading(false);
    })();
  }, [isLoaded, topicId]);

  async function downloadNotes() {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/notes/${topicId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notes.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
  }

  const bySegment = {};
  for (const n of notes) {
    (bySegment[n.segment_number] = bySegment[n.segment_number] || []).push(n);
  }
  const segmentNumbers = Object.keys(bySegment).map(Number).sort((a, b) => a - b);

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
      <Header />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <BackButton href={`/v3/${courseId}/${topicId}`} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '16px 0 6px' }}>
          <h1 style={{ fontFamily: "var(--font-display), 'Lora', serif", fontSize: 26, fontWeight: 600, margin: 0 }}>
            My Notes
          </h1>
          {notes.length > 0 && (
            <button
              onClick={downloadNotes}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #E8E4DA',
                background: '#fff', color: '#6B6B6B', fontSize: 13, cursor: 'pointer',
              }}
            >
              ↓ Download my notes
            </button>
          )}
        </div>
        <p style={{ color: '#9B8E82', fontSize: 14, marginBottom: 28 }}>
          Every line here is one you earned.
        </p>

        {loading ? (
          <p style={{ color: '#9B8E82' }}>Loading…</p>
        ) : notes.length === 0 ? (
          <p style={{ color: '#6B6B6B' }}>No notes yet — open a lecture and choose Make My Notes.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {segmentNumbers.map((segNum) => (
              <div key={segNum}>
                <div style={{
                  fontSize: 13, color: '#9B8E82', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
                }}>
                  Lecture {segNum}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {bySegment[segNum].map((n) => (
                    <div key={n.id} style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ fontSize: 12, color: '#9B8E82', marginBottom: 6 }}>{n.question}</div>
                      <div style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.6 }}>{n.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
