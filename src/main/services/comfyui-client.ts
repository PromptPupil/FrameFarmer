import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import type { WorkflowInputNode } from '../../shared/types';

interface ComfyUIUploadResponse {
  name: string;
  subfolder?: string;
  type?: string;
}

interface ComfyUIPromptResponse {
  prompt_id: string;
  number?: number;
  node_errors?: Record<string, unknown>;
}

interface ComfyUIQueueResponse {
  queue_running: Array<[string, number, unknown, unknown]>;
  queue_pending: Array<[string, number, unknown, unknown]>;
}

// Type for workflow nodes
interface WorkflowNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: {
    title?: string;
  };
}

type Workflow = Record<string, WorkflowNode>;

class ComfyUIClient {
  /**
   * Test connection to ComfyUI server.
   */
  async testConnection(baseUrl: string, timeout: number = 5000): Promise<{ connected: boolean; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(baseUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { connected: true };
      } else {
        return { connected: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      if (error.includes('abort')) {
        return { connected: false, error: 'Connection timeout' };
      }
      return { connected: false, error };
    }
  }

  /**
   * Upload an image to ComfyUI.
   */
  async uploadImage(baseUrl: string, imagePath: string): Promise<string> {
    const imageBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);

    // Create form data
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    const formData = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="image"; filename="${fileName}"`,
      'Content-Type: image/png',
      '',
      '',
    ].join('\r\n');

    const endBoundary = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(formData),
      imageBuffer,
      Buffer.from(endBoundary),
    ]);

    const response = await fetch(`${baseUrl}/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as ComfyUIUploadResponse;
    return result.name;
  }

  /**
   * Queue a prompt with ComfyUI.
   */
  async queuePrompt(
    baseUrl: string,
    workflow: Workflow,
    imageInputs: Array<{ nodeId: string; imagePath: string }>
  ): Promise<string> {
    // Upload images and modify workflow
    const modifiedWorkflow = JSON.parse(JSON.stringify(workflow)) as Workflow;

    for (const input of imageInputs) {
      const uploadedFilename = await this.uploadImage(baseUrl, input.imagePath);
      const node = modifiedWorkflow[input.nodeId];
      if (node) {
        node.inputs.image = uploadedFilename;
      }
    }

    // Queue the prompt
    const response = await fetch(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: modifiedWorkflow }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Queue failed: ${response.status} ${text}`);
    }

    const result = (await response.json()) as ComfyUIPromptResponse;

    if (result.node_errors && Object.keys(result.node_errors).length > 0) {
      throw new Error(`Workflow errors: ${JSON.stringify(result.node_errors)}`);
    }

    return result.prompt_id;
  }

  /**
   * Get current queue status.
   */
  async getQueueStatus(baseUrl: string): Promise<{ running: string[]; pending: string[] }> {
    const response = await fetch(`${baseUrl}/queue`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to get queue: ${response.status}`);
    }

    const result = (await response.json()) as ComfyUIQueueResponse;

    return {
      running: result.queue_running.map((item) => item[0]),
      pending: result.queue_pending.map((item) => item[0]),
    };
  }

  /**
   * Parse a workflow JSON file and extract LoadImage nodes.
   */
  parseWorkflow(filePath: string): WorkflowInputNode[] {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const workflow = JSON.parse(content) as Workflow;
      const inputNodes: WorkflowInputNode[] = [];

      for (const [nodeId, node] of Object.entries(workflow)) {
        if (node.class_type === 'LoadImage') {
          inputNodes.push({
            nodeId,
            nodeName: node._meta?.title ?? node.class_type,
            nodeType: node.class_type,
          });
        }
      }

      return inputNodes;
    } catch (err) {
      log.error(`Failed to parse workflow ${filePath}:`, err);
      throw new Error(`Failed to parse workflow: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Load a workflow JSON file.
   */
  loadWorkflow(filePath: string): Workflow {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as Workflow;
  }
}

// Export singleton instance
export const comfyuiClient = new ComfyUIClient();
