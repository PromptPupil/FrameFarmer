import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import type { AppSettings } from '@shared/types';

export function SettingsDialog() {
  const { settings, setSettings, setSettingsDialogOpen, ffmpegStatus } = useStore();
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    // Save to store and persist via IPC
    setSettings(localSettings);
    await window.electronAPI.invoke('db:save-settings', localSettings);
    setSettingsDialogOpen(false);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const result = await window.electronAPI.invoke('comfyui:test-connection', {
        baseUrl: localSettings.comfyuiBaseUrl,
      });
      setConnectionStatus(result.connected ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    }
    setTestingConnection(false);
  };

  const handleSelectFolder = async (field: 'watchFolderPath' | 'outputFolderBase') => {
    const result = await window.electronAPI.invoke('fs:select-folder', {});
    if (result.folderPath) {
      setLocalSettings({ ...localSettings, [field]: result.folderPath });
    }
  };

  return (
    <div className="dialog-overlay" onClick={() => setSettingsDialogOpen(false)}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-medium">Settings</h2>
          <button onClick={() => setSettingsDialogOpen(false)} className="btn btn-ghost p-1">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* ComfyUI Section */}
          <section className="space-y-3">
            <h3 className="font-medium text-sm text-text-secondary uppercase tracking-wide">
              ComfyUI
            </h3>
            <div className="space-y-2">
              <label className="block text-sm">
                Server URL
                <input
                  type="text"
                  value={localSettings.comfyuiBaseUrl}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, comfyuiBaseUrl: e.target.value })
                  }
                  className="input w-full mt-1"
                  placeholder="http://localhost:8188"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="btn btn-secondary text-sm"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
                {connectionStatus === 'success' && (
                  <span className="text-success text-sm">Connected!</span>
                )}
                {connectionStatus === 'error' && (
                  <span className="text-error text-sm">Failed to connect</span>
                )}
              </div>
            </div>
          </section>

          {/* Watch Folder Section */}
          <section className="space-y-3">
            <h3 className="font-medium text-sm text-text-secondary uppercase tracking-wide">
              Watch Folder
            </h3>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localSettings.watchFolderEnabled}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, watchFolderEnabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm">Enable watch folder</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localSettings.watchFolderPath ?? ''}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, watchFolderPath: e.target.value || null })
                }
                className="input flex-1"
                placeholder="Select folder to watch..."
                readOnly
              />
              <button
                onClick={() => handleSelectFolder('watchFolderPath')}
                className="btn btn-secondary"
              >
                Browse
              </button>
            </div>
          </section>

          {/* Frame Extraction Section */}
          <section className="space-y-3">
            <h3 className="font-medium text-sm text-text-secondary uppercase tracking-wide">
              Frame Extraction
            </h3>
            <label className="block text-sm">
              Default frame count
              <select
                value={localSettings.defaultFrameCount}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, defaultFrameCount: parseInt(e.target.value) })
                }
                className="select w-full mt-1"
              >
                {[5, 10, 15, 20, 30, 60, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localSettings.autoAnalyze}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, autoAnalyze: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm">Auto-analyze frames after extraction</span>
            </label>
          </section>

          {/* Analysis Thresholds Section */}
          <section className="space-y-3">
            <h3 className="font-medium text-sm text-text-secondary uppercase tracking-wide">
              Analysis Thresholds
            </h3>
            <label className="block text-sm">
              Blur threshold ({localSettings.blurThreshold})
              <input
                type="range"
                min="0"
                max="100"
                value={localSettings.blurThreshold}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, blurThreshold: parseInt(e.target.value) })
                }
                className="w-full mt-1"
              />
            </label>
            <label className="block text-sm">
              Similarity threshold ({localSettings.similarityThreshold}%)
              <input
                type="range"
                min="50"
                max="100"
                value={localSettings.similarityThreshold}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    similarityThreshold: parseInt(e.target.value),
                  })
                }
                className="w-full mt-1"
              />
            </label>
          </section>

          {/* Output Section */}
          <section className="space-y-3">
            <h3 className="font-medium text-sm text-text-secondary uppercase tracking-wide">
              Output
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={localSettings.outputFolderBase ?? ''}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, outputFolderBase: e.target.value || null })
                }
                className="input flex-1"
                placeholder="Same as video folder"
              />
              <button
                onClick={() => handleSelectFolder('outputFolderBase')}
                className="btn btn-secondary"
              >
                Browse
              </button>
            </div>
            <label className="block text-sm">
              Output format
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={localSettings.outputFormat === 'png'}
                    onChange={() => setLocalSettings({ ...localSettings, outputFormat: 'png' })}
                  />
                  PNG
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={localSettings.outputFormat === 'jpg'}
                    onChange={() => setLocalSettings({ ...localSettings, outputFormat: 'jpg' })}
                  />
                  JPG
                </label>
              </div>
            </label>
          </section>

          {/* FFmpeg Section */}
          <section className="space-y-3">
            <h3 className="font-medium text-sm text-text-secondary uppercase tracking-wide">
              FFmpeg
            </h3>
            <label className="block text-sm">
              FFmpeg path (leave empty for auto-detect)
              <input
                type="text"
                value={localSettings.ffmpegPath ?? ''}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, ffmpegPath: e.target.value || null })
                }
                className="input w-full mt-1"
                placeholder="Auto-detect"
              />
            </label>
            <div className="text-sm text-text-secondary">
              Status:{' '}
              {ffmpegStatus.available ? (
                <span className="text-success">
                  Found at {ffmpegStatus.ffmpegPath} (v{ffmpegStatus.version})
                </span>
              ) : (
                <span className="text-error">Not found</span>
              )}
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={() => setSettingsDialogOpen(false)} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
