import sharp from 'sharp';
import log from 'electron-log';
import type { FrameAnalysis } from '../../shared/types';

/**
 * Blur detection method selection.
 * - 'gradient': Gradient direction variance (detects directional motion blur)
 * - 'motion': Frame-to-frame hash difference (detects scene change/motion)
 * - 'laplacian': Laplacian variance (detects overall edge contrast)
 */
const BLUR_DETECTION_METHOD: 'gradient' | 'motion' | 'laplacian' = 'gradient';

/**
 * Calculate gradient direction variance for an image.
 * Motion blur creates edges predominantly in one direction (perpendicular to motion).
 * Sharp images have edges in all directions.
 * Returns 0-100 where higher = more directional blur detected.
 */
export async function calculateGradientDirectionScore(imagePath: string): Promise<number> {
  try {
    // Downsample for performance - 200px wide is enough to detect directionality
    const { data, info } = await sharp(imagePath)
      .grayscale()
      .resize(200, null, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;

    // Compute gradients and accumulate angle statistics
    let sumCos = 0;
    let sumSin = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // Sobel-like gradient computation
        const left = data[idx - 1] ?? 0;
        const right = data[idx + 1] ?? 0;
        const top = data[idx - width] ?? 0;
        const bottom = data[idx + width] ?? 0;

        const gx = right - left;
        const gy = bottom - top;

        // Skip low-gradient pixels (flat areas)
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        if (magnitude < 10) continue;

        // Compute angle and accumulate for circular statistics
        const angle = Math.atan2(gy, gx);
        // Use doubled angle to make opposite directions equivalent (edge has same direction either way)
        const doubledAngle = angle * 2;
        sumCos += Math.cos(doubledAngle);
        sumSin += Math.sin(doubledAngle);
        count++;
      }
    }

    if (count === 0) {
      return 0; // No edges detected, can't determine blur
    }

    // Mean resultant length (R) - measures concentration of angles
    // R near 1 = all edges point same direction = directional blur
    // R near 0 = edges spread in all directions = sharp
    const R = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / count;

    // Convert to 0-100 score where higher = more blur
    const score = R * 100;
    return Math.round(score * 10) / 10;
  } catch (err) {
    log.error(`Error calculating gradient direction score for ${imagePath}:`, err);
    throw err;
  }
}

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
 * Normalize raw scores to 0-100 relative to batch.
 * @param invert - If true, high raw value = low score (for Laplacian where high variance = sharp)
 */
function normalizeScores(values: (number | null)[], invert: boolean): (number | null)[] {
  const validValues = values.filter((v): v is number => v !== null);

  if (validValues.length === 0) {
    return values.map(() => null);
  }

  const sorted = [...validValues].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const range = max - min;

  return values.map((value) => {
    if (value === null) return null;

    if (range === 0) {
      return 0;
    }

    const score = invert
      ? 100 * (max - value) / range  // High value = low score
      : 100 * (value - min) / range; // High value = high score
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
  // First pass: calculate perceptual hash and blur metric for each frame
  const rawResults: Array<{
    frameNumber: number;
    timestamp: number;
    perceptualHash: string | null;
    rawBlurValue: number | null;
  }> = [];

  for (let i = 0; i < framePaths.length; i++) {
    const frame = framePaths[i];
    if (!frame) continue;

    try {
      // Always compute perceptual hash (needed for duplicates)
      const perceptualHash = await calculatePerceptualHash(frame.path);

      // Compute blur metric based on selected method
      let rawBlurValue: number | null = null;
      if (BLUR_DETECTION_METHOD === 'gradient') {
        rawBlurValue = await calculateGradientDirectionScore(frame.path);
      } else if (BLUR_DETECTION_METHOD === 'laplacian') {
        rawBlurValue = await calculateLaplacianVariance(frame.path);
      }
      // For 'motion' method, blur is calculated after all hashes are collected

      rawResults.push({
        frameNumber: frame.frameNumber,
        timestamp: frame.timestamp,
        perceptualHash,
        rawBlurValue,
      });

      onProgress?.(i + 1, framePaths.length, frame.frameNumber);
    } catch (err) {
      log.warn(`Failed to analyze frame ${frame.frameNumber}:`, err);
      rawResults.push({
        frameNumber: frame.frameNumber,
        timestamp: frame.timestamp,
        perceptualHash: null,
        rawBlurValue: null,
      });
      onProgress?.(i + 1, framePaths.length, frame.frameNumber);
    }
  }

  // Calculate final blur scores based on method
  let normalizedScores: (number | null)[];

  if (BLUR_DETECTION_METHOD === 'motion') {
    // Motion method: compare consecutive frame hashes
    const motionDistances: (number | null)[] = rawResults.map((current, i) => {
      if (!current.perceptualHash) return null;
      if (i === 0) return null;
      const previous = rawResults[i - 1];
      if (!previous?.perceptualHash) return null;
      return hammingDistance(current.perceptualHash, previous.perceptualHash);
    });
    normalizedScores = normalizeScores(motionDistances, false);
  } else if (BLUR_DETECTION_METHOD === 'laplacian') {
    // Laplacian: high variance = sharp, so invert
    const variances = rawResults.map((r) => r.rawBlurValue);
    normalizedScores = normalizeScores(variances, true);
  } else {
    // Gradient: score is already 0-100, use directly (no normalization)
    normalizedScores = rawResults.map((r) => r.rawBlurValue);
  }

  // Build results with blur scores
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
