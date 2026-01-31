import Database from 'better-sqlite3';
import log from 'electron-log';
import { getDatabasePath } from '../utils/paths';
import { generateId } from '../utils/hash';
import type {
  AppSettings,
  VideoState,
  WorkflowTemplate,
  FrameAnalysis,
  TimelineMarker,
} from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

const DB_VERSION = 1;

interface SettingsRow {
  key: string;
  value: string;
}

interface VideoStateRow {
  id: string;
  file_path: string;
  file_hash: string | null;
  selected_frames: string;
  timeline_markers: string;
  last_position: number;
  last_opened_at: number;
  created_at: number;
}

interface WorkflowTemplateRow {
  id: string;
  name: string;
  file_path: string;
  input_nodes: string;
  created_at: number;
  updated_at: number;
}

interface FrameAnalysisRow {
  id: string;
  video_hash: string;
  frame_number: number;
  timestamp: number;
  blur_score: number | null;
  perceptual_hash: string | null;
  analyzed_at: number;
}

interface QueueRow {
  id: string;
  file_path: string;
  status: string;
  added_at: number;
  processed_at: number | null;
}

class DatabaseService {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    this.dbPath = getDatabasePath();
    log.info(`Initializing database at: ${this.dbPath}`);

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    // Create settings table first so we can check version
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
    `);

    // Check current version
    const versionRow = this.db
      .prepare("SELECT value FROM settings WHERE key = 'db_version'")
      .get() as SettingsRow | undefined;

    const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

    if (currentVersion < DB_VERSION) {
      this.runMigrations(currentVersion);
    }

    log.info('Database initialized successfully');
  }

  private runMigrations(fromVersion: number): void {
    log.info(`Running database migrations from v${fromVersion} to v${DB_VERSION}`);

    if (fromVersion < 1) {
      this.migrateToV1();
    }

    // Update version
    this.db
      .prepare(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('db_version', ?, strftime('%s', 'now'))"
      )
      .run(DB_VERSION.toString());
  }

  private migrateToV1(): void {
    this.db.exec(`
      -- Workflow templates
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        input_nodes TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      -- Video state (remembers selections per video)
      CREATE TABLE IF NOT EXISTS video_states (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        file_hash TEXT,
        selected_frames TEXT NOT NULL DEFAULT '[]',
        timeline_markers TEXT NOT NULL DEFAULT '[]',
        last_position REAL NOT NULL DEFAULT 0,
        last_opened_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      -- Analysis cache
      CREATE TABLE IF NOT EXISTS frame_analysis (
        id TEXT PRIMARY KEY,
        video_hash TEXT NOT NULL,
        frame_number INTEGER NOT NULL,
        timestamp REAL NOT NULL,
        blur_score REAL,
        perceptual_hash TEXT,
        analyzed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        UNIQUE(video_hash, frame_number)
      );

      -- Video queue
      CREATE TABLE IF NOT EXISTS video_queue (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        status TEXT NOT NULL DEFAULT 'pending',
        processed_at INTEGER
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_video_states_file_path ON video_states(file_path);
      CREATE INDEX IF NOT EXISTS idx_frame_analysis_video ON frame_analysis(video_hash);
      CREATE INDEX IF NOT EXISTS idx_video_queue_status ON video_queue(status);
    `);

    log.info('Migration to v1 complete');
  }

  // ============ Settings ============

  getSettings(): AppSettings {
    const rows = this.db
      .prepare("SELECT key, value FROM settings WHERE key != 'db_version'")
      .all() as SettingsRow[];

    const stored: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        stored[row.key] = JSON.parse(row.value);
      } catch {
        stored[row.key] = row.value;
      }
    }

    return { ...DEFAULT_SETTINGS, ...stored } as AppSettings;
  }

  saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at)
         VALUES (?, ?, strftime('%s', 'now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = strftime('%s', 'now')`
      )
      .run(key, JSON.stringify(value));
  }

