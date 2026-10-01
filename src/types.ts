export interface ImageMetadata {
  id: string;
  filename: string;
  width: number;
  height: number;
  uploadedAt: string;
}

export interface ColorParameters {
  colorTemperature: number;   // Kelvin 3000-8000
  saturation: number;         // 0.0-2.0 multiplier
  brightness: number;         // 0.0-2.0 multiplier
  contrast: number;           // 0.0-2.0 multiplier
  highlights: number;         // -1.0 to 1.0
  shadows: number;            // -1.0 to 1.0
  vibrance: number;           // 0.0-2.0 multiplier
}

export interface LUT3D {
  size: number;               // 16 or 32
  data: number[];             // size^3 * 3 elements (RGB)
}

export interface ColorPalette {
  dominantColors: string[];   // hex colors
  averageColor: string;
  mood: 'warm' | 'cool' | 'neutral';
}

/** R/G/B 各チャンネルの累積分布関数（ヒストグラムマッチング用） */
export interface ChannelCDF {
  r: number[];
  g: number[];
  b: number[];
  labL?: number[];  // Lab L チャンネル CDF（0-100 → 256ビン）
  labA?: number[];  // Lab a チャンネル CDF（-128〜127 → 256ビン）
  labB?: number[];  // Lab b チャンネル CDF（-128〜127 → 256ビン）
}

/** Lab 空間の統計量（フォールバック用） */
export interface LabStats {
  lMean: number; lStd: number;
  aMean: number; aStd: number;
  bMean: number; bStd: number;
}

/** 輝度ゾーン（シャドウ/ミッドトーン/ハイライト）ごとの色統計 */
export interface ZoneStats {
  aMean: number; bMean: number;
  aStd:  number; bStd:  number;
  pixelRatio: number; // このゾーンが画像全体に占める割合
}

/** LCh 色空間の統計量 — 「彩度の純度」と「明度との相関」を記述する */
export interface LchMetrics {
  lMean: number;          // 平均明度 (0-100)
  cMean: number;          // 平均クロマ（彩度純度）
  cStd: number;           // クロマの標準偏差
  lcCorrelation: number;  // L-C 相関 (-1〜+1)：負 = Leiter的（明部=低彩度）
  hueEntropy: number;     // 色相エントロピー (0-1)：高 = 色相が均等に分布
  /**
   * 補色ペアスコア (0-1)
   * 180°対の色相バケットが両方充実しているほど高い。
   * Leiter的な「補色の緊張感」を持つ写真 → 高スコア（0.5〜1.0）
   * モノクロ的・単色的な写真 → 低スコア（0〜0.2）
   */
  complementaryScore: number;
}

/** トーンカーブ形状 — 輝度分布と「撮影者が重みを置いたトーン域」を記述する */
export interface ToneCurveShape {
  bins: number[];          // 64ビン正規化輝度分布（合計=1）
  peakZone: number;        // 最もピクセル密度が高いビン
  curvature: number[];     // 2次導関数：曲率のパターン
  emphasis: 'shadows' | 'midtones' | 'highlights';
  /** 推定ガンマ値 (< 1 = シャドウ持ち上げ/マット、1 = ニュートラル、> 1 = 暗め) */
  gammaFit: number;
  /** S字カーブ強度 (0-1)：高 = ミッドトーンコントラスト強調 */
  sCurvature: number;
  /** ハイライトロールオフ (0 = デジタル硬クリップ、1 = フィルム的滑らか) */
  highlightRolloff: number;
}

/** HSV 5×5×5 LUT — HSV 空間の 125 セルごとの Lab ab 平均値 */
export interface HsvLutCell {
  aMean: number;           // セル内ピクセルの Lab a 平均
  bMean: number;           // セル内ピクセルの Lab b 平均
  coverage: number;        // このセルに属するピクセルの割合 (0-1)
  temporalWeight?: number; // このセルの色が現れる領域のテクスチャ複雑度 (0-1)
                           // 0 = 均一/滑らか（白背景・青空）
                           // 1 = テクスチャ豊か（皺・風化した壁・粒子感）
}

export interface HsvLut {
  size: number;           // 5 (5×5×5 = 125 セル)
  cells: HsvLutCell[];    // インデックス = h*25 + s*5 + v
}

/**
 * 柔らかさ指標 — Leiter 的な「視線が滑る面」の空間分布を記述する
 * ボケ・霧・窓ガラス越しの撮影など、フォーカス外領域の性質を捉える
 */
export interface SoftnessMetrics {
  /** ソフト領域の割合 (0-1)：高 = Leiter 的、低 = ドキュメンタリー的鮮明さ */
  softAreaRatio: number;
  /** ソフト領域の平均深度 (0-1)：高 = 深いボケ */
  meanSoftnessDepth: number;
  /** 柔らかさの 8 段階分布（最も鋭い → 最も柔らかい、合計 = 1） */
  softnessProfile: number[];
  /** ソフト領域の空間パターン：集中 / 層状 / 拡散 */
  softnessDistribution: 'concentrated' | 'layered' | 'diffuse';
  /** 自然なボケが始まるガウシアン σ スケール (px) */
  peakBlurScale: number;
}

