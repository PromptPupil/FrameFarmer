import { useStore } from '../../store';

interface InputSlotProps {
  nodeId: string;
  nodeName: string;
  frameNumber: number | null;
}

export function InputSlot({ nodeId, nodeName, frameNumber }: InputSlotProps) {
  const { frames, setInputSlot } = useStore();

  const frame = frameNumber !== null ? frames.find((f) => f.frameNumber === frameNumber) : null;
  const thumbnailSrc = frame ? `local-file:///${frame.thumbnailPath.replace(/\\/g, '/')}` : null;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputSlot(nodeId, null);
  };

  return (
    <div
      className={`relative w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
        frame ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'
      }`}
      title={`Drop frame for: ${nodeName}`}
    >
      {frame ? (
        <>
          <img
            src={thumbnailSrc!}
            alt={`Frame ${frameNumber}`}
            className="w-full h-full object-cover rounded-lg"
          />
          <button
            onClick={handleClear}
            className="absolute -top-2 -right-2 w-5 h-5 bg-error rounded-full flex items-center justify-center text-white text-xs"
          >
            ×
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-center py-0.5 rounded-b-lg">
            {nodeName}
          </div>
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span className="text-xs text-text-secondary mt-1 text-center px-1">{nodeName}</span>
        </>
      )}
    </div>
  );
}
