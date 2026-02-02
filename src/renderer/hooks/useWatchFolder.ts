import { useEffect } from 'react';
import { useStore } from '../store';

export function useWatchFolder() {
  const { addToQueue, addToast, settings } = useStore();

  useEffect(() => {
    // Subscribe to new video events from watch folder
    const unsubscribe = window.electronAPI.on('watch:new-video', ({ filePath, fileName }) => {
      // Add to queue
      addToQueue({
        id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filePath,
        fileName,
        addedAt: new Date(),
        status: 'pending',
      });

      // Show toast notification with sound
      addToast({
        type: 'info',
        message: `New video detected: ${fileName}`,
        duration: 5000,
        playSound: true,
      });

      // Play notification sound
      playNotificationSound();
    });

    return () => {
      unsubscribe();
    };
  }, [addToQueue, addToast]);

  // Start/stop watching based on settings
  useEffect(() => {
    const startWatch = async () => {
      if (settings.watchFolderEnabled && settings.watchFolderPath) {
        await window.electronAPI.invoke('fs:watch-folder', {
          folderPath: settings.watchFolderPath,
        });
      } else {
        await window.electronAPI.invoke('fs:unwatch-folder', {});
      }
    };

    startWatch();
  }, [settings.watchFolderEnabled, settings.watchFolderPath]);
}

async function playNotificationSound() {
  try {
    const result = await window.electronAPI.invoke('app:play-notification-sound', {});
    if (result.success && result.soundPath) {
      const soundUrl = `local-file:///${result.soundPath.replace(/\\/g, '/')}`;
      const audio = new Audio(soundUrl);
      audio.volume = 0.1;
      audio.play().catch(() => {
        // Ignore errors if sound can't be played
      });
    }
  } catch {
    // Ignore errors
  }
}
