"use client";

import { useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Sparkles } from "lucide-react";

export default function HeroVideoPlayer({
  videoTitle = "شاهد العرض التوضيحي لنظام بناية",
  videoSub = "نظام إدارة الأملاك الأول في صلالة وعُمان",
}: {
  videoTitle?: string;
  videoSub?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullScreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <div className="relative group">
      {/* Ambient background glow backdrop */}
      <div className="absolute -inset-1.5 rounded-[24px] bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500 opacity-30 blur-xl transition-all duration-500 group-hover:opacity-50" />

      {/* Main Video Container */}
      <div className="relative overflow-hidden rounded-[20px] border border-gray-200/80 bg-gray-900 shadow-[0_30px_70px_-20px_rgba(15,39,64,0.35)] transition-all duration-300">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-gray-900/90 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ms-2 text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" />
              <span>Binaya Demo Video</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="rounded-lg bg-white/10 p-1.5 text-gray-300 transition hover:bg-white/20 hover:text-white"
              title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
              aria-label="Toggle mute"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleFullScreen}
              className="rounded-lg bg-white/10 p-1.5 text-gray-300 transition hover:bg-white/20 hover:text-white"
              title="ملء الشاشة"
              aria-label="Full screen"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Video Element */}
        <div className="relative aspect-video w-full bg-black cursor-pointer" onClick={togglePlay}>
          <video
            ref={videoRef}
            src="/Binaya_Demo.mp4"
            className="h-full w-full object-cover"
            loop
            muted={isMuted}
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Big Center Play/Pause Button Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-300">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="group/btn relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-500 text-white shadow-2xl transition-transform duration-300 hover:scale-110 active:scale-95"
                aria-label="Play demo video"
              >
                <span className="absolute -inset-2 animate-ping rounded-full bg-brand-500/40 opacity-75" />
                <Play className="h-9 w-9 text-white ms-1" fill="currentColor" />
              </button>
              <p className="mt-4 text-sm font-bold text-white tracking-wide shadow-sm">
                {videoTitle}
              </p>
              <p className="mt-1 text-xs text-gray-300">
                {videoSub}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Floating Info Badge */}
        <div className="flex items-center justify-between border-t border-white/10 bg-gray-900/90 px-4 py-2 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex items-center gap-1.5 rounded-md bg-brand-500/20 px-2.5 py-1 text-brand-300 hover:bg-brand-500/30 transition-colors font-medium"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isPlaying ? "إيقاف مؤقت" : "تشغيل العرض"}</span>
            </button>
          </div>
          <span className="text-gray-400 font-mono text-[11px]">HD 1080p · Binaya PMS</span>
        </div>
      </div>
    </div>
  );
}
