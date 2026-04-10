'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import Header from '../../../../components/Header';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function TravelDemoPage() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentText]);

  // ── Audio queue playback ──
  const playNextChunk = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    const b64 = audioQueueRef.current.shift();
    const audio = new Audio(`data:audio/mp3;base64,${b64}`);
    audioRef.current = audio;
    audio.onended = () => playNextChunk();
    audio.onerror = () => playNextChunk();
    audio.play().catch(() => playNextChunk());
  }, []);

  const enqueueAudio = useCallback((b64) => {
    audioQueueRef.current.push(b64);
    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [playNextChunk]);

  // ── Send message (text or audio) ──
  const sendMessage = useCallback(async (textOverride, audioB64) => {
    const question = textOverride || input.trim();
    if (!question && !audioB64) return;

    const token = await getToken();
    setIsLoading(true);
    setInput('');
    setCurrentText('');

    // Add user message to history
    if (question) {
      setMessages(prev => [...prev, { role: 'user', content: question }]);
    }

    // Build history for API
    const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API}/api/travel/ask-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: question || undefined,
          audio: audioB64 || undefined,
          history: historyForApi,
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

            if (event.type === 'transcript' && !question) {
              // Voice input — show transcribed text
              setMessages(prev => [...prev, { role: 'user', content: event.text }]);
            } else if (event.type === 'text_chunk') {
              fullAnswer += event.text + ' ';
              setCurrentText(fullAnswer);
            } else if (event.type === 'audio_chunk') {
              enqueueAudio(event.audio);
            } else if (event.type === 'answer') {
              fullAnswer = event.text;
            } else if (event.type === 'done') {
              setMessages(prev => [...prev, { role: 'assistant', content: fullAnswer.trim() }]);
              setCurrentText('');
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Travel stream error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, getToken, enqueueAudio]);

  // ── Voice recording ──
  const startRecording = useCallback(async () => {
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
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = reader.result.split(',')[1];
          sendMessage(null, b64);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
    }
  }, [sendMessage]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Stop audio playback ──
  const stopAudio = useCallback(() => {
    audioQueueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5' }}>
      <Header />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>

        {/* Title */}
        <div style={{ marginBottom: 16, borderBottom: '1px solid #222', paddingBottom: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>Travel Advisor Demo</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Caribbean destination intelligence — Jamaica, Antigua, Barbados, Trinidad & Tobago</p>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
          {messages.length === 0 && !isLoading && (
            <div style={{ color: '#666', fontSize: 14, textAlign: 'center', marginTop: 80 }}>
              Ask me anything about Caribbean travel — who's going, when, what matters to you.
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

          {/* Streaming response */}
          {currentText && (
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 14,
                lineHeight: 1.5,
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                color: '#e5e5e5',
                whiteSpace: 'pre-wrap',
              }}
            >
              {currentText}
              <span style={{ opacity: 0.4 }}>▊</span>
            </div>
          )}

          {isLoading && !currentText && (
            <div style={{ alignSelf: 'flex-start', color: '#666', fontSize: 13, padding: '8px 14px' }}>
              Thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '12px 0', borderTop: '1px solid #222',
        }}>
          {/* Mic button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading && !isRecording}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              border: isRecording ? '2px solid #ef4444' : '2px solid #444',
              background: isRecording ? '#991b1b' : '#1a1a1a',
              color: isRecording ? '#fca5a5' : '#888',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
              transition: 'all 0.15s',
            }}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            🎤
          </button>

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Caribbean destinations..."
            disabled={isLoading}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8,
              border: '1px solid #333', background: '#111',
              color: '#e5e5e5', fontSize: 14, outline: 'none',
            }}
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
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

          {/* Stop audio */}
          {isPlayingRef.current && (
            <button
              onClick={stopAudio}
              style={{
                padding: '10px 12px', borderRadius: 8,
                background: '#1a1a1a', border: '1px solid #444',
                color: '#888', cursor: 'pointer', fontSize: 13, flexShrink: 0,
              }}
            >
              ⏹
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
