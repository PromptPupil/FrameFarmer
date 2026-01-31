import { useCallback } from 'react';
import { useStore } from '../store';

export function useFrameActions() {
  const {
    currentVideo,
    selectedFrames,
    frames,
    currentTimestamp,
    settings,
    addFrame,
    selectFrame,
    addToast,
    setExtractionProgress,
    ffmpegStatus,
  } = useStore();

  // Save selected frames to disk
  const saveSelectedFrames = useCallback(async () => {
    if (!currentVideo || selectedFrames.size === 0) {
      addToast({ type: 'warning', message: 'No frames selected', duration: 2000 });
      return;
    }

    if (!ffmpegStatus.available) {
      addToast({ type: 'error', message: 'FFmpeg is not available', duration: 3000 });
      return;
    }

    try {
      // Determine output directory
      const baseDir = settings.outputFolderBase ?? currentVideo.directory;
      const videoName = currentVideo.fileName.replace(/\.[^.]+$/, '');
      const dateStr = new Date().toISOString().split('T')[0];
      const outputDir = `${baseDir}/${videoName}_${dateStr}`;

      // Get frame info for selected frames
      const selectedFrameData = frames
        .filter((f) => selectedFrames.has(f.frameNumber))
        .map((f) => ({ frameNumber: f.frameNumber, timestamp: f.timestamp }));

      const result = await window.electronAPI.invoke('frame:save', {
        videoPath: currentVideo.filePath,
        frames: selectedFrameData,
        outputDir,
        filenamePattern: settings.filenamePattern,
        format: settings.outputFormat,
        jpgQuality: settings.jpgQuality,
      });

      setExtractionProgress(null);

      addToast({
        type: 'success',
        message: `Saved ${result.savedPaths.length} frames`,
        duration: 3000,
      });

      // Offer to open folder
      await window.electronAPI.invoke('fs:open-folder', { folderPath: outputDir });
    } catch (err) {
      setExtractionProgress(null);
      addToast({ type: 'error', message: `Failed to save frames: ${err}`, duration: 5000 });
    }
  }, [currentVideo, selectedFrames, frames, settings, ffmpegStatus.available]);

  // Grab frame at current playhead position
  const grabFrameAtPlayhead = useCallback(async () => {
    if (!currentVideo) {
      addToast({ type: 'warning', message: 'No video loaded', duration: 2000 });
      return;
    }

    if (!ffmpegStatus.available) {
      addToast({ type: 'error', message: 'FFmpeg is not available', duration: 3000 });
      return;
    }

    try {
      const frame = await window.electronAPI.invoke('video:extract-single', {
        videoPath: currentVideo.filePath,
        timestamp: currentTimestamp,
        outputPath: '', // Will be generated
        fullRes: false,
      });

      // Check if frame already exists in grid
      const existingFrame = frames.find((f) => f.frameNumber === frame.frameNumber);
      if (existingFrame) {
        // Just select it
        selectFrame(frame.frameNumber);
        addToast({ type: 'info', message: `Frame ${frame.frameNumber} selected`, duration: 1500 });
      } else {
        // Add new frame and select it
        addFrame(frame);
        selectFrame(frame.frameNumber);
        addToast({
          type: 'success',
          message: `Grabbed frame ${frame.frameNumber}`,
          duration: 1500,
        });
      }
    } catch (err) {
      addToast({ type: 'error', message: `Failed to grab frame: ${err}`, duration: 3000 });
    }
  }, [currentVideo, currentTimestamp, frames, ffmpegStatus.available]);

  // Export animation (GIF or MP4)
  const exportAnimation = useCallback(
    async (format: 'gif' | 'mp4', fps: number) => {
      if (!currentVideo || selectedFrames.size === 0) {
        addToast({ type: 'warning', message: 'No frames selected', duration: 2000 });
        return;
      }

      if (!ffmpegStatus.available) {
        addToast({ type: 'error', message: 'FFmpeg is not available', duration: 3000 });
        return;
      }

      try {
        // Get frame paths in order
        const selectedFrameData = frames
          .filter((f) => selectedFrames.has(f.frameNumber))
          .sort((a, b) => a.frameNumber - b.frameNumber);

        const framePaths = selectedFrameData.map((f) => f.thumbnailPath);

        // Determine output path
        const baseDir = settings.outputFolderBase ?? currentVideo.directory;
        const videoName = currentVideo.fileName.replace(/\.[^.]+$/, '');
        const dateStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        const outputPath = `${baseDir}/${videoName}_${dateStr}.${format}`;

        await window.electronAPI.invoke('frame:export-animation', {
          framePaths,
          outputPath,
          format,
          fps,
        });

        addToast({
          type: 'success',
          message: `Exported ${format.toUpperCase()} successfully`,
          duration: 3000,
        });

        // Open containing folder
        await window.electronAPI.invoke('fs:open-folder', { folderPath: baseDir });
      } catch (err) {
        addToast({ type: 'error', message: `Failed to export: ${err}`, duration: 5000 });
        throw err;
      }
    },
    [currentVideo, selectedFrames, frames, settings, ffmpegStatus.available]
  );

  return {
    saveSelectedFrames,
    grabFrameAtPlayhead,
    exportAnimation,
  };
}
