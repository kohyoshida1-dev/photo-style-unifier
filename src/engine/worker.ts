/// <reference lib="webworker" />
import type { ColorStyle } from '../types';
import { analyzeSamples } from './analyze';
import { applyStyle } from './transfer';
import { bitmapToRaw, decodeFile, encodeJpeg, type RawImage } from './image';

export type WorkerRequest =
  | { id: number; type: 'analyze'; files: Blob[] }
  | {
      id: number;
      type: 'apply';
      fileKey: string;
      file: Blob;
      style: ColorStyle;
      intensity: number;
      /** 長辺の上限（プレビュー用）。未指定ならフル解像度 */
      maxSize?: number;
      jpegQuality: number;
    };

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }
  | { id: number; progress: [number, number] };

// プレビュー用に縮小済み画像を少数キャッシュ（強度スライダーを動かすたびに再デコードしない）
const PREVIEW_CACHE_LIMIT = 4;
const previewCache = new Map<string, RawImage>();

async function loadTarget(file: Blob, fileKey: string, maxSize?: number): Promise<RawImage> {
  const key = `${fileKey}@${maxSize ?? 'full'}`;
  const cached = previewCache.get(key);
  if (cached) return cached;

  const bmp = await decodeFile(file);
  const img = bitmapToRaw(bmp, maxSize, false);
  bmp.close();

  if (maxSize) {
    previewCache.set(key, img);
    if (previewCache.size > PREVIEW_CACHE_LIMIT) {
      previewCache.delete(previewCache.keys().next().value!);
    }
  }
  return img;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  const post = (r: WorkerResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(r);
  try {
    if (msg.type === 'analyze') {
      const style = await analyzeSamples(msg.files, (done, total) => post({ id: msg.id, progress: [done, total] }));
      post({ id: msg.id, ok: true, result: style });
    } else {
      const target = await loadTarget(msg.file, msg.fileKey, msg.maxSize);
      const out = applyStyle(target, msg.style, msg.intensity);
      const blob = await encodeJpeg(out, msg.jpegQuality);
      post({ id: msg.id, ok: true, result: blob });
    }
  } catch (err) {
    post({ id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
