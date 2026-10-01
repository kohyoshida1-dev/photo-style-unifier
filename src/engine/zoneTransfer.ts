import { srgbToLab, labToSrgb, srgbToHsv } from './colorSpace';
import type { StyleSignature, ZoneStats, HsvLut } from '../types';

/**
 * 分析指標から導出した転送パラメータ
 * computeTransferWeights() が StyleSignature を読んで生成する
 */
export interface TransferWeights {
  /** ゾーン ab シフト全体の強度倍率 (0.6–1.0+) */
  zoneShiftScale: number;
  /** クロマスケールの適用率 (0.5–1.0) */
  chromaScaleBlend: number;
  /** L依存クロマ補正の強度 — |lcCorrelation| × 信頼性 (0–0.4) */
  lcChromaModStrength: number;
  /** L-C相関値（補正の方向に使用） */
  lcCorrelation: number;
  /** テクスチャ保護マスクの最大強度 (0–0.65): サンプルのmicrocontrastDensityから導出 */
  textureMaskStrength: number;
}

/**
 * StyleSignature の分析指標から TransferWeights を導出する
 *
 * ConsensusStrength（複数サンプル時のみ存在）がある場合はばらつきで信頼度を下げる。
 * ない場合（単一サンプル）は分析が可能な範囲で控えめな補正のみ適用する。
 */
export function computeTransferWeights(sig: StyleSignature): TransferWeights {
  const consensus = sig.consensusStrength;
  const lch = sig.lchMetrics;
  const harmonic = sig.harmonicMetrics;
  const lcCorrelation = lch?.lcCorrelation ?? 0;

  let zoneShiftScale = 1.0;
  let chromaScaleBlend = 1.0;
  let lcChromaModStrength = 0;

  if (consensus) {
    // ① ConsensusStrength → zoneShiftScale
    // トーン重点ゾーンの一致率が高いほど zone shift を強く (0.6–1.0)
    zoneShiftScale = 0.6 + 0.4 * consensus.toneEmphasisAgreement;

    // ② ConsensusStrength → chromaScaleBlend
    // 色相エントロピーの IQR が小さい（サンプル間で一致）ほど chroma scaling を信頼 (0.5–1.0)
    chromaScaleBlend = Math.max(0.5, Math.min(1.0, 1 - consensus.hueEntropyIQR * 1.5));

    // ③ LCh L-C相関 × IQR信頼性 → lcChromaModStrength
    const lcCorrConfidence = Math.max(0, 1 - consensus.lcCorrelationIQR * 2);
    lcChromaModStrength = Math.abs(lcCorrelation) * lcCorrConfidence * 0.4;
  } else if (lch) {
    // 単一サンプル: L-C相関補正を控えめに適用（信頼性 0.3 固定）
    lcChromaModStrength = Math.abs(lcCorrelation) * 0.3 * 0.4;
  }

  // ④ HarmonicMetrics.edgeOrientationEntropy → zoneShiftScale を微増
  // 空気感のある画像（均等エッジ分布）はグローバルな色調シフトが効果的
  if (harmonic) {
    zoneShiftScale *= 0.9 + 0.1 * harmonic.edgeOrientationEntropy;
  }

  // ⑤ TemporalMetrics.microcontrastDensity → textureMaskStrength
  // サンプルのテクスチャ密度が高いほど、ターゲットのテクスチャ領域への転送を抑制する
  // MC_THRESHOLD=0.07 基準: 0.10 未満 = ほぼ影響なし、0.40 以上 = 最大マスク
  const sampleMC = sig.temporalMetrics?.microcontrastDensity ?? 0;
  const textureMaskStrength = Math.max(0, Math.min(0.65, (sampleMC - 0.10) * 1.857));


  return { zoneShiftScale, chromaScaleBlend, lcChromaModStrength, lcCorrelation, textureMaskStrength };
}

const NUM_HUE_BUCKETS = 12;
const MIN_CHROMA = 1;
const CHROMA_SCALE_MIN = 0.5;   // 過剰な彩度減衰を防ぐ
const CHROMA_SCALE_MAX = 1.6;   // 過剰な彩度増幅を防ぐ（2.5→1.6）
const CHROMA_EPS = 8;
const HSV_LUT_SIZE = 5;

