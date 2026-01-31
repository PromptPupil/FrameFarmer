import path from 'path-browserify';
import type { VideoQueueItem } from '@shared/types';

interface QueueItemProps {
  item: VideoQueueItem;
  onClick: () => void;
}

export function QueueItem({ item, onClick }: QueueItemProps) {
  const statusIcon = {
    pending: '○',
    processing: '⟳',
    completed: '✓',
  }[item.status];

  const statusClass = {
    pending: 'text-text-secondary',
    processing: 'text-accent animate-spin',
    completed: 'text-success',
  }[item.status];

  // Extract just the filename
  const fileName = item.fileName || item.filePath.split(/[/\\]/).pop() || 'Unknown';

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary rounded hover:bg-border transition-colors"
      title={item.filePath}
    >
      <span className={statusClass}>{statusIcon}</span>
      <span className="text-sm text-text-primary truncate max-w-32">{fileName}</span>
    </button>
  );
}
