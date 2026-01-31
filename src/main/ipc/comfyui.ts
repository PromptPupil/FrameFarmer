import { ipcMain } from 'electron';
import { comfyuiClient } from '../services/comfyui-client';
import { databaseService } from '../services/database';
import log from 'electron-log';

export function registerComfyuiHandlers(): void {
  // Test connection
  ipcMain.handle(
    'comfyui:test-connection',
    async (_event, { baseUrl }: { baseUrl: string }) => {
      const settings = databaseService.getSettings();
      return comfyuiClient.testConnection(baseUrl, settings.comfyuiTimeout);
    }
  );

  // Upload image
  ipcMain.handle(
    'comfyui:upload-image',
    async (_event, { baseUrl, imagePath }: { baseUrl: string; imagePath: string }) => {
      const filename = await comfyuiClient.uploadImage(baseUrl, imagePath);
      return { filename };
    }
  );

  // Queue prompt
  ipcMain.handle(
    'comfyui:queue-prompt',
    async (
      _event,
      {
        baseUrl,
        workflow,
        imageInputs,
      }: {
        baseUrl: string;
        workflow: object;
        imageInputs: Array<{ nodeId: string; imagePath: string }>;
      }
    ) => {
      log.info(`Queueing prompt with ${imageInputs.length} image inputs`);
      const promptId = await comfyuiClient.queuePrompt(
        baseUrl,
        workflow as Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } }>,
        imageInputs
      );
      return { promptId };
    }
  );

  // Get queue status
  ipcMain.handle('comfyui:get-queue', async (_event, { baseUrl }: { baseUrl: string }) => {
    return comfyuiClient.getQueueStatus(baseUrl);
  });

  // Parse workflow file
  ipcMain.handle('comfyui:parse-workflow', async (_event, { filePath }: { filePath: string }) => {
    const inputNodes = comfyuiClient.parseWorkflow(filePath);
    return { inputNodes };
  });

  // Load full workflow JSON
  ipcMain.handle('comfyui:load-workflow', async (_event, { filePath }: { filePath: string }) => {
    const workflow = comfyuiClient.loadWorkflow(filePath);
    return { workflow };
  });
}
