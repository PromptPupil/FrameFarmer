import { useEffect } from 'react';
import { useStore } from './store';
import { Toolbar } from './components/layout/Toolbar';
import { MainLayout } from './components/layout/MainLayout';
import { StatusBar } from './components/layout/StatusBar';
import { ToastContainer } from './components/common/ToastContainer';
import { SettingsDialog } from './components/dialogs/SettingsDialog';
import { ExportDialog } from './components/dialogs/ExportDialog';
import { WorkflowManagerDialog } from './components/dialogs/WorkflowManagerDialog';
import { FFmpegWarningBanner } from './components/common/FFmpegWarningBanner';
import { FramePreviewOverlay } from './components/frames/FramePreviewOverlay';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppInit } from './hooks/useAppInit';
import { useWatchFolder } from './hooks/useWatchFolder';

export default function App() {
  const { settingsDialogOpen, exportDialogOpen, workflowManagerOpen, ffmpegStatus } = useStore();

  // Initialize app (load settings, check FFmpeg, etc.)
  useAppInit();

  // Set up keyboard shortcuts
  useKeyboardShortcuts();

  // Set up watch folder listener
  useWatchFolder();

  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      {/* FFmpeg warning banner if not available */}
      {!ffmpegStatus.available && <FFmpegWarningBanner />}

      {/* Toolbar */}
      <Toolbar />

      {/* Main content area */}
      <MainLayout />

      {/* Status bar */}
      <StatusBar />

      {/* Toast notifications */}
      <ToastContainer />

      {/* Dialogs */}
      {settingsDialogOpen && <SettingsDialog />}
      {exportDialogOpen && <ExportDialog />}
      {workflowManagerOpen && <WorkflowManagerDialog />}

      {/* Frame preview overlay */}
      <FramePreviewOverlay />
    </div>
  );
}
