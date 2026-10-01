import { srgbToLinear, linearToSrgb } from './colorSpace';

/**
 * ブラウザ内画像処理の基本ユーティリティ（旧バックエンドの sharp 相当）
 *
 * - すべて Web Worker 内で動く（OffscreenCanvas / createImageBitmap）
 * - ピクセルは常に RGBA 4ch の Uint8ClampedArray
 */

export interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: 4;
}

export interface GrayImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** ファイルをデコード（EXIF 回転を適用済みのビットマップを返す） */
export async function decodeFile(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image format is not supported by your browser. Please use JPEG, PNG or WebP.');
  }
}

/**
 * ビットマップを RawImage に変換する
 * @param maxSize  長辺の上限（fit: inside）
 * @param enlarge  false なら元サイズより大きくしない（sharp の withoutEnlargement）
 */
export function bitmapToRaw(
  bmp: ImageBitmap,
  maxSize?: number,
  enlarge = true,
  crop?: { left: number; top: number; width: number; height: number },
): RawImage {
  const sx = crop?.left ?? 0;
  const sy = crop?.top ?? 0;
  const sw = crop?.width ?? bmp.width;
  const sh = crop?.height ?? bmp.height;

  let w = sw;
  let h = sh;
  if (maxSize) {
    const scale = Math.min(maxSize / sw, maxSize / sh);
    if (scale < 1 || enlarge) {
      w = Math.max(1, Math.round(sw * scale));
      h = Math.max(1, Math.round(sh * scale));
    }
  }

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return { data, width: w, height: h, channels: 4 };
}

/** RGB → グレースケール（Rec.709 輝度を線形空間で合成し sRGB ガンマに戻す） */
export function toGray(img: RawImage): GrayImage {
  const n = img.width * img.height;
  const out = new Uint8ClampedArray(n);
  const d = img.data;
  for (let i = 0; i < n; i++) {
    const b = i * 4;
    const y = 0.2126 * srgbToLinear(d[b]) + 0.7152 * srgbToLinear(d[b + 1]) + 0.0722 * srgbToLinear(d[b + 2]);
    out[i] = linearToSrgb(y);
  }
  return { data: out, width: img.width, height: img.height };
}

function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

/**
 * 分離型ガウシアンブラー（端はピクセル複製）
 * @param ch       チャンネル数
 * @param nCh      ブラーをかけるチャンネル数（RGBA の場合 3 にしてアルファを保持）
 */
export function gaussianBlur(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  ch: number,
  sigma: number,
  nCh = ch,
): Uint8ClampedArray {
  const k = gaussianKernel(sigma);
  const K = k.length;
  const r = (K - 1) / 2;
  const tmp = new Float32Array(width * height * ch);
  const out = new Uint8ClampedArray(src);

  // 端の複製を含む参照先オフセットを事前計算（内側ループから分岐をなくす）
  const xOff = new Int32Array(width * K);
  for (let x = 0; x < width; x++) {
    for (let i = 0; i < K; i++) xOff[x * K + i] = Math.min(width - 1, Math.max(0, x + i - r)) * ch;
  }
  const yOff = new Int32Array(height * K);
  for (let y = 0; y < height; y++) {
    for (let i = 0; i < K; i++) yOff[y * K + i] = Math.min(height - 1, Math.max(0, y + i - r)) * width * ch;
  }

  for (let y = 0; y < height; y++) {
    const rowBase = y * width * ch;
    for (let x = 0; x < width; x++) {
      const xk = x * K;
      for (let c = 0; c < nCh; c++) {
        let acc = 0;
        for (let i = 0; i < K; i++) acc += src[rowBase + xOff[xk + i] + c] * k[i];
        tmp[rowBase + x * ch + c] = acc;
      }
    }
  }
  for (let y = 0; y < height; y++) {
    const yk = y * K;
    for (let x = 0; x < width; x++) {
      const colBase = x * ch;
      for (let c = 0; c < nCh; c++) {
        let acc = 0;
        for (let i = 0; i < K; i++) acc += tmp[yOff[yk + i] + colBase + c] * k[i];
        out[(y * width + x) * ch + c] = acc;
      }
    }
  }
  return out;
}

export function blurGray(img: GrayImage, sigma: number): GrayImage {
  return { ...img, data: gaussianBlur(img.data, img.width, img.height, 1, sigma) };
}

/**
 * libvips sharpen 相当（m1=0 固定）
 * 輝度差 |d| ≤ 2 は無変化、それを超える分に m2 を掛けて加算。明側 +10 / 暗側 -20 でクリップ。
 * 差分は L*（0-100）スケールで評価し、RGB へ均等に戻す。
 */
export function sharpenInPlace(img: RawImage, sigma: number, m2: number) {
  const n = img.width * img.height;
  const gray = toGray(img);
  const blurred = gaussianBlur(gray.data, img.width, img.height, 1, sigma);
  const X1 = 2, Y2 = 10, Y3 = 20;
  const d = img.data;
  for (let i = 0; i < n; i++) {
    const diff = (gray.data[i] - blurred[i]) / 2.55;
    const ad = Math.abs(diff);
    if (ad <= X1) continue;
    let y = Math.sign(diff) * (ad - X1) * m2;
    y = Math.max(-Y3, Math.min(Y2, y)) * 2.55;
    const b = i * 4;
    d[b] += y; d[b + 1] += y; d[b + 2] += y;
  }
}

/** RawImage → JPEG Blob */
export async function encodeJpeg(img: RawImage, quality: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');
  ctx.putImageData(new ImageData(img.data as Uint8ClampedArray<ArrayBuffer>, img.width, img.height), 0, 0);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