/**
 * フィルム肩曲線: L>80 でabシフトを漸減させる係数 (0-1)
 *
 * フィルム乳剤の特性曲線（H&D曲線）はハイライト側で傾きが緩やかになる「肩」を持つ。
 * これにより、ハイライトのカラーシフトが「重ねたレイヤー」に見えず
 * 写真の空気感に自然に溶け込む。rolloffStrength=0で従来動作（デジタル硬クリップ）。
 */
function highlightRolloffFactor(L: number, rolloffStrength: number): number {
  if (L <= 80 || rolloffStrength < 0.05) return 1.0;
  const t = (L - 80) / 20; // L=80で0、L=100で1
  return Math.max(0, 1 - t * rolloffStrength);
}

/**
 * フィルム肩: ハイライト端でLを微量圧縮し、デジタル硬クリップを防ぐ
 *
 * L=85以上で二次関数的に圧縮。最大圧縮量は rolloffStrength=1 で約3.5 Lab単位（L≈100時）。
 * ミッドトーン以下には一切影響しない。
 */
function filmShoulderL(L: number, rolloffStrength: number): number {
  if (L <= 85 || rolloffStrength < 0.1) return L;
  const t = (L - 85) / 15; // L=85で0、L=100で1
  return L - t * t * 3.5 * rolloffStrength;
}

// クロマ適応マスク: C が高いほど転写強度を下げる
// C=0(無彩色)→1.0, C=15→0.5, C=30→0.2
function chromaAdaptiveWeight(C: number): number {
  const r = C / 15;
  return 1 / (1 + r * r);
}

// 肌色保護係数: Lab ab 空間で h ≈ 20-50°, C > 8 の領域を保護
// shiftWeight に掛けることで肌への過剰転写を抑制
function skinProtectionFactor(a: number, b: number, C: number): number {
  if (C < 8) return 1; // 低彩度は肌ではないので保護不要
  const hDeg = ((Math.atan2(b, a) * 180 / Math.PI) + 360) % 360;
  const SKIN_HUE_CENTER = 35;
  const SKIN_HUE_RADIUS = 30;
  const hueDist = Math.abs(((hDeg - SKIN_HUE_CENTER + 180) % 360) - 180);
  const skinness = Math.max(0, 1 - hueDist / SKIN_HUE_RADIUS) * Math.min(1, C / 15);
  return 1 - 0.55 * skinness; // 肌色域では転写を最大55%抑制
}


/**
 * 輝度 L からゾーン重みを計算（smoothstep ブレンド）
 * shadow[25-45] ↔ midtone、midtone[60-80] ↔ highlight でクロスフェード
 * smoothstep により一次微分不連続を解消 → 印刷条件でのバンディングアーティファクト防止
 */
function smoothstep(t: number): number { return t * t * (3 - 2 * t); }

function zoneWeights(L: number): [sW: number, mW: number, hW: number] {
  if (L < 25) return [1, 0, 0];
  if (L < 45) { const t = smoothstep((L - 25) / 20); return [1 - t, t, 0]; }
  if (L < 60) return [0, 1, 0];
  if (L < 80) { const t = smoothstep((L - 60) / 20); return [0, 1 - t, t]; }
  return [0, 0, 1];
}

/**
 * 色相角から隣接バケットを補間したクロマスケールを返す
 *
 * 30°ハードバケット境界による不連続を解消する（Fujifilm中村氏の指摘）。
 * - 元の色相角（abシフト前）を使用: シフト後の色相でバケットを決めると
 *   バケット境界をまたぐシフトで突然スケールが変わり継ぎ目アーティファクトが出る
 * - smoothstep で隣接バケットを補間: 肌色・夕焼けグラデーション等の連続色域で有効
 */
function interpolatedChromaScale(chromaScales: number[], hDeg: number): number {
  const pos = (hDeg / 30) % NUM_HUE_BUCKETS;
  const b1 = Math.floor(pos) % NUM_HUE_BUCKETS;
  const b2 = (b1 + 1) % NUM_HUE_BUCKETS;
  const w = smoothstep(pos - Math.floor(pos));
  return chromaScales[b1] * (1 - w) + chromaScales[b2] * w;
}

