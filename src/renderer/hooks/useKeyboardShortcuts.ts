import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { useVideoActions } from './useVideoActions';
import { useFrameActions } from './useFrameActions';

export function useKeyboardShortcuts() {
  const {
    currentVideo,
    togglePlayPause,
    setCurrentTimestamp,
    currentTimestamp,
    goToNextVideo,
    goToPreviousVideo,
    selectAll,
    selectNone,
    invertSelection,
    toggleFrameSelection,
    frames,
    addTimelineMarker,
    setSettingsDialogOpen,
    setExportDialogOpen,
    thumbnailSize,
    setThumbnailSize,
    showBlurryFrames,
    setShowBlurryFrames,
    showDuplicateFrames,
    setShowDuplicateFrames,
  } = useStore();

  const { openVideo } = useVideoActions();
  const { saveSelectedFrames, grabFrameAtPlayhead } = useFrameActions();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            openVideo();
            break;
          case 's':
            e.preventDefault();
            saveSelectedFrames();
            break;
          case 'e':
            e.preventDefault();
            setExportDialogOpen(true);
            break;
          case ',':
            e.preventDefault();
            setSettingsDialogOpen(true);
            break;
        }
        return;
      }

      // Frame stepping and navigation
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentVideo) {
            const frameDuration = 1 / currentVideo.frameRate;
            setCurrentTimestamp(Math.max(0, currentTimestamp - frameDuration));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentVideo) {
            const frameDuration = 1 / currentVideo.frameRate;
            setCurrentTimestamp(
              Math.min(currentVideo.duration, currentTimestamp + frameDuration)
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          goToPreviousVideo();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goToNextVideo();
          break;
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'Home':
          e.preventDefault();
          setCurrentTimestamp(0);
          break;
        case 'End':
          e.preventDefault();
          if (currentVideo) {
            setCurrentTimestamp(currentVideo.duration);
          }
          break;

        // Selection shortcuts
        case 'a':
        case 'A':
          e.preventDefault();
          selectAll();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          selectNone();
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          invertSelection();
          break;

        // Number keys for quick frame selection (1-9)
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const frameIndex = parseInt(e.key) - 1;
          if (frames[frameIndex]) {
            toggleFrameSelection(frames[frameIndex].frameNumber);
          }
          break;

        // Grab frame
        case 'g':
        case 'G':
          e.preventDefault();
          grabFrameAtPlayhead();
          break;

        // Add marker
        case 'm':
        case 'M':
          e.preventDefault();
          if (currentVideo) {
            addTimelineMarker({
              id: `marker-${Date.now()}`,
              timestamp: currentTimestamp,
              label: `Marker ${currentTimestamp.toFixed(2)}s`,
            });
          }
          break;

        // Thumbnail size
        case '[':
          e.preventDefault();
          if (thumbnailSize === 'large') setThumbnailSize('medium');
          else if (thumbnailSize === 'medium') setThumbnailSize('small');
          break;
        case ']':
          e.preventDefault();
          if (thumbnailSize === 'small') setThumbnailSize('medium');
          else if (thumbnailSize === 'medium') setThumbnailSize('large');
          break;

        // Toggle filters
        case 'b':
        case 'B':
          e.preventDefault();
          setShowBlurryFrames(!showBlurryFrames);
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          setShowDuplicateFrames(!showDuplicateFrames);
          break;
      }
    },
    [
      currentVideo,
      currentTimestamp,
      frames,
      thumbnailSize,
      showBlurryFrames,
      showDuplicateFrames,
      openVideo,
      saveSelectedFrames,
      grabFrameAtPlayhead,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
