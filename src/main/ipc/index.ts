import { registerVideoHandlers } from './video';
import { registerFrameHandlers } from './frame';
import { registerFilesystemHandlers } from './filesystem';
import { registerDatabaseHandlers } from './database';
import { registerComfyuiHandlers } from './comfyui';
import { registerAppHandlers } from './app';
import log from 'electron-log';

/**
 * Register all IPC handlers.
 * Called once during app initialization.
 */
export function registerAllHandlers(): void {
  log.info('Registering IPC handlers...');

  registerVideoHandlers();
  registerFrameHandlers();
  registerFilesystemHandlers();
  registerDatabaseHandlers();
  registerComfyuiHandlers();
  registerAppHandlers();

  log.info('IPC handlers registered');
}
