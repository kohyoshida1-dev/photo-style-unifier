import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  before: string;
  after: string;
  aspectRatio?: string;
  direction?: 'horizontal' | 'vertical';
}

export function BeforeAfterSlider({
  before, after,
  aspectRatio = '4/3',
  direction = 'horizontal',
}: Props) {
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isV = direction === 'vertical';

  const onMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging.current || !containerRef.current) return;
    if ('touches' in e) e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    if (isV) {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const pct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      setPos(pct);
    } else {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setPos(pct);
    }
  }, [isV]);

  const onUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [onMove, onUp]);

  // portrait のときは pos をリセット
  useEffect(() => { setPos(50); }, [direction]);

  const afterClip = isV
    ? `inset(${pos}% 0 0 0)`       // 上側を隠す → 下にスライドで before 増加
    : `inset(0 0 0 ${pos}%)`;      // 左側を隠す → 右にスライドで before 増加

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-xl"
      style={{ aspectRatio, cursor: isV ? 'row-resize' : 'col-resize', background: 'var(--bg2)', touchAction: 'none' }}
      tabIndex={0}
      onMouseDown={() => { dragging.current = true; }}
      onTouchStart={() => { dragging.current = true; }}
      onKeyDown={e => {
        if (isV) {
          if (e.key === 'ArrowUp')   setPos(p => Math.max(0,   p - 5));
          if (e.key === 'ArrowDown') setPos(p => Math.min(100, p + 5));
        } else {
          if (e.key === 'ArrowLeft')  setPos(p => Math.max(0,   p - 5));
          if (e.key === 'ArrowRight') setPos(p => Math.min(100, p + 5));
        }
      }}
    >
      {/* BEFORE */}
      <img src={before} alt="before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />

      {/* AFTER */}
      <img
        src={after} alt="after"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: afterClip }}
        draggable={false}
      />

      {/* 仕切り線 */}
      {isV ? (
        <div className="absolute left-0 right-0 h-px" style={{ top: `${pos}%`, background: 'rgba(255,255,255,0.6)' }} />
      ) : (
        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${pos}%`, background: 'rgba(255,255,255,0.6)' }} />
      )}

      {/* ドラッグハンドル */}
      <div
        className="absolute flex items-center justify-center rounded-full pointer-events-none"
        style={{
          ...(isV
            ? { top: `${pos}%`, left: '50%', transform: 'translate(-50%, -50%)' }
            : { left: `${pos}%`, top: '50%', transform: 'translate(-50%, -50%)' }
          ),
          width: 40, height: 40,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.1)',
        }}
      >
        {isV ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 4V10M7 4L5 6M7 4L9 6M7 10L5 8M7 10L9 8" stroke="#333" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 7H10M4 7L6 5M4 7L6 9M10 7L8 5M10 7L8 9" stroke="#333" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* ラベル — それぞれの表示エリアの中央に配置 */}
      {pos > 15 && (
        <div
          className="absolute mono text-[9px] px-1.5 py-0.5 rounded pointer-events-none"
          style={{
            background: 'rgba(0,0,0,0.45)',
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.08em',
            transform: 'translate(-50%, -50%)',
            ...(isV
              ? { top: `${pos / 2}%`,         left: '50%' }
              : { left: `${pos / 2}%`,         top:  '50%' }),
          }}
        >
          BEFORE
        </div>
      )}
      {pos < 85 && (
        <div
          className="absolute mono text-[9px] px-1.5 py-0.5 rounded pointer-events-none"
          style={{
            background: 'rgba(0,0,0,0.45)',
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.08em',
            transform: 'translate(-50%, -50%)',
            ...(isV
              ? { top: `${(pos + 100) / 2}%`,  left: '50%' }
              : { left: `${(pos + 100) / 2}%`, top:  '50%' }),
          }}
        >
          AFTER
        </div>
      )}
    </div>
  );
}
