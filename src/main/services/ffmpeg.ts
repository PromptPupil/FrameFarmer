import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { app } from 'electron';
import type { VideoInfo, FFmpegStatus, ExtractedFrame } from '../../shared/types';
import { getVideoCachePath, ensureDirectory } from '../utils/paths';
import { generateVideoCacheKey } from '../utils/hash';

class FFmpegService {
  private status: FFmpegStatus = {
    available: false,
    ffmpegPath: null,
    ffprobePath: null,
    version: null,
  };

  constructor() {
    this.detectFFmpeg();
  }

  private detectFFmpeg(): void {
    const candidates = this.getCandidatePaths();

    for (const ffmpegPath of candidates) {
      const verified = this.verifyFFmpeg(ffmpegPath);
      if (verified) {
        const ffprobePath = this.getFfprobePath(ffmpegPath);
        if (this.verifyFFprobe(ffprobePath)) {
          this.status = {
            available: true,
            ffmpegPath: verified,
            ffprobePath,
            version: this.getVersion(verified),
          };
          log.info(`FFmpeg found at: ${verified}`);
          log.info(`FFprobe found at: ${ffprobePath}`);
          log.info(`FFmpeg version: ${this.status.version}`);
          return;
        }
      }
    }

    log.warn('FFmpeg not found. Video features will be disabled.');
    this.status.available = false;
  }

  private getCandidatePaths(): string[] {
    const candidates: string[] = [];

    // 1. Environment variable (highest priority)
    if (process.env.FFMPEG_PATH) {
      candidates.push(process.env.FFMPEG_PATH);
    }

    // 2. User's known location (from spec)
    candidates.push('C:\\_EnvironmentVarProgs\\ffmpeg.exe');
    candidates.push('C:\\_EnvironmentVarProgs\\bin\\ffmpeg.exe');
    candidates.push('C:\\_EnvironmentVarProgs\\ffmpeg\\bin\\ffmpeg.exe');

    // 3. App's resources folder (for bundled FFmpeg)
    const resourcesPath = app.isPackaged
      ? process.resourcesPath
      : path.join(__dirname, '../../../resources');
    candidates.push(path.join(resourcesPath, 'ffmpeg', 'ffmpeg.exe'));
    candidates.push(path.join(resourcesPath, 'ffmpeg', 'bin', 'ffmpeg.exe'));

    // 4. Common Windows locations
    if (process.platform === 'win32') {
      candidates.push('C:\\ffmpeg\\bin\\ffmpeg.exe');
      candidates.push('C:\\ffmpeg\\ffmpeg.exe');
      candidates.push('C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe');
      candidates.push('C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe');
    }

    // 5. System PATH (will be checked via where/which)
    candidates.push('ffmpeg');

    return candidates;
  }

  private verifyFFmpeg(ffmpegPath: string): string | null {
    // Check if it's a PATH reference
    if (ffmpegPath === 'ffmpeg' || !path.isAbsolute(ffmpegPath)) {
      try {
        const which = process.platform === 'win32' ? 'where' : 'which';
        const result = spawnSync(which, [ffmpegPath], {
          encoding: 'utf8',
          timeout: 5000,
        });
        if (result.status === 0 && result.stdout) {
          // Return the first line (path found)
          const foundPath = result.stdout.trim().split('\n')[0];
          if (foundPath && fs.existsSync(foundPath)) {
            return foundPath;
          }
        }
        return null;
      } catch {
        return null;
      }
    }

    // Check absolute path
    if (fs.existsSync(ffmpegPath)) {
      return ffmpegPath;
    }
    return null;
  }

  private getFfprobePath(ffmpegPath: string): string {
    // Replace ffmpeg with ffprobe in the path
    if (process.platform === 'win32') {
      return ffmpegPath.replace(/ffmpeg\.exe$/i, 'ffprobe.exe');
    }
    return ffmpegPath.replace(/ffmpeg$/, 'ffprobe');
  }

