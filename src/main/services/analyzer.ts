import sharp from 'sharp';
import log from 'electron-log';
import type { FrameAnalysis } from '../../shared/types';

/**
 * Calculate raw Laplacian variance for an image.
 * Higher variance = sharper image.
 * Returns raw variance value (not normalized).
 */
export async function calculateLaplacianVariance(imagePath: string): Promise<number> {
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
      return 0;
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    return variance;
  } catch (err) {
    log.error(`Error calculating Laplacian variance for ${imagePath}:`, err);
    throw err;
  }
}

/**
 * Normalize variance values to 0-100 blur scores relative to batch statistics.
 * Uses median as baseline - frames below median variance are considered blurrier.
 * Higher score = more blurry.
 */
function normalizeBlurScores(variances: (number | null)[]): (number | null)[] {
  const validVariances = variances.filter((v): v is number => v !== null);

  if (validVariances.length === 0) {
    return variances.map(() => null);
  }

  // Sort to find min/max
  const sorted = [...validVariances].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const range = max - min;

  return variances.map((variance) => {
    if (variance === null) return null;

    if (range === 0) {
      // All frames have same variance, none are relatively blurry
      return 0;
    }

    // Score: 0 = sharpest (max variance), 100 = blurriest (min variance)
    const score = 100 * (max - variance) / range;
    return Math.round(score * 10) / 10;
  });
}

/**
 * Calculate blur score for a single image (absolute scoring).
 * Used for single-frame analysis where batch context isn't available.
 * Higher score = more blurry (0-100 scale).
 */
export async function calculateBlurScore(imagePath: string): Promise<number> {
  const variance = await calculateLaplacianVariance(imagePath);
  // Use wider range for absolute scoring
  // Typical variance: 0 (very blurry) to 1000+ (very sharp)
  const score = Math.max(0, Math.min(100, 100 - variance / 10));
  return Math.round(score * 10) / 10;
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
  // First pass: calculate raw variance and hash for each frame
  const rawResults: Array<{
    frameNumber: number;
    timestamp: number;
    variance: number | null;
    perceptualHash: string | null;
  }> = [];

  for (let i = 0; i < framePaths.length; i++) {
    const frame = framePaths[i];
    if (!frame) continue;

    try {
      const [variance, perceptualHash] = await Promise.all([
        calculateLaplacianVariance(frame.path),
        calculatePerceptualHash(frame.path),
      ]);

      rawResults.push({
        frameNumber: frame.frameNumber,
        timestamp: frame.timestamp,
        variance,
        perceptualHash,
      });

      onProgress?.(i + 1, framePaths.length, frame.frameNumber);
    } catch (err) {
      log.warn(`Failed to analyze frame ${frame.frameNumber}:`, err);
      rawResults.push({
        frameNumber: frame.frameNumber,
        timestamp: frame.timestamp,
        variance: null,
        perceptualHash: null,
      });
      onProgress?.(i + 1, framePaths.length, frame.frameNumber);
    }
  }

  // Normalize blur scores relative to batch statistics
  const variances = rawResults.map((r) => r.variance);
  const normalizedScores = normalizeBlurScores(variances);

  // Build results with normalized blur scores
  const results: FrameAnalysis[] = rawResults.map((raw, i) => ({
    frameNumber: raw.frameNumber,
    timestamp: raw.timestamp,
    blurScore: normalizedScores[i] ?? null,
    perceptualHash: raw.perceptualHash,
    isDuplicate: false, // Will be calculated in second pass
    isBlurry: normalizedScores[i] !== null && normalizedScores[i]! > blurThreshold,
  }));

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
