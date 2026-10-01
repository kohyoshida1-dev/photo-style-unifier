import type { ColorStyle, StyleSignature } from '../types';
import { decodeFile } from './image';
import { computeStyleSignature, averageStyleSignatures } from './styleSignature';
import { extractColorParameters, extractColorPalette } from './parameterExtractor';

/** 複数のお手本写真からコンセンサス・スタイルを抽出する */
export async function analyzeSamples(
  files: Blob[],
  onProgress?: (done: number, total: number) => void,
): Promise<ColorStyle> {
  const sigs: StyleSignature[] = [];
  let first: ImageBitmap | null = null;

  for (let i = 0; i < files.length; i++) {
    const bmp = await decodeFile(files[i]);
    sigs.push(await computeStyleSignature(bmp));
    if (i === 0) first = bmp;
    else bmp.close();
    onProgress?.(i + 1, files.length);
  }

  const parameters = await extractColorParameters(first!);
  const palette = await extractColorPalette(first!);
  first!.close();

  const n = files.length;
  return {
    id: crypto.randomUUID(),
    name: n === 1 ? 'Style from 1 sample' : `Consensus style (${n} samples)`,
    sourceImageId: '',
    parameters,
    styleSignature: averageStyleSignatures(sigs),
    palette,
    createdAt: new Date().toISOString(),
  };
}
