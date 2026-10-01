import type { ColorStyle } from '../types';
import type { RawImage } from './image';
import { gaussianBlur, sharpenInPlace } from './image';
import { computeTargetSignature, applyZoneHueTransfer, computeTransferWeights } from './zoneTransfer';

/**
 * 座標ベースの決定的ノイズ
 * 同じ (x, y, seed) には常に同じ値を返す → プレビューと書き出しで粒子が揃う
 */
function seededNoise(x: number, y: number, seed: number): number {
  let h = ((x * 1619 + y * 31337 + seed * 1013904223) | 0);
  h ^= (h << 13); h ^= (h >> 17); h ^= (h << 5);
  return ((h >>> 0) & 0xffff) / 0x8000 - 1; // -1 to 1
}

/**
 * フィルム粒子を合成する（Ilford感光測定知見に基づく実装）
 *
 * - ピーク輝度 0.32（Zone III-IV）: 実フィルムの感光測定上の粒子ピーク
 * - 非対称フォールオフ: ハイライト側（高密度銀で粒子が埋没）はシャドウ側より急峻
 * - チャンネル独立ノイズ: R/G/B 乳剤層の独立した化学挙動を再現
 */
function applyGrainInPlace(img: RawImage, grainIntensity: number, intensity: number, seed: number) {
  const out = img.data;
  const n = img.width * img.height;
  const sigma = grainIntensity * 255 * intensity * 0.65;
  if (sigma < 0.3) return;

  const GRAIN_PEAK = 0.32;

  for (let i = 0; i < n; i++) {
    const base = i * 4;
    const luma = (out[base] * 0.299 + out[base + 1] * 0.587 + out[base + 2] * 0.114) / 255;

    const factor = luma <= GRAIN_PEAK
      ? Math.max(0, luma / GRAIN_PEAK)
      : Math.max(0, 1 - (luma - GRAIN_PEAK) * 3.0);

    const s = sigma * factor;
    if (s < 0.3) continue;

    const px = i % img.width;
    const py = (i / img.width) | 0;
    out[base]     += s * seededNoise(px * 3,     py, seed);
    out[base + 1] += s * seededNoise(px * 3 + 1, py, seed);
    out[base + 2] += s * seededNoise(px * 3 + 2, py, seed);
  }
}

/**
 * スタイルを適用した新しい画像を返す（入力は変更しない）
 *
 * 処理順は旧バックエンドと同じ:
 *   ゾーン別色調シフト + 色相別クロマ → ソフトネスぼかし → マイクロコントラスト → 粒子
 */
export function applyStyle(src: RawImage, style: ColorStyle, intensity: number, grainSeed = 1): RawImage {
  const img: RawImage = { ...src, data: new Uint8ClampedArray(src.data) };
  const sig = style.styleSignature;
  if (!sig) return img;

  const targetSig = computeTargetSignature(img.data, 4);
  const weights = computeTransferWeights(sig);
  applyZoneHueTransfer(img.data, 4, img.width, img.height, targetSig, sig, intensity, weights);

  const softness = sig.softnessMetrics?.meanSoftnessDepth ?? 0;
  const softSigma = Math.min(0.4, Math.max(0, (softness - 0.60) * 2.5 * intensity));
  if (softSigma >= 0.3) {
    img.data = gaussianBlur(img.data, img.width, img.height, 4, softSigma, 3);
  }

  const mc = sig.temporalMetrics?.microcontrastIntensity ?? 0;
  const sharpenM2 = Math.min(1.2, Math.max(0, (mc - 0.09) * 10 * intensity));
  if (sharpenM2 > 0.15) {
    sharpenInPlace(img, 0.5, sharpenM2);
  }

  const grainIntensity = sig.temporalMetrics?.grainIntensity ?? 0;
  if (grainIntensity > 0.030) {
    applyGrainInPlace(img, grainIntensity, intensity, grainSeed);
  }

  return img;
}
