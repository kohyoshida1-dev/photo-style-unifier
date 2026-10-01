import { useState, useRef, useCallback } from 'react';

/**
 * 推定処理時間からなめらかな進捗アニメーションを生成する。
 * - start(ms): 推定時間を渡してアニメ開始（0 → 0.92 に指数的に近づく）
 * - finish(): 強制的に 1.0 にして 600ms 後にリセット
 * 真の進捗が取れない長時間バックエンド処理のために使用する。
 */
export function useEstimatedProgress() {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback((estimatedMs: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const startTime = Date.now();
    setProgress(0);
    timerRef.current = setInterval(() => {
      const t = (Date.now() - startTime) / estimatedMs;
      setProgress(Math.min(0.92, 0.92 * (1 - Math.exp(-t * 2))));
    }, 80);
  }, []);

  const finish = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setProgress(1);
    setTimeout(() => setProgress(0), 600);
  }, []);

  return { progress, start, finish };
}
