import { BeforeAfterSlider } from './BeforeAfterSlider';

export interface ResultItem {
  filename: string;
  original: string;
  result: string;
}

interface Props {
  items: ResultItem[];
  selectedIndices: Set<number>;
  onToggle: (i: number) => void;
}

export function ImageGrid({ items, selectedIndices, onToggle }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--text)' }}>{items.length}</span>
          {' '}{items.length !== 1 ? 'photos' : 'photo'} ready —{' '}
          <span style={{ color: 'var(--accent)' }}>tap to select</span>
        </p>
        {selectedIndices.size > 0 && (
          <span className="text-xs" style={{ color: 'var(--accent)' }}>
            {selectedIndices.size} selected
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => {
          const selected = selectedIndices.has(i);
          return (
            <div
              key={i}
              className="space-y-1 cursor-pointer"
              onClick={() => onToggle(i)}
            >
              <p className="mono text-[9px] truncate" style={{ color: 'var(--text-subtle)' }}>
                {item.filename}
              </p>
              <div className="relative">
                <BeforeAfterSlider before={item.original} after={item.result} aspectRatio="4/3" />
                {/* 選択オーバーレイ */}
                <div
                  className="absolute inset-0 rounded-lg transition-all pointer-events-none"
                  style={{
                    border: selected ? '2px solid var(--accent)' : '2px solid transparent',
                    background: selected ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0)',
                  }}
                />
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: selected ? 'var(--accent)' : 'rgba(0,0,0,0.4)',
                    border: selected ? 'none' : '1px solid rgba(255,255,255,0.4)',
                  }}
                >
                  {selected && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#0b0b0c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
