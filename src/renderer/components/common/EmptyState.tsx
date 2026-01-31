import { useVideoActions } from '../../hooks/useVideoActions';
import { useStore } from '../../store';

export function EmptyState() {
  const { openVideo } = useVideoActions();
  const { ffmpegStatus } = useStore();

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-24 w-24 mx-auto text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to FrameFarmer</h2>

        {/* Description */}
        <p className="text-text-secondary mb-6">
          Extract and review frames from AI-generated videos, then send them back to ComfyUI for
          further generation.
        </p>

        {/* Open button */}
        <button
          onClick={openVideo}
          disabled={!ffmpegStatus.available}
          className="btn btn-primary text-lg px-6 py-3"
        >
          Open Video
        </button>

        {/* Keyboard hint */}
        <p className="text-sm text-text-secondary mt-4">
          or press <kbd className="px-2 py-1 bg-bg-tertiary rounded">Ctrl+O</kbd>
        </p>

        {/* Drag and drop hint */}
        <p className="text-sm text-text-secondary mt-2">
          You can also drag and drop video files here
        </p>
      </div>
    </div>
  );
}
