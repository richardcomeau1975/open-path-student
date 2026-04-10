"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "../../../../../lib/api";
import { useAdmin } from "../../../../../lib/admin";
import AdminToolbar from "../../../../../components/AdminToolbar";
import gsap from "gsap";

export default function VisualOverviewPage() {
  const { courseId, topicId } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const { isAdmin } = useAdmin();

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef(null);
  const textRef = useRef(null);

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
  }, [topicId, getToken, refreshKey]);

  // Get slides from the visual overview data
  const slides = content?.visual_overview_slides || [];
  const audioSegments = content?.visual_overview_audio || [];

  // GSAP fade transition when slide changes
  useEffect(() => {
    if (textRef.current && slides.length > 0) {
      gsap.to(textRef.current, {
        opacity: 0,
        y: 10,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => {
          gsap.fromTo(
            textRef.current,
            { opacity: 0, y: -10 },
            { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }
          );
        },
      });
    }
  }, [currentSlide]);

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

  const handleAudioEnded = () => {
    if (currentSlide < slides.length - 1) {
      setTimeout(() => {
        setCurrentSlide((prev) => prev + 1);
        setAudioProgress(0);
      }, 800);
    } else {
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setAudioProgress(audioRef.current.currentTime / audioRef.current.duration);
    }
  };

  // Auto-play next slide's audio when slide changes
  useEffect(() => {
    if (playing && audioRef.current && audioSegments[currentSlide]) {
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
    }
  }, [currentSlide]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setAudioProgress(0);
    if (audioRef.current) {
      audioRef.current.load();
      if (playing) {
        setTimeout(() => {
          audioRef.current.play().catch(() => {});
        }, 600);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#6B6B6B" }}>
        Loading visual overview...
      </div>
    );
  }

  const slideCount = slides.length || (content?.visual_overview_images || []).length;

  if (!slideCount) {
    return (
      <div style={{ padding: "24px 32px", maxWidth: "1000px", margin: "0 auto" }}>
        <button onClick={() => router.back()} style={backBtnStyle}>
          &larr; Back
        </button>
        {isAdmin && (
          <>
            <AdminToolbar topicId={topicId} outputType="visual_overview_script" label="VO Script"
              showTestPrompt={true} downstreamLabel="Generate narration ↓" accept=".json,.txt,.md,.yaml,.yml"
              onRefresh={() => setRefreshKey(k => k + 1)} />
            <AdminToolbar topicId={topicId} outputType="narration_audio" label="Narration Audio"
              showTestPrompt={false} downstreamLabel={null} accept=".mp3,.wav"
              onRefresh={() => setRefreshKey(k => k + 1)} />
          </>
        )}
        <p style={{ fontFamily: "Inter, sans-serif", color: "#6B6B6B", marginTop: "20px" }}>
          No visual overview content available yet.
        </p>
      </div>
    );
  }

  const currentAnchorText = slides[currentSlide]?.anchor_text || `Section ${currentSlide + 1}`;

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1000px", margin: "0 auto" }}>
      <button onClick={() => router.back()} style={backBtnStyle}>
        &larr; Back
      </button>

      {isAdmin && (
        <>
          <AdminToolbar topicId={topicId} outputType="visual_overview_script" label="VO Script"
            showTestPrompt={true} downstreamLabel="Generate narration ↓" accept=".json,.txt,.md,.yaml,.yml"
            onRefresh={() => setRefreshKey(k => k + 1)} />
          <AdminToolbar topicId={topicId} outputType="narration_audio" label="Narration Audio"
            showTestPrompt={false} downstreamLabel={null} accept=".mp3,.wav"
            onRefresh={() => setRefreshKey(k => k + 1)} />
        </>
      )}

      <div style={{ marginTop: "16px", marginBottom: "24px" }}>
        <div style={{
          fontSize: "13px",
          color: "#8B6914",
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          letterSpacing: "0.5px",
        }}>
          VISUAL OVERVIEW
        </div>
        <h1 style={{
          fontFamily: "'Lora', serif",
          fontWeight: 600,
          fontSize: "28px",
          marginTop: "4px",
        }}>
          Build Your Foundation
        </h1>
      </div>

      {/* Typography card — anchor text is the visual */}
      <div style={{
        background: "#FDFBF5",
        borderRadius: 16,
        border: "1px solid #E8E4DA",
        minHeight: "340px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 48px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle slide number */}
        <div style={{
          position: "absolute",
          top: 20,
          right: 24,
          fontSize: 12,
          color: "#C4B89C",
          fontFamily: "Inter, sans-serif",
        }}>
          {currentSlide + 1} / {slideCount}
        </div>

        {/* The anchor text — the star of the show */}
        <div ref={textRef} style={{ textAlign: "center", maxWidth: "680px" }}>
          <p style={{
            fontSize: "32px",
            fontFamily: "'Lora', serif",
            fontWeight: 600,
            color: "#1a1a1a",
            lineHeight: 1.35,
            margin: 0,
            letterSpacing: "-0.01em",
          }}>
            {currentAnchorText}
          </p>
        </div>
      </div>

      {/* Audio element (hidden) */}
      {audioSegments[currentSlide] && (
        <audio
          ref={audioRef}
          src={audioSegments[currentSlide]?.url}
          onEnded={handleAudioEnded}
          onTimeUpdate={handleTimeUpdate}
        />
      )}

      {/* Controls — play/pause + progress */}
      <div style={{
        marginTop: "20px",
        background: "#ffffff",
        border: "1px solid #E8E4DA",
        borderRadius: "12px",
        padding: "16px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#9B8E82",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {playing ? "\u275A\u275A" : "\u25B6"}
          </button>

          {/* Progress bar */}
          <div style={{ flex: 1 }}>
            <div style={{
              height: "6px",
              background: "#E8E4DA",
              borderRadius: "3px",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${((currentSlide + audioProgress) / slideCount) * 100}%`,
                background: "#8B6914",
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>
        </div>

        {/* Slide dots */}
        <div style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
          marginTop: "12px",
        }}>
          {Array.from({ length: slideCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                border: "none",
                background: i === currentSlide ? "#8B6914" : i < currentSlide ? "#4A7C59" : "#E8E4DA",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
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
