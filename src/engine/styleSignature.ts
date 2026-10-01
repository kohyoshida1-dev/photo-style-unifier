import { bitmapToRaw } from './image';
import { srgbToLab, srgbToHsv } from './colorSpace';
import type { StyleSignature, ZoneStats, LchMetrics, ToneCurveShape, ConsensusStrength, TemporalMetrics, HarmonicMetrics, HsvLut, HsvLutCell, SoftnessMetrics } from '../types';
import { computeTemporalMetrics, aggregateTemporalMetrics } from './temporalAnalysis';
import { computeHarmonicMetrics, aggregateHarmonicMetrics } from './harmonicAnalysis';
import { computeSoftnessMetrics, aggregateSoftnessMetrics } from './softnessAnalysis';

// ── 統計ユーティリティ ──

/** 数値配列の中央値 */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** 四分位範囲 (IQR = Q3 - Q1)：外れ値の影響を受けにくい散布度 */
function iqr(arr: number[]): number {
  if (arr.length < 4) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return q3 - q1;
}

/** 複数配列の要素ごと中央値 */
function medianPerElement(arrays: number[][]): number[] {
  if (arrays.length === 0) return [];
  return Array.from({ length: arrays[0].length }, (_, i) =>
    median(arrays.map(arr => arr[i]))
  );
}

const NUM_HUE_BUCKETS = 12; // 30° × 12
const MIN_CHROMA = 2;       // これ以下のクロマはグレーとみなし色相分析から除外
const HSV_LUT_SIZE = 5;     // 5×5×5 = 125 セル

/**
 * ゾーン重みを計算（zoneTransfer.ts と同一ロジック）
 * shadow[25-45] ↔ midtone、midtone[60-80] ↔ highlight でクロスフェード
 * 解析と転送で同じゾーン定義を使うことで、シフト量とターゲット統計が対応する
 * smoothstep で一次微分不連続を解消（印刷でのバンディング防止）
 */
function smoothstep(t: number): number { return t * t * (3 - 2 * t); }

function zoneWeights(L: number): [sW: number, mW: number, hW: number] {
  if (L < 25) return [1, 0, 0];
  if (L < 45) { const t = smoothstep((L - 25) / 20); return [1 - t, t, 0]; }
  if (L < 60) return [0, 1, 0];
  if (L < 80) { const t = smoothstep((L - 60) / 20); return [0, 1 - t, t]; }
  return [0, 0, 1];
}

// ZoneAcc: [Σ(w·a), Σ(w·b), Σ(w·a²), Σ(w·b²), Σ(w)]
// w=ゾーン重み（ソフトブレンド）なので cnt は浮動小数
type ZoneAcc = [sumWA: number, sumWB: number, sumWA2: number, sumWB2: number, sumW: number];

function accToStats(acc: ZoneAcc, totalPixels: number): ZoneStats {
  if (acc[4] < 1e-6) {
    return { aMean: 0, bMean: 0, aStd: 5, bStd: 5, pixelRatio: 0 };
  }
  const sumW = acc[4];
  const aMean = acc[0] / sumW;
  const bMean = acc[1] / sumW;
  return {
    aMean,
    bMean,
    aStd: Math.sqrt(Math.max(0, acc[2] / sumW - aMean * aMean)),
    bStd: Math.sqrt(Math.max(0, acc[3] / sumW - bMean * bMean)),
    // Σ(w) / n — 各ゾーンの重み合計の比（3ゾーンの合計 = n）
    pixelRatio: sumW / totalPixels,
  };
}

/**
 * 画像からスタイル・シグネチャを計算する
 * - 輝度ゾーン別（シャドウ/ミッドトーン/ハイライト）の色調統計
 * - 色相別の平均クロマ（彩度プロファイル）
 */
