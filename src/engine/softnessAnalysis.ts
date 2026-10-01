import { bitmapToRaw, toGray, blurGray } from './image';
import type { SoftnessMetrics } from '../types';

/**
 * 柔らかさ指標の計算
 *
 * Saul Leiter の本質は「フォーカスが合っていない場所」にある。
 * 雨に濡れた窓、店のショーウィンドウの反射、降る雪 —— これらは全部ピントが合っていない。
 * このメトリクスは「画面の何割が柔らかいか」「そのボケがどう分布しているか」を定量化する。
 *
 * アルゴリズム:
 * 1. Laplacian 分散（主指標）: エッジ強度の分布を測定
 *    - 一様領域（白背景等）は Laplacian ≈ 0 で分散に寄与しない
 *    - シャープなエッジが多い = 高分散 = Sharp
 *    - ボケ・ソフトフォーカス = 低分散 = Soft
 *    ※ローカル分散手法は背景の大きさに影響されるため、Laplacian 分散に置き換え
 * 2. ローカル分散マップ（補助）: ゾーン分析・分布プロファイルに使用
 * 3. 複数 σ スケールで「自然なボケが始まるスケール」を特定
 */
export async function computeSoftnessMetrics(bmp: ImageBitmap): Promise<SoftnessMetrics> {
  const SIZE = 256;
  const WINDOW = 8;
  const SOFT_THRESHOLD = 0.04; // 正規化ローカル標準偏差（0-1）がこれ以下 = ソフト領域

  const gray = toGray(bitmapToRaw(bmp, SIZE));
  const data = gray.data;
  const w = gray.width;
  const h = gray.height;

  // ── ① Laplacian マップを data[] から直接計算 ──
  // sharp.js の convolve は出力バッファサイズが入力と異なる場合があり
  // インデックスずれで NaN になる不具合が発生するため、
  // すでに正しい data[] を用いて JS 側で計算する。
  // 4-connected Laplacian: 4·p - top - bottom - left - right
  // 端ピクセルはゼロ（エッジ効果を避けるため）
  const lapData = new Float32Array(w * h); // 未計算ピクセルは 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      lapData[idx] =
        4 * data[idx]
        - data[(y - 1) * w + x]
        - data[(y + 1) * w + x]
        - data[y * w + (x - 1)]
        - data[y * w + (x + 1)];
      // 値域: 約 -1020〜+1020（uint8 の 4倍差）
    }
  }

  // ── ② パッチループ ──
  //
  // meanSoftnessDepth の計算方針:
  //   "ソフトコンテンツ比率" = softContentCount / totalPatchCount を使う。
  //
  //   白背景パッチ（明るくて均一）: 分子に入らない、分母には入る → 比率を希釈
  //   ⇒ 白背景の製品写真: 比率 LOW → Sharp ✓
  //
  //   ぼけた有色・暗い前景（Saul Leiter 的）: 分子に入る → 比率を押し上げ
  //   ⇒ ぼけ前景の大きい写真: 比率 HIGH → Soft ✓
  //
  //   重要: 「白背景」と「暗いボケ領域」は localStd だけでは区別できない
  //         （両方 std ≈ 0 に近い）。
  //         → meanGray > 0.90 かつ std 低い = 白背景 → 除外
  //         → meanGray ≤ 0.90 かつ std 低い = 暗いソフト領域 → ソフトコンテンツ ✓
  //
  // WHITE_BG_LUMA = 0.90 : これ以上の明度 + 低std パッチ = 白背景として除外
  // SHARP_LAP     = 20  : パッチ内の平均|Laplacian|（生値, 0–1020）がこれ以上 = シャープ
  //   生値での参考:
  //     均一エリア / ぼけ内部: ≈ 0–5
  //     ぼけ境界（なだらか）: ≈ 5–15
  //     シャープエッジ（8×8 patch 中2px がエッジの場合）:
  //       2px × 255 / 64px ≈ 8 → 上下で 16、実際は ~20–60
  //     均等にシャープなテクスチャ: ≈ 30–100
  const WHITE_BG_LUMA = 0.90;
  const BG_STD        = 0.015;
  const SHARP_LAP     = 20;

  const patchSoftness: number[] = [];
  const zoneTop: number[] = [], zoneMid: number[] = [], zoneBot: number[] = [];
  let softContentCount = 0;
  let totalPatchCount  = 0;

  for (let y = 0; y <= h - WINDOW; y += WINDOW / 2) {
    for (let x = 0; x <= w - WINDOW; x += WINDOW / 2) {
      let gSum = 0, gSum2 = 0, lapAbsSum = 0, cnt = 0;
      for (let dy = 0; dy < WINDOW && y + dy < h; dy++) {
        for (let dx = 0; dx < WINDOW && x + dx < w; dx++) {
          const idx = (y + dy) * w + (x + dx);
          const v = data[idx] / 255;
          gSum     += v;
          gSum2    += v * v;
          lapAbsSum += Math.abs(lapData[idx]); // Float32Array から直接取得（NaN なし）
          cnt++;
        }
      }
      if (cnt === 0) continue;

      const meanGray   = gSum / cnt;                  // 0–1
      const localStd   = Math.sqrt(Math.max(0, gSum2 / cnt - meanGray ** 2));
      // meanAbsLap: 値域 0〜1020（uint8 Laplacian の生値）
      // SHARP_LAP は同スケールで設定（下記定数を参照）
      const meanAbsLap = lapAbsSum / cnt;

      // ゾーン分析・プロファイル用（既存ロジック）
      const softness = Math.max(0, 1 - localStd / 0.3);
      patchSoftness.push(softness);
      const yCenter = y + WINDOW / 2;
      if (yCenter < h / 3)      zoneTop.push(softness);
      else if (yCenter < 2*h/3) zoneMid.push(softness);
      else                       zoneBot.push(softness);

      // 主指標: ソフトコンテンツ比率
      // 白背景（明るくて均一）だけを除外。暗い均一領域（ぼけ前景）は除外しない。
      const isWhiteBackground = meanGray > WHITE_BG_LUMA && localStd < BG_STD;
      totalPatchCount++;
      if (!isWhiteBackground && meanAbsLap < SHARP_LAP) {
        softContentCount++;
      }
    }
  }

  if (patchSoftness.length === 0) {
    return {
      softAreaRatio: 0, meanSoftnessDepth: 0.5,
      softnessProfile: new Array(8).fill(0),
      softnessDistribution: 'diffuse', peakBlurScale: 2,
    };
  }

  // ソフトコンテンツ比率 = soft な有色パッチ / 全パッチ（背景含む）
  const meanSoftnessDepth = totalPatchCount > 0
    ? softContentCount / totalPatchCount
    : 0.5;


  const softAreaRatio = patchSoftness.filter(s => s > SOFT_THRESHOLD * 25).length / patchSoftness.length;

  // ── ② 8段階分布プロファイル ──
  const softnessProfile = new Array(8).fill(0);
  for (const s of patchSoftness) {
    const bin = Math.min(7, Math.floor(s * 8));
    softnessProfile[bin]++;
  }
  const profileTotal = softnessProfile.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 8; i++) softnessProfile[i] /= profileTotal;

  // ── ③ 空間分布パターン ──
  const avgTop = zoneTop.length > 0 ? zoneTop.reduce((a, b) => a + b) / zoneTop.length : 0;
  const avgMid = zoneMid.length > 0 ? zoneMid.reduce((a, b) => a + b) / zoneMid.length : 0;
  const avgBot = zoneBot.length > 0 ? zoneBot.reduce((a, b) => a + b) / zoneBot.length : 0;
  const zoneVariance = [avgTop, avgMid, avgBot].reduce((s, v) => {
    const mean = (avgTop + avgMid + avgBot) / 3;
    return s + (v - mean) ** 2;
  }, 0) / 3;
  const zoneMax = Math.max(avgTop, avgMid, avgBot);
  const zoneMin = Math.min(avgTop, avgMid, avgBot);

  let softnessDistribution: SoftnessMetrics['softnessDistribution'];
  if (zoneMax - zoneMin > 0.2) {
    // 1つのゾーンが著しく柔らかい = 集中型（前景ボケや背景ボケ）
    softnessDistribution = 'concentrated';
  } else if (zoneVariance > 0.01 && avgMid < Math.min(avgTop, avgBot) - 0.05) {
    // 上下が柔らかく中央が鋭い = 層状（Leiter 的な窓越し構造）
    softnessDistribution = 'layered';
  } else {
    // 均等に分布 = 拡散型（霧・全体的な軟調）
    softnessDistribution = 'diffuse';
  }

  // ── ④ ピークブラースケールの推定 ──
  // 複数の σ でブラーを掛けて「どのスケールで最もぼけ量が増えるか」を測定
  const sigmas = [2, 4, 8, 16];
  const blurDiffs = sigmas.map(sigma => {
    const blurred = blurGray(gray, sigma).data;
    let totalDiff = 0;
    for (let i = 0; i < data.length; i++) {
      totalDiff += Math.abs(data[i] - blurred[i]);
    }
    return totalDiff / data.length; // 平均絶対差
  });

  // 最も差分が増加したスケール = 自然なボケが始まるスケール
  let maxIncrease = 0;
  let peakBlurScaleIdx = 0;
  for (let i = 1; i < blurDiffs.length; i++) {
    const increase = blurDiffs[i] - blurDiffs[i - 1];
    if (increase > maxIncrease) { maxIncrease = increase; peakBlurScaleIdx = i; }
  }
  const peakBlurScale = sigmas[peakBlurScaleIdx];

  return {
    softAreaRatio,
    meanSoftnessDepth,
    softnessProfile,
    softnessDistribution,
    peakBlurScale,
  };
}

/** 複数サンプルの SoftnessMetrics を中央値で集約 */
export function aggregateSoftnessMetrics(metrics: SoftnessMetrics[]): SoftnessMetrics {
  if (metrics.length === 0) {
    return {
      softAreaRatio: 0, meanSoftnessDepth: 0,
      softnessProfile: new Array(8).fill(0),
      softnessDistribution: 'diffuse', peakBlurScale: 2,
    };
  }

  function med(arr: number[]): number {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  }

  // 分布パターンは多数決
  const counts = { concentrated: 0, layered: 0, diffuse: 0 };
  for (const m of metrics) counts[m.softnessDistribution]++;
  const softnessDistribution = (Object.keys(counts) as Array<keyof typeof counts>)
    .reduce((a, b) => counts[a] >= counts[b] ? a : b);

  return {
    softAreaRatio:       med(metrics.map(m => m.softAreaRatio)),
    meanSoftnessDepth:   med(metrics.map(m => m.meanSoftnessDepth)),
    softnessProfile:     Array.from({ length: 8 }, (_, i) =>
      med(metrics.map(m => m.softnessProfile[i] ?? 0))
    ),
    softnessDistribution,
    peakBlurScale: med(metrics.map(m => m.peakBlurScale)),
  };
}
