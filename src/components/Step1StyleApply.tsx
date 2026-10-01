import { useState, useEffect } from 'react';
import type { OutputQuality } from '../engine/client';
import type { ColorStyle, SavedStylePreset } from '../types';
import { SectionTitle }     from './SectionTitle';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { IntensitySlider }  from './IntensitySlider';
import { MultiImageSelector, type ImageItem } from './MultiImageSelector';
import { ImageGrid, type ResultItem } from './ImageGrid';
import { StyleCard }        from './StyleCard';
import { IconDownload, IconRefresh, IconSpinner } from './Icons';
import { ProgressButton } from './ProgressButton';
import { PRESET_LIMIT } from '../services/presetStorage';

interface Props {
  colorStyle:    ColorStyle;
  sampleItems:   ImageItem[];
  savedPresets:  SavedStylePreset[];
  targetItems:   ImageItem[];
  previewIdx:    number;
  previewUrl:    string | null;
  previewLoading: boolean;
  previewError:  boolean;
  intensityPct:  number;
  applying:      boolean;
  results:       ResultItem[];
  downloadQuality: OutputQuality;
  downloading:     boolean;
  downloadMsg:     string | null;
  downloadProgress: number;
  onTargetChange:          (items: ImageItem[]) => void;
  onPreviewSelect:         (idx: number) => void;
  onIntensityChange:       (v: number) => void;
  onRetryPreview:          () => void;
  onDownloadQualityChange: (q: OutputQuality) => void;
  onDownloadSelected:      (indices: number[]) => void;
  onClearResults:          () => void;
  onSaveStyle:             () => void;
  onReset:                 () => void;
  saveDialogOpen:          boolean;
  saveName:                string;
  onSaveNameChange:        (name: string) => void;
  onSaveConfirm:           () => void;
  onSaveCancel:            () => void;
}

