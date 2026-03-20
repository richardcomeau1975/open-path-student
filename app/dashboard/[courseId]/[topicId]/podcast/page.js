"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../../../../lib/api";

export default function PodcastPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const token = await getToken();
        const data = await apiFetch(`/api/topics/${topicId}/content`, {}, token);
        setContent(data);
      } catch (err) {
        console.error("Failed to fetch content:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [topicId, getToken]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && duration) {
      audioRef.current.currentTime = ratio * duration;
    }
  };

  const handleEnded = () => {
    setPlaying(false);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#6B6B6B" }}>
        Loading podcast...
      </div>
    );
  }

  if (!content?.podcast_audio) {
    return (
      <div style={{ padding: "40px" }}>
        <button onClick={() => router.back()} style={backBtnStyle}>
          &larr; Back
        </button>
        <p style={{ fontFamily: "Inter, sans-serif", color: "#6B6B6B", marginTop: "20px" }}>
          No podcast available yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: "800px", margin: "0 auto" }}>
      <button onClick={() => router.back()} style={backBtnStyle}>
        &larr; Back
      </button>

      <div style={{ marginTop: "16px", marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "13px",
            color: "#8B6914",
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            letterSpacing: "0.5px",
          }}
        >
          PODCAST
        </div>
        <h1
          style={{
            fontFamily: "Lora, serif",
            fontWeight: 600,
            fontSize: "28px",
            marginTop: "4px",
          }}
        >
          {content.name || "Listen & Explore"}
        </h1>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={content.podcast_audio}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Player card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #E8E4DA",
          borderRadius: "12px",
          padding: "32px",
        }}
      >
        {/* Play button + time */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button
            onClick={handlePlayPause}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#9B8E82",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {playing ? "\u275A\u275A" : "\u25B6"}
          </button>

          <div style={{ flex: 1 }}>
            {/* Progress bar (clickable) */}
            <div
              onClick={handleSeek}
              style={{
                height: "8px",
                background: "#E8E4DA",
                borderRadius: "4px",
                cursor: "pointer",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  background: "#8B6914",
                  borderRadius: "4px",
                  transition: "width 0.1s linear",
                }}
              />
            </div>

            {/* Time display */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "6px",
                fontSize: "13px",
                color: "#6B6B6B",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Pause & Ask button (visible but not functional until Phase 5) */}
        <div style={{ marginTop: "28px", textAlign: "center" }}>
          <button
            onClick={() => {
              if (audioRef.current && playing) {
                audioRef.current.pause();
                setPlaying(false);
              }
            }}
            style={{
              padding: "12px 28px",
              background: "#F5F3EE",
              border: "1px solid #E8E4DA",
              borderRadius: "8px",
              color: "#6B6B6B",
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Pause & Ask a Question
          </button>
          <p
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#6B6B6B",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Voice Q&A coming soon
          </p>
        </div>
      </div>
    </div>
  );
}

const backBtnStyle = {
  background: "none",
  border: "none",
  color: "#6B6B6B",
  fontFamily: "Inter, sans-serif",
  fontSize: "15px",
  cursor: "pointer",
  padding: "4px 0",
};
