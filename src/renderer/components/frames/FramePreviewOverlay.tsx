import { useState, useEffect } from 'react';
import { useStore } from '../../store';

export function FramePreviewOverlay() {
  const { hoveredFrame, pinnedPreviewFrame, setPinnedPreviewFrame } = useStore();
  const [isCtrlHeld, setIsCtrlHeld] = useState(false);

  // Track Ctrl key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlHeld(true);
      if (e.key === 'Escape' && pinnedPreviewFrame) setPinnedPreviewFrame(null);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [pinnedPreviewFrame, setPinnedPreviewFrame]);

  // Determine which frame to show fullscreen (pinned takes priority, then Ctrl+hover)
  const fullscreenFrame = pinnedPreviewFrame || (isCtrlHeld ? hoveredFrame : null);

  if (!fullscreenFrame) {
    return null;
  }

  const imageSrc = `local-file:///${fullscreenFrame.thumbnailPath.replace(/\\/g, '/')}`;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 ${
        pinnedPreviewFrame ? 'cursor-pointer' : 'pointer-events-none'
      }`}
      onClick={() => {
        if (pinnedPreviewFrame) setPinnedPreviewFrame(null);
      }}
    >
      <img
        src={imageSrc}
        alt={`Frame ${fullscreenFrame.frameNumber} preview`}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
