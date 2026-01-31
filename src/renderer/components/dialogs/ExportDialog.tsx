import { useState } from 'react';
import { useStore } from '../../store';
import { useFrameActions } from '../../hooks/useFrameActions';

export function ExportDialog() {
  const { setExportDialogOpen, selectedFrames, currentVideo, settings } = useStore();
  const { exportAnimation } = useFrameActions();

  const [format, setFormat] = useState<'gif' | 'mp4'>('gif');
  const [fps, setFps] = useState(currentVideo?.frameRate ?? 24);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!currentVideo) return;

    setIsExporting(true);
    try {
      await exportAnimation(format, fps);
      setExportDialogOpen(false);
    } catch (err) {
      // Error handling is done in the hook
    }
    setIsExporting(false);
  };

  return (
    <div className="dialog-overlay" onClick={() => setExportDialogOpen(false)}>
      <div className="dialog-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-medium">Export Animation</h2>
          <button onClick={() => setExportDialogOpen(false)} className="btn btn-ghost p-1">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-text-secondary">
            Export {selectedFrames.size} selected frames as an animation.
          </p>

          {/* Format selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={format === 'gif'}
                  onChange={() => setFormat('gif')}
                  className="w-4 h-4"
                />
                <span>GIF</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={format === 'mp4'}
                  onChange={() => setFormat('mp4')}
                  className="w-4 h-4"
                />
                <span>MP4</span>
              </label>
            </div>
          </div>

          {/* FPS */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Frame Rate: {fps} fps
            </label>
            <input
              type="range"
              min="1"
              max="60"
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-text-secondary">
              <span>1</span>
              <button
                onClick={() => setFps(currentVideo?.frameRate ?? 24)}
                className="text-accent hover:underline"
              >
                Source ({currentVideo?.frameRate.toFixed(1) ?? 24})
              </button>
              <span>60</span>
            </div>
          </div>

          {format === 'gif' && (
            <p className="text-xs text-text-secondary">
              GIF will be exported with optimized palette for better quality.
            </p>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={() => setExportDialogOpen(false)}
            disabled={isExporting}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedFrames.size === 0}
            className="btn btn-primary"
          >
            {isExporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
