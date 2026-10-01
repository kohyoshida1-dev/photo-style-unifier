import { useState, useEffect, useRef } from 'react';
import type { ColorStyle } from '../types';
import { renderLivePreview, SupersededError } from '../engine/client';

interface Options {
  file: File | null;
  style: ColorStyle | null;
  intensity: number;
  debounceMs?: number;
  /** 値を変えると同じ条件で再生成する（Retry 用） */
  retryToken?: number;
}

export function useLivePreview({ file, style, intensity, debounceMs = 250, retryToken = 0 }: Options) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    setPreviewUrl(null);
    setError(false);
  }, [file]);

  // 古いプレビューの Object URL を解放
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    if (!file || !style) return;

    setError(false);
    const req = ++requestRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const blob = await renderLivePreview(file, style, intensity);
        // 後から来たリクエストがあれば、古い結果は捨てる
        if (req !== requestRef.current) return;
        setPreviewUrl(URL.createObjectURL(blob));
        setError(false);
      } catch (e) {
        if (e instanceof SupersededError) return;
        if (req === requestRef.current) setError(true);
      } finally {
        if (req === requestRef.current) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [file, style, intensity, debounceMs, retryToken]);

  const active = !!(file && style);
  return {
    previewUrl: active ? previewUrl : null,
    loading:    active ? loading    : false,
    error:      active ? error      : false,
  };
}
