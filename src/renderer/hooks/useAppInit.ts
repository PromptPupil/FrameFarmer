import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { useVideoActions } from './useVideoActions';

export function useAppInit() {
  const {
    setSettings,
    setFfmpegStatus,
    setWorkflowTemplates,
    setVideoQueue,
    setComfyuiConnected,
    addToast,
    ffmpegStatus,
  } = useStore();

  const { loadVideo } = useVideoActions();
  const hasLoadedLastVideo = useRef(false);

  // Initial app setup
  useEffect(() => {
    const init = async () => {
      try {
        // Load settings from database
        const loadedSettings = await window.electronAPI.invoke('db:get-settings', {});
        setSettings(loadedSettings);

        // Check FFmpeg status
        const ffmpegStatusResult = await window.electronAPI.invoke('app:get-ffmpeg-status', {});
        setFfmpegStatus(ffmpegStatusResult);

        if (!ffmpegStatusResult.available) {
          addToast({
            type: 'warning',
            message: 'FFmpeg not found. Video features are disabled.',
            duration: 0, // Don't auto-dismiss
          });
        }

        // Load workflow templates
        const templates = await window.electronAPI.invoke('db:get-workflow-templates', {});
        setWorkflowTemplates(templates);

        // Load video queue
        const queue = await window.electronAPI.invoke('db:get-queue', {});
        setVideoQueue(
          queue.map((item) => ({
            id: item.id,
            filePath: item.filePath,
            fileName: item.filePath.split(/[/\\]/).pop() ?? 'Unknown',
            status: item.status as 'pending' | 'processing' | 'completed',
            addedAt: new Date(item.addedAt * 1000),
          }))
        );

        // Test ComfyUI connection
        const connectionResult = await window.electronAPI.invoke('comfyui:test-connection', {
          baseUrl: loadedSettings.comfyuiBaseUrl,
        });
        setComfyuiConnected(connectionResult.connected);
      } catch (err) {
        console.error('App initialization error:', err);
        addToast({
          type: 'error',
          message: `Initialization error: ${err}`,
          duration: 5000,
        });
      }
    };

    init();
  }, []);

  // Load last opened video once FFmpeg is confirmed available
  useEffect(() => {
    if (!ffmpegStatus.available || hasLoadedLastVideo.current) return;

    const loadLastVideo = async () => {
      try {
        const lastVideo = await window.electronAPI.invoke('db:get-last-video', {});
        if (lastVideo?.filePath) {
          const fileExists = await window.electronAPI.invoke('fs:file-exists', {
            filePath: lastVideo.filePath,
          });
          if (fileExists) {
            hasLoadedLastVideo.current = true;
            loadVideo(lastVideo.filePath);
          }
        }
      } catch (err) {
        console.error('Failed to load last video:', err);
      }
    };

    loadLastVideo();
  }, [ffmpegStatus.available, loadVideo]);
}
