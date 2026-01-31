import { useStore } from '../../store';
import { useVideoActions } from '../../hooks/useVideoActions';
import { useFrameActions } from '../../hooks/useFrameActions';

const FRAME_COUNT_OPTIONS = [5, 10, 15, 20, 30, 60, 100];

export function Toolbar() {
  const {
    currentVideo,
    selectedFrames,
    settings,
    thumbnailSize,
    setThumbnailSize,
    setSettingsDialogOpen,
    setExportDialogOpen,
    ffmpegStatus,
    isLoading,
    updateSetting,
  } = useStore();

  const { openVideo, reExtractFrames } = useVideoActions();
  const { saveSelectedFrames } = useFrameActions();

  const hasSelection = selectedFrames.size > 0;
  const ffmpegAvailable = ffmpegStatus.available;

  const handleFrameCountChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const count = parseInt(e.target.value, 10);
    updateSetting('defaultFrameCount', count);
    // Re-extract frames if a video is loaded
    if (currentVideo) {
      await reExtractFrames(count);
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-bg-secondary border-b border-border">
      {/* File Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={openVideo}
          disabled={!ffmpegAvailable || isLoading}
          className="btn btn-primary"
          title="Open video file (Ctrl+O)"
        >
          Open
        </button>

        <button
          onClick={saveSelectedFrames}
          disabled={!ffmpegAvailable || !hasSelection || isLoading}
          className="btn btn-secondary"
          title="Save selected frames (Ctrl+S)"
        >
          Save Selected ({selectedFrames.size})
        </button>

        <button
          onClick={() => setExportDialogOpen(true)}
          disabled={!ffmpegAvailable || !hasSelection || isLoading}
          className="btn btn-secondary"
          title="Export as GIF/MP4 (Ctrl+E)"
        >
          Export
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border" />

      {/* Frame Count Selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-text-secondary">Frames:</label>
        <select
          value={settings.defaultFrameCount}
          onChange={handleFrameCountChange}
          disabled={!ffmpegAvailable}
          className="select text-sm w-20"
        >
          {FRAME_COUNT_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border" />

      {/* Thumbnail Size Toggle */}
      <div className="flex items-center gap-1">
        <label className="text-sm text-text-secondary mr-1">Size:</label>
        {(['small', 'medium', 'large'] as const).map((size) => (
          <button
            key={size}
            onClick={() => setThumbnailSize(size)}
            className={`px-2 py-1 text-xs font-medium rounded ${
              thumbnailSize === size
                ? 'bg-accent text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-border'
            }`}
          >
            {size[0]?.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Video Info (if loaded) */}
      {currentVideo && (
        <div className="text-sm text-text-secondary">
          {currentVideo.fileName} | {currentVideo.width}x{currentVideo.height} @{' '}
          {currentVideo.frameRate.toFixed(2)}fps
        </div>
      )}

      {/* Settings Button */}
      <button
        onClick={() => setSettingsDialogOpen(true)}
        className="btn btn-ghost"
        title="Settings (Ctrl+,)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
