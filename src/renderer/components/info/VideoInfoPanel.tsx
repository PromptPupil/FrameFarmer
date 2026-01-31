import { useStore } from '../../store';
import { formatFileSize, formatTime, formatDate } from '../../utils/formatters';

export function VideoInfoPanel() {
  const { currentVideo, selectedFrames, videoQueue } = useStore();

  if (!currentVideo) {
    return (
      <div className="p-4 text-text-secondary text-sm">
        No video loaded
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="font-medium text-text-primary">Video Info</h3>

      <div className="space-y-2 text-sm">
        {/* Filename */}
        <div className="flex justify-between">
          <span className="text-text-secondary">File:</span>
          <span className="text-text-primary font-mono truncate max-w-[200px]" title={currentVideo.fileName}>
            {currentVideo.fileName}
          </span>
        </div>

        {/* Resolution */}
        <div className="flex justify-between">
          <span className="text-text-secondary">Resolution:</span>
          <span className="text-text-primary">
            {currentVideo.width}x{currentVideo.height}
          </span>
        </div>

        {/* Frame rate */}
        <div className="flex justify-between">
          <span className="text-text-secondary">Frame Rate:</span>
          <span className="text-text-primary">
            {currentVideo.frameRate.toFixed(2)} fps
          </span>
        </div>

        {/* Duration */}
        <div className="flex justify-between">
          <span className="text-text-secondary">Duration:</span>
          <span className="text-text-primary">{formatTime(currentVideo.duration)}</span>
        </div>

        {/* Total frames */}
        <div className="flex justify-between">
          <span className="text-text-secondary">Total Frames:</span>
          <span className="text-text-primary">{currentVideo.totalFrames.toLocaleString()}</span>
        </div>

        {/* File size */}
        <div className="flex justify-between">
          <span className="text-text-secondary">Size:</span>
          <span className="text-text-primary">{formatFileSize(currentVideo.fileSize)}</span>
        </div>

        {/* Modified date */}
        <div className="flex justify-between">
          <span className="text-text-secondary">Modified:</span>
          <span className="text-text-primary">{formatDate(currentVideo.modifiedAt)}</span>
        </div>
      </div>

      {/* Separator */}
      <hr className="border-border" />

      {/* Selection info */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Selected:</span>
          <span className="text-text-primary">{selectedFrames.size} frames</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Queue:</span>
          <span className="text-text-primary">
            {videoQueue.filter((v) => v.status === 'pending').length} pending
          </span>
        </div>
      </div>
    </div>
  );
}
