import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import log from 'electron-log';
import { BrowserWindow } from 'electron';
import { isVideoFile, VIDEO_EXTENSIONS } from '../utils/paths';

class WatcherService {
  private watcher: FSWatcher | null = null;
  private watchPath: string | null = null;
  private isWatching: boolean = false;

  /**
   * Start watching a folder for new video files.
   */
  startWatching(folderPath: string): boolean {
    // Stop any existing watcher
    this.stopWatching();

    try {
      // Build glob pattern for video files
      const extensions = VIDEO_EXTENSIONS.map((ext) => ext.slice(1)); // Remove leading dot
      const pattern = path.join(folderPath, `**/*.{${extensions.join(',')}}`);

      this.watcher = chokidar.watch(pattern, {
        ignored: /(^|[\/\\])\../, // Ignore hidden files
        persistent: true,
        ignoreInitial: true, // Don't fire for existing files
        usePolling: true, // Required for network/mapped drives
        interval: 1000, // Poll every 1 second
        awaitWriteFinish: {
          stabilityThreshold: 2000, // Wait 2 seconds after file stops changing
          pollInterval: 100,
        },
      });

      this.watcher.on('add', (filePath) => {
        this.handleNewVideo(filePath);
      });

      this.watcher.on('error', (error) => {
        log.error('Watch folder error:', error);
      });

      this.watchPath = folderPath;
      this.isWatching = true;
      log.info(`Started watching folder: ${folderPath}`);
      return true;
    } catch (err) {
      log.error('Failed to start watching folder:', err);
      return false;
    }
  }

  /**
   * Stop watching the current folder.
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      log.info(`Stopped watching folder: ${this.watchPath}`);
    }
    this.watchPath = null;
    this.isWatching = false;
  }

  /**
   * Get current watching status.
   */
  getStatus(): { isWatching: boolean; watchPath: string | null } {
    return {
      isWatching: this.isWatching,
      watchPath: this.watchPath,
    };
  }

  /**
   * Handle a new video file being detected.
   */
  private handleNewVideo(filePath: string): void {
    if (!isVideoFile(filePath)) {
      return;
    }

    const fileName = path.basename(filePath);
    log.info(`New video detected: ${fileName}`);

    // Send event to renderer process
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('watch:new-video', {
        filePath,
        fileName,
      });
    }
  }
}

// Export singleton instance
export const watcherService = new WatcherService();
