import { ipcMain } from 'electron';
import { databaseService } from '../services/database';
import { generateId } from '../utils/hash';
import type { VideoState, WorkflowTemplate } from '../../shared/types';

export function registerDatabaseHandlers(): void {
  // Get video state
  ipcMain.handle('db:get-video-state', async (_event, { filePath }: { filePath: string }) => {
    return databaseService.getVideoState(filePath);
  });

  // Save video state
  ipcMain.handle('db:save-video-state', async (_event, state: VideoState) => {
    // Ensure state has an ID
    if (!state.id) {
      state.id = generateId();
    }
    databaseService.saveVideoState(state);
    return { success: true };
  });

  // Get last opened video
  ipcMain.handle('db:get-last-video', async () => {
    return databaseService.getLastOpenedVideo();
  });

  // Get settings
  ipcMain.handle('db:get-settings', async () => {
    return databaseService.getSettings();
  });

  // Save settings (partial update)
  ipcMain.handle('db:save-settings', async (_event, settings: Record<string, unknown>) => {
    databaseService.saveSettings(settings);
    return { success: true };
  });

  // Get workflow templates
  ipcMain.handle('db:get-workflow-templates', async () => {
    return databaseService.getWorkflowTemplates();
  });

  // Save workflow template
  ipcMain.handle(
    'db:save-workflow-template',
    async (
      _event,
      template: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>
    ) => {
      return databaseService.saveWorkflowTemplate(template);
    }
  );

  // Delete workflow template
  ipcMain.handle('db:delete-workflow-template', async (_event, { id }: { id: string }) => {
    databaseService.deleteWorkflowTemplate(id);
    return { success: true };
  });

  // Get queue
  ipcMain.handle('db:get-queue', async () => {
    const queue = databaseService.getQueue();
    return queue.map((item) => ({
      id: item.id,
      filePath: item.file_path,
      status: item.status,
      addedAt: item.added_at,
    }));
  });

  // Add to queue
  ipcMain.handle('db:add-to-queue', async (_event, { filePath }: { filePath: string }) => {
    const id = databaseService.addToQueue(filePath);
    return { id };
  });

  // Remove from queue
  ipcMain.handle('db:remove-from-queue', async (_event, { id }: { id: string }) => {
    databaseService.removeFromQueue(id);
    return { success: true };
  });

  // Clear queue
  ipcMain.handle('db:clear-queue', async () => {
    databaseService.clearQueue();
    return { success: true };
  });

  // Get analysis cache
  ipcMain.handle('db:get-analysis-cache', async (_event, { videoHash }: { videoHash: string }) => {
    return databaseService.getAnalysisCache(videoHash);
  });

  // Save analysis cache
  ipcMain.handle(
    'db:save-analysis-cache',
    async (
      _event,
      {
        videoHash,
        analyses,
      }: {
        videoHash: string;
        analyses: Array<{
          frameNumber: number;
          timestamp: number;
          blurScore: number | null;
          perceptualHash: string | null;
          isDuplicate: boolean;
          isBlurry: boolean;
        }>;
      }
    ) => {
      databaseService.saveAnalysisCache(videoHash, analyses);
      return { success: true };
    }
  );
}
