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
  // ── Listen Q&A state (Gemini Live) ──
  const [qaInput, setQaInput] = useState('');
  const [qaState, setQaState] = useState('idle'); // 'idle' | 'connecting' | 'listening' | 'speaking'
  const [qaResponse, setQaResponse] = useState('');
  const [qaCount, setQaCount] = useState(0);
  const MAX_QUESTIONS = 5;
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const pcmBufferRef = useRef([]);
  const isPlayingRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const qaLoading = qaState !== 'idle';

  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  const GEMINI_MODEL = 'gemini-2.0-flash-exp';

  // ── Office Hours state ──
  const [ohSession, setOhSession] = useState(null);
  const [ohMessages, setOhMessages] = useState([]);
  const [ohInput, setOhInput] = useState('');
  const [ohStreaming, setOhStreaming] = useState(false);
  const [ohStreamingText, setOhStreamingText] = useState('');
  const [ohStarted, setOhStarted] = useState(false);
  const messagesEndRef = useRef(null);

  // ── Exit Ticket state ──
  const [etStatus, setEtStatus] = useState(null);
  const [etTasks, setEtTasks] = useState([]);
  const [etResponses, setEtResponses] = useState([]);
  const [etEvaluation, setEtEvaluation] = useState(null);
  const [etLoading, setEtLoading] = useState(false);
  const [etLoaded, setEtLoaded] = useState(false);
  const [etCurrentTask, setEtCurrentTask] = useState(0);

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
  // LISTEN: Gemini Live Q&A
  // ══════════════════════════════════════════════════════════

  // PCM audio playback
  function playPcmAudio(base64Pcm) {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    const raw = atob(base64Pcm);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }

  // Build system instruction from segment context
  function buildQaSystemInstruction() {
    const scriptContext = seg?.script || '';
    const assetContext = seg?.content || '';
    return (
      "You are the Expert from a lecture the student is currently listening to. " +
      "The student just paused to ask you a question. Answer naturally, warmly, and directly — " +
      "as if you're the same person who was just speaking in the lecture. " +
      "Keep answers to 3-4 sentences MAX. Be direct. One clear point per answer. " +
      "Always begin your response with a very brief natural interruption acknowledgment — as if someone just raised their hand while you were talking. Something like 'Oh — hold on, there's a question...' or 'Yeah, let me pause here — what's up?' or 'Sure, let's stop for a sec.' Just a few words that acknowledge you were mid-lecture and someone interrupted. Then answer their question directly. " +
      "NEVER say: learning asset, system, material provided, context, or anything that breaks the illusion. " +
      "NEVER refuse to answer. Always give the student something useful.\n\n" +
      (assetContext ? `WHAT YOU KNOW:\n${assetContext.slice(0, 4000)}\n\n` : '') +
      (scriptContext ? `WHAT YOU WERE JUST SAYING:\n${scriptContext.slice(0, 2000)}` : '')
    );
  }

  // Open WebSocket to Gemini Live
  function connectGeminiLive() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(GEMINI_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send setup config
        ws.send(JSON.stringify({
          setup: {
            model: `models/${GEMINI_MODEL}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Kore',
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: buildQaSystemInstruction() }],
            },
          },
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        // Setup complete
        if (msg.setupComplete) {
          resolve(ws);
          return;
        }

        // Audio response
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              playPcmAudio(part.inlineData.data);
              setQaState('speaking');
            }
          }
        }

        // Text transcription of the response
        if (msg.serverContent?.outputTranscription?.text) {
          setQaResponse(prev => prev + msg.serverContent.outputTranscription.text);
        }

        // Turn complete
        if (msg.serverContent?.turnComplete) {
          setQaState('idle');
        }
      };

      ws.onerror = (err) => {
        console.error('Gemini Live WS error:', err);
        setQaState('idle');
        reject(err);
      };

      ws.onclose = () => {
        wsRef.current = null;
      };

      // Timeout
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error('WebSocket timeout'));
        }
      }, 10000);
    });
  }

  // Send text question
  const sendQuestion = useCallback(async () => {
    const q = qaInput.trim();
    if (!q || qaLoading || qaCount >= MAX_QUESTIONS) return;

    // Pause lecture audio
    if (audioRef.current && playing) {
      audioRef.current.pause();
      setPlaying(false);
    }

    setQaState('connecting');
    setQaInput('');
    setQaResponse('');
    setQaCount(c => c + 1);

    try {
      const ws = wsRef.current?.readyState === WebSocket.OPEN
        ? wsRef.current
        : await connectGeminiLive();

      // Send text message
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: q }] }],
          turnComplete: true,
        },
      }));

      setQaState('speaking');
    } catch (err) {
      console.error('Q&A failed:', err);
      setQaResponse('Sorry, something went wrong connecting to the voice assistant.');
      setQaState('idle');
    }
  }, [qaInput, qaLoading, qaCount, playing, seg]);

  // Voice recording
  const startRecording = useCallback(async () => {
    if (qaLoading || qaCount >= MAX_QUESTIONS) return;
    if (audioRef.current && playing) {
      audioRef.current.pause();
      setPlaying(false);
    }

    try {
      // Ensure WebSocket is connected
      setQaState('connecting');
      const ws = wsRef.current?.readyState === WebSocket.OPEN
        ? wsRef.current
        : await connectGeminiLive();

      // Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });

      // Use MediaRecorder to capture audio, then send as base64
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        setQaResponse('');
        setQaCount(c => c + 1);

        // Send audio to Gemini Live
        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/webm',
              data: base64,
            }],
          },
        }));

        setQaState('speaking');
      };

      mediaRecorder.start();
      setQaState('listening');
    } catch (err) {
      console.error('Recording failed:', err);
      setQaState('idle');
    }
  }, [qaLoading, qaCount, playing, seg]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

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
  // EXIT TICKET: check status lazily, start, submit
  // ══════════════════════════════════════════════════════════

  useEffect(() => {
    if (activeTab !== 'exit-ticket' || etLoaded || !isLoaded) return;
    setEtLoaded(true);
    async function checkStatus() {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API}/api/exit-ticket/${topicId}/status?segment_number=${segmentNum}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setEtStatus(data.status);
        if (data.result) {
          setEtTasks(data.result.tasks || []);
          if (data.result.responses) {
            setEtResponses(data.result.responses);
          } else {
            setEtResponses((data.result.tasks || []).map(() => ''));
          }
          setEtEvaluation(data.result.evaluation || null);
        }
      } catch (err) {
        console.error('Failed to check exit ticket status:', err);
        setEtStatus('not_started');
      }
    }
    checkStatus();
  }, [activeTab, isLoaded]);

  async function etStart() {
    setEtLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/exit-ticket/${topicId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ segment_number: parseInt(segmentNum, 10) }),
      });
      const data = await res.json();
      if (data.result) {
        setEtTasks(data.result.tasks || []);
        setEtResponses((data.result.tasks || []).map(() => ''));
        setEtStatus('in_progress');
        setEtCurrentTask(0);
        setEtEvaluation(null);
      }
    } catch (err) {
      console.error('Failed to start exit ticket:', err);
    }
    setEtLoading(false);
  }

  async function etSubmit() {
    const hasEmpty = etResponses.some(r => !r.trim());
    if (hasEmpty) return;
    setEtLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/exit-ticket/${topicId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          segment_number: parseInt(segmentNum, 10),
          responses: etResponses,
        }),
      });
      const data = await res.json();
      if (data.result) {
        setEtEvaluation(data.result.evaluation);
        setEtStatus(data.result.status);
      }
    } catch (err) {
      console.error('Failed to submit exit ticket:', err);
    }
    setEtLoading(false);
  }

  function etRetry() {
    setEtStatus('not_started');
    setEtTasks([]);
    setEtResponses([]);
    setEtEvaluation(null);
    setEtLoaded(false);
    setEtCurrentTask(0);
  }

  function etGoToOfficeHours(prompt) {
    setOhInput(prompt);
    setActiveTab('office-hours');
  }

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
                        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
                        if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
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
                        qaState === 'connecting' ? 'Connecting...' :
                        qaState === 'listening' ? 'Listening...' :
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
            TAB: Exit Ticket
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'exit-ticket' && (
          <div>
            {/* Not started */}
            {(etStatus === 'not_started' || etStatus === null) && !etLoading && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{
                  fontFamily: "var(--font-display), 'Lora', serif",
                  fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 12,
                }}>
                  Ready to show what you know?
                </p>
                <p style={{ fontSize: 14, color: '#6B6B6B', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                  The exit ticket checks whether you can use the material from this segment — not just remember it.
                </p>
                <button
                  onClick={etStart}
                  style={{
                    padding: '12px 32px', borderRadius: 8,
                    background: '#8B6914', border: 'none',
                    color: '#fff', cursor: 'pointer',
                    fontSize: 15, fontWeight: 500,
                  }}
                >
                  Begin Exit Ticket
                </button>
              </div>
            )}

            {/* Loading */}
            {etLoading && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#9B8E82' }}>
                <p style={{ fontSize: 14 }}>
                  {etStatus === 'in_progress' && etEvaluation === null ? 'Evaluating your responses...' : 'Generating tasks...'}
                </p>
              </div>
            )}

            {/* Tasks — in progress, no evaluation yet */}
            {etStatus === 'in_progress' && !etEvaluation && !etLoading && etTasks.length > 0 && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, color: '#9B8E82' }}>
                    Task {etCurrentTask + 1} of {etTasks.length}
                  </p>
                </div>

                {(() => {
                  const task = etTasks[etCurrentTask];
                  const taskText = typeof task === 'string' ? task : task.task || '';
                  return (
                    <div style={{
                      marginBottom: 24, background: '#ffffff',
                      border: '1px solid #E8E4DA', borderRadius: 12, padding: '20px 24px',
                    }}>
                      <div style={{ fontSize: 15, color: '#1a1a1a', lineHeight: 1.6, marginBottom: 16 }}>
                        {taskText}
                      </div>
                      <textarea
                        value={etResponses[etCurrentTask] || ''}
                        onChange={(e) => {
                          const updated = [...etResponses];
                          updated[etCurrentTask] = e.target.value;
                          setEtResponses(updated);
                        }}
                        placeholder="Explain your thinking..."
                        rows={5}
                        style={{
                          width: '100%', padding: '12px 14px', borderRadius: 8,
                          border: '1px solid #E8E4DA', background: '#fdfbf7',
                          color: '#1a1a1a', fontSize: 14, lineHeight: 1.6,
                          outline: 'none', resize: 'vertical',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      />
                    </div>
                  );
                })()}

                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  {etCurrentTask < etTasks.length - 1 ? (
                    <button
                      onClick={() => setEtCurrentTask(i => i + 1)}
                      disabled={!etResponses[etCurrentTask]?.trim()}
                      style={{
                        padding: '12px 32px', borderRadius: 8,
                        background: etResponses[etCurrentTask]?.trim() ? '#8B6914' : '#E8E4DA',
                        color: etResponses[etCurrentTask]?.trim() ? '#fff' : '#9B8E82',
                        border: 'none',
                        cursor: etResponses[etCurrentTask]?.trim() ? 'pointer' : 'default',
                        fontSize: 15, fontWeight: 500,
                      }}
                    >
                      Next Task →
                    </button>
                  ) : (
                    <button
                      onClick={etSubmit}
                      disabled={etResponses.some(r => !r.trim())}
                      style={{
                        padding: '12px 32px', borderRadius: 8,
                        background: etResponses.every(r => r.trim()) ? '#8B6914' : '#E8E4DA',
                        color: etResponses.every(r => r.trim()) ? '#fff' : '#9B8E82',
                        border: 'none',
                        cursor: etResponses.every(r => r.trim()) ? 'pointer' : 'default',
                        fontSize: 15, fontWeight: 500,
                      }}
                    >
                      Submit All Responses
                    </button>
                  )}

                  {etCurrentTask > 0 && (
                    <button
                      onClick={() => setEtCurrentTask(i => i - 1)}
                      style={{
                        marginLeft: 12, padding: '12px 20px', borderRadius: 8,
                        background: '#ffffff', border: '1px solid #E8E4DA',
                        color: '#1a1a1a', cursor: 'pointer', fontSize: 14,
                      }}
                    >
                      ← Previous
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Evaluation — pass or incomplete */}
            {etEvaluation && !etLoading && (
              <div>
                {/* Status banner */}
                <div style={{
                  padding: '16px 20px', borderRadius: 12, marginBottom: 24,
                  background: etStatus === 'pass' ? '#f0f7f2' : '#FFF8F0',
                  border: etStatus === 'pass' ? '1px solid #4A7C59' : '1px solid #C4972A',
                }}>
                  <div style={{
                    fontSize: 16, fontWeight: 600,
                    color: etStatus === 'pass' ? '#4A7C59' : '#8B6914',
                  }}>
                    {etStatus === 'pass' ? 'Segment complete' : 'Almost there — specific gaps remain'}
                  </div>
                </div>

                {/* Demonstrated */}
                {etEvaluation.demonstrated && (
                  <div style={{
                    background: '#ffffff', border: '1px solid #E8E4DA', borderRadius: 12,
                    padding: '20px 24px', marginBottom: 16,
                  }}>
                    <div style={{
                      fontSize: 13, color: '#4A7C59', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
                    }}>
                      What you demonstrated
                    </div>
                    <div style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.7 }}>
                      {etEvaluation.demonstrated}
                    </div>
                  </div>
                )}

                {/* Not there yet */}
                {etEvaluation.not_there_yet && (
                  <div style={{
                    background: '#ffffff', border: '1px solid #E8E4DA', borderRadius: 12,
                    padding: '20px 24px', marginBottom: 16,
                  }}>
                    <div style={{
                      fontSize: 13, color: '#8B6914', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
                    }}>
                      Not there yet
                    </div>
                    <div style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.7 }}>
                      {etEvaluation.not_there_yet}
                    </div>
                  </div>
                )}

                {/* Take this to Office Hours */}
                {etEvaluation.office_hours_prompt && (
                  <div
                    onClick={() => etGoToOfficeHours(etEvaluation.office_hours_prompt)}
                    style={{
                      background: '#f5f0e8', border: '1px solid #E8E4DA', borderRadius: 12,
                      padding: '20px 24px', marginBottom: 16, cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      fontSize: 13, color: '#8B6914', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
                    }}>
                      Take this to Office Hours →
                    </div>
                    <div style={{
                      fontSize: 14, color: '#4a4a4a', lineHeight: 1.7, fontStyle: 'italic',
                    }}>
                      "{etEvaluation.office_hours_prompt}"
                    </div>
                    <div style={{ fontSize: 12, color: '#9B8E82', marginTop: 8 }}>
                      Click to open Office Hours with this question ready
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', gap: 16, justifyContent: 'center' }}>
                  {etStatus === 'incomplete' && (
                    <button
                      onClick={etRetry}
                      style={{
                        padding: '10px 24px', borderRadius: 8,
                        background: '#ffffff', border: '1px solid #E8E4DA',
                        color: '#1a1a1a', cursor: 'pointer', fontSize: 14,
                      }}
                    >
                      Try Again
                    </button>
                  )}
                  {etStatus === 'pass' && totalSegments && parseInt(segmentNum, 10) < totalSegments && (
                    <button
                      onClick={() => router.push(`/dashboard/${courseId}/${topicId}/v2/lectures/${parseInt(segmentNum, 10) + 1}`)}
                      style={{
                        padding: '10px 24px', borderRadius: 8,
                        background: '#8B6914', border: 'none',
                        color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                      }}
                    >
                      Next Segment →
                    </button>
                  )}
                </div>
              </div>
            )}
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
