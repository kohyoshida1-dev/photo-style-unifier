import { bitmapToRaw, toGray, blurGray } from './image';
import type { TemporalMetrics } from '../types';

/**
 * 時間的指標の計算
 *
 * 被写体が体験してきた時間は、光の複雑な反射層に現れる。
 * - 皺・風化：複数スケールで均等にエッジが存在する（= 多スケールエッジ複雑度）
 * - 古い建物・重ねられたマテリアル：局所的な高コントラスト領域が密（= マイクロコントラスト密度）
 *
 * これらは単一画像からの解析で、「この写真が捉えた時間の深さ」を表す。
 * 複数サンプルの中央値を取ることで「撮影者が好む時間密度」が抽出される。
 */
export async function computeTemporalMetrics(bmp: ImageBitmap): Promise<TemporalMetrics> {
  // 処理サイズを 256px に統一（エッジ計算は大きい解像度不要）
  const BASE_SIZE = 256;

  // ── ① 多スケールエッジ複雑度 ──
  // σ = 1, 2, 4, 8, 16, 32 ピクセルのガウシアンブラーを適用し、
  // 各スケールでのエッジ密度を計測する
  const sigmas = [1, 2, 4, 8, 16, 32];
  const edgeDensities: number[] = [];

  // 各スケールでの平均勾配強度を収集（並列実行でパフォーマンス改善）
  const baseGray = toGray(bitmapToRaw(bmp, BASE_SIZE));
  const meanGradients: number[] = sigmas.map((sigma) => {
      const blurred = blurGray(baseGray, sigma);
      const blurData = blurred.data;
      const w = blurred.width;
      const h = blurred.height;

      // Sobel フィルタで各ピクセルの勾配強度を計算し、平均を取る
      let sumMag = 0;
      let cnt = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const gx =
            -blurData[idx - w - 1] + blurData[idx - w + 1]
            - 2 * blurData[idx - 1] + 2 * blurData[idx + 1]
            - blurData[idx + w - 1] + blurData[idx + w + 1];
          const gy =
            -blurData[idx - w - 1] - 2 * blurData[idx - w] - blurData[idx - w + 1]
            + blurData[idx + w - 1] + 2 * blurData[idx + w] + blurData[idx + w + 1];
          sumMag += Math.sqrt(gx * gx + gy * gy);
          cnt++;
        }
      }
      return cnt > 0 ? sumMag / cnt : 0;
    });

  // スケールプロファイル: σ=1 の平均勾配で正規化した「相対的エッジ残存率」
  // σ=1 が 1.0、大スケールほど低下する減衰プロファイルになる
  // 老いた表面 → フラット（全スケールでエッジが残る）
  // 若い表面 → 急激に減衰（細部にしかエッジがない）
  const refGrad = meanGradients[0] || 1;
  for (const mg of meanGradients) {
    edgeDensities.push(Math.min(1, mg / refGrad));
  }

  // 多スケールエッジ深度 = σ=1 以外のスケールでの平均残存率
  // (σ=1 は常に 1.0 なので除外して、大スケールでの「持続性」を測る)
  const deepScales = edgeDensities.slice(1); // σ=2〜32 の残存率
  const multiScaleEdgeDepth = deepScales.reduce((s, d) => s + d, 0) / deepScales.length;

  // 時間的複雑度 = 減衰プロファイルの「フラットさ」
  // (edgeDensities[5] / edgeDensities[0]) = σ=32 での残存率が高いほど複雑
  const temporalComplexity = Math.min(1, edgeDensities[5] * 2); // σ=32 での残存率（0-0.5 → 0-1 に拡大）

  // ── ② マイクロコントラスト密度 ──
  // 16x16 ウィンドウで局所的な明度の分散を計算し、
  // 「局所コントラストが高い領域の密度」を求める
  const rawData = baseGray.data;
  const rw = baseGray.width;
  const rh = baseGray.height;
  const WINDOW = 16;
  const MC_THRESHOLD = 0.07; // 局所標準偏差（0-1正規化）がこれを超えたら高コントラスト

  let highContrastCount = 0;
  let totalIntensity = 0;
  let patchCount = 0;

  for (let y = 0; y <= rh - WINDOW; y += WINDOW / 2) {
    for (let x = 0; x <= rw - WINDOW; x += WINDOW / 2) {
      // ウィンドウ内のピクセルを収集
      let sum = 0, sum2 = 0, cnt = 0;
      for (let dy = 0; dy < WINDOW && y + dy < rh; dy++) {
        for (let dx = 0; dx < WINDOW && x + dx < rw; dx++) {
          const v = rawData[(y + dy) * rw + (x + dx)] / 255;
          sum += v;
          sum2 += v * v;
          cnt++;
        }
      }
      if (cnt === 0) continue;

      const localMean = sum / cnt;
      const localVar = Math.max(0, sum2 / cnt - localMean * localMean);
      const localStd = Math.sqrt(localVar);

      totalIntensity += localStd;
      if (localStd > MC_THRESHOLD) highContrastCount++;
      patchCount++;
    }
  }

  const microcontrastDensity = patchCount > 0 ? highContrastCount / patchCount : 0;
  const microcontrastIntensity = patchCount > 0 ? totalIntensity / patchCount : 0;

  // ── ③ フィルム粒子強度（ラプラシアン法）──
  // blur との差分では grain と同スケールの blur が grain 自体を消してしまう。
  // フラット領域のラプラシアン（2次微分）= pixel-level variation を直接測定する。
  // エッジピクセル（1次勾配が大きい）は除外し grain 固有の信号のみ集計。
  const GRAIN_CROP = 512;
  const gw = bmp.width;
  const gh = bmp.height;
  const cw = Math.min(GRAIN_CROP, gw);
  const ch = Math.min(GRAIN_CROP, gh);
  const cropOpts = {
    left:   Math.floor((gw - cw) / 2),
    top:    Math.floor((gh - ch) / 2),
    width:  cw,
    height: ch,
  };
  const grainOrig = toGray(bitmapToRaw(bmp, undefined, false, cropOpts)).data;

  // ステップ=2 Laplacian: 1000px 画像に現れる 2〜4px スケールの grain を適切に検出する
  // ステップ=1 では σ=1.5px 粒子への感度が理論値の 39% しかないが
  // ステップ=2 では 59% まで改善（同スケール粒子に対して 2.5 倍の感度）
  const STEP = 2;
  const EDGE_GRAD_THRESHOLD = 20;
  let lapSum = 0;
  let lapCount = 0;
  for (let y = STEP; y < ch - STEP; y++) {
    for (let x = STEP; x < cw - STEP; x++) {
      const idx = y * cw + x;
      const gx = Math.abs(grainOrig[idx + STEP] - grainOrig[idx - STEP]) >> 1;
      const gy = Math.abs(grainOrig[idx + STEP * cw] - grainOrig[idx - STEP * cw]) >> 1;
      if (gx > EDGE_GRAD_THRESHOLD || gy > EDGE_GRAD_THRESHOLD) continue;
      const lap = Math.abs(
        4 * grainOrig[idx]
        - grainOrig[idx - STEP] - grainOrig[idx + STEP]
        - grainOrig[idx - STEP * cw] - grainOrig[idx + STEP * cw]
      );
      lapSum += lap;
      lapCount++;
    }
  }
  const grainIntensity = lapCount > 0 ? (lapSum / lapCount) / 255 : 0;

  return {
    multiScaleEdgeDepth,
    temporalComplexity,
    microcontrastDensity,
    microcontrastIntensity,
    scaleProfile: edgeDensities,
    grainIntensity,
  };
}

/** 複数サンプルの TemporalMetrics を中央値で集約 */
export function aggregateTemporalMetrics(metrics: TemporalMetrics[]): TemporalMetrics {
  if (metrics.length === 0) {
    return {
      multiScaleEdgeDepth: 0,
      temporalComplexity: 0,
      microcontrastDensity: 0,
      microcontrastIntensity: 0,
      scaleProfile: [0, 0, 0, 0, 0, 0],
    };
  }

  function med(arr: number[]): number {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  }

  const grainList = metrics.map(m => m.grainIntensity).filter((v): v is number => v !== undefined);
  return {
    multiScaleEdgeDepth:    med(metrics.map(m => m.multiScaleEdgeDepth)),
    temporalComplexity:     med(metrics.map(m => m.temporalComplexity)),
    microcontrastDensity:   med(metrics.map(m => m.microcontrastDensity)),
    microcontrastIntensity: med(metrics.map(m => m.microcontrastIntensity)),
    scaleProfile:           Array.from({ length: 6 }, (_, i) =>
      med(metrics.map(m => m.scaleProfile[i] ?? 0))
    ),
    grainIntensity: grainList.length > 0 ? med(grainList) : undefined,
  };
}
