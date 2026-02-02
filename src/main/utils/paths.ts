import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Get the app's user data directory
 * Windows: %APPDATA%/FrameFarmer
 * macOS: ~/Library/Application Support/FrameFarmer
 * Linux: ~/.config/FrameFarmer
 */
export function getAppDataPath(): string {
  return app.getPath('userData');
}

/**
 * Get the database file path
 */
export function getDatabasePath(): string {
  return path.join(getAppDataPath(), 'framefarmer.db');
}

/**
 * Get the thumbnail cache directory
 */
export function getCachePath(): string {
  const cachePath = path.join(getAppDataPath(), 'cache');
  ensureDirectory(cachePath);
  return cachePath;
}

/**
 * Get the cache directory for a specific video
 */
export function getVideoCachePath(cacheKey: string): string {
  const videoCachePath = path.join(getCachePath(), cacheKey);
  ensureDirectory(videoCachePath);
  return videoCachePath;
}

/**
 * Get the logs directory
 */
export function getLogsPath(): string {
  const logsPath = path.join(getAppDataPath(), 'logs');
  ensureDirectory(logsPath);
  return logsPath;
}

/**
 * Get the resources directory (for bundled assets)
 */
export function getResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  // In development, app.getAppPath() returns the project root
  return path.join(app.getAppPath(), 'resources');
}

/**
 * Get the sounds directory
 */
export function getSoundsPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sounds');
  }
  // In development, app.getAppPath() returns the project root
  return path.join(app.getAppPath(), 'resources/sounds');
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Clean up old cache directories (older than 7 days)
 */
export function cleanupOldCache(maxAgeDays: number = 7): void {
  const cachePath = getCachePath();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  try {
    const entries = fs.readdirSync(cachePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(cachePath, entry.name);
        const stats = fs.statSync(dirPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      }
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Get video file extensions we support
 */
export const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv'];

/**
 * Check if a file is a supported video format
 */
export function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}