export async function computeStyleSignature(bmp: ImageBitmap): Promise<StyleSignature> {
  const info = bitmapToRaw(bmp, 512);
  const data = info.data;

  const ch = info.channels;
  const n  = info.width * info.height;

  const shadowAcc:    ZoneAcc = [0, 0, 0, 0, 0];
  const midAcc:       ZoneAcc = [0, 0, 0, 0, 0];
  const highlightAcc: ZoneAcc = [0, 0, 0, 0, 0];
  const hueBuckets: [sumC: number, count: number][] =
    Array.from({ length: NUM_HUE_BUCKETS }, () => [0, 0]);

  // HSV LUT アキュムレータ: [sumA, sumB, count, sumLap] per cell
  // sumLap = 4連結 Laplacian 絶対値の累積（temporal weight 計算用）
  const hsvCells: [sumA: number, sumB: number, count: number, sumLap: number][] =
    Array.from({ length: HSV_LUT_SIZE ** 3 }, () => [0, 0, 0, 0]);

  // LCh 相関用アキュムレータ
  let sumL = 0, sumC = 0, sumL2 = 0, sumC2 = 0, sumLC = 0;
  // 輝度分布（64ビン、L=0-100 → 約1.5625L/ビン）
  // 16ビンでは Velvia的S字カーブとAstia的なハイライトロールオフを区別できないため拡張
  const TONE_BINS = 64;
  const toneBins = new Array(TONE_BINS).fill(0);

  for (let i = 0; i < n; i++) {
    const base = i * ch;
    const [L, a, b] = srgbToLab(data[base], data[base + 1], data[base + 2]);

    // ゾーン振り分け（ソフトブレンド）
    const [sW, mW, hW] = zoneWeights(L);
    if (sW > 0) {
      shadowAcc[0] += sW * a; shadowAcc[1] += sW * b;
      shadowAcc[2] += sW * a * a; shadowAcc[3] += sW * b * b;
      shadowAcc[4] += sW;
    }
    if (mW > 0) {
      midAcc[0] += mW * a; midAcc[1] += mW * b;
      midAcc[2] += mW * a * a; midAcc[3] += mW * b * b;
      midAcc[4] += mW;
    }
    if (hW > 0) {
      highlightAcc[0] += hW * a; highlightAcc[1] += hW * b;
      highlightAcc[2] += hW * a * a; highlightAcc[3] += hW * b * b;
      highlightAcc[4] += hW;
    }

    // クロマ計算
    const C = Math.sqrt(a * a + b * b);

    // L-C 相関アキュムレータ
    sumL += L; sumC += C; sumL2 += L * L; sumC2 += C * C; sumLC += L * C;

    // 輝度分布
    toneBins[Math.min(TONE_BINS - 1, Math.floor(L / 100 * TONE_BINS))]++;

    // 色相別クロマ（無彩色に近いピクセルは除外）
    if (C > MIN_CHROMA) {
      const h      = ((Math.atan2(b, a) * 180 / Math.PI) + 360) % 360;
      const bucket = Math.floor(h / 30) % NUM_HUE_BUCKETS;
      hueBuckets[bucket][0] += C;
      hueBuckets[bucket][1]++;
    }

    // HSV LUT: RGB → HSV → セル集計
    const [hsvH, hsvS, hsvV] = srgbToHsv(data[base], data[base + 1], data[base + 2]);
    const hBin = Math.min(HSV_LUT_SIZE - 1, Math.floor(hsvH / 360 * HSV_LUT_SIZE));
    const sBin = Math.min(HSV_LUT_SIZE - 1, Math.floor(hsvS * HSV_LUT_SIZE));
    const vBin = Math.min(HSV_LUT_SIZE - 1, Math.floor(hsvV * HSV_LUT_SIZE));
    const cellIdx = hBin * HSV_LUT_SIZE * HSV_LUT_SIZE + sBin * HSV_LUT_SIZE + vBin;
    hsvCells[cellIdx][0] += a;
    hsvCells[cellIdx][1] += b;
    hsvCells[cellIdx][2]++;
    // sumLap は後段の Laplacian パスで加算（インデックス再引き当て不要のよう別パス）
  }

  // ── Laplacian パス: temporal weight（テクスチャ複雑度）をセルごとに蓄積 ──
  // 4連結 Laplacian の絶対値 = 局所エッジ強度 = その色が現れる領域の「時間の蓄積」の代理指標
  // softness分析と同じ手法だが、ここでは目的が「HSVセルへの帰属」のため同バッファで計算
  {
    const w = info.width;
    const h = info.height;
    // グレースケール変換（既存 data[] から）
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * ch;
      gray[i] = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
    }
    // 端ピクセルを除いて Laplacian を計算し、対応する HSV セルに加算
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const lap = Math.abs(
          4 * gray[idx]
          - gray[(y - 1) * w + x]
          - gray[(y + 1) * w + x]
          - gray[y * w + (x - 1)]
          - gray[y * w + (x + 1)]
        );
        // 同じピクセルの HSV セルインデックスを再引き当て
        const base = idx * ch;
        const [hsvH2, hsvS2, hsvV2] = srgbToHsv(data[base], data[base + 1], data[base + 2]);
        const hBin2 = Math.min(HSV_LUT_SIZE - 1, Math.floor(hsvH2 / 360 * HSV_LUT_SIZE));
        const sBin2 = Math.min(HSV_LUT_SIZE - 1, Math.floor(hsvS2 * HSV_LUT_SIZE));
        const vBin2 = Math.min(HSV_LUT_SIZE - 1, Math.floor(hsvV2 * HSV_LUT_SIZE));
        hsvCells[hBin2 * HSV_LUT_SIZE * HSV_LUT_SIZE + sBin2 * HSV_LUT_SIZE + vBin2][3] += lap;
      }
    }
  }

  // ── LCh メトリクス ──
  const lMean = sumL / n;
  const cMean = sumC / n;
  const lStd  = Math.sqrt(Math.max(0, sumL2 / n - lMean * lMean));
  const cStd  = Math.sqrt(Math.max(0, sumC2 / n - cMean * cMean));
  const lcCov = sumLC / n - lMean * cMean;
  const lcCorrelation = (lStd > 0 && cStd > 0) ? Math.max(-1, Math.min(1, lcCov / (lStd * cStd))) : 0;

  // 色相エントロピー（hueBuckets の count を使用）
  const hueTotal = hueBuckets.reduce((s, [, cnt]) => s + cnt, 0);
  let hueEntropy = 0;
  if (hueTotal > 0) {
    for (const [, cnt] of hueBuckets) {
      if (cnt > 0) {
        const p = cnt / hueTotal;
        hueEntropy -= p * Math.log(p);
      }
    }
    hueEntropy /= Math.log(NUM_HUE_BUCKETS); // 0-1 に正規化
  }

  // ── 補色ペアスコア ──
  // hueBuckets の 30°×12 バケットのうち、180°対（i と i+6）を 6 ペア比較
  // 両バケットの平均クロマの「小さい方」= 両色相が同時に存在する強さ
  // 最大ペアを代表値とし、全体クロマ (cMean) で正規化して 0-1 に収める
  const hueSatForScore = hueBuckets.map(([sumC, cnt]) => cnt > 0 ? sumC / cnt : 0);
  let maxComplementaryRaw = 0;
  for (let i = 0; i < 6; i++) {
    const pairStrength = Math.min(hueSatForScore[i], hueSatForScore[i + 6]);
    if (pairStrength > maxComplementaryRaw) maxComplementaryRaw = pairStrength;
  }
  const complementaryScore = Math.min(1, maxComplementaryRaw / (cMean + 0.1));

  const lchMetrics: LchMetrics = { lMean, cMean, cStd, lcCorrelation, hueEntropy, complementaryScore };

  // ── トーンカーブ形状 ──
  const toneTotal = toneBins.reduce((s, c) => s + c, 0);
  const normalizedBins = toneBins.map(c => toneTotal > 0 ? c / toneTotal : 0);
  const peakZone = normalizedBins.indexOf(Math.max(...normalizedBins));
  const curvature: number[] = [];
  for (let i = 1; i < normalizedBins.length - 1; i++) {
    curvature.push(normalizedBins[i + 1] - 2 * normalizedBins[i] + normalizedBins[i - 1]);
  }
  // 64ビン基準: shadow L<35 → bin<22, highlight L>70 → bin>44
  const emphasis: ToneCurveShape['emphasis'] =
    peakZone < 22 ? 'shadows' : peakZone > 44 ? 'highlights' : 'midtones';

  // gammaFit: 輝度CDF のメジアン位置からガンマを推定
  // 均一な入力に対して y = x^γ を適用すると出力メジアンは 0.5^(1/γ) になる
  let cumSum = 0;
  let medianBinPos = TONE_BINS / 2;
  for (let i = 0; i < TONE_BINS; i++) {
    cumSum += normalizedBins[i];
    if (cumSum >= 0.5) { medianBinPos = i + 0.5; break; }
  }
  const l50 = medianBinPos / TONE_BINS; // 0-1 に正規化
  const gammaFit = (l50 > 0.02 && l50 < 0.98)
    ? Math.max(0.3, Math.min(4.0, Math.log(0.5) / Math.log(l50)))
    : 1.0;

  // sCurvature: curvature 配列の RMS（高い = カーブが複雑 = S字が強い）
  const curvatureRms = Math.sqrt(curvature.reduce((s, c) => s + c * c, 0) / Math.max(1, curvature.length));
  const sCurvature = Math.min(1, curvatureRms * 500);

  // highlightRolloff: 上位 10% bin の密度 / 上位 10-25% bin の密度
  // 比が高い = 最上位まで徐々に減衰 = フィルム的ロールオフ
  const hi25Start = Math.floor(TONE_BINS * 0.75);
  const hi10Start = Math.floor(TONE_BINS * 0.90);
  const densLowerHigh = normalizedBins.slice(hi25Start, hi10Start).reduce((s, v) => s + v, 0)
    / (hi10Start - hi25Start);
  const densUpperHigh = normalizedBins.slice(hi10Start).reduce((s, v) => s + v, 0)
    / (TONE_BINS - hi10Start);
  const highlightRolloff = densLowerHigh > 1e-6
    ? Math.min(1, densUpperHigh / densLowerHigh)
    : 0;

  const toneCurve: ToneCurveShape = {
    bins: normalizedBins, peakZone, curvature, emphasis,
    gammaFit, sCurvature, highlightRolloff,
  };

  // ── HSV LUT の構築 ──
  const hsvLut: HsvLut = {
    size: HSV_LUT_SIZE,
    cells: hsvCells.map(([sumA, sumB, count, sumLap]): HsvLutCell => ({
      aMean:          count > 0 ? sumA / count : 0,
      bMean:          count > 0 ? sumB / count : 0,
      coverage:       count / n,
      // temporalWeight: 平均絶対 Laplacian を 60 で正規化
      // 60 = 目安: 均一領域 ≈ 0-5、ソフトエッジ ≈ 5-15、シャープ境界 ≈ 20-60、テクスチャ豊 ≈ 40+
      temporalWeight: count > 0 ? Math.min(1, (sumLap / count) / 60) : 0,
    })),
  };

  // ── Temporal / Harmonic / Softness Metrics（別パスで並列計算）──
  const temporalMetrics = await computeTemporalMetrics(bmp);
  const harmonicMetrics = await computeHarmonicMetrics(bmp);
  const softnessMetrics = await computeSoftnessMetrics(bmp);

  return {
    shadows:    accToStats(shadowAcc, n),
    midtones:   accToStats(midAcc, n),
    highlights: accToStats(highlightAcc, n),
    hueSatBuckets: hueBuckets.map(([sumC, cnt]) => cnt > 0 ? sumC / cnt : 0),
    lchMetrics,
    toneCurve,
    temporalMetrics,
    harmonicMetrics,
    hsvLut,
    softnessMetrics,
  };
}

