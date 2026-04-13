'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../../../../../lib/api';
import Header from '../../../../../../components/Header';
import BackButton from '../../../../../../components/BackButton';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function LecturePlayerPage() {
  const { courseId, topicId, segmentNum } = useParams();
  const segIdx = parseInt(segmentNum, 10) - 1;
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();

  const [segments, setSegments] = useState(null);
  const [seg, setSeg] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeAnchor, setActiveAnchor] = useState('');
  const [audioFinished, setAudioFinished] = useState(false);

  // Q&A state
  const [qaMode, setQaMode] = useState(false);
  const [qaInput, setQaInput] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [qaResponse, setQaResponse] = useState('');
  const [qaCount, setQaCount] = useState(0);
  const MAX_QUESTIONS = 5;

  // Audio queue for Q&A TTS
  const audioQueueRef = useRef([]);
  const isPlayingQaRef = useRef(false);
  const qaAudioRef = useRef(null);

  const audioRef = useRef(null);
  const imageRef = useRef(null);
  const anchorRef = useRef(null);

  // Load content
  useEffect(() => {
    if (!isLoaded) return;
    async function load() {
      try {
        const token = await getToken();
        const content = await apiFetch(`/api/topics/${topicId}/content`, {}, token);
        const segs = content.lecture_segments || [];
        setSegments(segs);
        if (segs[segIdx]) setSeg(segs[segIdx]);
      } catch (err) {
        console.error('Failed to load lecture:', err);
      }
    }
    load();
  }, [topicId, segIdx, getToken, isLoaded]);

  // Audio time update — anchor sync
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || !seg) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);

    const anchors = seg.timestamps?.anchors || [];
    let active = '';
    for (const a of anchors) {
      const start = a.start_time || a.time || 0;
      const end = a.end_time || (start + 5);
      if (t >= start - 0.3 && t <= end + 1.5) {
        active = a.text;
        break;
      }
    }

    if (active !== activeAnchor) {
      // GSAP-style fade
      if (anchorRef.current) {
        anchorRef.current.style.transition = 'opacity 0.3s, transform 0.3s';
        anchorRef.current.style.opacity = '0';
        anchorRef.current.style.transform = 'translateY(-8px)';
        setTimeout(() => {
          setActiveAnchor(active);
          if (anchorRef.current && active) {
            anchorRef.current.style.transform = 'translateY(10px)';
            requestAnimationFrame(() => {
              if (anchorRef.current) {
                anchorRef.current.style.opacity = '1';
                anchorRef.current.style.transform = 'translateY(0)';
              }
            });
          }
        }, 300);
      } else {
        setActiveAnchor(active);
      }
    }
  }, [seg, activeAnchor]);

  // Play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  // Progress bar click
  const handleProgressClick = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  // Format time
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Q&A audio queue
  const playNextQaChunk = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingQaRef.current = false;
      return;
    }
    isPlayingQaRef.current = true;
    const b64 = audioQueueRef.current.shift();
    const audio = new Audio(`data:audio/mp3;base64,${b64}`);
    qaAudioRef.current = audio;
    audio.onended = () => playNextQaChunk();
    audio.onerror = () => playNextQaChunk();
    audio.play().catch(() => playNextQaChunk());
  }, []);

  const enqueueQaAudio = useCallback((b64) => {
    audioQueueRef.current.push(b64);
    if (!isPlayingQaRef.current) playNextQaChunk();
  }, [playNextQaChunk]);

  // Q&A submit
  const sendQuestion = useCallback(async () => {
    const q = qaInput.trim();
    if (!q || qaLoading || qaCount >= MAX_QUESTIONS) return;

    // Pause lecture
    if (audioRef.current && playing) {
      audioRef.current.pause();
      setPlaying(false);
    }

    setQaLoading(true);
    setQaInput('');
    setQaResponse('');
    setQaCount(c => c + 1);

    const token = await getToken();

    try {
      const res = await fetch(`${API}/api/voice/podcast/${topicId}/ask-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          text: q,
          pausedAt: currentTime,
          history: [],
          segment_number: parseInt(segmentNum, 10),
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullAnswer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text_chunk') {
              fullAnswer += event.text + ' ';
              setQaResponse(fullAnswer);
            } else if (event.type === 'audio_chunk') {
              enqueueQaAudio(event.audio);
            } else if (event.type === 'answer') {
              fullAnswer = event.text;
              setQaResponse(fullAnswer);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Q&A failed:', err);
      setQaResponse('Sorry, something went wrong.');
    }

    setQaLoading(false);
  }, [qaInput, qaLoading, qaCount, playing, currentTime, topicId, segmentNum, getToken, enqueueQaAudio]);

  // Navigate
  const prevSeg = segIdx > 0 ? segIdx : null;
  const nextSeg = segments && segIdx < segments.length - 1 ? segIdx + 2 : null;

  if (!seg) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
        <Header />
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
          <p style={{ color: '#888' }}>Loading...</p>
        </div>
      </div>
    );
  }

  const title = seg.anchors?.[0] || `Segment ${seg.number}`;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
      <Header />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        <BackButton href={`/dashboard/${courseId}/${topicId}/lectures`} />

        <div style={{ fontSize: 13, color: '#666', marginTop: 12 }}>
          Lecture {seg.number}{segments ? ` of ${segments.length}` : ''}
        </div>

        {/* Image area */}
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '3/2',
          borderRadius: 12, overflow: 'hidden', marginTop: 12, marginBottom: 16,
          background: '#111',
        }}>
          {seg.image && (
            <img
              ref={imageRef}
              src={seg.image}
              alt=""
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                opacity: playing ? 0.15 : 1,
                transition: 'opacity 0.6s ease',
              }}
            />
          )}
          {/* Anchor text overlay */}
          {activeAnchor && (
            <div
              ref={anchorRef}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px 32px',
              }}
            >
              <p style={{
                fontFamily: "var(--font-display), 'Lora', serif",
                fontSize: 22, fontWeight: 500, fontStyle: 'italic',
                color: '#e5e5e5', textAlign: 'center', lineHeight: 1.4,
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              }}>
                {activeAnchor}
              </p>
            </div>
          )}
        </div>

        {/* Audio element */}
        <audio
          ref={audioRef}
          src={seg.audio || ''}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onEnded={() => { setPlaying(false); setAudioFinished(true); }}
          preload="auto"
        />

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={togglePlay}
            disabled={!seg.audio}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: seg.audio ? '#2563eb' : '#333',
              border: 'none', color: '#fff', fontSize: 18, cursor: seg.audio ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            {playing ? '⏸' : '▶'}
          </button>

          <div
            onClick={handleProgressClick}
            style={{
              flex: 1, height: 6, background: '#222', borderRadius: 3,
              cursor: 'pointer', position: 'relative',
            }}
          >
            <div style={{
              width: `${duration ? (currentTime / duration) * 100 : 0}%`,
              height: '100%', background: '#2563eb', borderRadius: 3,
              transition: 'width 0.1s',
            }} />
          </div>

          <span style={{ fontSize: 12, color: '#666', flexShrink: 0 }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        </div>

        {/* Q&A section */}
        <div style={{ borderTop: '1px solid #222', paddingTop: 16, marginBottom: 16 }}>
          {qaResponse && (
            <div style={{
              background: '#111', border: '1px solid #222', borderRadius: 8,
              padding: '12px 16px', fontSize: 14, color: '#ccc', lineHeight: 1.5,
              marginBottom: 12, whiteSpace: 'pre-wrap',
            }}>
              {qaResponse}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={qaInput}
              onChange={e => setQaInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }}
              placeholder={qaCount >= MAX_QUESTIONS ? 'Question limit reached' : 'Ask about what you just heard...'}
              disabled={qaLoading || qaCount >= MAX_QUESTIONS}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                border: '1px solid #333', background: '#111',
                color: '#e5e5e5', fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={sendQuestion}
              disabled={!qaInput.trim() || qaLoading || qaCount >= MAX_QUESTIONS}
              style={{
                padding: '10px 16px', borderRadius: 8,
                background: qaInput.trim() ? '#2563eb' : '#222',
                color: qaInput.trim() ? '#fff' : '#666',
                border: 'none', cursor: qaInput.trim() ? 'pointer' : 'default',
                fontSize: 14, fontWeight: 500, flexShrink: 0,
              }}
            >
              {qaLoading ? '...' : 'Ask'}
            </button>
          </div>
          {qaCount > 0 && qaCount < MAX_QUESTIONS && (
            <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
              {MAX_QUESTIONS - qaCount} question{MAX_QUESTIONS - qaCount !== 1 ? 's' : ''} remaining
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid #222', paddingTop: 16,
        }}>
          {prevSeg !== null ? (
            <button
              onClick={() => router.push(`/dashboard/${courseId}/${topicId}/lectures/${prevSeg}`)}
              style={{
                padding: '8px 16px', borderRadius: 8, background: '#111',
                border: '1px solid #333', color: '#888', cursor: 'pointer', fontSize: 13,
              }}
            >
              ← Previous
            </button>
          ) : <div />}

          {audioFinished && (
            <button
              onClick={() => router.push(`/dashboard/${courseId}/${topicId}/lectures/${seg.number}/tutorial`)}
              style={{
                padding: '10px 20px', borderRadius: 8, background: '#2563eb',
                border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              }}
            >
              Next: Tutorial →
            </button>
          )}

          {nextSeg !== null ? (
            <button
              onClick={() => router.push(`/dashboard/${courseId}/${topicId}/lectures/${nextSeg}`)}
              style={{
                padding: '8px 16px', borderRadius: 8, background: '#111',
                border: '1px solid #333', color: '#888', cursor: 'pointer', fontSize: 13,
              }}
            >
              Next →
            </button>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}
