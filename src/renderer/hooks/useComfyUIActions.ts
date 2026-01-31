import { useCallback } from 'react';
import { useStore } from '../store';

export function useComfyUIActions() {
  const {
    selectedWorkflow,
    selectedFrames,
    comfyuiInputSlots,
    frames,
    settings,
    setComfyuiConnected,
    addToast,
  } = useStore();

  // Test ComfyUI connection
  const testConnection = useCallback(async () => {
    try {
      const result = await window.electronAPI.invoke('comfyui:test-connection', {
        baseUrl: settings.comfyuiBaseUrl,
      });

      setComfyuiConnected(result.connected);

      if (result.connected) {
        addToast({ type: 'success', message: 'Connected to ComfyUI', duration: 2000 });
      } else {
        addToast({
          type: 'error',
          message: `Connection failed: ${result.error ?? 'Unknown error'}`,
          duration: 3000,
        });
      }

      return result.connected;
    } catch (err) {
      setComfyuiConnected(false);
      addToast({ type: 'error', message: `Connection error: ${err}`, duration: 3000 });
      return false;
    }
  }, [settings.comfyuiBaseUrl]);

  // Send frames to ComfyUI
  const sendToComfyUI = useCallback(async () => {
    if (!selectedWorkflow) {
      addToast({ type: 'warning', message: 'No workflow selected', duration: 2000 });
      return;
    }

    const isMultiInput = selectedWorkflow.inputNodes.length > 1;

    try {
      // Load the workflow JSON
      const workflow = await loadWorkflowJson(selectedWorkflow.filePath);

      if (isMultiInput) {
        // Multi-input: send single job with all inputs
        const imageInputs = selectedWorkflow.inputNodes
          .map((node) => {
            const frameNumber = comfyuiInputSlots.get(node.nodeId);
            if (frameNumber === null || frameNumber === undefined) return null;
            const frame = frames.find((f) => f.frameNumber === frameNumber);
            if (!frame) return null;
            return { nodeId: node.nodeId, imagePath: frame.thumbnailPath };
          })
          .filter((input): input is { nodeId: string; imagePath: string } => input !== null);

        if (imageInputs.length !== selectedWorkflow.inputNodes.length) {
          addToast({ type: 'warning', message: 'Please fill all input slots', duration: 2000 });
          return;
        }

        const result = await window.electronAPI.invoke('comfyui:queue-prompt', {
          baseUrl: settings.comfyuiBaseUrl,
          workflow,
          imageInputs,
        });

        addToast({ type: 'success', message: `Queued job: ${result.promptId}`, duration: 2000 });
      } else {
        // Single-input: send one job per selected frame
        const inputNodeId = selectedWorkflow.inputNodes[0]?.nodeId;
        if (!inputNodeId) {
          addToast({ type: 'error', message: 'No input node found in workflow', duration: 3000 });
          return;
        }

        const selectedFrameData = frames.filter((f) => selectedFrames.has(f.frameNumber));

        for (const frame of selectedFrameData) {
          const result = await window.electronAPI.invoke('comfyui:queue-prompt', {
            baseUrl: settings.comfyuiBaseUrl,
            workflow,
            imageInputs: [{ nodeId: inputNodeId, imagePath: frame.thumbnailPath }],
          });

          addToast({
            type: 'info',
            message: `Queued frame ${frame.frameNumber}: ${result.promptId}`,
            duration: 1500,
          });
        }

        addToast({
          type: 'success',
          message: `Queued ${selectedFrameData.length} jobs`,
          duration: 2000,
        });
      }
    } catch (err) {
      addToast({ type: 'error', message: `Failed to send to ComfyUI: ${err}`, duration: 5000 });
    }
  }, [selectedWorkflow, selectedFrames, comfyuiInputSlots, frames, settings.comfyuiBaseUrl]);

  return {
    testConnection,
    sendToComfyUI,
  };
}

async function loadWorkflowJson(filePath: string): Promise<object> {
  const result = await window.electronAPI.invoke('comfyui:load-workflow', { filePath });
  return result.workflow;
}
