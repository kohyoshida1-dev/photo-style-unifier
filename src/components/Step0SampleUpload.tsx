import type { SavedStylePreset } from '../types';
import { SavedPresetsPanel } from './SavedPresetsPanel';
import { SectionTitle }     from './SectionTitle';
import { MultiImageSelector, type ImageItem } from './MultiImageSelector';

interface Props {
  sampleItems:  ImageItem[];
  savedPresets: SavedStylePreset[];
  onSampleChange:  (items: ImageItem[]) => void;
  onPresetsChange: (presets: SavedStylePreset[]) => void;
  onLoadPreset:    (preset: SavedStylePreset) => void;
}

export function Step0SampleUpload({
  sampleItems,
  savedPresets,
  onSampleChange,
  onPresetsChange,
  onLoadPreset,
}: Props) {
  return (
    <div className="space-y-10">
      {savedPresets.length > 0 && (
        <SavedPresetsPanel
          presets={savedPresets}
          onChange={onPresetsChange}
          onLoad={onLoadPreset}
        />
      )}

      {sampleItems.length === 0 && (
        <div className="text-center py-4">
          <p
            className="mb-2 leading-relaxed"
            style={{
              fontFamily: 'Lora, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '1.1rem',
              color: 'var(--text)',
            }}
          >
            Read your aesthetic from multiple photos.
            <br />
            <span style={{ color: 'var(--text-muted)' }}>Apply that vision everywhere.</span>
          </p>
          <p className="text-xs leading-relaxed mt-3" style={{ color: 'var(--text-subtle)', maxWidth: '42ch', margin: '12px auto 0' }}>
            1 photo minimum, 3–8 recommended. We extract tonal balance, color harmony, and atmosphere — then apply that sensibility with intensity control.
          </p>
        </div>
      )}

      <SectionTitle label="Sample Photos" heading="Upload your references." hint="Drag & drop, or click to select" />
      <MultiImageSelector
        items={sampleItems}
        onChange={onSampleChange}
      />
    </div>
  );
}
