import { memo } from 'react';
import type { ExtractedFrame, FrameAnalysis } from '@shared/types';
import { AnalysisBadge } from './AnalysisBadge';
import { useStore } from '../../store';

// Shared timeout for debouncing hover clear across all thumbnails
let hoverClearTimeout: ReturnType<typeof setTimeout> | null = null;

interface FrameThumbnailProps {
  frame: ExtractedFrame;
  isSelected: boolean;
  analysis: FrameAnalysis | null;
  onClick: (e: React.MouseEvent) => void;
  showFrameNumber: boolean;
  isLandscape: boolean;
}

export const FrameThumbnail = memo(function FrameThumbnail({
  frame,
  isSelected,
  analysis,
  onClick,
  showFrameNumber,
  isLandscape,
}: FrameThumbnailProps) {
  const { setHoveredFrame, setPinnedPreviewFrame } = useStore();

  // Convert file path to custom protocol URL
  // Use three slashes to indicate no host component in the URL
  const thumbnailSrc = `local-file:///${frame.thumbnailPath.replace(/\\/g, '/')}`;

  return (
    <div
      className={`frame-thumbnail relative cursor-pointer rounded overflow-hidden ${
        isSelected ? 'selected' : ''
      } ${isLandscape ? 'aspect-video' : 'aspect-[9/16]'}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setPinnedPreviewFrame(frame);
      }}
      onMouseEnter={() => {
        if (hoverClearTimeout) {
          clearTimeout(hoverClearTimeout);
          hoverClearTimeout = null;
        }
        setHoveredFrame(frame);
      }}
      onMouseLeave={() => {
        hoverClearTimeout = setTimeout(() => {
          setHoveredFrame(null);
          hoverClearTimeout = null;
        }, 50);
      }}
    >
      {/* Thumbnail image */}
      <img
        src={thumbnailSrc}
        alt={`Frame ${frame.frameNumber}`}
        className="w-full h-full object-contain"
        loading="lazy"
      />

      {/* Frame number overlay */}
      {showFrameNumber && (
        <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-xs font-mono">
          {frame.frameNumber}
        </div>
      )}

      {/* Selection checkbox */}
      <div
        className={`absolute top-1 right-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isSelected
            ? 'bg-accent border-accent'
            : 'bg-black/40 border-white/60 opacity-0 group-hover:opacity-100'
        }`}
        style={{ opacity: isSelected ? 1 : undefined }}
      >
        {isSelected && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3 text-white"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {/* Analysis badges */}
      {analysis && (
        <div className="absolute bottom-1 left-1 flex gap-1">
          {analysis.isBlurry && <AnalysisBadge type="blur" score={analysis.blurScore} />}
          {analysis.isDuplicate && <AnalysisBadge type="duplicate" />}
        </div>
      )}
    </div>
  );
});
