import { useStore } from '../../store';
import { VideoPlayer } from '../video/VideoPlayer';
import { FrameGrid } from '../frames/FrameGrid';
import { VideoInfoPanel } from '../info/VideoInfoPanel';
import { ComfyUIPanel } from '../comfyui/ComfyUIPanel';
import { QueueBar } from '../queue/QueueBar';
import { EmptyState } from '../common/EmptyState';

export function MainLayout() {
  const { currentVideo, frames } = useStore();

  if (!currentVideo) {
    return <EmptyState />;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Video Player */}
        <div className="w-1/2 flex flex-col border-r border-border">
          <VideoPlayer />
        </div>

        {/* Right panel - Frame Grid */}
        <div className="w-1/2 flex flex-col">
          <FrameGrid />
        </div>
      </div>

      {/* Bottom panels */}
      <div className="flex border-t border-border" style={{ height: '180px' }}>
        {/* Video Info Panel */}
        <div className="w-1/3 border-r border-border overflow-auto">
          <VideoInfoPanel />
        </div>

        {/* ComfyUI Panel */}
        <div className="w-2/3 overflow-auto">
          <ComfyUIPanel />
        </div>
      </div>

      {/* Queue Bar */}
      <QueueBar />
    </div>
  );
}
