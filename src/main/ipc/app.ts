import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { ffmpegService } from '../services/ffmpeg';
import { getSoundsPath, getAppDataPath } from '../utils/paths';
import log from 'electron-log';

export function registerAppHandlers(): void {
  // Get app version
  ipcMain.handle('app:get-version', async () => {
    return { version: app.getVersion() };
  });

  // Get FFmpeg status
  ipcMain.handle('app:get-ffmpeg-status', async () => {
    return ffmpegService.getStatus();
  });

  // Play notification sound
  ipcMain.handle('app:play-notification-sound', async () => {
    try {
      // Note: The actual sound playing is handled by the renderer process
      // This handler just returns the path to the sound file
      const soundPath = path.join(getSoundsPath(), 'notification.wav');
      return { success: true, soundPath };
    } catch {
      return { success: false };
    }
  });

  // Debug: Write timing data to file
  ipcMain.handle('debug:write-timing', async (_event, { timing, filePath }: { timing: Record<string, number>; filePath: string }) => {
    try {
      const timingPath = path.join(getAppDataPath(), 'timing-debug.json');
      const entry = {
        timestamp: new Date().toISOString(),
        filePath,
        timing,
      };
      log.info(`[TIMING] Renderer timing: ${JSON.stringify(timing)}`);
      fs.writeFileSync(timingPath, JSON.stringify(entry, null, 2));
      return { success: true, path: timingPath };
    } catch (err) {
      log.error('Failed to write timing data:', err);
      return { success: false };
    }
  });
}
