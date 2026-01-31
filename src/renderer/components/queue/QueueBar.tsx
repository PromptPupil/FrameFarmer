import { useStore } from '../../store';
import { QueueItem } from './QueueItem';
import { useVideoActions } from '../../hooks/useVideoActions';

export function QueueBar() {
  const { videoQueue, clearQueue } = useStore();
  const { loadVideoFromQueue } = useVideoActions();

  if (videoQueue.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-t border-border">
      <span className="text-sm text-text-secondary">Queue:</span>

      <div className="flex-1 flex items-center gap-2 overflow-x-auto">
        {videoQueue.map((item) => (
          <QueueItem
            key={item.id}
            item={item}
            onClick={() => loadVideoFromQueue(item.id)}
          />
        ))}
      </div>

      <button onClick={clearQueue} className="btn btn-ghost text-sm">
        Clear
      </button>
    </div>
  );
}
