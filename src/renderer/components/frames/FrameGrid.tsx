import { useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { FrameThumbnail } from './FrameThumbnail';
import { FrameFilters } from './FrameFilters';
import type { ExtractedFrame, FrameAnalysis } from '@shared/types';

export function FrameGrid() {
  const {
    frames,
    selectedFrames,
    analysisResults,
    thumbnailSize,
    filterMode,
    showBlurryFrames,
    showDuplicateFrames,
    settings,
    lastClickedFrame,
    toggleFrameSelection,
    selectRange,
    setLastClickedFrame,
  } = useStore();

  // Filter frames based on current filter settings
  const filteredFrames = useMemo(() => {
    return frames.filter((frame) => {
      const analysis = analysisResults.get(frame.frameNumber);

      // Filter by selection mode
      if (filterMode === 'selected' && !selectedFrames.has(frame.frameNumber)) {
        return false;
      }
      if (filterMode === 'unselected' && selectedFrames.has(frame.frameNumber)) {
        return false;
      }

      // Filter by blur
      if (!showBlurryFrames && analysis?.isBlurry) {
        return false;
      }

      // Filter by duplicate
      if (!showDuplicateFrames && analysis?.isDuplicate) {
        return false;
      }

      return true;
    });
  }, [frames, filterMode, selectedFrames, showBlurryFrames, showDuplicateFrames, analysisResults]);

  // Handle frame click with shift for range selection
  const handleFrameClick = useCallback(
    (frame: ExtractedFrame, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedFrame !== null) {
        // Range selection
        selectRange(lastClickedFrame, frame.frameNumber);
      } else {
        // Toggle single frame
        toggleFrameSelection(frame.frameNumber);
      }
      setLastClickedFrame(frame.frameNumber);
    },
    [lastClickedFrame, selectRange, toggleFrameSelection, setLastClickedFrame]
  );

  const sizeClass = {
    small: 'size-small',
    medium: 'size-medium',
    large: 'size-large',
  }[thumbnailSize];

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <FrameFilters />

      {/* Frame grid */}
      <div className={`frame-grid ${sizeClass} flex-1 overflow-auto`}>
        {filteredFrames.map((frame) => (
          <FrameThumbnail
            key={frame.frameNumber}
            frame={frame}
            isSelected={selectedFrames.has(frame.frameNumber)}
            analysis={analysisResults.get(frame.frameNumber) ?? null}
            onClick={(e) => handleFrameClick(frame, e)}
            showFrameNumber={settings.showFrameNumbers}
          />
        ))}

        {filteredFrames.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-32 text-text-secondary">
            No frames match the current filters
          </div>
        )}
      </div>

      {/* Selection info */}
      <div className="px-3 py-2 bg-bg-secondary border-t border-border text-sm text-text-secondary">
        {selectedFrames.size} of {frames.length} frames selected
        {filteredFrames.length !== frames.length && (
          <span className="ml-2">({filteredFrames.length} visible)</span>
        )}
      </div>
    </div>
  );
}
