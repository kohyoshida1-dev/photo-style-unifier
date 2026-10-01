import { useState, useEffect } from 'react';
import { AnalyzingOverlay } from './components/AnalyzingOverlay';
import { AppHeader }      from './components/AppHeader';
import { Footer }         from './components/Footer';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { LandingPage }    from './components/LandingPage';
import { Step0SampleUpload } from './components/Step0SampleUpload';
import { Step1StyleApply }   from './components/Step1StyleApply';
import { ProgressButton } from './components/ProgressButton';
import { IconArrowRight, IconSpinner } from './components/Icons';
import { useLivePreview } from './hooks/useLivePreview';
import { loadPresets, savePreset } from './services/presetStorage';
import { generateThumbnail } from './utils/thumbnail';
import { analyzeStyle, renderPreview, renderFullResolution, type OutputQuality } from './engine/client';
import { currentPath, navigate } from './lib/router';
import type { ColorStyle, SavedStylePreset } from './types';
import type { ImageItem } from './components/MultiImageSelector';
import type { ResultItem } from './components/ImageGrid';

type Step = 0 | 1;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** 元ファイル名から書き出しファイル名を作る（出力は常に JPEG） */
function outputFilename(name: string) {
  return `styled_${name.replace(/\.[^.]+$/, '')}.jpg`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function Router() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const handler = () => setPath(currentPath());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  if (path === '/privacy') return <PrivacyPolicyPage onBack={() => navigate('/')} />;
  if (path === '/app')     return <App />;
  return <LandingPage />;
}

