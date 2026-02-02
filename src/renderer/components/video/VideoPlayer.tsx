import { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { VideoControls } from './VideoControls';
import { Scrubber } from './Scrubber';
import { TimeDisplay } from './TimeDisplay';


export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSeeking = useRef(false);
  const {
    currentVideo,
    currentTimestamp,
    setCurrentTimestamp,
    setIsSeeking,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    volume,
    isMuted,
    isLoading,
    loadingMessage,
    hoveredFrame,
  } = useStore();

  // Sync video element with store state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // Update playback speed
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Update volume
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Sync store timestamp to video element (for external changes like keyboard shortcuts)
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const diff = Math.abs(video.currentTime - currentTimestamp);

    // Only sync if there's a meaningful difference
    if (diff > 0.01) {
      isSeeking.current = true;
      video.currentTime = currentTimestamp;
    }
  }, [currentTimestamp]);

  // Poll video time at 60Hz during playback for smooth scrubber updates
  useEffect(() => {
    if (!isPlaying) return;

    let rafId: number;

    const pollTime = () => {
      const video = videoRef.current;
      if (video && !isSeeking.current && !video.seeking) {
        const currentStoreTime = useStore.getState().currentTimestamp;
        const videoDuration = video.duration;

        // Detect loop: video near end jumping to near start
        const isLoopingBack = currentStoreTime > (videoDuration - 0.5) && video.currentTime < 0.5;

        // Ignore large backward jumps unless it's a loop
        if (!isLoopingBack && currentStoreTime - video.currentTime > 0.5) {
          rafId = requestAnimationFrame(pollTime);
          return;
        }

        // Only update if time actually changed
        if (Math.abs(video.currentTime - currentStoreTime) > 0.001) {
          setCurrentTimestamp(video.currentTime);
        }
      }
      rafId = requestAnimationFrame(pollTime);
    };

    rafId = requestAnimationFrame(pollTime);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, setCurrentTimestamp]);

  // Handle time updates from video element (fallback for when paused)
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    // Don't update store while seeking or playing (rAF handles playing)
    if (video && !isSeeking.current && !video.seeking && video.paused) {
      const currentStoreTime = useStore.getState().currentTimestamp;
      const videoDuration = video.duration;

      // Detect loop: video near end jumping to near start (only when actually playing)
      const isActuallyPlaying = !video.paused;
      const isLoopingBack = isActuallyPlaying && currentStoreTime > (videoDuration - 0.5) && video.currentTime < 0.5;

      // Ignore large backward jumps (likely from video element resetting unexpectedly)
      // but allow the loop case
      if (!isLoopingBack && currentStoreTime - video.currentTime > 0.5) {
        return;
      }
      setCurrentTimestamp(video.currentTime);
    }
  }, [setCurrentTimestamp]);

  // Handle seek completion
  const handleSeeked = useCallback(() => {
    isSeeking.current = false;
    setIsSeeking(false);
  }, [setIsSeeking]);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (video && currentVideo) {
      isSeeking.current = true;
      const clampedTime = Math.max(0, Math.min(time, currentVideo.duration));
      video.currentTime = clampedTime;
      setCurrentTimestamp(clampedTime);
    }
  }, [currentVideo, setCurrentTimestamp]);

  // Step frame forward/backward
  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      if (!currentVideo) return;
      const frameDuration = 1 / currentVideo.frameRate;
      const newTime = currentTimestamp + direction * frameDuration;
      seekTo(newTime);
    },
    [currentVideo, currentTimestamp, seekTo]
  );

  if (!currentVideo) {
    return null;
  }

  // Convert file path to custom protocol URL for video element
  // Use three slashes to indicate no host component in the URL
  const videoSrc = `local-file:///${currentVideo.filePath.replace(/\\/g, '/')}`;

  return (
    <div className="flex flex-col h-full">
      {/* Video element */}
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden relative">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-lg text-white">{loadingMessage}</span>
          </div>
        )}
        {/* Hover preview - shows frame thumbnail in video area when hovering */}
        {hoveredFrame && (
          <img
            src={`local-file:///${hoveredFrame.thumbnailPath.replace(/\\/g, '/')}`}
            alt={`Frame ${hoveredFrame.frameNumber} preview`}
            className="absolute inset-0 w-full h-full object-contain z-5"
          />
        )}
        <video
          ref={videoRef}
          src={videoSrc}
          className="max-w-full max-h-full"
          loop
          onTimeUpdate={handleTimeUpdate}
          onSeeked={handleSeeked}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (video) {
              // Seek to last position if available
              if (currentTimestamp > 0) {
                video.currentTime = currentTimestamp;
              }
              // Autoplay
              video.play().catch(() => setIsPlaying(false));
              setIsPlaying(true);
            }
          }}
        />
      </div>

      {/* Controls */}
      <div className="bg-bg-secondary p-3 space-y-2">
        {/* Video Controls */}
        <VideoControls
          onStepBackward={() => stepFrame(-1)}
          onStepForward={() => stepFrame(1)}
          onSeekStart={() => seekTo(0)}
          onSeekEnd={() => seekTo(currentVideo.duration)}
        />

        {/* Scrubber */}
        <Scrubber
          currentTime={currentTimestamp}
          duration={currentVideo.duration}
          onSeek={seekTo}
        />

        {/* Time Display */}
        <TimeDisplay
          currentTime={currentTimestamp}
          duration={currentVideo.duration}
          frameRate={currentVideo.frameRate}
          totalFrames={currentVideo.totalFrames}
        />
      </div>
    </div>
  );
}
