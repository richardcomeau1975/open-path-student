'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Header from '../../../../../components/Header';
import BackButton from '../../../../../components/BackButton';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function V3HowTested() {
  const { courseId, topicId } = useParams();
  const { getToken, isLoaded } = useAuth();
  const [analysis, setAnalysis] = useState(null);
  const [formatDescription, setFormatDescription] = useState(null);
  const [exists, setExists] = useState(false);
  const [inherited, setInherited] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function fetchAnalysis() {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/topics/${topicId}/exam/analysis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAnalysis(data.analysis || null);
      setFormatDescription(data.format_description || null);
      setExists(!!data.exists);
      setInherited(!!data.inherited);
    } catch (e) {
      console.error('Failed to load exam analysis:', e);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!isLoaded) return;
    fetchAnalysis();
  }, [isLoaded, topicId]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/api/topics/${topicId}/exam/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAnalysis();
    } catch (err) {
      setError('Upload failed — try a different file or try again.');
      console.error(err);
    }
    setUploading(false);
    e.target.value = '';
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
      <Header />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <BackButton href={`/v3/${courseId}/${topicId}`} />
        <h1 style={{ fontFamily: "var(--font-display), 'Lora', serif", fontSize: 24, fontWeight: 600, margin: '16px 0 8px' }}>
          How You're Tested
        </h1>
        <p style={{ color: '#6B6B6B', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Upload a real test from this course — a past exam, a sample quiz, anything the professor has given out.
          The questions in Test Me will match how this course actually tests you.
        </p>

        {loading ? (
          <p style={{ color: '#9B8E82' }}>Loading…</p>
        ) : (
          <>
            <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                {exists
                  ? inherited
                    ? formatDescription
                      ? `Your test format: ${formatDescription} (carried over from a previous topic). Upload a test from this topic to make it exact.`
                      : 'A test format is carried over from a previous topic. Upload one from this topic to make it exact.'
                    : formatDescription
                      ? `Your test format: ${formatDescription}`
                      : 'A sample test has been analyzed for this topic.'
                  : 'No sample test yet — upload one below.'}
              </div>
            </div>

            <label style={{
              display: 'inline-block', padding: '12px 24px', borderRadius: 8,
              background: uploading ? '#E8E4DA' : '#8B6914',
              color: uploading ? '#9B8E82' : '#fff',
              cursor: uploading ? 'default' : 'pointer',
              fontSize: 14, fontWeight: 500,
            }}>
              {uploading ? 'Analyzing your test…' : exists ? 'Upload a different test' : 'Upload a sample test'}
              <input
                type="file"
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt"
                disabled={uploading}
                onChange={handleUpload}
                style={{ display: 'none' }}
              />
            </label>
            {error && <div style={{ color: '#c0392b', fontSize: 13, marginTop: 10 }}>{error}</div>}

            {exists && analysis && (
              <div style={{ marginTop: 24 }}>
                <button
                  onClick={() => setShowAnalysis((s) => !s)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #E8E4DA',
                    background: '#fff', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  {showAnalysis ? 'Hide the breakdown' : 'See the full breakdown'}
                </button>
                {showAnalysis && (
                  <div style={{
                    marginTop: 12, background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12,
                    padding: '20px 24px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#4a4a4a',
                  }}>
                    {analysis}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
