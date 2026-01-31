import { useStore } from '../../store';

export function StatusBar() {
  const {
    currentVideo,
    videosInDirectory,
    currentVideoIndex,
    analysisProgress,
    isAnalyzing,
    settings,
    extractionProgress,
    isLoading,
    loadingMessage,
  } = useStore();

  const watchEnabled = settings.watchFolderEnabled && settings.watchFolderPath;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-bg-secondary border-t border-border text-xs text-text-secondary">
      {/* Video navigation info */}
      <div className="flex items-center gap-4">
        {videosInDirectory.length > 0 && (
          <span>
            Video {currentVideoIndex + 1} of {videosInDirectory.length}
          </span>
        )}

        {currentVideo && (
          <span className="text-text-primary">{currentVideo.fileName}</span>
        )}
      </div>

      {/* Progress indicators */}
      <div className="flex items-center gap-4">
        {/* Extraction progress */}
        {extractionProgress && (
          <div className="flex items-center gap-2">
            <span>Extracting frames...</span>
            <div className="w-24 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-150"
                style={{
                  width: `${(extractionProgress.current / extractionProgress.total) * 100}%`,
                }}
              />
            </div>
            <span>
              {extractionProgress.current}/{extractionProgress.total}
            </span>
          </div>
        )}

        {/* Analysis progress */}
        {isAnalyzing && (
          <div className="flex items-center gap-2">
            <span>Analyzing frames...</span>
            <div className="w-24 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-150"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <span>{Math.round(analysisProgress)}%</span>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !extractionProgress && !isAnalyzing && (
          <div className="flex items-center gap-2">
            <div className="spinner w-4 h-4" />
            <span>{loadingMessage}</span>
          </div>
        )}
      </div>

      {/* Watch folder status */}
      <div className="flex items-center gap-2">
        {watchEnabled ? (
          <span className="flex items-center gap-1 text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Watch: ON
          </span>
        ) : (
          <span className="text-text-secondary">Watch: OFF</span>
        )}
      </div>
    </div>
  );
}
