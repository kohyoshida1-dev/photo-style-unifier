import { DropZone, type DropZoneItem } from './DropZone';

export interface ImageItem {
  file: File;
  preview: string;
}

interface Props {
  items: ImageItem[];
  onChange: (items: ImageItem[]) => void;
  /** Step 1 でライブプレビュー対象を選ぶためのインデックス */
  previewIndex?: number;
  onPreviewSelect?: (index: number) => void;
  label?: string;
  hint?: string;
  maxItems?: number;
  upgradeHint?: string;
}

export function MultiImageSelector({
  items, onChange,
  previewIndex, onPreviewSelect,
  label, hint,
  maxItems, upgradeHint,
}: Props) {
  // ImageItem と DropZoneItem は同じ形（file + preview）なので型互換
  const dropItems: DropZoneItem[] = items;

  function handleChange(next: DropZoneItem[]) {
    onChange(next as ImageItem[]);
  }

  const hasPreviewSelect = onPreviewSelect != null;

  return (
    <DropZone
      items={dropItems}
      onChange={handleChange}
      compact={hasPreviewSelect && items.length > 0}
      activeIndex={previewIndex}
      onThumbClick={onPreviewSelect}
      label={label}
      hint={hint}
      maxItems={maxItems}
      upgradeHint={upgradeHint}
    />
  );
}
