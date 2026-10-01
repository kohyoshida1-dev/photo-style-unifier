import { useState, useEffect, useRef } from 'react';

const STAGES = [
  { label: 'Loading samples…',         durationMs: 600  },
  { label: 'Analyzing luminance zones…', durationMs: 800  },
  { label: 'Extracting hue profile…',  durationMs: 800  },
  { label: 'Computing consensus…',     durationMs: 700  },
  { label: 'Finalizing style…',        durationMs: Infinity },
];

interface Props {
  active: boolean;
  sampleCount?: number;
}

export function AnalyzingOverlay({ active, sampleCount }: Props) {
  if (!active) return null;
  return <ActiveAnalyzingOverlay sampleCount={sampleCount} />;
}

function ActiveAnalyzingOverlay({ sampleCount }: Pick<Props, 'sampleCount'>) {
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());
  const isLast = stage === STAGES.length - 1;

  // ステージを順に進める
  useEffect(() => {
    if (stage >= STAGES.length - 1) return;
    const ms = STAGES[stage].durationMs;
    const t = setTimeout(() => setStage(s => s + 1), ms);
    return () => clearTimeout(t);
  }, [stage]);

  // 最終ステージに入ったら startRef をリセットして秒数をカウント
  useEffect(() => {
    if (!isLast) return;
    startRef.current = Date.now();
    setElapsed(0);
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [isLast]);

  const estimateSec = sampleCount ? sampleCount * 15 : 30;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(11,11,12,0.85)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex flex-col items-center gap-8 px-8 text-center">

        {/* ドット */}
        <div className="flex gap-2.5 items-center">
          {STAGES.map((_, i) => {
            const done    = i < stage;
            const current = i === stage;
            return (
              <div
                key={i}
                className="rounded-full transition-all duration-500"
                style={{
                  width:      current ? '10px' : '6px',
                  height:     current ? '10px' : '6px',
                  background: (done || current) ? 'var(--accent)' : 'var(--bg4)',
                  opacity:    done ? 0.5 : current ? 1 : 0.3,
                }}
              />
            );
          })}
        </div>

        {/* ラベル + 経過時間 */}
        <div className="space-y-1.5">
          <p className="text-base font-medium" style={{ color: 'var(--text)' }}>
            {STAGES[stage].label}
          </p>
          {isLast && (
            <p className="mono text-[11px]" style={{ color: 'var(--accent)', opacity: 0.8 }}>
              {elapsed}s elapsed · usually {estimateSec}–{estimateSec + 20}s
            </p>
          )}
        </div>

        {/* プログレスバー：最終ステージはインジケーター、それ以外は確定幅 */}
        <div
          className="w-48 h-px rounded-full overflow-hidden"
          style={{ background: 'var(--bg4)' }}
        >
          {isLast ? (
            <div
              className="h-full rounded-full"
              style={{
                width: '40%',
                background: 'var(--accent)',
                animation: 'slide-indicator 1.6s ease-in-out infinite',
              }}
            />
          ) : (
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${((stage + 1) / STAGES.length) * 100}%`,
                background: 'var(--accent)',
              }}
            />
          )}
        </div>

        {sampleCount != null && (
          <p className="mono text-[11px]" style={{ color: 'var(--text-subtle)' }}>
            Analyzing {sampleCount} sample{sampleCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <style>{`
        @keyframes slide-indicator {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
