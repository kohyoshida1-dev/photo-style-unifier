import type { SavedStylePreset } from '../types';

/**
 * 保存したスタイルは利用者のブラウザ（localStorage）にだけ保存する。
 * サーバーもアカウントも不要。ブラウザのデータを消すと保存済みスタイルも消える。
 */

const STORAGE_KEY = 'psu_saved_presets_v1';

export const PRESET_LIMIT = 20;

function read(): SavedStylePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(presets: SavedStylePreset[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

export async function loadPresets(): Promise<SavedStylePreset[]> {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function savePreset(preset: SavedStylePreset): Promise<{ limitReached?: boolean; failed?: boolean }> {
  const others = read().filter(p => p.id !== preset.id);
  if (others.length >= PRESET_LIMIT) return { limitReached: true };
  return write([preset, ...others]) ? {} : { failed: true };
}

export async function deletePreset(id: string): Promise<void> {
  write(read().filter(p => p.id !== id));
}

export async function updatePresetName(id: string, name: string): Promise<void> {
  write(read().map(p => (p.id === id ? { ...p, name } : p)));
}
