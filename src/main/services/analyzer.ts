import sharp from 'sharp';
import log from 'electron-log';
import type { FrameAnalysis } from '../../shared/types';

/**
 * Calculate blur score using Laplacian variance method.
 * Higher score = more blurry (0-100 scale)
 */
export async function calculateBlurScore(imagePath: string): Promise<number> {
  try {
    // Load image and convert to grayscale
    const { data, info } = await sharp(imagePath)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    // Apply Laplacian kernel: [0, 1, 0], [1, -4, 1], [0, 1, 0]
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const center = data[idx] ?? 0;
        const left = data[idx - 1] ?? 0;
        const right = data[idx + 1] ?? 0;
        const top = data[idx - width] ?? 0;
        const bottom = data[idx + width] ?? 0;

        const laplacian = -4 * center + left + right + top + bottom;

        sum += laplacian;
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    if (count === 0) {
      return 100; // If we can't calculate, assume blurry
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Normalize to 0-100 scale (higher = more blurry)
    // Typical variance ranges from 0 (very blurry) to 2000+ (very sharp)
    const normalizedScore = Math.max(0, Math.min(100, 100 - variance / 20));

    return Math.round(normalizedScore * 10) / 10;
  } catch (err) {
    log.error(`Error calculating blur score for ${imagePath}:`, err);
    throw err;
  }
}

/**
 * Calculate perceptual hash using difference hash (dHash) method.
 * Returns a 16-character hex string.
 */
export async function calculatePerceptualHash(imagePath: string): Promise<string> {
  try {
    // Resize to 9x8 (to get 8x8 differences) and convert to grayscale
    const { data } = await sharp(imagePath)
      .grayscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate horizontal gradient differences
    let hash = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = data[y * 9 + x] ?? 0;
        const right = data[y * 9 + x + 1] ?? 0;
        hash += left < right ? '1' : '0';
      }
    }

    // Convert binary string to hex
    const hexHash = BigInt('0b' + hash).toString(16).padStart(16, '0');
    return hexHash;
  } catch (err) {
    log.error(`Error calculating perceptual hash for ${imagePath}:`, err);
    throw err;
  }
}

/**
 * Calculate Hamming distance between two perceptual hashes.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  const bin1 = BigInt('0x' + hash1);
  const bin2 = BigInt('0x' + hash2);
  const xor = bin1 ^ bin2;

  // Count bits in XOR result
  let count = 0;
  let n = xor;
  while (n > 0n) {
    count += Number(n & 1n);
    n >>= 1n;
  }
  return count;
}

/**
 * Calculate similarity percentage between two perceptual hashes.
 * Returns a value between 0 and 100.
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  // 64 bits total, so max distance is 64
  return ((64 - distance) / 64) * 100;
}

/**
 * Analyze a batch of frames for blur and perceptual hashing.
 */
export async function analyzeFrames(
  framePaths: Array<{ path: string; frameNumber: number; timestamp: number }>,
  blurThreshold: number,
  similarityThreshold: number,
  onProgress?: (current: number, total: number, frameNumber: number) => void
): Promise<FrameAnalysis[]> {
  const results: FrameAnalysis[] = [];

  // First pass: calculate blur and hash for each frame
  for (let i = 0; i < framePaths.length; i++) {
    const frame = framePaths[i];
    if (!frame) continue;

    try {
      const [blurScore, perceptualHash] = await Promise.all([
        calculateBlurScore(frame.path),
        calculatePerceptualHash(frame.path),
      ]);

      results.push({
        frameNumber: frame.frameNumber,
        timestamp: frame.timestamp,
        blurScore,
        perceptualHash,
        isDuplicate: false, // Will be calculated in second pass
        isBlurry: blurScore > blurThreshold,
      });

      onProgress?.(i + 1, framePaths.length, frame.frameNumber);
    } catch (err) {
      log.warn(`Failed to analyze frame ${frame.frameNumber}:`, err);
      // Add partial result
      results.push({
        frameNumber: frame.frameNumber,
        timestamp: frame.timestamp,
        blurScore: null,
        perceptualHash: null,
        isDuplicate: false,
        isBlurry: false,
      });
      onProgress?.(i + 1, framePaths.length, frame.frameNumber);
    }
  }

  // Second pass: detect duplicates based on similarity
  for (let i = 0; i < results.length; i++) {
    const current = results[i];
    if (!current || !current.perceptualHash) continue;

    // Check against previous frames (only mark later ones as duplicates)
    for (let j = 0; j < i; j++) {
      const previous = results[j];
      if (!previous || !previous.perceptualHash) continue;

      const similarity = calculateSimilarity(current.perceptualHash, previous.perceptualHash);
      if (similarity >= similarityThreshold) {
        current.isDuplicate = true;
        break;
      }
    }
  }

  return results;
}

/**
 * Find groups of similar frames based on perceptual hashes.
 */
export function findSimilarityGroups(
  analyses: FrameAnalysis[],
  similarityThreshold: number
): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  const assigned = new Set<number>();

  for (let i = 0; i < analyses.length; i++) {
    const current = analyses[i];
    if (!current || !current.perceptualHash || assigned.has(current.frameNumber)) {
      continue;
    }

    const group: number[] = [current.frameNumber];
    assigned.add(current.frameNumber);

    // Find all similar frames
    for (let j = i + 1; j < analyses.length; j++) {
      const other = analyses[j];
      if (!other || !other.perceptualHash || assigned.has(other.frameNumber)) {
        continue;
      }

      const similarity = calculateSimilarity(current.perceptualHash, other.perceptualHash);
      if (similarity >= similarityThreshold) {
        group.push(other.frameNumber);
        assigned.add(other.frameNumber);
      }
    }

    if (group.length > 1) {
      groups.set(current.frameNumber, group);
    }
  }

  return groups;
}
