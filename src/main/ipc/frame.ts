import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import { ffmpegService } from '../services/ffmpeg';
import { calculateBlurScore, analyzeFrames } from '../services/analyzer';
import { databaseService } from '../services/database';
import log from 'electron-log';

export function registerFrameHandlers(): void {
  // Save frames to disk
  ipcMain.handle(
    'frame:save',
    async (
      event,
      {
        videoPath,
        frames,
        outputDir,
        filenamePattern,
        format,
        jpgQuality,
      }: {
        videoPath: string;
        frames: Array<{ frameNumber: number; timestamp: number }>;
        outputDir: string;
        filenamePattern: string;
        format: 'png' | 'jpg';
        jpgQuality?: number;
      }
    ) => {
      log.info(`Saving ${frames.length} frames to: ${outputDir}`);

      const win = BrowserWindow.fromWebContents(event.sender);

      const savedPaths = await ffmpegService.saveFramesToDisk(
        videoPath,
        frames,
        outputDir,
        filenamePattern,
        format,
        jpgQuality ?? 95,
        (current, total) => {
          win?.webContents.send('extraction:progress', { current, total });
        }
      );

      return { savedPaths };
    }
  );

  // Analyze single frame for blur
  ipcMain.handle('frame:analyze-blur', async (_event, { imagePath }: { imagePath: string }) => {
    const blurScore = await calculateBlurScore(imagePath);
    return { blurScore };
  });

  // Analyze batch of frames
  ipcMain.handle(
    'frame:analyze-batch',
    async (
      event,
      {
        imagePaths,
      }: {
        imagePaths: Array<{ path: string; frameNumber: number; timestamp: number }>;
      }
    ) => {
      log.info(`Analyzing ${imagePaths.length} frames`);

      const win = BrowserWindow.fromWebContents(event.sender);
      const settings = databaseService.getSettings();

      const results = await analyzeFrames(
        imagePaths,
        settings.blurThreshold,
        settings.similarityThreshold,
        (current, total, frameNumber) => {
          win?.webContents.send('analysis:progress', { current, total, frameNumber });
        }
      );

      return results;
    }
  );

  // Export animation (GIF or MP4)
  ipcMain.handle(
    'frame:export-animation',
    async (
      _event,
      {
        framePaths,
        outputPath,
        format,
        fps,
      }: {
        framePaths: string[];
        outputPath: string;
        format: 'gif' | 'mp4';
        fps: number;
      }
    ) => {
      log.info(`Exporting ${format.toUpperCase()} with ${framePaths.length} frames to: ${outputPath}`);

      // Ensure output path has correct extension
      const ext = path.extname(outputPath).toLowerCase();
      let finalPath = outputPath;
      if (ext !== `.${format}`) {
        finalPath = outputPath.replace(/\.[^.]+$/, '') + `.${format}`;
      }

      if (format === 'gif') {
        await ffmpegService.createGif(framePaths, finalPath, fps);
      } else {
        await ffmpegService.createMp4(framePaths, finalPath, fps);
      }

      return { success: true, outputPath: finalPath };
    }
  );
}
