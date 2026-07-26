'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../../../../lib/api';
import { useAdmin } from '../../../../../lib/admin';
import Header from '../../../../../components/Header';
import BackButton from '../../../../../components/BackButton';
import AdminToolbar from '../../../../../components/AdminToolbar';

export default function LecturesPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const { isAdmin } = useAdmin();
  const [segments, setSegments] = useState(null);
  const [topicName, setTopicName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openSeg, setOpenSeg] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    async function load() {
      try {
        const token = await getToken();
        const content = await apiFetch(`/api/topics/${topicId}/content`, {}, token);
        setTopicName(content.name || '');
        setSegments(content.lecture_segments || null);
      } catch (err) {
        console.error('Failed to load lectures:', err);
      }
      setLoading(false);
    }
    load();
  }, [topicId, getToken, isLoaded, refreshKey]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
        <Header />
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
          <p style={{ color: '#9B8E82' }}>Loading lectures...</p>
        </div>
      </div>
    );
  }

  // Format duration from seconds
  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.round(seconds / 60);
    return `~${mins} min`;
  };

  // Calculate total duration
  const totalDuration = segments
    ? segments.reduce((sum, seg) => sum + (seg.timestamps?.duration || 0), 0)
    : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
      <Header />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        <BackButton href={`/dashboard/${courseId}/${topicId}`} />

        <h1 style={{
          fontFamily: "var(--font-display), 'Lora', serif",
          fontSize: 24, fontWeight: 600, marginBottom: 4, marginTop: 16,
        }}>
          Lectures
        </h1>
        {segments && (
          <p style={{ color: '#9B8E82', fontSize: 14, marginBottom: 24 }}>
            {segments.length} segment{segments.length !== 1 ? 's' : ''}
            {totalDuration > 0 ? ` · ${formatDuration(totalDuration)} total` : ''}
          </p>
        )}

        {isAdmin && (
          <div style={{ marginBottom: 24 }}>
            <AdminToolbar
              topicId={topicId}
              outputType="podcast_script"
              label="Lecture Script"
              showTestPrompt={true}
              downstreamLabel="Regenerate script + segments + audio + images ↓"
              accept=".txt,.md"
              onRefresh={() => setRefreshKey(k => k + 1)}
            />
            <AdminToolbar
              topicId={topicId}
              outputType="podcast_audio"
              label="Lecture Audio (all segments)"
              accept=".wav,.mp3"
              onRefresh={() => setRefreshKey(k => k + 1)}
            />
          </div>
        )}

        {!segments ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B6B6B' }}>
            <p>No lecture segments generated yet.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Generate a lecture script from the admin toolbar to create segments.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {segments.map((seg) => {
              // Title comes from the learning asset via the manifest. Never from
              // the script's [ANCHOR] text — that's on-screen playback copy.
              const title = seg.title || null;
              const questions = seg.questions?.length ? seg.questions : null;
              const hasDetail = !!(questions || seg.takeaway);
              const isOpen = openSeg === seg.number;
              const duration = formatDuration(seg.timestamps?.duration);

              return (
                <div
                  key={seg.number}
                  onMouseEnter={() => hasDetail && setOpenSeg(seg.number)}
                  onMouseLeave={() => setOpenSeg(null)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #E8E4DA',
                    borderRadius: 12,
                    padding: '20px 24px',
                  }}
                >
                  {/* Lecture link */}
                  <div
                    onClick={() => router.push(`/dashboard/${courseId}/${topicId}/lectures/${seg.number}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        fontSize: 20, color: seg.audio ? '#8B6914' : '#444',
                      }}>
                        ▶
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>
                          Lecture {seg.number}
                        </div>
                        {title && (
                          <div style={{
                            fontSize: 13, color: '#6B6B6B', marginTop: 2, maxWidth: 500,
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>
                            {title}
                          </div>
                        )}
                        {duration && (
                          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}>
                            {duration}
                          </div>
                        )}
                        {hasDetail && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenSeg(isOpen ? null : seg.number);
                            }}
                            style={{
                              fontSize: 12, color: '#9B8E82', marginTop: 6,
                              cursor: 'pointer', userSelect: 'none',
                            }}
                          >
                            {questions
                              ? `${questions.length} question${questions.length === 1 ? '' : 's'}`
                              : "What you'll be able to explain"} {isOpen ? '⌃' : '⌄'}
                          </div>
                        )}
                        {isOpen && hasDetail && (
                          <div style={{
                            marginTop: 8, maxWidth: 500, fontSize: 13,
                            color: '#4A4A4A', lineHeight: 1.5,
                          }}>
                            {questions ? (
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {questions.map((q, i) => (
                                  <li key={i} style={{ marginBottom: 4 }}>{q}</li>
                                ))}
                              </ul>
                            ) : (
                              <p style={{ margin: 0 }}>{seg.takeaway}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tutorial link */}
                  <div
                    onClick={() => router.push(`/dashboard/${courseId}/${topicId}/lectures/${seg.number}/tutorial`)}
                    style={{
                      marginTop: 12, paddingTop: 12, borderTop: '1px solid #f5f0e8',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14, color: '#9B8E82' }}>○</span>
                    <span style={{ fontSize: 13, color: '#9B8E82' }}>Tutorial</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