  private verifyFFprobe(ffprobePath: string): boolean {
    if (ffprobePath === 'ffprobe' || !path.isAbsolute(ffprobePath)) {
      try {
        const which = process.platform === 'win32' ? 'where' : 'which';
        const result = spawnSync(which, ['ffprobe'], {
          encoding: 'utf8',
          timeout: 5000,
        });
        return result.status === 0;
      } catch {
        return false;
      }
    }
    return fs.existsSync(ffprobePath);
  }

  private getVersion(ffmpegPath: string): string | null {
    try {
      const result = spawnSync(ffmpegPath, ['-version'], {
        encoding: 'utf8',
        timeout: 5000,
      });
      const match = result.stdout?.match(/ffmpeg version (\S+)/);
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  }

  getStatus(): FFmpegStatus {
    return { ...this.status };
  }

  private ensureAvailable(): void {
    if (!this.status.available || !this.status.ffmpegPath || !this.status.ffprobePath) {
      throw new Error(
        'FFmpeg is not available. Please install FFmpeg and restart the application.'
      );
    }
  }

  async getVideoInfo(videoPath: string): Promise<VideoInfo> {
    this.ensureAvailable();
    const start = Date.now();
    log.info(`[TIMING] getVideoInfo START - ${videoPath}`);

    return new Promise((resolve, reject) => {
      const proc = spawn(this.status.ffprobePath!, [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        videoPath,
      ]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data;
      });
      proc.stderr.on('data', (data) => {
        stderr += data;
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFprobe failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          const videoStream = parsed.streams?.find(
            (s: { codec_type: string }) => s.codec_type === 'video'
          );

          if (!videoStream) {
            reject(new Error('No video stream found in file'));
            return;
          }

          // Parse frame rate (could be "24000/1001" or "24/1" or "24")
          let frameRate = 24; // Default
          if (videoStream.r_frame_rate) {
            const parts = videoStream.r_frame_rate.split('/');
            const num = parseFloat(parts[0] ?? '24');
            const den = parts[1] ? parseFloat(parts[1]) : 1;
            frameRate = den > 0 ? num / den : num;
          }

          const duration = parseFloat(parsed.format?.duration ?? '0');
          const stats = fs.statSync(videoPath);

          log.info(`[TIMING] getVideoInfo END - ${Date.now() - start}ms`);
          resolve({
            filePath: videoPath,
            fileName: path.basename(videoPath),
            directory: path.dirname(videoPath),
            duration,
            frameRate,
            width: videoStream.width ?? 0,
            height: videoStream.height ?? 0,
            fileSize: parseInt(parsed.format?.size ?? '0', 10),
            modifiedAt: stats.mtime,
            totalFrames: Math.floor(duration * frameRate),
          });
        } catch (err) {
          reject(new Error(`Failed to parse FFprobe output: ${err}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`FFprobe spawn error: ${err.message}`));
      });
    });
  }

  async extractFrame(
    videoPath: string,
    timestamp: number,
    outputPath: string,
    options?: { width?: number }
  ): Promise<void> {
    this.ensureAvailable();

    const args = ['-ss', timestamp.toFixed(3), '-i', videoPath, '-vframes', '1', '-q:v', '2'];

    if (options?.width) {
      args.push('-vf', `scale=${options.width}:-1`);
    }

    args.push('-y', outputPath);

    return this.runFFmpeg(args);
  }

  async extractMultipleFrames(
    videoPath: string,
    timestamps: number[],
    outputDir: string,
    options?: { width?: number; concurrency?: number },
    onProgress?: (current: number, total: number) => void
  ): Promise<ExtractedFrame[]> {
    this.ensureAvailable();
    ensureDirectory(outputDir);

    const concurrency = options?.concurrency ?? 4;
    const results: ExtractedFrame[] = [];
    let completed = 0;

    // Get video info for frame number calculation
    const videoInfoStart = Date.now();
    const videoInfo = await this.getVideoInfo(videoPath);
    log.info(`[TIMING] extractMultipleFrames getVideoInfo (redundant) - ${Date.now() - videoInfoStart}ms`);

    // Process in batches
    for (let i = 0; i < timestamps.length; i += concurrency) {
      const batchStart = Date.now();
      const batch = timestamps.slice(i, i + concurrency);
      const batchPromises = batch.map(async (ts, idx) => {
        const frameIndex = i + idx;
        const frameNumber = Math.round(ts * videoInfo.frameRate);
        const outputPath = path.join(outputDir, `thumb_${String(frameIndex).padStart(5, '0')}.jpg`);

        const frameStart = Date.now();
        await this.extractFrame(videoPath, ts, outputPath, options);
        log.info(`[TIMING] single frame ${frameIndex} at ${ts.toFixed(2)}s - ${Date.now() - frameStart}ms`);

        completed++;
        onProgress?.(completed, timestamps.length);

        return {
          frameNumber,
          timestamp: ts,
          thumbnailPath: outputPath,
        };
      });

      const batchResults = await Promise.all(batchPromises);
      log.info(`[TIMING] batch ${Math.floor(i / concurrency) + 1} complete - ${Date.now() - batchStart}ms`);
      results.push(...batchResults);
    }

    return results;
  }

  calculateFrameTimestamps(
    duration: number,
    frameCount: number,
    frameRate: number
  ): number[] {
    const timestamps: number[] = [];

    // Avoid very start and end (often black frames)
    const startOffset = Math.min(0.1, duration * 0.01);
    const endOffset = Math.min(0.1, duration * 0.01);

    const effectiveDuration = duration - startOffset - endOffset;

    if (frameCount === 1) {
      timestamps.push(duration / 2);
    } else {
      const step = effectiveDuration / (frameCount - 1);
      for (let i = 0; i < frameCount; i++) {
        const time = startOffset + i * step;
        // Snap to nearest frame boundary
        const frameNum = Math.round(time * frameRate);
        timestamps.push(frameNum / frameRate);
      }
    }

    return timestamps;
  }

  async extractFramesForVideo(
    videoPath: string,
    frameCount: number,
    thumbnailWidth: number,
    onProgress?: (current: number, total: number) => void
  ): Promise<ExtractedFrame[]> {
    const start = Date.now();
    log.info(`[TIMING] extractFramesForVideo START - ${frameCount} frames`);

    const cacheKey = generateVideoCacheKey(videoPath);
    const cacheDir = getVideoCachePath(cacheKey);
    log.info(`[TIMING] cache setup - ${Date.now() - start}ms`);

    // Get video info
    const videoInfoStart = Date.now();
    const videoInfo = await this.getVideoInfo(videoPath);
    log.info(`[TIMING] getVideoInfo in extractFramesForVideo - ${Date.now() - videoInfoStart}ms`);

    // Calculate timestamps
    const timestamps = this.calculateFrameTimestamps(
      videoInfo.duration,
      frameCount,
      videoInfo.frameRate
    );

    // Extract frames
    const extractStart = Date.now();
    const result = await this.extractMultipleFrames(
      videoPath,
      timestamps,
      cacheDir,
      { width: thumbnailWidth },
      onProgress
    );
    log.info(`[TIMING] extractMultipleFrames - ${Date.now() - extractStart}ms`);
    log.info(`[TIMING] extractFramesForVideo END - ${Date.now() - start}ms total`);
    return result;
  }

  async extractSingleFrame(
    videoPath: string,
    timestamp: number,
    fullRes: boolean = false
  ): Promise<ExtractedFrame> {
    this.ensureAvailable();

    const cacheKey = generateVideoCacheKey(videoPath);
    const cacheDir = getVideoCachePath(cacheKey);

    const videoInfo = await this.getVideoInfo(videoPath);
    const frameNumber = Math.round(timestamp * videoInfo.frameRate);

    const outputPath = path.join(
      cacheDir,
      `frame_${String(frameNumber).padStart(5, '0')}_manual.${fullRes ? 'png' : 'jpg'}`
    );

    await this.extractFrame(
      videoPath,
      timestamp,
      outputPath,
      fullRes ? undefined : { width: 320 }
    );

    return {
      frameNumber,
      timestamp,
      thumbnailPath: outputPath,
      fullResPath: fullRes ? outputPath : undefined,
    };
  }

  async saveFramesToDisk(
    videoPath: string,
    frames: Array<{ frameNumber: number; timestamp: number }>,
    outputDir: string,
    filenamePattern: string,
    format: 'png' | 'jpg',
    jpgQuality: number = 95,
    onProgress?: (current: number, total: number) => void
  ): Promise<string[]> {
    this.ensureAvailable();
    ensureDirectory(outputDir);

    const videoName = path.basename(videoPath, path.extname(videoPath));
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0] ?? '';
    const timeStr = now.toISOString().replace(/[-:]/g, '').split('.')[0]?.replace('T', '_') ?? '';

    const savedPaths: string[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (!frame) continue;

      // Build filename from pattern
      let filename = filenamePattern
        .replace('{video}', videoName)
        .replace('{frame}', String(frame.frameNumber).padStart(5, '0'))
        .replace('{datetime}', `${dateStr}_${timeStr}`)
        .replace('{date}', dateStr)
        .replace(
          '{time}',
          `${String(Math.floor(frame.timestamp / 60)).padStart(2, '0')}-${String(Math.floor(frame.timestamp % 60)).padStart(2, '0')}-${String(Math.floor((frame.timestamp % 1) * 1000)).padStart(3, '0')}`
        );

      filename = `${filename}.${format}`;
      const outputPath = path.join(outputDir, filename);

      const args = [
        '-ss',
        frame.timestamp.toFixed(3),
        '-i',
        videoPath,
        '-vframes',
        '1',
      ];

      if (format === 'jpg') {
        args.push('-q:v', String(Math.round((100 - jpgQuality) / 3.2) + 1)); // Convert 1-100 to FFmpeg scale
      }

      args.push('-y', outputPath);

      await this.runFFmpeg(args);
      savedPaths.push(outputPath);

      onProgress?.(i + 1, frames.length);
    }

    return savedPaths;
  }

  async createGif(
    framePaths: string[],
    outputPath: string,
    fps: number
  ): Promise<void> {
    this.ensureAvailable();
    ensureDirectory(path.dirname(outputPath));

    // Create a temp file list for FFmpeg
    const listPath = path.join(path.dirname(outputPath), `frames_list_${Date.now()}.txt`);
    const listContent = framePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    try {
      // Generate palette
      const palettePath = path.join(path.dirname(outputPath), `palette_${Date.now()}.png`);
      await this.runFFmpeg([
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-vf',
        `fps=${fps},palettegen`,
        '-y',
        palettePath,
      ]);

      // Create GIF using palette
      await this.runFFmpeg([
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-i',
        palettePath,
        '-lavfi',
        `fps=${fps} [x]; [x][1:v] paletteuse`,
        '-y',
        outputPath,
      ]);

      // Cleanup palette
      if (fs.existsSync(palettePath)) {
        fs.unlinkSync(palettePath);
      }
    } finally {
      // Cleanup list file
      if (fs.existsSync(listPath)) {
        fs.unlinkSync(listPath);
      }
    }
  }

  async createMp4(
    framePaths: string[],
    outputPath: string,
    fps: number
  ): Promise<void> {
    this.ensureAvailable();
    ensureDirectory(path.dirname(outputPath));

    // Create a temp file list for FFmpeg
    const listPath = path.join(path.dirname(outputPath), `frames_list_${Date.now()}.txt`);
    const frameDuration = 1 / fps;
    const listContent = framePaths
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join(`\nduration ${frameDuration}\n`);
    fs.writeFileSync(listPath, listContent + `\nduration ${frameDuration}`);

    try {
      await this.runFFmpeg([
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-y',
        outputPath,
      ]);
    } finally {
      // Cleanup list file
      if (fs.existsSync(listPath)) {
        fs.unlinkSync(listPath);
      }
    }
  }

  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.status.ffmpegPath!, args);

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data;
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`FFmpeg spawn error: ${err.message}`));
      });
    });
  }
}

// Export singleton instance
export const ffmpegService = new FFmpegService();
