import { useState, useRef } from 'react';
import type { SavedStylePreset } from '../types';
import { deletePreset, updatePresetName, PRESET_LIMIT } from '../services/presetStorage';

interface Props {
  presets: SavedStylePreset[];
  onChange: (presets: SavedStylePreset[]) => void;
  onLoad: (preset: SavedStylePreset) => void;
}

export function SavedPresetsPanel({ presets, onChange, onLoad }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(preset: SavedStylePreset, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(preset.id);
    setEditingName(preset.name);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitEdit(id: string) {
    const name = editingName.trim() || 'Style';
    await updatePresetName(id, name);
    onChange(presets.map(p => (p.id === id ? { ...p, name } : p)));
    setEditingId(null);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deletePreset(id);
    onChange(presets.filter(p => p.id !== id));
  }

  return (
    <div className="mb-1">
      <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--accent)', letterSpacing: '0.2em' }}>
        Saved Styles ({presets.length}/{PRESET_LIMIT}) · this browser
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {presets.map(preset => (
          <div
            key={preset.id}
            role="button"
            tabIndex={0}
            onClick={() => onLoad(preset)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onLoad(preset); }}
            className="relative flex-shrink-0 rounded-xl overflow-hidden text-left transition-all group cursor-pointer"
            style={{
              width: 96,
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            {/* サムネイル */}
            <div className="w-full" style={{ aspectRatio: '1', background: 'var(--bg)' }}>
              {preset.thumbnail ? (
                <img
                  src={preset.thumbnail}
                  alt={preset.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-lg" style={{ color: 'var(--text-subtle)' }}>◻</span>
                </div>
              )}
            </div>

            {/* 名前・情報 */}
            <div className="px-2 py-1.5">
              {editingId === preset.id ? (
                <input
                  ref={inputRef}
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={() => commitEdit(preset.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(preset.id);
                    if (e.key === 'Escape') setEditingId(null);
                    e.stopPropagation();
                  }}
                  onClick={e => e.stopPropagation()}
                  className="w-full text-xs bg-transparent border-b outline-none"
                  style={{ color: 'var(--text)', borderColor: 'var(--accent)' }}
                  autoFocus
                />
              ) : (
                <p
                  className="truncate leading-tight"
                  style={{ fontFamily: 'Lora, Georgia, serif', fontSize: '0.8rem', fontWeight: 400, color: 'var(--text)' }}
                  onDoubleClick={e => startEdit(preset, e)}
                  title={`${preset.name} (double-click to rename)`}
                >
                  {preset.name}
                </p>
              )}
              <p className="mono text-[10px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                {preset.sampleCount} photos
              </p>
            </div>

            {/* 削除ボタン */}
            <button
              onClick={e => handleDelete(preset.id, e)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
              style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.85)' }}
              title="Delete"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