export function Step1StyleApply({
  colorStyle,
  sampleItems,
  savedPresets,
  targetItems,
  previewIdx,
  previewUrl,
  previewLoading,
  previewError,
  intensityPct,
  applying: _applying,
  results,
  downloadQuality,
  downloading,
  downloadMsg,
  downloadProgress,
  onTargetChange,
  onPreviewSelect,
  onIntensityChange,
  onRetryPreview,
  onDownloadQualityChange,
  onDownloadSelected,
  onClearResults,
  onSaveStyle,
  onReset,
  saveDialogOpen,
  saveName,
  onSaveNameChange,
  onSaveConfirm,
  onSaveCancel,
}: Props) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  function toggleSelect(i: number) {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }
  const previewItem = targetItems[previewIdx] ?? targetItems[0] ?? null;

  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!previewItem) return;
    setImageDims(null);
    const img = new Image();
    img.onload = () => setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = previewItem.preview;
  }, [previewItem?.preview]);

  const presetAtLimit = savedPresets.length >= PRESET_LIMIT;
  const saveLabel = presetAtLimit
    ? `Style limit reached (${PRESET_LIMIT}/${PRESET_LIMIT})`
    : '+ Save this style';

  const isPortrait = imageDims ? imageDims.h > imageDims.w : false;
  const aspectRatio = imageDims ? `${imageDims.w}/${imageDims.h}` : '3/2';
  const direction   = isPortrait ? 'vertical' : 'horizontal';
  const wrapStyle   = isPortrait && imageDims
    ? { width: `${(2 / 3) * (imageDims.w / imageDims.h) * 100}%`, margin: '0 auto' }
    : {};

  return (
    <div className="space-y-12">

      {/* ① ライブプレビュー */}
      {previewItem && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle label="Live Preview" heading="Before · After" />
            {previewLoading && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <IconSpinner size={12} /> Updating
              </span>
            )}
          </div>

          <div style={wrapStyle}>
            {previewUrl ? (
              <BeforeAfterSlider
                before={previewItem.preview}
                after={previewUrl}
                aspectRatio={aspectRatio}
                direction={direction}
              />
            ) : (
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio }}>
                <img
                  src={previewItem.preview}
                  alt="preview"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: 'brightness(0.7)' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  {previewError ? (
                    <>
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Preview failed</span>
                      <button
                        onClick={onRetryPreview}
                        className="mono text-[10px] px-3 py-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)' }}
                      >
                        Retry
                      </button>
                    </>
                  ) : (
                    <span className="text-sm animate-pulse" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Generating preview…
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ② 適用先 */}
      <div>
        <SectionTitle label="Target Photos" heading="Select your photos." hint="The style will be applied to each one." />
        <MultiImageSelector
          items={targetItems}
          onChange={items => { onTargetChange(items); onClearResults(); }}
          previewIndex={previewIdx}
          onPreviewSelect={onPreviewSelect}
        />
      </div>

      {/* ③ 強度スライダー */}
      <div>
        <SectionTitle label="Intensity" heading="Blend the influence." />
        <IntensitySlider
          value={intensityPct}
          onChange={v => { onIntensityChange(v); onClearResults(); }}
        />
      </div>

      {/* ④ 結果 + ダウンロード */}
      {results.length > 0 && (
        <div className="space-y-4">
          <ImageGrid
            items={results}
            selectedIndices={selectedIndices}
            onToggle={toggleSelect}
          />

          {selectedIndices.size > 0 && (
            <div className="space-y-3 pt-2">
              <p className="mono text-xs uppercase tracking-widest" style={{ color: 'var(--accent)', letterSpacing: '0.2em' }}>
                Output Quality
              </p>
              <div className="flex gap-2">
                {(['fast', 'standard', 'archive'] as const).map(q => {
                  const sizes = { fast: '~2 MB', standard: '~4 MB', archive: '~8 MB' };
                  const hints = { fast: 'SNS', standard: 'Web · Monitor', archive: 'Print · Archive' };
                  const names = { fast: 'Fast', standard: 'Standard', archive: 'Archive' };
                  const active = downloadQuality === q;
                  return (
                    <button
                      key={q}
                      onClick={() => onDownloadQualityChange(q)}
                      className="flex-1 py-3 px-4 rounded-xl text-left transition-all"
                      style={{
                        background: active ? 'var(--accent-dim)' : 'var(--bg2)',
                        border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
                      }}
                    >
                      <div style={{ fontFamily: 'Lora, Georgia, serif', fontWeight: 400, fontSize: '0.9rem', color: active ? 'var(--accent)' : 'var(--text)' }}>
                        {names[q]}
                      </div>
                      <div className="mono text-[10px] mt-1" style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>{sizes[q]}</div>
                      <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>{hints[q]}</div>
                    </button>
                  );
                })}
              </div>

              <ProgressButton
                progress={downloading ? downloadProgress : 0}
                onClick={() => onDownloadSelected(Array.from(selectedIndices))}
                disabled={downloading}
                className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              >
                {downloading ? (
                  // スピナーは出さず、進捗テキストだけ表示（グラデーション自体が進捗を示す）
                  <span className="tabular-nums">
                    {downloadMsg ?? 'Starting…'}
                  </span>
                ) : (
                  <><IconDownload size={15} /> Download {selectedIndices.size} photo{selectedIndices.size !== 1 ? 's' : ''} · full resolution</>
                )}
              </ProgressButton>

              <p className="text-center text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                Processed on your device — your photos never leave your browser.
              </p>
            </div>
          )}

          {selectedIndices.size === 0 && (
            <p className="text-center serif italic py-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
              Select photos above to download.
            </p>
          )}

          <button
            onClick={onClearResults}
            className="w-full py-2 text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Adjust intensity and retry
          </button>
        </div>
      )}

      {/* ⑤ 抽出済みスタイル */}
      <div>
        <SectionTitle label="Extracted Style" heading="Your style signature." />
        <StyleCard style={colorStyle} selected samplePreviews={sampleItems.map(i => i.preview)} />
      </div>

      {/* スタイルを保存 */}
      {!saveDialogOpen && (
        <button
          onClick={onSaveStyle}
          disabled={presetAtLimit}
          title={presetAtLimit ? 'Delete a saved style to save a new one.' : 'Saved in this browser only'}
          className="flex items-center gap-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { if (!presetAtLimit) e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {saveLabel}
        </button>
      )}
      {saveDialogOpen && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>Style name</p>
          <input
            value={saveName}
            onChange={e => onSaveNameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSaveConfirm(); if (e.key === 'Escape') onSaveCancel(); }}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            placeholder="e.g. Sunset Harbor"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={onSaveConfirm} className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ background: 'var(--accent)', color: '#0b0b0c' }}>Save</button>
            <button onClick={onSaveCancel} className="py-2 px-4 rounded-lg text-xs" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* 最初からやり直す */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: 'var(--text-subtle)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
      >
        <IconRefresh size={12} /> Start over
      </button>
    </div>
  );
}
