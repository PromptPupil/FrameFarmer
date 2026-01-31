import crypto from 'crypto';
import fs from 'fs';

/**
 * Generate a cache key for a video file based on path and modification time.
 * This is fast (no need to read file contents) and invalidates when file changes.
 *
 * @param filePath - Absolute path to the video file
 * @returns 16-character hex string cache key
 */
export function generateVideoCacheKey(filePath: string): string {
  const stats = fs.statSync(filePath);
  const mtimeMs = stats.mtimeMs.toString();
  const input = filePath + mtimeMs;
  return crypto.createHash('md5').update(input).digest('hex').substring(0, 16);
}

/**
 * Generate a unique ID using UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}
