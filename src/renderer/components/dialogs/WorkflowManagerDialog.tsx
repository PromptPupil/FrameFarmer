import { useState } from 'react';
import { useStore } from '../../store';
import type { WorkflowTemplate } from '@shared/types';

export function WorkflowManagerDialog() {
  const {
    workflowTemplates,
    setWorkflowTemplates,
    addWorkflowTemplate,
    removeWorkflowTemplate,
    setWorkflowManagerOpen,
  } = useStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [inputNodes, setInputNodes] = useState<Array<{ nodeId: string; nodeName: string; nodeType: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = async () => {
    const result = await window.electronAPI.invoke('fs:select-file', {
      title: 'Select ComfyUI Workflow',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (result.filePath) {
      setSelectedFile(result.filePath);
      setError(null);

      // Parse the workflow to find input nodes
      try {
        const parseResult = await window.electronAPI.invoke('comfyui:parse-workflow', {
          filePath: result.filePath,
        });
        setInputNodes(parseResult.inputNodes);

        // Auto-generate name from filename if empty
        if (!newName) {
          const fileName = result.filePath.split(/[/\\]/).pop() ?? 'workflow';
          setNewName(fileName.replace('.json', ''));
        }
      } catch (err) {
        setError(`Failed to parse workflow: ${err}`);
        setInputNodes([]);
      }
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !selectedFile) {
      setError('Please provide a name and select a workflow file');
      return;
    }

    try {
      const result = await window.electronAPI.invoke('db:save-workflow-template', {
        name: newName.trim(),
        filePath: selectedFile,
        inputNodes,
      });

      addWorkflowTemplate(result);
      setIsAdding(false);
      setNewName('');
      setSelectedFile(null);
      setInputNodes([]);
      setError(null);
    } catch (err) {
      setError(`Failed to save template: ${err}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI.invoke('db:delete-workflow-template', { id });
      removeWorkflowTemplate(id);
    } catch (err) {
      setError(`Failed to delete template: ${err}`);
    }
  };

  return (
    <div className="dialog-overlay" onClick={() => setWorkflowManagerOpen(false)}>
      <div className="dialog-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-medium">Manage Workflow Templates</h2>
          <button onClick={() => setWorkflowManagerOpen(false)} className="btn btn-ghost p-1">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-error/20 border border-error rounded text-sm text-error">
              {error}
            </div>
          )}

          {/* Existing templates */}
          {workflowTemplates.length > 0 ? (
            <div className="space-y-2">
              {workflowTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 bg-bg-tertiary rounded"
                >
                  <div>
                    <div className="font-medium">{template.name}</div>
                    <div className="text-xs text-text-secondary">
                      {template.inputNodes.length} input
                      {template.inputNodes.length !== 1 ? 's' : ''} •{' '}
                      {template.inputNodes.map((n) => n.nodeName).join(', ')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="btn btn-ghost text-error p-1"
                    title="Delete template"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-sm">No workflow templates yet.</p>
          )}

          {/* Add new template form */}
          {isAdding ? (
            <div className="space-y-3 p-4 border border-border rounded">
              <h3 className="font-medium">Add New Template</h3>

              <label className="block text-sm">
                Template Name
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input w-full mt-1"
                  placeholder="e.g., FLF2V Template"
                />
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedFile ?? ''}
                  className="input flex-1"
                  placeholder="Select workflow JSON..."
                  readOnly
                />
                <button onClick={handleSelectFile} className="btn btn-secondary">
                  Browse
                </button>
              </div>

              {inputNodes.length > 0 && (
                <div className="text-sm text-text-secondary">
                  Found {inputNodes.length} LoadImage node
                  {inputNodes.length !== 1 ? 's' : ''}:{' '}
                  {inputNodes.map((n) => n.nodeName).join(', ')}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handleAdd} className="btn btn-primary">
                  Add Template
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewName('');
                    setSelectedFile(null);
                    setInputNodes([]);
                    setError(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAdding(true)} className="btn btn-primary w-full">
              + Add Template
            </button>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={() => setWorkflowManagerOpen(false)} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
