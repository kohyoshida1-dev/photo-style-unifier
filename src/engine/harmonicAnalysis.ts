import { bitmapToRaw, toGray, blurGray } from './image';
import type { HarmonicMetrics } from '../types';

/**
 * 視覚的調和指標の計算
 *
 * 1. エッジ方向エントロピー
 *    Sobel フィルタで全ピクセルのエッジ方向（0-180°）を計測し、
 *    36ビンのヒストグラムを構築してシャノンエントロピーを計算する。
 *    エッジ方向が均等に分布する写真 → 高エントロピー → 視覚的調和
 *    特定方向に偏る写真（強い水平線など）→ 低エントロピー → 構造的な主張
 *
 * 2. 低空間周波数の光の流れ
 *    σ=30 のガウシアンブラー後に勾配ベクトル場を計算し、
 *    画像全体の「光の流れ」の方向と強度を抽出する。
 *    明確な方向性がある写真 → 光が一方向に流れている = 強い視線誘導
 */
export async function computeHarmonicMetrics(bmp: ImageBitmap): Promise<HarmonicMetrics> {
  const SIZE = 256;
  const NUM_ANGLE_BINS = 36; // 5° × 36 = 180°（エッジ方向は 0-180° で対称）

  // ── ① エッジ方向エントロピー ──
  const gray = toGray(bitmapToRaw(bmp, SIZE));
  const rawData = gray.data;
  const w = gray.width;
  const h = gray.height;

  const angleHistogram = new Array(NUM_ANGLE_BINS).fill(0);
  let totalEdgeWeight = 0;

  // Sobel でエッジ方向（0-180°）と強度を計算
  // 細かいテクスチャ・ノイズを除外し、構造的に支配的なエッジのみを対象にする
  // 15 では自然なテクスチャが全方向に拾われてエントロピーが高止まりする
  const EDGE_MIN_MAGNITUDE = 60;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -rawData[idx - w - 1] + rawData[idx - w + 1]
        - 2 * rawData[idx - 1] + 2 * rawData[idx + 1]
        - rawData[idx + w - 1] + rawData[idx + w + 1];
      const gy =
        -rawData[idx - w - 1] - 2 * rawData[idx - w] - rawData[idx - w + 1]
        + rawData[idx + w - 1] + 2 * rawData[idx + w] + rawData[idx + w + 1];

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (magnitude < EDGE_MIN_MAGNITUDE) continue;

      // エッジ方向を 0-180° に変換（エッジは方向に対して垂直なので mod 180°）
      const angle = ((Math.atan2(gy, gx) * 180 / Math.PI) + 180) % 180;
      const bin = Math.min(NUM_ANGLE_BINS - 1, Math.floor(angle / 180 * NUM_ANGLE_BINS));

      // 強度で重み付け（強いエッジほど方向の代表性が高い）
      angleHistogram[bin] += magnitude;
      totalEdgeWeight += magnitude;
    }
  }

  // 正規化
  const normalizedAngleHistogram = angleHistogram.map(v =>
    totalEdgeWeight > 0 ? v / totalEdgeWeight : 0
  );

  // シャノンエントロピー（0-1 に正規化）
  let edgeOrientationEntropy = 0;
  for (const p of normalizedAngleHistogram) {
    if (p > 0) edgeOrientationEntropy -= p * Math.log2(p);
  }
  edgeOrientationEntropy /= Math.log2(NUM_ANGLE_BINS); // 0-1

  // 支配的なエッジ方向（最も強度が集中しているビン）
  const dominantBin = normalizedAngleHistogram.indexOf(Math.max(...normalizedAngleHistogram));
  const dominantEdgeAngle = dominantBin * (180 / NUM_ANGLE_BINS);

  // ── ② 低空間周波数の光の流れ ──
  // σ=30 で大まかな明度変化だけを残し、勾配ベクトル場の平均を取る
  const blurred = blurGray(gray, 30);
  const blurData = blurred.data;
  const bw = blurred.width;
  const bh = blurred.height;

  let sumGx = 0, sumGy = 0, totalFlowWeight = 0;

  for (let y = 1; y < bh - 1; y++) {
    for (let x = 1; x < bw - 1; x++) {
      const idx = y * bw + x;
      const gx =
        -blurData[idx - bw - 1] + blurData[idx - bw + 1]
        - 2 * blurData[idx - 1] + 2 * blurData[idx + 1]
        - blurData[idx + bw - 1] + blurData[idx + bw + 1];
      const gy =
        -blurData[idx - bw - 1] - 2 * blurData[idx - bw] - blurData[idx - bw + 1]
        + blurData[idx + bw - 1] + 2 * blurData[idx + bw] + blurData[idx + bw + 1];

      const mag = Math.sqrt(gx * gx + gy * gy);
      // 重み付き平均ベクトル（明確なグラデーションがある領域を重視）
      sumGx += gx * mag;
      sumGy += gy * mag;
      totalFlowWeight += mag;
    }
  }

  // 光の流れベクトルを 0-360° に変換
  const avgGx = totalFlowWeight > 0 ? sumGx / totalFlowWeight : 0;
  const avgGy = totalFlowWeight > 0 ? sumGy / totalFlowWeight : 0;
  const lightFlowAngle = ((Math.atan2(avgGy, avgGx) * 180 / Math.PI) + 360) % 360;

  // 光の流れの強度（ベクトルの大きさを 0-1 に正規化）
  // σ=30ブラー後のSobel加重平均値: 実測値は通常 2-20 程度なので /20 でスケール
  const flowMagnitude = Math.sqrt(avgGx * avgGx + avgGy * avgGy);
  const lightFlowStrength = Math.min(1, flowMagnitude / 20);

  return {
    edgeOrientationEntropy,
    dominantEdgeAngle,
    lightFlowAngle,
    lightFlowStrength,
    edgeAngleHistogram: normalizedAngleHistogram,
  };
}

