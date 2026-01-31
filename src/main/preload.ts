import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  IpcChannelName,
  IpcEventName,
  IpcRequest,
  IpcResponse,
  IpcEventData,
} from '../shared/ipc-types';

// Type-safe IPC API exposed to renderer
const electronAPI = {
  /**
   * Invoke an IPC channel and wait for response
   */
  invoke: <T extends IpcChannelName>(
    channel: T,
    data: IpcRequest<T>
  ): Promise<IpcResponse<T>> => {
    return ipcRenderer.invoke(channel, data);
  },

  /**
   * Subscribe to an event channel from main process
   * Returns unsubscribe function
   */
  on: <T extends IpcEventName>(
    channel: T,
    callback: (data: IpcEventData<T>) => void
  ): (() => void) => {
    const listener = (_event: IpcRendererEvent, data: IpcEventData<T>) => {
      callback(data);
    };
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  /**
   * Subscribe to an event channel for a single event
   */
  once: <T extends IpcEventName>(
    channel: T,
    callback: (data: IpcEventData<T>) => void
  ): void => {
    ipcRenderer.once(channel, (_event: IpcRendererEvent, data: IpcEventData<T>) => {
      callback(data);
    });
  },
};

// Expose the API to renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for renderer process
export type ElectronAPI = typeof electronAPI;

// This declaration is used by the renderer to get proper types
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
