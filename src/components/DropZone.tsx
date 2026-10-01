import { useRef } from 'react';
import type { DragEvent } from 'react';
import { IconUpload, IconPlus, IconX } from './Icons';

export interface DropZoneItem {
  file: File;
  preview: string;
}

interface Props {
  items: DropZoneItem[];
  onChange: (items: DropZoneItem[]) => void;
  /** true のとき選択サムネイル+追加ボタンのコンパクト表示 */
  compact?: boolean;
  /** サムネイルクリック時のコールバック */
  onThumbClick?: (index: number) => void;
  /** アクティブなサムネイルのインデックス */
  activeIndex?: number;
  label?: string;
  hint?: string;
  accept?: string;
  /** アップロード可能な最大枚数 (未設定 = 無制限) */
  maxItems?: number;
  /** 制限理由の説明文 (フリープランなど) */
  upgradeHint?: string;
}

function readFiles(files: FileList | File[]): Promise<DropZoneItem[]> {
  return Promise.all(
    Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(file =>
        new Promise<DropZoneItem>(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve({ file, preview: e.target!.result as string });
          reader.readAsDataURL(file);
        })
      )
  );
}

export function DropZone({
  items, onChange,
  compact = false,
  onThumbClick, activeIndex,
  label = 'Drag & drop photos',
  hint = 'or click to browse',
  accept = 'image/*',
  maxItems,
  upgradeHint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const atLimit = maxItems != null && items.length >= maxItems;

  async function addFiles(newFiles: FileList | File[]) {
    const added = await readFiles(newFiles);
    let merged: DropZoneItem[];
    if (maxItems === 1) {
      // 1枚制限: 新しい1枚で置き換え
      merged = added.slice(0, 1);
    } else {
      merged = [...items];
      for (const a of added) {
        if (!merged.some(e => e.file.name === a.file.name && e.file.size === a.file.size)) {
          merged.push(a);
        }
      }
      if (maxItems != null) merged = merged.slice(0, maxItems);
    }
    onChange(merged);
  }

  function remove(i: number, e: React.MouseEvent) {
    e.stopPropagation();
    const next = items.filter((_, idx) => idx !== i);
    onChange(next);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging.current = false;
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  }

  /* ── コンパクトモード（写真追加済み） ── */
  if (compact && items.length > 0) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {items.map((item, i) => (
          <div key={i} className="relative group flex-shrink-0">
            <button
              type="button"
              onClick={() => onThumbClick?.(i)}
              className="block w-14 rounded-lg overflow-hidden transition-all flex items-center justify-center"
              style={{
                height: 56,
                background: 'var(--bg3)',
                outline: activeIndex === i ? '2px solid var(--accent)' : '2px solid transparent',
                outlineOffset: '2px',
              }}
            >
              <img src={item.preview} alt="" className="w-full h-full object-contain" />
            </button>
            <button
              type="button"
              onClick={e => remove(i, e)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}
            >
              <IconX size={9} />
            </button>
          </div>
        ))}
        {/* 追加ボタン (上限未達のみ表示) */}
        {!atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-14 h-14 rounded-lg flex items-center justify-center transition-colors"
            style={{ border: '1.5px dashed var(--border-strong)', color: 'var(--text-subtle)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
          >
            <IconPlus size={16} />
          </button>
        )}
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={handleChange} />
      </div>
    );
  }

  /* ── フルサイズ ドロップゾーン ── */
  return (
    <div>
      {/* ドロップエリア */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.setAttribute('data-over', ''); }}
        onDragLeave={e => e.currentTarget.removeAttribute('data-over')}
        onDrop={e => { e.currentTarget.removeAttribute('data-over'); handleDrop(e); }}
        className="group relative rounded-xl cursor-pointer transition-all duration-200 select-none"
        style={{
          background: 'var(--bg2)',
          border: '1.5px dashed var(--border-strong)',
          minHeight: items.length === 0 ? '160px' : 'auto',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
      >
        {items.length === 0 ? (
          /* 空のとき */
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <span style={{ color: 'var(--accent-border)' }}><IconUpload size={20} /></span>
            <div className="text-center space-y-1.5">
              <p
                style={{
                  fontFamily: 'Lora, Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: '1rem',
                  color: 'var(--text-muted)',
                }}
              >
                {label}
              </p>
              <p className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-subtle)', letterSpacing: '0.16em' }}>
                {hint}
              </p>
            </div>
          </div>
        ) : (
          /* サムネイルグリッド */
          <div className="p-3">
            <div className="flex flex-wrap gap-2">
              {items.map((item, i) => (
                <div key={i} className="relative group/thumb flex-shrink-0">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onThumbClick?.(i); }}
                    className="block w-16 rounded-lg overflow-hidden transition-all flex items-center justify-center"
                    style={{
                      height: 72,
                      background: 'var(--bg3)',
                      outline: activeIndex === i ? '2px solid var(--accent)' : '2px solid transparent',
                      outlineOffset: '2px',
                    }}
                  >
                    <img src={item.preview} alt="" className="w-full h-full object-contain" />
                  </button>
                  <button
                    type="button"
                    onClick={e => remove(i, e)}
                    className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }}
                  >
                    <IconX size={9} />
                  </button>
                </div>
              ))}
              {/* 追加ボタン（グリッド内・上限未達のみ） */}
              {!atLimit && (
                <div
                  onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="w-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                  style={{ height: 72, border: '1.5px dashed var(--border)', color: 'var(--text-subtle)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <IconPlus size={14} />
                  <span className="text-[9px] mono">+</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={handleChange} />
      {upgradeHint && (
        <p className="mt-2 text-[11px] text-center" style={{ color: 'var(--text-subtle)' }}>
          {upgradeHint}
        </p>
      )}
    </div>
  );
}
