import { useStore } from '../../store';
import type { FilterMode } from '@shared/types';

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: 'All Frames' },
  { value: 'selected', label: 'Selected' },
  { value: 'unselected', label: 'Unselected' },
];

export function FrameFilters() {
  const {
    filterMode,
    setFilterMode,
    showBlurryFrames,
    setShowBlurryFrames,
    showDuplicateFrames,
    setShowDuplicateFrames,
    selectAll,
    selectNone,
    invertSelection,
  } = useStore();

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border">
      {/* Filter dropdown */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary">Filter:</label>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="select text-sm"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle buttons */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showBlurryFrames}
              onChange={(e) => setShowBlurryFrames(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg-tertiary text-accent focus:ring-accent"
            />
            <span className="text-sm text-text-secondary">Blur</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showDuplicateFrames}
              onChange={(e) => setShowDuplicateFrames(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg-tertiary text-accent focus:ring-accent"
            />
            <span className="text-sm text-text-secondary">Dupes</span>
          </label>
        </div>
      </div>

      {/* Selection actions */}
      <div className="flex items-center gap-1">
        <button onClick={selectAll} className="btn btn-ghost text-xs" title="Select all (A)">
          All
        </button>
        <button onClick={selectNone} className="btn btn-ghost text-xs" title="Select none (N)">
          None
        </button>
        <button
          onClick={invertSelection}
          className="btn btn-ghost text-xs"
          title="Invert selection (I)"
        >
          Invert
        </button>
      </div>
    </div>
  );
}
