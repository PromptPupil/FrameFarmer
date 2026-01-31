import { useRef, useCallback, useState } from 'react';
import { useStore } from '../../store';

interface ScrubberProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function Scrubber({ currentTime, duration, onSeek }: ScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { timelineMarkers } = useStore();

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const calculateTimeFromPosition = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return 0;

      const rect = track.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      return percentage * duration;
    },
    [duration]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const time = calculateTimeFromPosition(e.clientX);
      onSeek(time);

      const handleMouseMove = (e: MouseEvent) => {
        const time = calculateTimeFromPosition(e.clientX);
        onSeek(time);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [calculateTimeFromPosition, onSeek]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const time = calculateTimeFromPosition(e.clientX);
      onSeek(time);
    },
    [calculateTimeFromPosition, onSeek]
  );

  const handleMarkerClick = useCallback(
    (e: React.MouseEvent, markerTime: number) => {
      e.stopPropagation();
      onSeek(markerTime);
    },
    [onSeek]
  );

  return (
    <div
      ref={trackRef}
      className="scrubber-track relative"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Progress bar */}
      <div className="scrubber-progress" style={{ width: `${progress}%` }} />

      {/* Timeline markers */}
      {timelineMarkers.map((marker) => (
        <div
          key={marker.id}
          className="timeline-marker hover:bg-warning/80"
          style={{
            left: `${(marker.timestamp / duration) * 100}%`,
            backgroundColor: marker.color ?? undefined,
          }}
          onClick={(e) => handleMarkerClick(e, marker.timestamp)}
          title={marker.label}
        />
      ))}

      {/* Thumb */}
      <div
        className={`scrubber-thumb ${isDragging ? 'scale-110' : ''}`}
        style={{ left: `${progress}%` }}
      />
    </div>
  );
}
