/** sRGB (0-255) → Linear RGB (0-1)。入力は 8bit 整数なので 256 要素のテーブルで引く */
const SRGB_TO_LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const n = i / 255;
  SRGB_TO_LINEAR[i] = n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

export function srgbToLinear(c: number): number {
  return SRGB_TO_LINEAR[c];
}

/**
 * Linear RGB (0-1) → sRGB (0-255)
 * round(encode(c) * 255) と同じ結果を、Math.pow の代わりに
 * 「各階調の丸め境界」への二分探索で求める（encode は単調増加なので結果は完全一致）
 */
const SRGB_ROUND_THRESHOLDS = new Float64Array(256); // [k] = 階調 k に切り上がる最小の線形値
for (let k = 1; k < 256; k++) {
  const v = (k - 0.5) / 255;
  SRGB_ROUND_THRESHOLDS[k] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  if (!(c > 0)) return 0;
  if (c >= 1) return 255;
  let lo = 0, hi = 255;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (c >= SRGB_ROUND_THRESHOLDS[mid]) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Linear RGB (0-1) → CIE XYZ (D65) */
export function linearRgbToXyz(r: number, g: number, b: number): [number, number, number] {
  return [
    r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    r * 0.2126729 + g * 0.7151522 + b * 0.0721750,
    r * 0.0193339 + g * 0.1191920 + b * 0.9503041,
  ];
}

/** CIE XYZ → Lab */
export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const xn = 0.95047, yn = 1.00000, zn = 1.08883;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787037 * t + 16 / 116;
  const fx = f(x / xn), fy = f(y / yn), fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Lab → CIE XYZ */
export function labToXyz(L: number, a: number, b: number): [number, number, number] {
  const xn = 0.95047, yn = 1.00000, zn = 1.08883;
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const delta = 6 / 29;
  const f3 = (t: number) => t > delta ? t ** 3 : 3 * delta * delta * (t - 4 / 29);
  return [f3(fx) * xn, f3(fy) * yn, f3(fz) * zn];
}

/** CIE XYZ → Linear RGB (0-1) */
export function xyzToLinearRgb(x: number, y: number, z: number): [number, number, number] {
  return [
    x *  3.2404542 + y * -1.5371385 + z * -0.4985314,
    x * -0.9692660 + y *  1.8760108 + z *  0.0415560,
    x *  0.0556434 + y * -0.2040259 + z *  1.0572252,
  ];
}

// 毎ピクセル呼ばれるため、以下 2 関数は上の各関数をインライン展開してある（計算式は同一）
const XN = 0.95047, YN = 1.00000, ZN = 1.08883;
function labF(t: number): number { return t > 0.008856 ? Math.cbrt(t) : 7.787037 * t + 16 / 116; }
const LAB_DELTA = 6 / 29;
function labF3(t: number): number { return t > LAB_DELTA ? t * t * t : 3 * LAB_DELTA * LAB_DELTA * (t - 4 / 29); }

/** sRGB (0-255) → Lab */
export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = SRGB_TO_LINEAR[r], lg = SRGB_TO_LINEAR[g], lb = SRGB_TO_LINEAR[b];
  const fx = labF((lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / XN);
  const fy = labF((lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750) / YN);
  const fz = labF((lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** sRGB (0-255) → HSV (h: 0-360, s: 0-1, v: 0-1) */
export function srgbToHsv(r: number, g: number, b: number): [h: number, s: number, v: number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === rn)      h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else                 h = 60 * ((rn - gn) / delta + 4);
    if (h < 0) h += 360;
  }
  return [h, max > 0 ? delta / max : 0, max];
}

/** Lab → sRGB (0-255) */
export function labToSrgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const x = labF3(a / 500 + fy) * XN;
  const y = labF3(fy) * YN;
  const z = labF3(fy - b / 200) * ZN;
  return [
    linearToSrgb(x *  3.2404542 + y * -1.5371385 + z * -0.4985314),
    linearToSrgb(x * -0.9692660 + y *  1.8760108 + z *  0.0415560),
    linearToSrgb(x *  0.0556434 + y * -0.2040259 + z *  1.0572252),
  ];
}
