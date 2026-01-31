import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { ffmpegService } from '../services/ffmpeg';
import { watcherService } from '../services/watcher';
import { isVideoFile, VIDEO_EXTENSIONS } from '../utils/paths';
import log from 'electron-log';

export function registerFilesystemHandlers(): void {
  // Select file dialog
  ipcMain.handle(
    'fs:select-file',
    async (
      event,
      {
        title,
        filters,
      }: {
        title?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender);

      const defaultFilters = [
        {
          name: 'Video Files',
          extensions: VIDEO_EXTENSIONS.map((ext) => ext.slice(1)),
        },
        { name: 'All Files', extensions: ['*'] },
      ];

      const result = await dialog.showOpenDialog(win!, {
        title: title ?? 'Select File',
        filters: filters ?? defaultFilters,
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { filePath: null };
      }

      return { filePath: result.filePaths[0] ?? null };
    }
  );

  // Select folder dialog
  ipcMain.handle(
    'fs:select-folder',
    async (event, { title }: { title?: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender);

      const result = await dialog.showOpenDialog(win!, {
        title: title ?? 'Select Folder',
        properties: ['openDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { folderPath: null };
      }

      return { folderPath: result.filePaths[0] ?? null };
    }
  );

  // List videos in directory
  ipcMain.handle('fs:list-videos', async (_event, { directory }: { directory: string }) => {
    log.info(`Listing videos in: ${directory}`);

    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      const videoFiles = entries
        .filter((entry) => entry.isFile() && isVideoFile(entry.name))
        .map((entry) => path.join(directory, entry.name));

      // Get video info for each file (sorted by modification time, newest first)
      const videoInfos = await Promise.all(
        videoFiles.map(async (filePath) => {
          try {
            return await ffmpegService.getVideoInfo(filePath);
          } catch (err) {
            log.warn(`Failed to get info for ${filePath}:`, err);
            return null;
          }
        })
      );

      // Filter out nulls and sort by modification time (newest first)
      const validInfos = videoInfos
        .filter((info): info is NonNullable<typeof info> => info !== null)
        .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

      return validInfos;
    } catch (err) {
      log.error(`Failed to list videos in ${directory}:`, err);
      throw err;
    }
  });

  // Start watching folder
  ipcMain.handle('fs:watch-folder', async (_event, { folderPath }: { folderPath: string }) => {
    const success = watcherService.startWatching(folderPath);
    return { success };
  });

  // Stop watching folder
  ipcMain.handle('fs:unwatch-folder', async () => {
    watcherService.stopWatching();
    return { success: true };
  });

  // Open folder in Explorer/Finder
  ipcMain.handle('fs:open-folder', async (_event, { folderPath }: { folderPath: string }) => {
    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (err) {
      log.error(`Failed to open folder ${folderPath}:`, err);
      return { success: false };
    }
  });

  // Check if file exists
  ipcMain.handle('fs:file-exists', async (_event, { filePath }: { filePath: string }) => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });
}
