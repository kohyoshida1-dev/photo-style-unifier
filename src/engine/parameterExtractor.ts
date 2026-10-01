import { bitmapToRaw } from './image';
import type { ColorParameters, ColorPalette } from '../types';

interface ChannelStats {
  mean: number;
  std: number;
  p10: number;
  p90: number;
}

function computeStats(values: number[]): ChannelStats {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  return { mean, std, p10, p90 };
}

export async function extractColorParameters(bmp: ImageBitmap): Promise<ColorParameters> {
  const info = bitmapToRaw(bmp, 256);
  const data = info.data;

  const channels = info.channels;
  const pixelCount = info.width * info.height;

  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];

  for (let i = 0; i < pixelCount; i++) {
    r.push(data[i * channels]);
    g.push(data[i * channels + 1]);
    b.push(data[i * channels + 2]);
  }

  const rs = computeStats(r);
  const gs = computeStats(g);
  const bs = computeStats(b);

  // 色温度: R/B比率から推定 (高いほどwarm)
  const rbRatio = rs.mean / (bs.mean + 1);
  const colorTemperature = Math.round(3000 + (rbRatio > 1 ? 0 : (1 - rbRatio) * 5000));

  // 彩度: RGB間の標準偏差の平均
  const avgChannelMean = (rs.mean + gs.mean + bs.mean) / 3;
  const channelVariance = ((rs.mean - avgChannelMean) ** 2 + (gs.mean - avgChannelMean) ** 2 + (bs.mean - avgChannelMean) ** 2) / 3;
  const saturation = Math.min(2.0, 0.5 + Math.sqrt(channelVariance) / 64);

  // 明るさ: 相対輝度 (0.299R + 0.587G + 0.114B)
  const luminance = 0.299 * rs.mean + 0.587 * gs.mean + 0.114 * bs.mean;
  const brightness = luminance / 128;

  // コントラスト: 輝度の範囲 (p90 - p10)
  const lumSeries = r.map((rv, i) => 0.299 * rv + 0.587 * g[i] + 0.114 * b[i]);
  const lumStats = computeStats(lumSeries);
  const contrast = Math.min(2.0, (lumStats.p90 - lumStats.p10) / 128);

  // ハイライト: 高輝度ピクセルの平均からの偏り
  const highlights = (lumStats.p90 - 200) / 55;

  // シャドウ: 低輝度ピクセルの平均からの偏り
  const shadows = (55 - lumStats.p10) / 55;

  // ビブランス: 彩度に近い指標
  const vibrance = saturation;

  return {
    colorTemperature: Math.max(3000, Math.min(8000, colorTemperature)),
    saturation: Math.max(0, Math.min(2, saturation)),
    brightness: Math.max(0.1, Math.min(2, brightness)),
    contrast: Math.max(0.1, Math.min(2, contrast)),
    highlights: Math.max(-1, Math.min(1, highlights)),
    shadows: Math.max(-1, Math.min(1, shadows)),
    vibrance: Math.max(0, Math.min(2, vibrance)),
  };
}

export async function extractColorPalette(bmp: ImageBitmap): Promise<ColorPalette> {
  const info = bitmapToRaw(bmp, 128);
  const data = info.data;

  const channels = info.channels;
  const pixelCount = info.width * info.height;

  // k-meansで主要色を抽出 (k=6, シンプルな実装)
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < pixelCount; i++) {
    pixels.push([data[i * channels], data[i * channels + 1], data[i * channels + 2]]);
  }

  const dominantColors = extractDominantColors(pixels, 6);
  const avgR = pixels.reduce((s, p) => s + p[0], 0) / pixelCount;
  const avgG = pixels.reduce((s, p) => s + p[1], 0) / pixelCount;
  const avgB = pixels.reduce((s, p) => s + p[2], 0) / pixelCount;

  const averageColor = rgbToHex(Math.round(avgR), Math.round(avgG), Math.round(avgB));

  // ムード判定: R/B比率
  const mood: 'warm' | 'cool' | 'neutral' =
    avgR > avgB * 1.1 ? 'warm' : avgB > avgR * 1.1 ? 'cool' : 'neutral';

  return { dominantColors, averageColor, mood };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function extractDominantColors(pixels: [number, number, number][], k: number): string[] {
  // 量子化: ダウンサンプルして代表色をピックアップ
  const step = Math.max(1, Math.floor(pixels.length / 1000));
  const sampled = pixels.filter((_, i) => i % step === 0);

  // 初期重心: 等間隔にサンプルから選ぶ
  let centroids: [number, number, number][] = Array.from({ length: k }, (_, i) =>
    sampled[Math.floor((i * sampled.length) / k)]
  );

  for (let iter = 0; iter < 10; iter++) {
    const clusters: [number, number, number][][] = Array.from({ length: k }, () => []);

    for (const pixel of sampled) {
      let minDist = Infinity;
      let closest = 0;
      centroids.forEach((c, idx) => {
        const d = colorDistance(pixel, c);
        if (d < minDist) { minDist = d; closest = idx; }
      });
      clusters[closest].push(pixel);
    }

    centroids = clusters.map(cluster => {
      if (cluster.length === 0) return centroids[0];
      const sum = cluster.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]] as [number, number, number], [0, 0, 0] as [number, number, number]);
      return [sum[0] / cluster.length, sum[1] / cluster.length, sum[2] / cluster.length] as [number, number, number];
    });
  }

  return centroids.map(c => rgbToHex(Math.round(c[0]), Math.round(c[1]), Math.round(c[2])));
}
