'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../../../../../../lib/api';
import Header from '../../../../../../../components/Header';
import BackButton from '../../../../../../../components/BackButton';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const TABS = [
  { id: 'listen', label: 'Listen' },
  { id: 'office-hours', label: 'Office Hours' },
  { id: 'exit-ticket', label: 'Exit Ticket' },
  { id: 'notes', label: 'Notes' },
  { id: 'exam-questions', label: 'Exam-Style Questions' },
];

export default function SegmentContainerPage() {
  const { courseId, topicId, segmentNum } = useParams();
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const segIdx = parseInt(segmentNum, 10) - 1;

  // ── Shared state ──
  const [seg, setSeg] = useState(null);
  const [totalSegments, setTotalSegments] = useState(null);
  const [activeTab, setActiveTab] = useState('listen');
  const [contentLoading, setContentLoading] = useState(true);

  // ── Listen state ──
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeAnchor, setActiveAnchor] = useState('');
  const anchorRef = useRef(null);

  // ── Listen Q&A state ──
  const [qaInput, setQaInput] = useState('');
  const [qaState, setQaState] = useState('idle');
  const [qaResponse, setQaResponse] = useState('');
  const [qaCount, setQaCount] = useState(0);
  const MAX_QUESTIONS = 5;
  const audioQueueRef = useRef([]);
  const isPlayingQaRef = useRef(false);
  const qaAudioRef = useRef(null);
  const fillerAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const qaLoading = qaState !== 'idle';

  // ── Office Hours state ──
  const [ohSession, setOhSession] = useState(null);
  const [ohMessages, setOhMessages] = useState([]);
  const [ohInput, setOhInput] = useState('');
  const [ohStreaming, setOhStreaming] = useState(false);
  const [ohStreamingText, setOhStreamingText] = useState('');
  const [ohStarted, setOhStarted] = useState(false);
  const messagesEndRef = useRef(null);

  // ── Notes state ──
  const [notesQuestions, setNotesQuestions] = useState(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);

  // ── Exam-Style Questions state ──
  const [quizQuestions, setQuizQuestions] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizLoaded, setQuizLoaded] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // ══════════════════════════════════════════════════════════
  // LOAD CONTENT
  // ══════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isLoaded) return;
    async function load() {
      try {
        const token = await getToken();
        const content = await apiFetch(`/api/topics/${topicId}/content`, {}, token);
        const segs = content.lecture_segments || [];
        setTotalSegments(segs.length);
        if (segs[segIdx]) setSeg(segs[segIdx]);
      } catch (err) {
        console.error('Failed to load segment content:', err);
      }
      setContentLoading(false);
    }
    load();
  }, [topicId, segIdx, getToken, isLoaded]);

  // ══════════════════════════════════════════════════════════
  // LISTEN: Audio helpers
  // ══════════════════════════════════════════════════════════

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);

    // Anchor sync
    const anchors = seg?.timestamps?.anchors || [];
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

  const handleProgressClick = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ══════════════════════════════════════════════════════════
  // LISTEN: Q&A audio queue
  // ══════════════════════════════════════════════════════════

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
    if (!isPlayingQaRef.current) {
      if (fillerAudioRef.current) {
        try { fillerAudioRef.current.pause(); } catch {}
        fillerAudioRef.current = null;
      }
      setQaState('speaking');
      playNextQaChunk();
    }
  }, [playNextQaChunk]);

  const playRandomFiller = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/voice/podcast/filler-urls`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const fillers = data.fillers || [];
      if (fillers.length === 0) return;
      const filler = fillers[Math.floor(Math.random() * fillers.length)];
      return new Promise((resolve) => {
        const audio = new Audio(filler.url);
        fillerAudioRef.current = audio;
        audio.onended = () => { fillerAudioRef.current = null; resolve(); };
        audio.onerror = () => { fillerAudioRef.current = null; resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch (e) {
      console.error('Filler playback failed:', e);
    }
  }, [getToken]);

  // ══════════════════════════════════════════════════════════
  // LISTEN: Q&A submit + recording
  // ══════════════════════════════════════════════════════════

  const submitQuestionText = useCallback(async (question) => {
    const q = question.trim();
    if (!q) return;

    if (audioRef.current && playing) {
      audioRef.current.pause();
      setPlaying(false);
    }

    setQaState('thinking');
    setQaInput('');
    setQaResponse('');
    setQaCount(c => c + 1);

    playRandomFiller();

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

    if (!isPlayingQaRef.current && audioQueueRef.current.length === 0) {
      setQaState('idle');
    }
  }, [playing, currentTime, topicId, segmentNum, getToken, enqueueQaAudio, playRandomFiller]);

  const sendQuestion = useCallback(() => {
    if (qaLoading || qaCount >= MAX_QUESTIONS) return;
    submitQuestionText(qaInput);
  }, [qaInput, qaLoading, qaCount, submitQuestionText]);

  const startRecording = useCallback(async () => {
    if (qaLoading || qaCount >= MAX_QUESTIONS) return;
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setQaState('thinking');
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const token = await getToken();
          const sttResponse = await fetch(`${API}/api/voice/transcribe`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: new Uint8Array(arrayBuffer),
          });
          const sttData = await sttResponse.json();
          if (sttData.transcript?.trim()) {
            await submitQuestionText(sttData.transcript.trim());
          } else {
            setQaState('idle');
          }
        } catch (err) {
          console.error('Transcribe failed:', err);
          setQaState('idle');
        }
      };

      mediaRecorder.start();
      setQaState('recording');
    } catch (err) {
      console.error('Mic access denied:', err);
      setQaState('idle');
    }
  }, [qaLoading, qaCount, getToken, submitQuestionText]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(() => {
    if (qaState === 'speaking') {
      const check = setInterval(() => {
        if (!isPlayingQaRef.current && audioQueueRef.current.length === 0) {
          setQaState('idle');
          clearInterval(check);
        }
      }, 300);
      return () => clearInterval(check);
    }
  }, [qaState]);

  // ══════════════════════════════════════════════════════════
  // OFFICE HOURS: session + streaming
  // ══════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeTab !== 'office-hours' || ohStarted || !isLoaded) return;
    setOhStarted(true);
    async function startSession() {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/walkthrough/${topicId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mode: 'segment_tutorial',
            segment_number: parseInt(segmentNum, 10),
          }),
        });
        const data = await res.json();
        if (data.session) {
          setOhSession(data.session);
          setOhMessages(data.session.messages || []);
          if (!data.session.messages || data.session.messages.length === 0) {
            ohSendMessage('Begin', data.session.id, token);
          }
        }
      } catch (err) {
        console.error('Failed to start Office Hours session:', err);
      }
    }
    startSession();
  }, [activeTab, isLoaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ohMessages, ohStreamingText]);

  async function ohSendMessage(text, sessionId, tokenOverride) {
    const msg = text || ohInput.trim();
    if (!msg || ohStreaming) return;
    const sid = sessionId || ohSession?.id;
    if (!sid) return;

    setOhStreaming(true);
    setOhInput('');
    setOhStreamingText('');

    if (text !== 'Begin') {
      setOhMessages(prev => [...prev, { role: 'user', content: msg }]);
    }

    const token = tokenOverride || await getToken();

    try {
      const res = await fetch(`${API}/api/walkthrough/${topicId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sid, message: msg }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

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
            if (event.type === 'text') {
              fullResponse += event.text;
              setOhStreamingText(fullResponse);
            } else if (event.type === 'done') {
              setOhMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
              setOhStreamingText('');
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Office Hours message failed:', err);
    }
    setOhStreaming(false);
  }

  const ohHandleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ohSendMessage(); }
  };

  // ══════════════════════════════════════════════════════════
  // NOTES: load lazily
  // ══════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeTab !== 'notes' || notesLoaded || !isLoaded) return;
    setNotesLoaded(true);
    setNotesLoading(true);
    async function loadNotes() {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/topics/${topicId}/notechart/questions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotesQuestions(data.questions || []);
        }
      } catch (err) {
        console.error('Failed to load notes:', err);
      }
      setNotesLoading(false);
    }
    loadNotes();
  }, [activeTab, isLoaded]);

  const getSegmentNotes = () => {
    if (!notesQuestions || notesQuestions.length === 0) return [];
    const segNum = parseInt(segmentNum, 10);
    const filtered = notesQuestions.filter(q => {
      const s = q.segment || q.section || '';
      const match = String(s).match(/(\d+)/);
      return match && parseInt(match[1], 10) === segNum;
    });
    return filtered.length > 0 ? filtered : notesQuestions;
  };

  // ══════════════════════════════════════════════════════════
  // EXAM-STYLE QUESTIONS: load lazily + helpers
  // ══════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeTab !== 'exam-questions' || quizLoaded || !isLoaded) return;
    setQuizLoaded(true);
    setQuizLoading(true);
    async function loadQuiz() {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/topics/${topicId}/quiz`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setQuizQuestions(data.questions || []);
        }
      } catch (err) {
        console.error('Failed to load quiz:', err);
      }
      setQuizLoading(false);
    }
    loadQuiz();
  }, [activeTab, isLoaded]);

  const quizCurrent = quizQuestions?.[quizIndex];
  const quizLetters = ['A', 'B', 'C', 'D'];

  const handleQuizSelect = (letter) => {
    if (quizAnswered) return;
    setQuizSelected(letter);
    setQuizAnswered(true);
    if (letter === quizCurrent.correct) setQuizScore(s => s + 1);
  };

  const handleQuizNext = () => {
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex(i => i + 1); setQuizSelected(null); setQuizAnswered(false);
    } else { setQuizFinished(true); }
  };

  const handleQuizReset = () => {
    setQuizIndex(0); setQuizSelected(null); setQuizAnswered(false); setQuizScore(0); setQuizFinished(false);
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  if (contentLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
        <Header />
        <div style={{ position: 'fixed', top: 12, right: 16, background: '#8B6914', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, zIndex: 9999, letterSpacing: '0.5px' }}>v2</div>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
          <p style={{ color: '#9B8E82' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ position: 'fixed', top: 12, right: 16, background: '#8B6914', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, zIndex: 9999, letterSpacing: '0.5px' }}>v2</div>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <BackButton href={`/dashboard/${courseId}/${topicId}/v2/lectures`} />

        <div style={{ fontSize: 13, color: '#9B8E82', marginTop: 8, marginBottom: 16 }}>
          Segment {segmentNum}{totalSegments ? ` of ${totalSegments}` : ''}
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid #E8E4DA', marginBottom: 20,
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: activeTab === tab.id ? '#1a1a1a' : '#6B6B6B',
                borderBottom: activeTab === tab.id ? '2px solid #8B6914' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Audio element (always mounted) ── */}
        <audio
          ref={audioRef}
          src={seg?.audio || ''}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          preload="auto"
        />

        {/* ════════════════════════════════════════════════════════
            TAB: Listen
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'listen' && (
          <div>
            {!seg?.audio ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B6B6B' }}>
                <p>No audio available for this segment.</p>
                <p style={{ fontSize: 13, marginTop: 8 }}>Lecture content needs to be generated first.</p>
              </div>
            ) : (
              <>
                {/* Anchor text display */}
                <div style={{
                  minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16, padding: '16px 24px',
                  background: activeAnchor ? '#f5f0e8' : 'transparent',
                  borderRadius: 12, transition: 'background 0.3s',
                }}>
                  {activeAnchor && (
                    <div
                      ref={anchorRef}
                      style={{
                        fontFamily: "var(--font-display), 'Lora', serif",
                        fontSize: 18, fontWeight: 500, fontStyle: 'italic',
                        color: '#1a1a1a', textAlign: 'center', lineHeight: 1.5,
                      }}
                    >
                      {activeAnchor}
                    </div>
                  )}
                </div>

                {/* Audio controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <button onClick={togglePlay} style={{
                    width: 44, height: 44, borderRadius: '50%', background: '#8B6914',
                    border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {playing ? '⏸' : '▶'}
                  </button>
                  <div onClick={handleProgressClick} style={{
                    flex: 1, height: 6, background: '#E8E4DA', borderRadius: 3, cursor: 'pointer', position: 'relative',
                  }}>
                    <div style={{
                      width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                      height: '100%', background: '#8B6914', borderRadius: 3, transition: 'width 0.1s',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#9B8E82', flexShrink: 0 }}>
                    {fmt(currentTime)} / {fmt(duration)}
                  </span>
                </div>

                {/* Q&A section */}
                <div style={{ borderTop: '1px solid #E8E4DA', paddingTop: 16 }}>
                  {qaResponse && (
                    <div style={{
                      background: '#ffffff', border: '1px solid #E8E4DA', borderRadius: 8,
                      padding: '12px 16px', fontSize: 14, color: '#4a4a4a', lineHeight: 1.5,
                      marginBottom: 12, whiteSpace: 'pre-wrap',
                    }}>
                      {qaResponse}
                    </div>
                  )}

                  {qaState === 'speaking' && (
                    <button
                      onClick={() => {
                        if (qaAudioRef.current) { qaAudioRef.current.pause(); qaAudioRef.current = null; }
                        if (fillerAudioRef.current) { fillerAudioRef.current.pause(); fillerAudioRef.current = null; }
                        audioQueueRef.current = [];
                        isPlayingQaRef.current = false;
                        setQaState('idle');
                      }}
                      style={{
                        marginBottom: 12, padding: '8px 20px',
                        background: '#f5f0e8', border: '1px solid #E8E4DA',
                        borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#9B8E82',
                      }}
                    >
                      Got it — stop
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={qaState === 'recording' ? stopRecording : startRecording}
                      disabled={(qaLoading && qaState !== 'recording') || qaCount >= MAX_QUESTIONS}
                      title={qaState === 'recording' ? 'Stop recording' : 'Ask by voice'}
                      style={{
                        width: 44, height: 44, borderRadius: '50%',
                        border: qaState === 'recording' ? '2px solid #ef4444' : '2px solid #444',
                        background: qaState === 'recording' ? '#991b1b' : '#1a1a1a',
                        color: qaState === 'recording' ? '#fca5a5' : '#888',
                        cursor: qaCount >= MAX_QUESTIONS ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0, transition: 'all 0.15s',
                      }}
                    >
                      🎤
                    </button>
                    <input
                      type="text"
                      value={qaInput}
                      onChange={e => setQaInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }}
                      placeholder={
                        qaCount >= MAX_QUESTIONS ? 'Question limit reached' :
                        qaState === 'recording' ? 'Listening...' :
                        qaState === 'thinking' ? 'Thinking...' :
                        qaState === 'speaking' ? 'Responding...' :
                        'Ask about what you just heard...'
                      }
                      disabled={qaLoading || qaCount >= MAX_QUESTIONS}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: 8,
                        border: '1px solid #E8E4DA', background: '#ffffff',
                        color: '#1a1a1a', fontSize: 14, outline: 'none',
                      }}
                    />
                    <button
                      onClick={sendQuestion}
                      disabled={!qaInput.trim() || qaLoading || qaCount >= MAX_QUESTIONS}
                      style={{
                        padding: '10px 16px', borderRadius: 8,
                        background: qaInput.trim() && !qaLoading ? '#8B6914' : '#E8E4DA',
                        color: qaInput.trim() && !qaLoading ? '#fff' : '#666',
                        border: 'none', cursor: qaInput.trim() && !qaLoading ? 'pointer' : 'default',
                        fontSize: 14, fontWeight: 500, flexShrink: 0,
                      }}
                    >
                      {qaLoading ? '...' : 'Ask'}
                    </button>
                  </div>
                  {qaCount > 0 && qaCount < MAX_QUESTIONS && (
                    <div style={{ fontSize: 12, color: '#9B8E82', marginTop: 6 }}>
                      {MAX_QUESTIONS - qaCount} question{MAX_QUESTIONS - qaCount !== 1 ? 's' : ''} remaining
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: Office Hours
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'office-hours' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
              {ohMessages.filter(m => m.role !== 'user' || m.content !== 'Begin').map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                  fontSize: 14, lineHeight: 1.5,
                  background: msg.role === 'user' ? '#f0ebe0' : '#ffffff',
                  border: msg.role === 'user' ? '1px solid #2a4a6c' : '1px solid #222',
                  color: '#1a1a1a', whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              ))}
              {ohStreamingText && (
                <div style={{
                  alignSelf: 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                  fontSize: 14, lineHeight: 1.5, background: '#ffffff', border: '1px solid #E8E4DA',
                  color: '#1a1a1a', whiteSpace: 'pre-wrap',
                }}>
                  {ohStreamingText}<span style={{ opacity: 0.4 }}>▊</span>
                </div>
              )}
              {ohStreaming && !ohStreamingText && (
                <div style={{ color: '#9B8E82', fontSize: 13, padding: '8px 14px' }}>Thinking...</div>
              )}
              {!ohSession && !ohStreaming && (
                <div style={{ color: '#9B8E82', fontSize: 13, padding: '8px 14px' }}>Starting Office Hours...</div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ borderTop: '1px solid #E8E4DA', paddingTop: 12, paddingBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" value={ohInput}
                  onChange={e => setOhInput(e.target.value)}
                  onKeyDown={ohHandleKeyDown}
                  placeholder="Type your response..."
                  disabled={ohStreaming || !ohSession}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8,
                    border: '1px solid #E8E4DA', background: '#ffffff',
                    color: '#1a1a1a', fontSize: 14, outline: 'none',
                  }}
                />
                <button
                  onClick={() => ohSendMessage()}
                  disabled={!ohInput.trim() || ohStreaming || !ohSession}
                  style={{
                    padding: '10px 16px', borderRadius: 8,
                    background: ohInput.trim() && ohSession ? '#8B6914' : '#E8E4DA',
                    color: ohInput.trim() && ohSession ? '#fff' : '#666',
                    border: 'none', cursor: ohInput.trim() && ohSession ? 'pointer' : 'default',
                    fontSize: 14, fontWeight: 500,
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: Exit Ticket (placeholder)
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'exit-ticket' && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B6B6B' }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>Exit Ticket</p>
            <p style={{ fontSize: 14 }}>Coming soon</p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: Notes
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'notes' && (
          <div>
            {notesLoading ? (
              <div style={{ color: '#9B8E82', padding: '40px 0', textAlign: 'center' }}>Loading notes...</div>
            ) : !notesQuestions || notesQuestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B6B6B' }}><p>No notes available yet.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {getSegmentNotes().map((q, i) => (
                  <div key={i} style={{ background: '#ffffff', border: '1px solid #E8E4DA', borderRadius: 12, padding: '16px 20px' }}>
                    {q.section && (
                      <div style={{ fontSize: 11, color: '#9B8E82', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{q.section}</div>
                    )}
                    <div style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.6 }}>{q.question}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: Exam-Style Questions
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'exam-questions' && (
          <div>
            {quizLoading ? (
              <div style={{ color: '#9B8E82', padding: '40px 0', textAlign: 'center' }}>Loading practice questions...</div>
            ) : !quizQuestions || quizQuestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B6B6B' }}><p>No practice questions available yet.</p></div>
            ) : quizFinished ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 13, color: '#9B8E82', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Score</div>
                <div style={{
                  fontFamily: "var(--font-display), 'Lora', serif", fontSize: 48, fontWeight: 600, marginTop: 8,
                  color: quizScore / quizQuestions.length >= 0.8 ? '#4A7C59' : quizScore / quizQuestions.length >= 0.6 ? '#C4972A' : '#C44A2A',
                }}>
                  {quizScore} / {quizQuestions.length}
                </div>
                <button onClick={handleQuizReset} style={{
                  marginTop: 24, padding: '10px 24px', borderRadius: 8,
                  background: '#E8E4DA', border: '1px solid #E8E4DA', color: '#1a1a1a', cursor: 'pointer', fontSize: 14,
                }}>
                  Try Again
                </button>
              </div>
            ) : quizCurrent ? (
              <div>
                <div style={{ fontSize: 12, color: '#9B8E82', marginBottom: 12 }}>
                  Question {quizIndex + 1} of {quizQuestions.length}
                </div>
                <div style={{ fontSize: 15, color: '#1a1a1a', lineHeight: 1.6, marginBottom: 20 }}>
                  {quizCurrent.question}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quizLetters.map((letter) => {
                    const optionText = quizCurrent.options?.[letter];
                    if (!optionText) return null;
                    let bg = '#ffffff'; let border = '1px solid #E8E4DA'; let color = '#1a1a1a';
                    if (quizAnswered) {
                      if (letter === quizCurrent.correct) { bg = '#f0f7f2'; border = '1px solid #4A7C59'; color = '#4A7C59'; }
                      else if (letter === quizSelected) { bg = '#FFF0F0'; border = '1px solid #C44A2A'; color = '#C44A2A'; }
                      else { color = '#555'; }
                    } else if (letter === quizSelected) { border = '2px solid #2563eb'; }
                    return (
                      <button key={letter} onClick={() => handleQuizSelect(letter)} style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 8,
                        background: bg, border, color, cursor: quizAnswered ? 'default' : 'pointer', fontSize: 14, lineHeight: 1.5,
                      }}>
                        <strong style={{ marginRight: 8 }}>{letter}.</strong>{optionText}
                      </button>
                    );
                  })}
                </div>
                {quizAnswered && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <button onClick={handleQuizNext} style={{
                      padding: '10px 24px', borderRadius: 8, background: '#8B6914', border: 'none',
                      color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                    }}>
                      {quizIndex < quizQuestions.length - 1 ? 'Next Question →' : 'See Results'}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