/**
 * バッファからターゲット・シグネチャをリアルタイム計算
 * Zone/Hue 統計に加え、L ビン（CDF マッピング用）と HSV LUT（精密 ab マッピング用）も収集
 */
export function computeTargetSignature(data: Uint8ClampedArray, channels: number): StyleSignature {
  // 統計量（平均・ヒストグラム）なので間引いても結果はほぼ同じ。大画像での処理時間を一定に抑える
  const MAX_STAT_PIXELS = 500_000;
  const totalPixels = Math.floor(data.length / channels);
  const stride = Math.max(1, Math.floor(totalPixels / MAX_STAT_PIXELS));
  if (stride > 1) {
    const sampled = new Uint8ClampedArray(Math.ceil(totalPixels / stride) * channels);
    for (let i = 0, j = 0; i < totalPixels; i += stride, j += channels) {
      for (let c = 0; c < channels; c++) sampled[j + c] = data[i * channels + c];
    }
    data = sampled;
  }
  const n = Math.floor(data.length / channels);
  const shadowAcc:    [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const midAcc:       [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const highlightAcc: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const hueBuckets: [number, number][] = Array.from({ length: NUM_HUE_BUCKETS }, () => [0, 0]);

  // L チャンネル CDF 用（64 ビン、styleSignature と同じ解像度）
  const TONE_BINS = 64;
  const lBins = new Array(TONE_BINS).fill(0);

  // HSV LUT アキュムレータ
  const hsvCells: [sumA: number, sumB: number, count: number][] =
    Array.from({ length: HSV_LUT_SIZE ** 3 }, () => [0, 0, 0]);

  for (let i = 0; i < n; i++) {
    const base = i * channels;
    const r = data[base], g = data[base + 1], b = data[base + 2];
    const [L, a, bv] = srgbToLab(r, g, b);

    // styleSignature.ts と同じソフト境界で集計（バグ①修正）
    const [sW, mW, hW] = zoneWeights(L);
    if (sW > 0) {
      shadowAcc[0] += sW * a; shadowAcc[1] += sW * bv;
      shadowAcc[2] += sW * a * a; shadowAcc[3] += sW * bv * bv;
      shadowAcc[4] += sW;
    }
    if (mW > 0) {
      midAcc[0] += mW * a; midAcc[1] += mW * bv;
      midAcc[2] += mW * a * a; midAcc[3] += mW * bv * bv;
      midAcc[4] += mW;
    }
    if (hW > 0) {
      highlightAcc[0] += hW * a; highlightAcc[1] += hW * bv;
      highlightAcc[2] += hW * a * a; highlightAcc[3] += hW * bv * bv;
      highlightAcc[4] += hW;
    }

    const C = Math.sqrt(a * a + bv * bv);
    if (C > MIN_CHROMA) {
      const h = ((Math.atan2(bv, a) * 180 / Math.PI) + 360) % 360;
      hueBuckets[Math.floor(h / 30) % NUM_HUE_BUCKETS][0] += C;
      hueBuckets[Math.floor(h / 30) % NUM_HUE_BUCKETS][1]++;
    }

    lBins[Math.min(TONE_BINS - 1, Math.floor(L / 100 * TONE_BINS))]++;

    const [hsvH, hsvS, hsvV] = srgbToHsv(r, g, b);
    const hBin = Math.min(HSV_LUT_SIZE - 1, Math.floor(hsvH / 360 * HSV_LUT_SIZE));
    const sBin = Math.min(HSV_LUT_SIZE - 1, Math.floor(hsvS * HSV_LUT_SIZE));
    const vBin = Math.min(HSV_LUT_SIZE - 1, Math.floor(hsvV * HSV_LUT_SIZE));
    const cellIdx = hBin * HSV_LUT_SIZE * HSV_LUT_SIZE + sBin * HSV_LUT_SIZE + vBin;
    hsvCells[cellIdx][0] += a;
    hsvCells[cellIdx][1] += bv;
    hsvCells[cellIdx][2]++;
  }

  function toStats(acc: [number, number, number, number, number]): ZoneStats {
    if (acc[4] < 1e-6) return { aMean: 0, bMean: 0, aStd: 5, bStd: 5, pixelRatio: 0 };
    const sumW = acc[4];
    const aMean = acc[0] / sumW;
    const bMean = acc[1] / sumW;
    return {
      aMean, bMean,
      aStd: Math.sqrt(Math.max(0, acc[2] / sumW - aMean * aMean)),
      bStd: Math.sqrt(Math.max(0, acc[3] / sumW - bMean * bMean)),
      pixelRatio: sumW / n,
    };
  }

  const lBinTotal = lBins.reduce((s, c) => s + c, 0);
  const hsvLut: HsvLut = {
    size: HSV_LUT_SIZE,
    cells: hsvCells.map(([sumA, sumB, cnt]) => ({
      aMean: cnt > 0 ? sumA / cnt : 0,
      bMean: cnt > 0 ? sumB / cnt : 0,
      coverage: cnt / n,
    })),
  };

  return {
    shadows:    toStats(shadowAcc),
    midtones:   toStats(midAcc),
    highlights: toStats(highlightAcc),
    hueSatBuckets: hueBuckets.map(([sumC, cnt]) => cnt > 0 ? sumC / cnt : 0),
    // toneCurve.bins を L CDF として再利用（transfer パイプラインで参照）
    toneCurve: {
      bins: lBins.map(c => lBinTotal > 0 ? c / lBinTotal : 0),
      peakZone: 0, curvature: [], emphasis: 'midtones',
      gammaFit: 1, sCurvature: 0, highlightRolloff: 0,
    },
    hsvLut,
  };
}

/**
 * サンプルシグネチャが実質的に無彩色（白黒）かどうかを判定する。
 * 全ゾーンの Chroma が BW_CHROMA_THRESHOLD 未満、かつ hueSatBuckets の
 * 最大値も低い場合に true を返す。
 */
const BW_CHROMA_THRESHOLD = 7;

function isBWSignature(sig: StyleSignature): boolean {
  const zoneChroma = (z: { aMean: number; bMean: number }) =>
    Math.sqrt(z.aMean ** 2 + z.bMean ** 2);
  const maxZoneChroma = Math.max(
    zoneChroma(sig.shadows),
    zoneChroma(sig.midtones),
    zoneChroma(sig.highlights),
  );
  const maxHueSat = Math.max(...(sig.hueSatBuckets ?? [0]));
  return maxZoneChroma < BW_CHROMA_THRESHOLD && maxHueSat < BW_CHROMA_THRESHOLD;
}

/**
 * ターゲット画像のテクスチャ複雑度から転送強度マスクを生成する
 *
 * 16×16 ブロックごとに輝度分散を計算し、テクスチャが豊かな領域ほど
 * 転送強度を下げる Float32Array を返す。
 *
 * - 平坦な領域（空・光）→ mask ≈ 1.0: 色調が空気感を担うためフルで転送
 * - テクスチャ領域（布・壁・皮膚の質感）→ mask < 1.0: 素材固有の色を保護
 *
 * maskStrength < 0.02 の場合は null を返す（計算コストを回避）。
 */
function buildTextureTransferMask(
  data: Uint8ClampedArray,
  channels: number,
  width: number,
  height: number,
  maskStrength: number,
): Float32Array | null {
  if (maskStrength < 0.02) return null;

  const BLOCK = 16;
  const n = width * height;

  // グレースケール変換（RGB → luma）
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const b = i * channels;
    gray[i] = (0.299 * data[b] + 0.587 * data[b + 1] + 0.114 * data[b + 2]) | 0;
  }

  // ブロックごとの輝度分散（局所テクスチャ複雑度の代理指標）
  const numBX = Math.ceil(width / BLOCK);
  const numBY = Math.ceil(height / BLOCK);
  const blockVar = new Float32Array(numBX * numBY);

  for (let by = 0; by < numBY; by++) {
    const y0 = by * BLOCK;
    for (let bx = 0; bx < numBX; bx++) {
      const x0 = bx * BLOCK;
      let sum = 0, sum2 = 0, cnt = 0;
      for (let dy = 0; dy < BLOCK && y0 + dy < height; dy++) {
        const row = (y0 + dy) * width;
        for (let dx = 0; dx < BLOCK && x0 + dx < width; dx++) {
          const v = gray[row + x0 + dx];
          sum += v; sum2 += v * v; cnt++;
        }
      }
      if (cnt > 0) {
        const mean = sum / cnt;
        blockVar[by * numBX + bx] = Math.max(0, sum2 / cnt - mean * mean);
      }
    }
  }

  // 最大分散で正規化（spread演算子はサイズ制限があるためループで計算）
  let maxVar = 1;
  for (let i = 0; i < blockVar.length; i++) {
    if (blockVar[i] > maxVar) maxVar = blockVar[i];
  }

  // ピクセルごとのマスク値: テクスチャが豊かなほど転送を抑制
  const mask = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    const by = (y / BLOCK) | 0;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const texScore = blockVar[by * numBX + ((x / BLOCK) | 0)] / maxVar;
      mask[row + x] = 1 - texScore * maskStrength;
    }
  }

  return mask;
}

