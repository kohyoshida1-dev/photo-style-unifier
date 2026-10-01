const PRESETS = [25, 50, 75, 100] as const;

interface Props {
  value: number; // 0–100
  onChange: (v: number) => void;
}

export function IntensitySlider({ value, onChange }: Props) {
  const fillPct = value;

  return (
    <div className="space-y-4">
      {/* 上段：大型数値 + プリセットボタン */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-0.5">
            <span className="mono text-4xl font-medium leading-none" style={{ color: 'var(--text)' }}>
              {value}
            </span>
            <span className="mono text-xl" style={{ color: 'var(--text-muted)' }}>%</span>
          </div>
        </div>

        {/* プリセット */}
        <div className="flex gap-1">
          {PRESETS.map(p => {
            const active = value === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                className="mono text-xs px-2.5 py-1.5 rounded-md transition-all"
                style={active ? {
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent-border)',
                  color: 'var(--accent)',
                } : {
                  background: 'var(--bg3)',
                  border: '1px solid transparent',
                  color: 'var(--text-muted)',
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* スライダー */}
      <div className="relative">
        {/* 塗り済みトラック */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] rounded-full pointer-events-none transition-all"
          style={{ width: `${fillPct}%`, background: 'var(--accent)' }} />
        <input
          type="range"
          min={0} max={100}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="style-range w-full relative"
        />
      </div>

      {/* 下ラベル */}
      <div className="flex justify-between mono text-[10px]" style={{ color: 'var(--text-subtle)' }}>
        <span>Subtle</span>
        <span>Strong</span>
      </div>
    </div>
  );
}
