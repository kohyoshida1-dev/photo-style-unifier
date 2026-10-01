import type { ColorStyle } from '../types';
import type { WorkerRequest, WorkerResponse } from './worker';

/**
 * 画像処理エンジンの窓口。処理はすべて Web Worker 内（＝利用者のブラウザ内）で行い、
 * 写真がどこかへ送信されることはない。
 */

export type OutputQuality = 'fast' | 'standard' | 'archive';

const QUALITY_MAP: Record<OutputQuality, number> = {
  fast: 0.85,
  standard: 0.92,
  archive: 0.97,
};

/**
 * ライブプレビュー・一覧表示の解像度
 * 画面上の表示幅より十分大きく、スライダー操作に追従できる速さに収まるサイズ
 */
export const PREVIEW_SIZE = 1280;

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (done: number, total: number) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const p = pending.get(msg.id);
    if (!p) return;
    if ('progress' in msg) {
      p.onProgress?.(...msg.progress);
      return;
    }
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Image processing failed'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function call<T>(req: DistributiveOmit<WorkerRequest, 'id'>, onProgress?: Pending['onProgress']): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    getWorker().postMessage({ ...req, id });
  });
}

// File ごとに安定したキーを振る（Worker 側のプレビューキャッシュ用）
const fileKeys = new WeakMap<Blob, string>();
function keyOf(file: Blob): string {
  let k = fileKeys.get(file);
  if (!k) { k = crypto.randomUUID(); fileKeys.set(file, k); }
  return k;
}

export function analyzeStyle(files: File[], onProgress?: (done: number, total: number) => void): Promise<ColorStyle> {
  return call<ColorStyle>({ type: 'analyze', files }, onProgress);
}

/** PREVIEW_SIZE 以内に縮小してスタイル適用（一覧用） */
export function renderPreview(file: File, style: ColorStyle, intensity: number): Promise<Blob> {
  return call<Blob>({
    type: 'apply', file, fileKey: keyOf(file), style, intensity,
    maxSize: PREVIEW_SIZE, jpegQuality: 0.9,
  });
}

export class SupersededError extends Error {
  constructor() { super('Superseded by a newer preview request'); }
}

// ライブプレビューは「最新の 1 件だけ」を処理する。
// 処理中に来た要求は 1 件だけ待たせ、さらに新しい要求が来たら古い待ちは破棄する。
let liveInFlight = false;
let liveQueued: { args: [File, ColorStyle, number]; resolve: (b: Blob) => void; reject: (e: Error) => void } | null = null;

function runLive(args: [File, ColorStyle, number], resolve: (b: Blob) => void, reject: (e: Error) => void) {
  liveInFlight = true;
  renderPreview(...args).then(resolve, reject).finally(() => {
    liveInFlight = false;
    const next = liveQueued;
    liveQueued = null;
    if (next) runLive(next.args, next.resolve, next.reject);
  });
}

/** スライダー操作中のライブプレビュー用（古い要求は SupersededError で破棄される） */
export function renderLivePreview(file: File, style: ColorStyle, intensity: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!liveInFlight) { runLive([file, style, intensity], resolve, reject); return; }
    liveQueued?.reject(new SupersededError());
    liveQueued = { args: [file, style, intensity], resolve, reject };
  });
}

/** 元の解像度のままスタイル適用（ダウンロード用） */
export function renderFullResolution(file: File, style: ColorStyle, intensity: number, quality: OutputQuality): Promise<Blob> {
  return call<Blob>({
    type: 'apply', file, fileKey: keyOf(file), style, intensity,
    jpegQuality: QUALITY_MAP[quality],
  });
}
