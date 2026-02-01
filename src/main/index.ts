import { app, BrowserWindow, shell, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { registerAllHandlers } from './ipc';
import { databaseService } from './services/database';
import { ffmpegService } from './services/ffmpeg';
import { watcherService } from './services/watcher';

// Register custom protocol scheme as privileged BEFORE app ready
// This is required for media elements (video, audio, img) to work with custom protocols
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

// Configure logging
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  // Get saved window bounds from settings
  const settings = databaseService.getSettings();
  const bounds = settings.windowBounds;

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1400,
    height: bounds?.height ?? 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#1a1a1a',
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for native modules
    },
  });

  // Save window bounds on resize/move
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  log.info('Main window created');
}

let saveWindowBoundsTimeout: NodeJS.Timeout | null = null;

function saveWindowBounds(): void {
  if (!mainWindow) return;

  // Debounce saves
  if (saveWindowBoundsTimeout) {
    clearTimeout(saveWindowBoundsTimeout);
  }

  saveWindowBoundsTimeout = setTimeout(() => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    databaseService.saveSetting('windowBounds', bounds);
  }, 500);
}

// Export for IPC handlers to access
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

// App lifecycle
app.whenReady().then(() => {
  log.info('FrameFarmer starting...');
  log.info(`FFmpeg status: ${JSON.stringify(ffmpegService.getStatus())}`);

  // Register custom protocol to serve local files with range request support
  protocol.handle('local-file', async (request) => {
    // Parse the URL - the drive letter becomes the hostname
    // URL: local-file:///C:/path -> hostname='c', pathname='/path'
    const url = new URL(request.url);
    // Reconstruct the Windows path: drive letter + colon + pathname
    let filePath = url.hostname.toUpperCase() + ':' + decodeURIComponent(url.pathname);
    // Convert forward slashes to backslashes on Windows
    filePath = filePath.replace(/\//g, path.sep);

    log.debug(`Protocol handler: ${request.url} -> ${filePath}`);

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.wmv': 'video/x-ms-wmv',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    try {
      const stat = await fs.promises.stat(filePath);
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('Range');

      if (rangeHeader) {
        // Parse range header: "bytes=start-end"
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0;
          const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
          const chunkSize = end - start + 1;

          const fileHandle = await fs.promises.open(filePath, 'r');
          const buffer = Buffer.alloc(chunkSize);
          await fileHandle.read(buffer, 0, chunkSize, start);
          await fileHandle.close();

          return new Response(buffer, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(chunkSize),
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
            },
          });
        }
      }

      // No range request - return full file
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch (err) {
      log.error(`Failed to load file: ${filePath}`, err);
      return new Response('File not found', { status: 404 });
    }
  });

  // Register all IPC handlers
  registerAllHandlers();

  // Create main window
  createWindow();

  // Start watch folder if enabled
  const settings = databaseService.getSettings();
  if (settings.watchFolderEnabled && settings.watchFolderPath) {
    watcherService.startWatching(settings.watchFolderPath);
  }

  app.on('activate', () => {
    // macOS: re-create window when dock icon clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Cleanup
  watcherService.stopWatching();
  databaseService.close();

  // Quit on all platforms (including macOS for this app)
  app.quit();
});

app.on('before-quit', () => {
  log.info('FrameFarmer shutting down');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});
