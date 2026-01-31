import { useCallback } from 'react';
import { useStore } from '../store';

export function useVideoActions() {
  const {
    setCurrentVideo,
    setFrames,
    clearFrames,
    selectNone,
    clearAnalysisResults,
    setTimelineMarkers,
    setCurrentTimestamp,
    setVideosInDirectory,
    setCurrentVideoIndex,
    setSelectedFrames,
    setIsLoading,
    setLoadingMessage,
    setExtractionProgress,
    setIsAnalyzing,
    setAnalysisProgress,
    setAllAnalysisResults,
    addToast,
    settings,
    videoQueue,
    updateQueueItem,
    currentVideo,
    selectedFrames,
    timelineMarkers,
    currentTimestamp,
    ffmpegStatus,
  } = useStore();

  // Save current video state before switching
  const saveCurrentVideoState = useCallback(async () => {
    if (!currentVideo) return;

    try {
      await window.electronAPI.invoke('db:save-video-state', {
        id: `video-${Date.now()}`,
        filePath: currentVideo.filePath,
        selectedFrames: Array.from(selectedFrames),
        timelineMarkers,
        lastPosition: currentTimestamp,
        lastOpenedAt: new Date(),
      });
    } catch (err) {
      console.error('Failed to save video state:', err);
    }
  }, [currentVideo, selectedFrames, timelineMarkers, currentTimestamp]);

  // Open video file
  const openVideo = useCallback(async () => {
    if (!ffmpegStatus.available) {
      addToast({ type: 'error', message: 'FFmpeg is not available', duration: 3000 });
      return;
    }

    try {
      const result = await window.electronAPI.invoke('fs:select-file', {
        title: 'Select Video File',
      });

      if (result.filePath) {
        await loadVideo(result.filePath);
      }
    } catch (err) {
      addToast({ type: 'error', message: `Failed to open video: ${err}`, duration: 5000 });
    }
  }, [ffmpegStatus.available]);

  // Load video by path
  const loadVideo = useCallback(
    async (filePath: string) => {
      if (!ffmpegStatus.available) {
        addToast({ type: 'error', message: 'FFmpeg is not available', duration: 3000 });
        return;
      }

      const totalStart = performance.now();
      const timing: Record<string, number> = {};

      // Save state of previous video
      let stepStart = performance.now();
      await saveCurrentVideoState();
      timing['saveCurrentVideoState'] = performance.now() - stepStart;

      setIsLoading(true);
      setLoadingMessage('Loading video...');

      try {
        // Get video info
        stepStart = performance.now();
        const videoInfo = await window.electronAPI.invoke('video:load', { filePath });
        timing['video:load'] = performance.now() - stepStart;
        setCurrentVideo(videoInfo);

        // Clear previous state
        clearFrames();
        selectNone();
        clearAnalysisResults();
        setTimelineMarkers([]);
        setCurrentTimestamp(0);
        setExtractionProgress(null);

        // Load saved state for this video
        stepStart = performance.now();
        const savedState = await window.electronAPI.invoke('db:get-video-state', { filePath });
        timing['db:get-video-state'] = performance.now() - stepStart;
        if (savedState) {
          setSelectedFrames(savedState.selectedFrames);
          setTimelineMarkers(savedState.timelineMarkers);
          setCurrentTimestamp(savedState.lastPosition);
        }

        // Clear directory video list - will be populated on-demand when user navigates
        setVideosInDirectory([]);
        setCurrentVideoIndex(-1);

        // Extract frames
        setLoadingMessage('Extracting frames...');
        stepStart = performance.now();
        const frames = await window.electronAPI.invoke('video:extract-frames', {
          videoPath: filePath,
          frameCount: settings.defaultFrameCount,
          thumbnailWidth: settings.thumbnailWidth,
        });
        timing['video:extract-frames'] = performance.now() - stepStart;
        setFrames(frames);
        setExtractionProgress(null);

        // Auto-analyze if enabled
        if (settings.autoAnalyze) {
          setIsAnalyzing(true);
          setAnalysisProgress(0);
          setLoadingMessage('Analyzing frames...');

          const analysisResults = await window.electronAPI.invoke('frame:analyze-batch', {
            imagePaths: frames.map((f) => ({
              path: f.thumbnailPath,
              frameNumber: f.frameNumber,
              timestamp: f.timestamp,
            })),
          });

          setAllAnalysisResults(analysisResults);
          setIsAnalyzing(false);
          setAnalysisProgress(100);
        }

        timing['total'] = performance.now() - totalStart;
        console.log('[TIMING] loadVideo breakdown:', timing);
        // Write timing to a file for debugging
        window.electronAPI.invoke('debug:write-timing', { timing, filePath }).catch(() => {});

        setIsLoading(false);
        setLoadingMessage('');
        addToast({ type: 'success', message: `Loaded: ${videoInfo.fileName}`, duration: 2000 });
      } catch (err) {
        setIsLoading(false);
        setLoadingMessage('');
        addToast({ type: 'error', message: `Failed to load video: ${err}`, duration: 5000 });
        throw err;
      }
    },
    [ffmpegStatus.available, settings, saveCurrentVideoState]
  );

  // Load video from queue
  const loadVideoFromQueue = useCallback(
    async (queueId: string) => {
      const queueItem = videoQueue.find((v) => v.id === queueId);
      if (!queueItem) return;

      updateQueueItem(queueId, { status: 'processing' });

      try {
        await loadVideo(queueItem.filePath);
        updateQueueItem(queueId, { status: 'completed', processedAt: new Date() });
      } catch {
        updateQueueItem(queueId, { status: 'pending' });
      }
    },
    [videoQueue, loadVideo, updateQueueItem]
  );

  // Re-extract frames with new frame count (for current video)
  const reExtractFrames = useCallback(
    async (frameCount: number) => {
      if (!currentVideo || !ffmpegStatus.available) return;

      setIsLoading(true);
      setLoadingMessage('Re-extracting frames...');

      try {
        // Clear previous frames and analysis
        clearFrames();
        selectNone();
        clearAnalysisResults();
        setExtractionProgress(null);

        // Extract frames with new count
        const frames = await window.electronAPI.invoke('video:extract-frames', {
          videoPath: currentVideo.filePath,
          frameCount,
          thumbnailWidth: settings.thumbnailWidth,
        });
        setFrames(frames);
        setExtractionProgress(null);

        // Auto-analyze if enabled
        if (settings.autoAnalyze) {
          setIsAnalyzing(true);
          setAnalysisProgress(0);
          setLoadingMessage('Analyzing frames...');

          const analysisResults = await window.electronAPI.invoke('frame:analyze-batch', {
            imagePaths: frames.map((f) => ({
              path: f.thumbnailPath,
              frameNumber: f.frameNumber,
              timestamp: f.timestamp,
            })),
          });

          setAllAnalysisResults(analysisResults);
          setIsAnalyzing(false);
          setAnalysisProgress(100);
        }

        setIsLoading(false);
        setLoadingMessage('');
        addToast({ type: 'success', message: `Extracted ${frames.length} frames`, duration: 2000 });
      } catch (err) {
        setIsLoading(false);
        setLoadingMessage('');
        addToast({ type: 'error', message: `Failed to extract frames: ${err}`, duration: 5000 });
      }
    },
    [currentVideo, ffmpegStatus.available, settings]
  );

  return {
    openVideo,
    loadVideo,
    loadVideoFromQueue,
    saveCurrentVideoState,
    reExtractFrames,
  };
}