/**
 * ゾーン別色調シフト + 色相別クロマスケーリング（元の実装に戻す）
 *
 * 1. 輝度ゾーン（シャドウ/ミッドトーン/ハイライト）ごとにサンプルとターゲットの
 *    平均色調差を計算し、ソフトブレンドでシフトする
 * 2. 色相バケットごとに平均クロマの比（sample / target）を計算してスケーリング
 * 3. グレイン付加
 *
 * HSV LUT による転写は分析指標としては有効だが、転写アルゴリズムとしては
 * 被写体の色差とスタイル差が混在するため現時点では使用しない。
 *
 * サンプルが白黒（無彩色）と判定された場合は専用の脱彩色パスを使用する。
 */
export function applyZoneHueTransfer(
  data: Uint8ClampedArray,
  channels: number,
  width: number,
  height: number,
  targetSig: StyleSignature,
  sampleSig: StyleSignature,
  intensity: number,
  weights?: TransferWeights,
): Uint8ClampedArray {
  // 呼び出し側でコピー済みのバッファを渡す前提でインプレース書き換え（大画像のメモリ節約）
  const output = data;
  const n = width * height;
  // サンプルのハイライトロールオフ強度（0=デジタル硬クリップ, 1=フィルム肩）
  const rolloffStrength = sampleSig.toneCurve?.highlightRolloff ?? 0;

  // テクスチャ保護マスク: サンプルの microcontrastDensity が高いほど
  // ターゲットのテクスチャ領域への転送を抑制する
  const transferMask = weights
    ? buildTextureTransferMask(data, channels, width, height, weights.textureMaskStrength)
    : null;

  // ── 白黒専用パス ──────────────────────────────────────────────────────────
  // サンプルが無彩色の場合、通常の差分シフトでは chromaAdaptiveWeight による
  // 減衰が逆効果になり脱彩色できない。Lab の a/b を直接 0 へブレンドする。
  if (isBWSignature(sampleSig)) {
    for (let i = 0; i < n; i++) {
      const base = i * channels;
      const r = data[base], g = data[base + 1], b = data[base + 2];
      const [L, a, bv] = srgbToLab(r, g, b);
      const blendA = a  * (1 - intensity);
      const blendB = bv * (1 - intensity);
      const [or, og, ob] = labToSrgb(L, blendA, blendB);
      output[base]     = Math.max(0, Math.min(255, Math.round(or)));
      output[base + 1] = Math.max(0, Math.min(255, Math.round(og)));
      output[base + 2] = Math.max(0, Math.min(255, Math.round(ob)));
    }
    return output;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const chromaScales = sampleSig.hueSatBuckets.map((sC, i) => {
    const tC = targetSig.hueSatBuckets[i];
    return Math.min(CHROMA_SCALE_MAX, Math.max(CHROMA_SCALE_MIN, (sC + CHROMA_EPS) / (tC + CHROMA_EPS)));
  });

  for (let i = 0; i < n; i++) {
    const base = i * channels;
    const r = data[base], g = data[base + 1], b = data[base + 2];
    const [L, a, bv] = srgbToLab(r, g, b);

    const [sW, mW, hW] = zoneWeights(L);

    const tAMean = sW * targetSig.shadows.aMean + mW * targetSig.midtones.aMean + hW * targetSig.highlights.aMean;
    const tBMean = sW * targetSig.shadows.bMean + mW * targetSig.midtones.bMean + hW * targetSig.highlights.bMean;
    const sAMean = sW * sampleSig.shadows.aMean + mW * sampleSig.midtones.aMean + hW * sampleSig.highlights.aMean;
    const sBMean = sW * sampleSig.shadows.bMean + mW * sampleSig.midtones.bMean + hW * sampleSig.highlights.bMean;

    const C = Math.sqrt(a * a + bv * bv);

    // クロマ適応マスク（Steidl）× 肌色保護（Fujifilm）
    // 無彩色・低彩度 → 光の色温度・空気感をフルで転写
    // 肌色・中高彩度 → 被写体色を保護し、転写を大幅に抑制
    const shiftWeight = chromaAdaptiveWeight(C) * skinProtectionFactor(a, bv, C);

    // 分析指標由来の転送強度倍率（weights がない場合は 1.0 = 従来動作）
    const zoneScale = weights?.zoneShiftScale ?? 1.0;

    // 自然な範囲に収めるため ±12 Lab でクリップ（sampleとtargetの色差が極端な場合の過剰転写を防ぐ）
    const MAX_SHIFT = 12;
    const rawShiftA = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, (sAMean - tAMean) * shiftWeight * zoneScale));
    const rawShiftB = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, (sBMean - tBMean) * shiftWeight * zoneScale));

    let newA = a + rawShiftA;
    let newB = bv + rawShiftB;

    const newC = Math.sqrt(newA * newA + newB * newB);
    if (newC > MIN_CHROMA) {
      // 元の色相角（abシフト前）でスケールバケットを決定し、隣接バケット間を補間
      // シフト後の色相を使うとバケット境界越えで不連続が生じる（肌色・グラデーションに継ぎ目）
      const origH = ((Math.atan2(bv, a) * 180 / Math.PI) + 360) % 360;
      const iScale = interpolatedChromaScale(chromaScales, origH);

      // L-C相関補正: lcCorrelation*(L/100-0.5)*2 で明度依存クロマ調整
      // lcCorrelation < 0 (Leiter逆転): 暗部=クロマ増強、明部=クロマ抑制
      const lcMod = weights
        ? weights.lcCorrelation * (L / 100 - 0.5) * 2 * weights.lcChromaModStrength
        : 0;
      const clampedLcMod = Math.max(-0.35, Math.min(0.35, lcMod));

      // chromaScaleBlend でコンセンサス信頼度を反映、lcMod で L依存補正を加算
      const chromaBlend = weights?.chromaScaleBlend ?? 1.0;
      const scale = 1 + ((iScale - 1) * chromaBlend + clampedLcMod) * shiftWeight;
      newA *= scale;
      newB *= scale;
    }

    // テクスチャマスクで per-pixel 転送強度を調整
    // mask=1.0: 平坦領域 → フル転送、mask<1.0: テクスチャ領域 → 転送を抑制
    const pixelIntensity = intensity * (transferMask ? transferMask[i] : 1.0);

    // ハイライトロールオフ: L>80 でabシフトを漸減（フィルム肩曲線の近似）
    const rolloff = highlightRolloffFactor(L, rolloffStrength);
    const blendA = a  + (newA - a)  * pixelIntensity * rolloff;
    const blendB = bv + (newB - bv) * pixelIntensity * rolloff;

    // フィルム肩: ハイライト端で L を微量圧縮（デジタル硬クリップ防止）
    const outL = filmShoulderL(L, rolloffStrength);

    const [or, og, ob] = labToSrgb(
      outL,
      Math.max(-128, Math.min(127, blendA)),
      Math.max(-128, Math.min(127, blendB)),
    );

    output[base]     = Math.max(0, Math.min(255, Math.round(or)));
    output[base + 1] = Math.max(0, Math.min(255, Math.round(og)));
    output[base + 2] = Math.max(0, Math.min(255, Math.round(ob)));
  }

  return output;
}
