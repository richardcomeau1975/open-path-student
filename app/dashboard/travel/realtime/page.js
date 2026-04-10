'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import Header from '../../../../components/Header';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || '')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

export default function TravelRealtimePage() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | connecting | ready | listening | thinking
  const [messages, setMessages] = useState([]);
  const [currentText, setCurrentText] = useState('');
  const [input, setInput] = useState('');
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentText]);

  // ── Connect and start session ──
  const connect = useCallback(async () => {
    if (wsRef.current) return;
    setStatus('connecting');

    const token = await getToken();
    const ws = new WebSocket(`${WS_URL}/api/travel-realtime/realtime`);
    wsRef.current = ws;

    // Set up AudioContext for playback at 24kHz
    const audioCtx = new AudioContext({ sampleRate: 24000 });
    audioCtxRef.current = audioCtx;
    nextPlayTimeRef.current = 0;

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'ready':
          setStatus('ready');
          startMic();
          break;

        case 'audio':
          // Decode and play audio chunk
          playAudioChunk(msg.delta, audioCtx);
          break;

        case 'text':
          setCurrentText(prev => prev + (msg.delta || ''));
          break;

        case 'text_done':
          // Full response text
          setMessages(prev => [...prev, { role: 'assistant', content: msg.text }]);
          setCurrentText('');
          break;

        case 'speech_started':
          setStatus('listening');
          // Stop any playing audio when user starts speaking
          nextPlayTimeRef.current = 0;
          break;

        case 'speech_stopped':
          setStatus('thinking');
          break;

        case 'response_done':
          setStatus('ready');
          break;

        case 'error':
          console.error('Server error:', msg.error);
          setStatus('ready');
          break;
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      cleanup();
      setStatus('idle');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      cleanup();
      setStatus('idle');
    };
  }, [getToken]);

  // ── Start microphone streaming ──
  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;

      const audioCtx = audioCtxRef.current || new AudioContext({ sampleRate: 24000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const float32 = e.inputBuffer.getChannelData(0);
        // Convert float32 to int16 PCM
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        // Base64 encode
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        wsRef.current.send(JSON.stringify({ type: 'audio', audio: b64 }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      setStatus('ready');
    } catch (err) {
      console.error('Mic error:', err);
    }
  }, []);

  // ── Play audio chunk ──
  const playAudioChunk = useCallback((b64, audioCtx) => {
    if (!b64 || !audioCtx) return;

    try {
      // Decode base64 to raw bytes
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
      }

      // Decode as int16 PCM
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x8000;
      }

      const buffer = audioCtx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }, []);

  // ── Send text message ──
  const sendText = useCallback(() => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const text = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    wsRef.current.send(JSON.stringify({ type: 'text', text }));
    setInput('');
    setStatus('thinking');
  }, [input]);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus('idle');
    setMessages([]);
    setCurrentText('');
  }, [cleanup]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  // Status indicator
  const statusLabel = {
    idle: 'Not connected',
    connecting: 'Connecting...',
    ready: 'Listening',
    listening: 'You\'re speaking...',
    thinking: 'Thinking...',
  }[status];

  const statusColor = {
    idle: '#666',
    connecting: '#eab308',
    ready: '#22c55e',
    listening: '#3b82f6',
    thinking: '#eab308',
  }[status];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
      <Header />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>

        {/* Title + status */}
        <div style={{ marginBottom: 16, borderBottom: '1px solid #222', paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>SAM — Destination Intelligence</h1>
            <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Real-time voice • Caribbean destinations</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, boxShadow: status === 'ready' ? `0 0 8px ${statusColor}` : 'none' }} />
            <span style={{ fontSize: 12, color: statusColor }}>{statusLabel}</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
          {status === 'idle' && messages.length === 0 && (
            <div style={{ color: '#666', fontSize: 14, textAlign: 'center', marginTop: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <p>Real-time voice conversation with destination intelligence.</p>
              <button
                onClick={connect}
                style={{
                  padding: '12px 24px', borderRadius: 8,
                  background: '#2563eb', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 500,
                }}
              >
                Start Conversation
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 14,
                lineHeight: 1.5,
                background: msg.role === 'user' ? '#1a3a5c' : '#1a1a1a',
                border: msg.role === 'user' ? '1px solid #2a4a6c' : '1px solid #2a2a2a',
                color: '#e5e5e5',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          ))}

          {currentText && (
            <div style={{
              alignSelf: 'flex-start', maxWidth: '85%',
              padding: '10px 14px', borderRadius: 12,
              fontSize: 14, lineHeight: 1.5,
              background: '#1a1a1a', border: '1px solid #2a2a2a',
              color: '#e5e5e5', whiteSpace: 'pre-wrap',
            }}>
              {currentText}<span style={{ opacity: 0.4 }}>▊</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        {status !== 'idle' && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            padding: '12px 0', borderTop: '1px solid #222',
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Or type here..."
              disabled={status === 'connecting'}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                border: '1px solid #333', background: '#111',
                color: '#e5e5e5', fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={sendText}
              disabled={!input.trim()}
              style={{
                padding: '10px 16px', borderRadius: 8,
                background: input.trim() ? '#2563eb' : '#222',
                color: input.trim() ? '#fff' : '#666',
                border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                fontSize: 14, fontWeight: 500, flexShrink: 0,
              }}
            >
              Send
            </button>
            <button
              onClick={disconnect}
              style={{
                padding: '10px 12px', borderRadius: 8,
                background: '#1a1a1a', border: '1px solid #333',
                color: '#888', cursor: 'pointer', fontSize: 13, flexShrink: 0,
              }}
            >
              End
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