/**
 * 視覚的調和度 — エッジの方向分布と低空間周波数の光の流れを記述する
 * エッジ方向が均等に分布する写真は「視線が迷わない」調和した構成を持つ（美術作品との相関あり）
 */
export interface HarmonicMetrics {
  /** エッジ方向エントロピー (0-1)：高 = 方向が均等 = 視覚的調和 */
  edgeOrientationEntropy: number;
  /** 支配的なエッジ方向 (0-179°) */
  dominantEdgeAngle: number;
  /** 低空間周波数の支配的な光の流れ方向 (0-359°) */
  lightFlowAngle: number;
  /** 光の流れの強度 (0-1)：高 = 明確な方向性がある */
  lightFlowStrength: number;
  /** エッジ方向の 36ビン ヒストグラム (正規化済み) */
  edgeAngleHistogram: number[];
}

/**
 * 時間の蓄積 — 被写体が体験してきた時間は光の複雑な反射層に現れる
 * 皺・風化・古い建物の層構造を複数スケールのエッジで捉える
 */
export interface TemporalMetrics {
  /** 多スケールエッジ複雑度：σ={1,2,4,8,16,32} の平均エッジ密度 (0-1) */
  multiScaleEdgeDepth: number;
  /** 複数スケールでの一様性：高い値 = 全スケールで豊富なエッジ = 時間の蓄積が深い */
  temporalComplexity: number;
  /** マイクロコントラスト密度：局所高コントラスト領域の割合 (0-1) */
  microcontrastDensity: number;
  /** マイクロコントラスト強度：平均的な局所コントラスト強さ */
  microcontrastIntensity: number;
  /** 各スケールのエッジ密度 [σ=1, 2, 4, 8, 16, 32] */
  scaleProfile: number[];
  /** フィルム粒子強度：(original − σ=1 blur) の RMS / 255 で grain のみを分離 (0-1) */
  grainIntensity?: number;
}

/**
 * 複数サンプルのコンセンサス強度 — 「外れ値から来た傾向か、全員一致の傾向か」を示す
 * Steidl的視点：単一画像の偶然性を排除し「統計的に確かな傾向」だけを信頼する
 */
export interface ConsensusStrength {
  /** L-C 相関の IQR（小さいほどサンプル間の一致度が高い） */
  lcCorrelationIQR: number;
  /** トーンカーブ重点ゾーンの一致率（0-1：1.0 = 全サンプルが同じゾーンを示す）*/
  toneEmphasisAgreement: number;
  /** 色相エントロピーの IQR */
  hueEntropyIQR: number;
  /** サンプル数 */
  sampleCount: number;
}

/**
 * スタイル・シグネチャ — ゾーン別色調 + 色相別彩度プロファイル
 * 単純な全体統計ではなく「どのトーンにどんな色が乗っているか」「どの色相を活かすか」を記述する
 */
export interface StyleSignature {
  shadows:    ZoneStats; // L < 35
  midtones:   ZoneStats; // 35 ≤ L < 70
  highlights: ZoneStats; // L ≥ 70
  /** 30°×12バケットの平均クロマ（彩度の色相別プロファイル） */
  hueSatBuckets: number[];
  /** LCh 解析：L-C 相関・色相エントロピー */
  lchMetrics?: LchMetrics;
  /** トーンカーブ形状：輝度分布と重点ゾーン */
  toneCurve?: ToneCurveShape;
  /** 時間の蓄積：多スケールエッジ複雑度・マイクロコントラスト */
  temporalMetrics?: TemporalMetrics;
  /** 視覚的調和：エッジ方向エントロピー・光の流れ */
  harmonicMetrics?: HarmonicMetrics;
  /** HSV 5×5×5 LUT：Split Toning 上位互換の色空間マッピング */
  hsvLut?: HsvLut;
  /** 柔らかさ指標：Leiter 的ボケ・霧・軟調領域の分布 */
  softnessMetrics?: SoftnessMetrics;
  /** コンセンサス強度（複数サンプル解析時のみ付与） */
  consensusStrength?: ConsensusStrength;
}

export interface ColorStyle {
  id: string;
  name: string;
  sourceImageId: string;
  parameters: ColorParameters;
  lut?: LUT3D;
  channelCDF?: ChannelCDF;        // フォールバック用CDF
  labStats?: LabStats;            // フォールバック用統計量
  styleSignature?: StyleSignature; // 主手法：ゾーン別色調 + 色相別彩度
  palette: ColorPalette;
  createdAt: string;
}

export interface AnalysisResult {
  imageId: string;
  colorStyle: ColorStyle;
  durationMs: number;
}

export interface TransferRequest {
  targetImageId: string;
  styleId: string;
  intensity: number;          // 0.0-1.0 blend ratio
}

export interface TransferResult {
  resultImageUrl: string;
  durationMs: number;
}

export interface APIError {
  code: string;
  message: string;
}

export interface SavedStylePreset {
  id: string;
  name: string;
  colorStyle: ColorStyle;
  thumbnail: string;     // base64 data URL (96×96)
  sampleCount: number;
  savedAt: string;       // ISO timestamp
}