/** 複数サンプルの HarmonicMetrics を中央値で集約 */
export function aggregateHarmonicMetrics(metrics: HarmonicMetrics[]): HarmonicMetrics {
  if (metrics.length === 0) {
    return {
      edgeOrientationEntropy: 0,
      dominantEdgeAngle: 0,
      lightFlowAngle: 0,
      lightFlowStrength: 0,
      edgeAngleHistogram: new Array(36).fill(0),
    };
  }

  function med(arr: number[]): number {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  }

  // 循環平均: atan2(mean(sin), mean(cos)) で 0°/360° 境界の折り返しに対応
  function circularMean360(angles: number[]): number {
    const rad = angles.map(a => a * Math.PI / 180);
    const sinMean = rad.reduce((s, a) => s + Math.sin(a), 0) / rad.length;
    const cosMean = rad.reduce((s, a) => s + Math.cos(a), 0) / rad.length;
    return ((Math.atan2(sinMean, cosMean) * 180 / Math.PI) + 360) % 360;
  }

  // dominantEdgeAngle は 0-180° の周期なので角度を2倍にして360°円環で計算し戻す
  function circularMean180(angles: number[]): number {
    const rad = angles.map(a => a * 2 * Math.PI / 180);
    const sinMean = rad.reduce((s, a) => s + Math.sin(a), 0) / rad.length;
    const cosMean = rad.reduce((s, a) => s + Math.cos(a), 0) / rad.length;
    return ((Math.atan2(sinMean, cosMean) * 180 / Math.PI) + 360) % 360 / 2;
  }

  return {
    edgeOrientationEntropy: med(metrics.map(m => m.edgeOrientationEntropy)),
    dominantEdgeAngle:      circularMean180(metrics.map(m => m.dominantEdgeAngle)),
    lightFlowAngle:         circularMean360(metrics.map(m => m.lightFlowAngle)),
    lightFlowStrength:      med(metrics.map(m => m.lightFlowStrength)),
    edgeAngleHistogram:     Array.from({ length: 36 }, (_, i) =>
      med(metrics.map(m => m.edgeAngleHistogram[i] ?? 0))
    ),
  };
}
