import { formatTime, formatFrameNumber } from '../../utils/formatters';

interface TimeDisplayProps {
  currentTime: number;
  duration: number;
  frameRate: number;
}

export function TimeDisplay({ currentTime, duration, frameRate }: TimeDisplayProps) {
  const currentFrame = Math.round(currentTime * frameRate);
  const totalFrames = Math.round(duration * frameRate);

  return (
    <div className="flex items-center justify-between text-sm">
      {/* Time */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-text-primary">{formatTime(currentTime)}</span>
        <span className="text-text-secondary">/</span>
        <span className="font-mono text-text-secondary">{formatTime(duration)}</span>
      </div>

      {/* Frame number */}
      <div className="flex items-center gap-2">
        <span className="text-text-secondary">Frame:</span>
        <span className="font-mono text-text-primary">
          {formatFrameNumber(currentFrame)} / {formatFrameNumber(totalFrames)}
        </span>
      </div>
    </div>
  );
}
