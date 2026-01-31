import { useStore } from '../../store';
import { WorkflowSelector } from './WorkflowSelector';
import { InputSlot } from './InputSlot';
import { useComfyUIActions } from '../../hooks/useComfyUIActions';

export function ComfyUIPanel() {
  const {
    selectedWorkflow,
    comfyuiInputSlots,
    comfyuiConnected,
    selectedFrames,
    frames,
    settings,
    setWorkflowManagerOpen,
  } = useStore();

  const { sendToComfyUI, testConnection } = useComfyUIActions();

  const hasSelection = selectedFrames.size > 0;
  const isMultiInput = selectedWorkflow && selectedWorkflow.inputNodes.length > 1;

  // Check if all slots are filled for multi-input workflows
  const allSlotsFilled =
    !isMultiInput ||
    (selectedWorkflow &&
      selectedWorkflow.inputNodes.every((node) => comfyuiInputSlots.get(node.nodeId) !== null));

  const canSend = selectedWorkflow && (isMultiInput ? allSlotsFilled : hasSelection);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-text-primary">ComfyUI</h3>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 text-sm ${
              comfyuiConnected ? 'text-success' : 'text-text-secondary'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${comfyuiConnected ? 'bg-success' : 'bg-text-secondary'}`}
            />
            {comfyuiConnected ? 'Connected' : 'Disconnected'}
          </span>
          <button onClick={testConnection} className="btn btn-ghost text-xs">
            Test
          </button>
        </div>
      </div>

      {/* Workflow selector */}
      <div className="flex items-center gap-2">
        <WorkflowSelector />
        <button onClick={() => setWorkflowManagerOpen(true)} className="btn btn-ghost text-sm">
          Manage
        </button>
      </div>

      {/* Input slots for multi-input workflows */}
      {isMultiInput && selectedWorkflow && (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">
            Drag frames to slots or click a slot then click a frame:
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedWorkflow.inputNodes.map((node) => (
              <InputSlot
                key={node.nodeId}
                nodeId={node.nodeId}
                nodeName={node.nodeName}
                frameNumber={comfyuiInputSlots.get(node.nodeId) ?? null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Single input info */}
      {!isMultiInput && selectedWorkflow && (
        <p className="text-sm text-text-secondary">
          {hasSelection
            ? `Will queue ${selectedFrames.size} job${selectedFrames.size > 1 ? 's' : ''} (one per selected frame)`
            : 'Select frames to send to ComfyUI'}
        </p>
      )}

      {/* Send button */}
      <div className="flex items-center gap-2">
        <button
          onClick={sendToComfyUI}
          disabled={!canSend || !comfyuiConnected}
          className="btn btn-primary"
        >
          Send to ComfyUI
        </button>

        {!selectedWorkflow && (
          <span className="text-sm text-text-secondary">Select a workflow first</span>
        )}
      </div>
    </div>
  );
}