/**
 * 複数サンプルのシグネチャを【中央値】で集約してコンセンサスを生成
 *
 * Steidl的視点：平均は外れ値（ノイズ写真・露出ミス）の影響を受ける。
 * 中央値は「多数派の傾向」を忠実に反映し、IQR で一致度を定量化する。
 */
export function averageStyleSignatures(sigs: StyleSignature[]): StyleSignature {
  // ── ゾーン統計の中央値集約 ──
  function medianZone(key: 'shadows' | 'midtones' | 'highlights'): ZoneStats {
    return {
      aMean:      median(sigs.map(s => s[key].aMean)),
      bMean:      median(sigs.map(s => s[key].bMean)),
      aStd:       median(sigs.map(s => s[key].aStd)),
      bStd:       median(sigs.map(s => s[key].bStd)),
      pixelRatio: median(sigs.map(s => s[key].pixelRatio)),
    };
  }

  // ── 色相バケットの中央値集約 ──
  const medianHueSat = medianPerElement(sigs.map(s => s.hueSatBuckets));

  // ── LCh メトリクスの中央値集約 ──
  const lchList = sigs.map(s => s.lchMetrics).filter(Boolean) as LchMetrics[];
  let medianLch: LchMetrics | undefined;
  if (lchList.length > 0) {
    medianLch = {
      lMean:              median(lchList.map(m => m.lMean)),
      cMean:              median(lchList.map(m => m.cMean)),
      cStd:               median(lchList.map(m => m.cStd)),
      lcCorrelation:      median(lchList.map(m => m.lcCorrelation)),
      hueEntropy:         median(lchList.map(m => m.hueEntropy)),
      complementaryScore: median(lchList.map(m => m.complementaryScore)),
    };
  }

  // ── トーンカーブの中央値集約 ──
  const toneList = sigs.map(s => s.toneCurve).filter(Boolean) as ToneCurveShape[];
  let medianTone: ToneCurveShape | undefined;
  if (toneList.length > 0) {
    const medianBins = medianPerElement(toneList.map(t => t.bins));
    const peakZone = medianBins.indexOf(Math.max(...medianBins));
    const curvature: number[] = [];
    for (let i = 1; i < medianBins.length - 1; i++) {
      curvature.push(medianBins[i + 1] - 2 * medianBins[i] + medianBins[i - 1]);
    }
    const emphasis: ToneCurveShape['emphasis'] =
      peakZone < 22 ? 'shadows' : peakZone > 44 ? 'highlights' : 'midtones';
    medianTone = {
      bins: medianBins, peakZone, curvature, emphasis,
      gammaFit:         median(toneList.map(t => t.gammaFit ?? 1)),
      sCurvature:       median(toneList.map(t => t.sCurvature ?? 0)),
      highlightRolloff: median(toneList.map(t => t.highlightRolloff ?? 0)),
    };
  }

  // ── コンセンサス強度の計算 ──
  let consensusStrength: ConsensusStrength | undefined;
  if (lchList.length > 0 && toneList.length > 0) {
    // 各サンプルのトーン重点ゾーンがどれだけ一致しているか
    const emphasisCounts = new Map<string, number>();
    for (const t of toneList) {
      emphasisCounts.set(t.emphasis, (emphasisCounts.get(t.emphasis) ?? 0) + 1);
    }
    const maxCount = Math.max(...emphasisCounts.values());
    const toneEmphasisAgreement = maxCount / toneList.length;

    consensusStrength = {
      lcCorrelationIQR:    iqr(lchList.map(m => m.lcCorrelation)),
      toneEmphasisAgreement,
      hueEntropyIQR:       iqr(lchList.map(m => m.hueEntropy)),
      sampleCount:         sigs.length,
    };
  }

  // ── Temporal Metrics の中央値集約 ──
  const temporalList = sigs.map(s => s.temporalMetrics).filter(Boolean) as TemporalMetrics[];
  const medianTemporal = temporalList.length > 0
    ? aggregateTemporalMetrics(temporalList)
    : undefined;

  // ── Harmonic Metrics の中央値集約 ──
  const harmonicList = sigs.map(s => s.harmonicMetrics).filter(Boolean) as HarmonicMetrics[];
  const medianHarmonic = harmonicList.length > 0
    ? aggregateHarmonicMetrics(harmonicList)
    : undefined;

  // ── HsvLut の中央値集約 ──
  const hsvLutList = sigs.map(s => s.hsvLut).filter(Boolean) as HsvLut[];
  let medianHsvLut: HsvLut | undefined;
  if (hsvLutList.length > 0) {
    const numCells = HSV_LUT_SIZE ** 3;
    medianHsvLut = {
      size: HSV_LUT_SIZE,
      cells: Array.from({ length: numCells }, (_, i) => ({
        aMean:          median(hsvLutList.map(l => l.cells[i]?.aMean ?? 0)),
        bMean:          median(hsvLutList.map(l => l.cells[i]?.bMean ?? 0)),
        coverage:       median(hsvLutList.map(l => l.cells[i]?.coverage ?? 0)),
        temporalWeight: median(hsvLutList.map(l => l.cells[i]?.temporalWeight ?? 0)),
      })),
    };
  }

  // ── Softness Metrics の中央値集約 ──
  const softnessList = sigs.map(s => s.softnessMetrics).filter(Boolean) as SoftnessMetrics[];
  const medianSoftness = softnessList.length > 0
    ? aggregateSoftnessMetrics(softnessList)
    : undefined;

  return {
    shadows:          medianZone('shadows'),
    midtones:         medianZone('midtones'),
    highlights:       medianZone('highlights'),
    hueSatBuckets:    medianHueSat,
    lchMetrics:       medianLch,
    toneCurve:        medianTone,
    temporalMetrics:  medianTemporal,
    harmonicMetrics:  medianHarmonic,
    hsvLut:           medianHsvLut,
    softnessMetrics:  medianSoftness,
    consensusStrength,
  };
}