  saveSettings(settings: Partial<AppSettings>): void {
    const transaction = this.db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        this.saveSetting(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
      }
    });
    transaction();
  }

  // ============ Video State ============

  getVideoState(filePath: string): VideoState | null {
    const row = this.db
      .prepare('SELECT * FROM video_states WHERE file_path = ?')
      .get(filePath) as VideoStateRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      filePath: row.file_path,
      fileHash: row.file_hash ?? undefined,
      selectedFrames: JSON.parse(row.selected_frames) as number[],
      timelineMarkers: JSON.parse(row.timeline_markers) as TimelineMarker[],
      lastPosition: row.last_position,
      lastOpenedAt: new Date(row.last_opened_at * 1000),
    };
  }

  saveVideoState(state: VideoState): void {
    this.db
      .prepare(
        `INSERT INTO video_states (id, file_path, file_hash, selected_frames, timeline_markers, last_position, last_opened_at)
         VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
         ON CONFLICT(file_path) DO UPDATE SET
           file_hash = excluded.file_hash,
           selected_frames = excluded.selected_frames,
           timeline_markers = excluded.timeline_markers,
           last_position = excluded.last_position,
           last_opened_at = strftime('%s', 'now')`
      )
      .run(
        state.id,
        state.filePath,
        state.fileHash ?? null,
        JSON.stringify(state.selectedFrames),
        JSON.stringify(state.timelineMarkers),
        state.lastPosition
      );
  }

  getLastOpenedVideo(): VideoState | null {
    const row = this.db
      .prepare('SELECT * FROM video_states ORDER BY last_opened_at DESC LIMIT 1')
      .get() as VideoStateRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      filePath: row.file_path,
      fileHash: row.file_hash ?? undefined,
      selectedFrames: JSON.parse(row.selected_frames) as number[],
      timelineMarkers: JSON.parse(row.timeline_markers) as TimelineMarker[],
      lastPosition: row.last_position,
      lastOpenedAt: new Date(row.last_opened_at * 1000),
    };
  }

  // ============ Workflow Templates ============

  getWorkflowTemplates(): WorkflowTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM workflow_templates ORDER BY name')
      .all() as WorkflowTemplateRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      filePath: row.file_path,
      inputNodes: JSON.parse(row.input_nodes),
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000),
    }));
  }

  saveWorkflowTemplate(
    template: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): WorkflowTemplate {
    const id = generateId();
    const now = Math.floor(Date.now() / 1000);

    this.db
      .prepare(
        `INSERT INTO workflow_templates (id, name, file_path, input_nodes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, template.name, template.filePath, JSON.stringify(template.inputNodes), now, now);

    return {
      id,
      ...template,
      createdAt: new Date(now * 1000),
      updatedAt: new Date(now * 1000),
    };
  }

  updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.filePath !== undefined) {
      setClauses.push('file_path = ?');
      values.push(updates.filePath);
    }
    if (updates.inputNodes !== undefined) {
      setClauses.push('input_nodes = ?');
      values.push(JSON.stringify(updates.inputNodes));
    }

    if (setClauses.length === 0) return;

    setClauses.push("updated_at = strftime('%s', 'now')");
    values.push(id);

    this.db.prepare(`UPDATE workflow_templates SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteWorkflowTemplate(id: string): void {
    this.db.prepare('DELETE FROM workflow_templates WHERE id = ?').run(id);
  }

  // ============ Frame Analysis Cache ============

  getAnalysisCache(videoHash: string): FrameAnalysis[] {
    const rows = this.db
      .prepare('SELECT * FROM frame_analysis WHERE video_hash = ? ORDER BY frame_number')
      .all(videoHash) as FrameAnalysisRow[];

    return rows.map((row) => ({
      frameNumber: row.frame_number,
      timestamp: row.timestamp,
      blurScore: row.blur_score,
      perceptualHash: row.perceptual_hash,
      isDuplicate: false, // Calculated at runtime
      isBlurry: false, // Calculated at runtime
    }));
  }

  saveAnalysisCache(videoHash: string, analyses: FrameAnalysis[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO frame_analysis (id, video_hash, frame_number, timestamp, blur_score, perceptual_hash, analyzed_at)
       VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
       ON CONFLICT(video_hash, frame_number) DO UPDATE SET
         blur_score = excluded.blur_score,
         perceptual_hash = excluded.perceptual_hash,
         analyzed_at = strftime('%s', 'now')`
    );

    const transaction = this.db.transaction(() => {
      for (const analysis of analyses) {
        stmt.run(
          generateId(),
          videoHash,
          analysis.frameNumber,
          analysis.timestamp,
          analysis.blurScore,
          analysis.perceptualHash
        );
      }
    });

    transaction();
  }

  clearAnalysisCache(videoHash: string): void {
    this.db.prepare('DELETE FROM frame_analysis WHERE video_hash = ?').run(videoHash);
  }

  // ============ Video Queue ============

  getQueue(): QueueRow[] {
    return this.db
      .prepare('SELECT * FROM video_queue ORDER BY added_at')
      .all() as QueueRow[];
  }

  addToQueue(filePath: string): string {
    const id = generateId();
    this.db
      .prepare(
        `INSERT INTO video_queue (id, file_path, status, added_at)
         VALUES (?, ?, 'pending', strftime('%s', 'now'))`
      )
      .run(id, filePath);
    return id;
  }

  updateQueueStatus(id: string, status: string): void {
    const processedAt = status === 'completed' ? "strftime('%s', 'now')" : 'NULL';
    this.db
      .prepare(`UPDATE video_queue SET status = ?, processed_at = ${processedAt} WHERE id = ?`)
      .run(status, id);
  }

  removeFromQueue(id: string): void {
    this.db.prepare('DELETE FROM video_queue WHERE id = ?').run(id);
  }

  clearQueue(): void {
    this.db.prepare('DELETE FROM video_queue').run();
  }

  // ============ Lifecycle ============

  close(): void {
    log.info('Closing database');
    this.db.close();
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