function App() {
  // ── ステップ管理 ──
  const [step, setStep] = useState<Step>(0);

  // ── プリセット ──
  const [savedPresets,   setSavedPresets]   = useState<SavedStylePreset[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName,       setSaveName]       = useState('');

  useEffect(() => { loadPresets().then(setSavedPresets); }, []);

  // ── Step 0 ──
  const [sampleItems, setSampleItems] = useState<ImageItem[]>([]);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // ── Step 1 ──
  const [colorStyle,      setColorStyle]      = useState<ColorStyle | null>(null);
  const [targetItems,     setTargetItems]     = useState<ImageItem[]>([]);
  const [previewIdx,      setPreviewIdx]      = useState(0);
  const [intensityPct,    setIntensityPct]    = useState(85);
  const [applying,        setApplying]        = useState(false);
  const [applyProgress,   setApplyProgress]   = useState(0);
  const [results,         setResults]         = useState<ResultItem[]>([]);
  const [downloadQuality, setDownloadQuality] = useState<OutputQuality>('standard');
  const [downloading,     setDownloading]     = useState(false);
  const [downloadMsg,     setDownloadMsg]     = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [retryToken,      setRetryToken]      = useState(0);

  const intensity   = Math.pow(intensityPct / 100, 0.8);
  const previewItem = targetItems[previewIdx] ?? targetItems[0] ?? null;

  const { previewUrl, loading: previewLoading, error: previewError } = useLivePreview({
    file:  previewItem?.file ?? null,
    style: colorStyle,
    intensity,
    retryToken,
  });

  // 結果一覧の Object URL を解放
  useEffect(() => () => { results.forEach(r => URL.revokeObjectURL(r.result)); }, [results]);

  // ── Handlers ──

  async function handleSavePreset() {
    if (!colorStyle) return;
    const thumbnail = sampleItems.length > 0 ? await generateThumbnail(sampleItems[0].file) : '';
    const preset: SavedStylePreset = {
      id:          colorStyle.id,
      name:        saveName.trim() || `Style ${savedPresets.length + 1}`,
      colorStyle,
      thumbnail,
      sampleCount: sampleItems.length || colorStyle.styleSignature?.consensusStrength?.sampleCount || 0,
      savedAt:     new Date().toISOString(),
    };
    const result = await savePreset(preset);
    if (result.limitReached) {
      alert('Style limit reached. Delete a saved style to save a new one.');
    } else if (result.failed) {
      alert('Could not save — your browser storage may be full or disabled.');
    }
    setSavedPresets(await loadPresets());
    setSaveDialogOpen(false);
    setSaveName('');
  }

  function handleLoadPreset(preset: SavedStylePreset) {
    setColorStyle(preset.colorStyle);
    setSampleItems([]);
    setTargetItems([]);
    setResults([]);
    setError(null);
    setSaveDialogOpen(false);
    setStep(1);
  }

  async function handleAnalyze() {
    if (sampleItems.length === 0) return;
    setAnalyzing(true);
    setError(null);
    try {
      const style = await analyzeStyle(sampleItems.map(i => i.file));
      setColorStyle(style);
      setStep(1);
    } catch (e) {
      setError(getErrorMessage(e, 'Analysis failed'));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleApply() {
    if (!colorStyle || targetItems.length === 0) return;
    setApplying(true);
    setError(null);
    setResults([]);
    setApplyProgress(0.02);
    try {
      const out: ResultItem[] = [];
      for (let i = 0; i < targetItems.length; i++) {
        const blob = await renderPreview(targetItems[i].file, colorStyle, intensity);
        out.push({
          filename: targetItems[i].file.name,
          original: targetItems[i].preview,
          result:   URL.createObjectURL(blob),
        });
        setApplyProgress((i + 1) / targetItems.length);
      }
      setResults(out);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to apply'));
    } finally {
      setApplying(false);
      setApplyProgress(0);
    }
  }

  async function handleDownloadSelected(selectedIndices: number[]) {
    if (!colorStyle || selectedIndices.length === 0) return;
    const total = selectedIndices.length;

    setDownloading(true);
    setDownloadProgress(0.02);
    setError(null);

    try {
      for (let n = 0; n < total; n++) {
        const item = targetItems[selectedIndices[n]];
        setDownloadMsg(`Processing ${n + 1} / ${total} at full resolution…`);
        const blob = await renderFullResolution(item.file, colorStyle, intensity, downloadQuality);
        saveBlob(blob, outputFilename(item.file.name));
        setDownloadProgress((n + 1) / total);
        // 連続ダウンロードがブラウザにまとめてブロックされないよう少し間を空ける
        await new Promise(r => setTimeout(r, 300));
      }
      setDownloadMsg(`✓ ${total} photo${total !== 1 ? 's' : ''} downloaded`);
      setTimeout(() => { setDownloadProgress(0); setDownloadMsg(null); }, 4000);
    } catch (e) {
      setDownloadProgress(0);
      setDownloadMsg(null);
      setError(getErrorMessage(e, 'Download failed') + ' — very large photos may exceed your device memory.');
    } finally {
      setDownloading(false);
    }
  }

  function reset() {
    setStep(0);
    setSampleItems([]);
    setColorStyle(null);
    setTargetItems([]);
    setResults([]);
    setError(null);
    setSaveDialogOpen(false);
    setSaveName('');
    setDownloadQuality('standard');
  }

  // ── Render ──
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader />

      <AnalyzingOverlay active={analyzing} sampleCount={sampleItems.length} />

      <div className="max-w-4xl mx-auto px-4 pt-12 pb-20">
        {/* ステップヘッダー — LP eyebrow + Lora serif */}
        <div className="mb-10">
          <p
            className="mono text-xs uppercase tracking-widest mb-2"
            style={{ color: 'var(--accent)', letterSpacing: '0.22em' }}
          >
            {step === 0 ? '01 · Reference' : '02 · Apply'}
          </p>
          <h2
            style={{
              fontFamily: 'Lora, Georgia, serif',
              fontSize: 'clamp(1.4rem, 3vw, 1.9rem)',
              fontWeight: 400,
              lineHeight: 1.2,
              color: 'var(--text)',
            }}
          >
            {step === 0 ? 'Capture the style.' : 'Apply the vision.'}
          </h2>
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-3 mb-6 text-sm"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--danger)' }}
          >
            {error}
          </div>
        )}

        {!downloading && downloadMsg?.startsWith('✓') && (
          <div
            className="rounded-xl px-4 py-3 mb-6 text-sm font-medium text-center"
            style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)', color: '#4ade80' }}
          >
            {downloadMsg} — check your Downloads folder
          </div>
        )}

        {step === 0 && (
          <Step0SampleUpload
            sampleItems={sampleItems}
            savedPresets={savedPresets}
            onSampleChange={setSampleItems}
            onPresetsChange={setSavedPresets}
            onLoadPreset={handleLoadPreset}
          />
        )}

        {step === 1 && colorStyle && (
          <Step1StyleApply
            colorStyle={colorStyle}
            sampleItems={sampleItems}
            savedPresets={savedPresets}
            targetItems={targetItems}
            previewIdx={previewIdx}
            previewUrl={previewUrl}
            previewLoading={previewLoading}
            previewError={previewError}
            intensityPct={intensityPct}
            applying={applying}
            results={results}
            downloadQuality={downloadQuality}
            downloading={downloading}
            downloadMsg={downloadMsg}
            downloadProgress={downloadProgress}
            onTargetChange={(items: ImageItem[]) => { setTargetItems(items); setPreviewIdx(i => Math.min(i, Math.max(0, items.length - 1))); }}
            onPreviewSelect={setPreviewIdx}
            onIntensityChange={setIntensityPct}
            onRetryPreview={() => setRetryToken(t => t + 1)}
            onDownloadQualityChange={setDownloadQuality}
            onDownloadSelected={handleDownloadSelected}
            onClearResults={() => setResults([])}
            onSaveStyle={() => { setSaveName(`Style ${savedPresets.length + 1}`); setSaveDialogOpen(true); }}
            onReset={reset}
            saveDialogOpen={saveDialogOpen}
            saveName={saveName}
            onSaveNameChange={setSaveName}
            onSaveConfirm={handleSavePreset}
            onSaveCancel={() => setSaveDialogOpen(false)}
          />
        )}
      </div>

      <Footer />

      {/* スティッキー Action Bar */}
      {step === 0 && sampleItems.length > 0 && (
        <StickyBar>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
            style={{ background: 'var(--accent)', color: '#0b0b0c', opacity: analyzing ? 0.6 : 1 }}
          >
            {analyzing
              ? <><IconSpinner size={16} /> Analyzing…</>
              : <>Analyze style from {sampleItems.length} photo{sampleItems.length !== 1 ? 's' : ''} <IconArrowRight size={15} /></>
            }
          </button>
        </StickyBar>
      )}

      {step === 1 && colorStyle && targetItems.length > 0 && results.length === 0 && (
        <StickyBar>
          <ProgressButton
            progress={applying ? applyProgress : 0}
            onClick={handleApply}
            disabled={applying}
            className="w-full py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
          >
            {applying
              ? <><IconSpinner size={16} /> Applying {targetItems.length} photo{targetItems.length !== 1 ? 's' : ''}…</>
              : <>Apply to all {targetItems.length} photo{targetItems.length !== 1 ? 's' : ''} <IconArrowRight size={15} /></>
            }
          </ProgressButton>
        </StickyBar>
      )}
    </div>
  );
}

function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-4 py-4"
      style={{ background: 'linear-gradient(to top, var(--bg) 60%, transparent)', backdropFilter: 'blur(8px)' }}
    >
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}
