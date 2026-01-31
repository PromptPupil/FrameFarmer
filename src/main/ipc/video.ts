import { ipcMain, BrowserWindow } from 'electron';
import { ffmpegService } from '../services/ffmpeg';
import log from 'electron-log';

export function registerVideoHandlers(): void {
  // Load video and get info
  ipcMain.handle('video:load', async (_event, { filePath }: { filePath: string }) => {
    const start = Date.now();
    log.info(`[TIMING] video:load START - ${filePath}`);
    const result = await ffmpegService.getVideoInfo(filePath);
    log.info(`[TIMING] video:load END - ${Date.now() - start}ms`);
    return result;
  });

  // Get video info only (without side effects)
  ipcMain.handle('video:get-info', async (_event, { filePath }: { filePath: string }) => {
    return ffmpegService.getVideoInfo(filePath);
  });

  // Extract multiple frames
  ipcMain.handle(
    'video:extract-frames',
    async (
      event,
      {
        videoPath,
        frameCount,
        thumbnailWidth,
      }: {
        videoPath: string;
        frameCount: number;
        thumbnailWidth: number;
      }
    ) => {
      const start = Date.now();
      log.info(`[TIMING] video:extract-frames START - ${frameCount} frames from: ${videoPath}`);

      const win = BrowserWindow.fromWebContents(event.sender);

      const frames = await ffmpegService.extractFramesForVideo(
        videoPath,
        frameCount,
        thumbnailWidth,
        (current, total) => {
          // Send progress to renderer
          win?.webContents.send('extraction:progress', { current, total });
        }
      );

      log.info(`[TIMING] video:extract-frames END - ${Date.now() - start}ms total, ${frames.length} frames`);
      return frames;
    }
  );

  // Extract single frame at timestamp
  ipcMain.handle(
    'video:extract-single',
    async (
      _event,
      {
        videoPath,
        timestamp,
        fullRes,
      }: {
        videoPath: string;
        timestamp: number;
        outputPath: string;
        fullRes: boolean;
      }
    ) => {
      log.info(`Extracting frame at ${timestamp}s from: ${videoPath}`);
      return ffmpegService.extractSingleFrame(videoPath, timestamp, fullRes);
    }
  );
}
