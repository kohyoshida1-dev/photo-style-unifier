import type {
  ColorStyle, StyleSignature, ColorPalette,
} from '../types';
import { ColorCloud3D } from './ColorCloud3D';

// ── Lab → sRGB hex ──────────────────────────────────────────────────────────
function labToHex(L: number, a: number, b: number): string {
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const d = 6 / 29;
  const f3 = (t: number) => t > d ? t ** 3 : 3 * d * d * (t - 4 / 29);
  const X = f3(fx) * 0.95047, Y = f3(fy), Z = f3(fz) * 1.08883;
  const lr =  3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const lg = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
  const lb =  0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  const s = (c: number) => {
    const cl = Math.max(0, Math.min(1, c));
    return Math.round((cl <= 0.0031308 ? 12.92 * cl : 1.055 * cl ** (1 / 2.4) - 0.055) * 255);
  };
  const [r, g, bv] = [s(lr), s(lg), s(lb)];
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ATMOSPHERE BAR
//    Shadow → Midtone → Highlight の実測色グラデーション
//    「このスタイルを当てると、影がこの色、ハイライトがこの色になる」を即座に伝える
// ─────────────────────────────────────────────────────────────────────────────
function AtmosphereBar({ sig }: { sig: StyleSignature }) {
  const sHex = labToHex(20, sig.shadows.aMean,    sig.shadows.bMean);
  const mHex = labToHex(52, sig.midtones.aMean,   sig.midtones.bMean);
  const hHex = labToHex(82, sig.highlights.aMean, sig.highlights.bMean);

  const cast = (z: { aMean: number; bMean: number }) => {
    const w = z.aMean + z.bMean * 0.5;
    return w > 5 ? 'warm' : w < -5 ? 'cool' : 'neutral';
  };

  const zones = [
    { label: 'Shadows',    hex: sHex, zone: sig.shadows },
    { label: 'Midtones',   hex: mHex, zone: sig.midtones },
    { label: 'Highlights', hex: hHex, zone: sig.highlights },
  ];

  return (
    <div className="space-y-2.5">
      {/* Gradient strip */}
      <div
        className="h-14 rounded-xl"
        style={{
          background: `linear-gradient(to right, ${sHex} 0%, ${mHex} 50%, ${hHex} 100%)`,
        }}
      />
      {/* Zone labels */}
      <div className="grid grid-cols-3 gap-3 px-0.5">
        {zones.map(({ label, hex, zone }, i) => (
          <div
            key={label}
            className={`flex items-center gap-1.5 min-w-0 ${i === 2 ? 'justify-end text-right' : i === 1 ? 'justify-center text-center' : ''}`}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: hex, outline: '1px solid rgba(255,255,255,0.15)' }}
            />
            <div className="min-w-0">
              <p className="text-[10px] leading-none truncate" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-[9px] leading-none mt-0.5" style={{ color: 'var(--text-subtle)' }}>{cast(zone)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HUE ROSE
//    Lab 色相 12 方向の彩度強度を花弁チャートで表示
//    「この写真家がどの色を強調しているか」を視覚化
// ─────────────────────────────────────────────────────────────────────────────

// Lab atan2(b,a) 方向 → 近似 HSL 色相（視覚的マッピング）

// ─────────────────────────────────────────────────────────────────────────────
// 3. VIBE
//    写真の雰囲気を一文で描写 + 最小限のタグ
// ─────────────────────────────────────────────────────────────────────────────
function Vibe({ sig, palette }: { sig: StyleSignature; palette: ColorPalette }) {
  const { lchMetrics: lch, toneCurve: tone, consensusStrength: cs } = sig;

  const isShadow = tone?.emphasis === 'shadows';
  const isHigh   = tone?.emphasis === 'highlights';
  const isWarm   = palette.mood === 'warm';
  const isCool   = palette.mood === 'cool';
  const isMuted  = lch && lch.cMean < 18;
  const isVivid  = lch && lch.cMean > 44;
  const isLeiter = lch && lch.lcCorrelation < -0.3;

  const sentence = (() => {
    // ── Leiter (L-C逆転: 光の中で色が引いていく) ─────────────────
    if (isLeiter && isShadow && isWarm)
      return 'Pushed Portra in golden light — shadows held, highlights kissed back.';
    if (isLeiter && isCool)
      return 'A window covered with raindrops — soft rolloff, quiet palette. Leiter\'s overlooked light.';
    if (isLeiter && isHigh)
      return 'Bright but restrained — Leiter\'s search for beauty in the most prosaic places, where light gives back more than it takes.';
    if (isLeiter)
      return 'Beauty in the overlooked ordinary — Leiter\'s gift: prosaic light made singular.';

    // ── Shadow ────────────────────────────────────────────────────
    if (isShadow && isVivid)
      // Velvia の本来の特性: シャドウ重視 + 高彩度 (富士フィルム技師指摘)
      return 'Shadow-deep and saturated — Velvia\'s true character. Colour deepens where light gives way, vivid beneath a heavy sky.';
    if (isShadow && isWarm)
      return 'Exposed for the shadows, warm cast — the feeling of backlit afternoons.';
    if (isShadow && isCool)
      return 'Shadow-weighted and cool — looking is so difficult, Cartier-Bresson said. This is a photograph of someone who looked.';
    if (isShadow)
      return 'It is important to see what is invisible to others — perhaps the look of hope or the look of sadness.';

    // ── Highlights ────────────────────────────────────────────────
    if (isHigh && isVivid)
      // isHigh + isVivid は Velvia ではなく Ektachrome 的 (富士フィルム技師指摘)
      return 'Bright and fully charged — colour held without shadow depth, like Ektachrome in summer sun.';
    if (isHigh && isWarm)
      return 'High key and warm — where the moment becomes opinion in golden light. After Avedon.';
    if (isHigh && isCool)
      return 'High key, cool and stark — a series of no\'s: no exquisite light, no seduction. Just the person and what happens.';
    if (isHigh && isMuted)
      return 'High key and washed out — pale, considered, the restraint of choosing what not to say.';
    if (isHigh)
      return 'High key — all photographs are accurate. None of them is truth. Clean light, open ground.';

    // ── Muted ─────────────────────────────────────────────────────
    if (isMuted && isCool)
      return 'I don\'t want anyone to appreciate the light or the palette of tones — grey witness, testimony over beauty.';
    if (isMuted && isWarm)
      return 'Warm and muted — a belief in simple things and the beauty of simple things, unhurried.';
    if (isMuted)
      return 'Muted and even — the restraint of a deliberate, film-like palette, a quiet search.';

    // ── Vivid ─────────────────────────────────────────────────────
    if (isVivid && isWarm)
      return 'Rich, warm, and saturated — golden hour carried through the whole frame.';
    if (isVivid && isCool)
      // Frank はほぼ B&W 写真家のため isVivid + isCool への引用は不適切 (Steidl指摘)
      return 'Vivid and cool — saturated jewel tones in clear light, the chromatic boldness of a clear day.';
    if (isVivid)
      // Leiter が言っていない言葉を削除 (Leiter本人指摘)
      return 'Fully saturated — colour charged throughout, nothing withheld, nothing understated.';

    // ── Default ───────────────────────────────────────────────────
    return 'There is one thing the photograph must contain — the humanity of the moment, held in natural light.';
  })();

  const tags: string[] = [];
  if (palette.mood !== 'neutral') tags.push(palette.mood === 'warm' ? 'Warm' : 'Cool');
  if (lch) {
    if (lch.cMean < 18) tags.push('Muted');
    else if (lch.cMean > 44) tags.push('Vivid');
    if (isLeiter) tags.push('Soft rolloff');
  }
  if (isHigh && !isVivid) tags.push('High key');
  if (isShadow && isVivid) tags.push('Deep shadow');

  const consistency = cs
    ? cs.toneEmphasisAgreement > 0.75 ? 'consistent'
      : cs.toneEmphasisAgreement > 0.5  ? 'moderate'
      : 'varied'
    : null;

  return (
    <div className="space-y-2.5">
      <p className="serif italic text-[13px] leading-relaxed" style={{ color: 'var(--text)' }}>
        "{sentence}"
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            className="mono text-[9px] px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-subtle)',
            }}
          >
            {tag}
          </span>
        ))}
        {cs && (
          <span className="mono text-[9px]" style={{ color: 'var(--text-subtle)' }}>
            {cs.sampleCount} photos{consistency ? ` · ${consistency}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE CARD — メインコンポーネント
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  style: ColorStyle;
  selected?: boolean;
  samplePreviews?: string[];
}

export function StyleCard({ style, selected = false, samplePreviews }: Props) {
  const { palette } = style;
  const sig: StyleSignature | undefined = style.styleSignature;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        ...(selected ? { boxShadow: '0 0 0 2px var(--accent)' } : {}),
      }}
    >
      {/* サンプル写真ストリップ */}
      {samplePreviews && samplePreviews.length > 0 && (
        samplePreviews.length === 1 ? (
          <div className="p-1.5" style={{ background: 'var(--bg3)' }}>
            <div className="w-full overflow-hidden rounded" style={{ aspectRatio: '3/2' }}>
              <img src={samplePreviews[0]} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        ) : (
          <div className="flex gap-0.5 p-1.5" style={{ background: 'var(--bg3)' }}>
            {samplePreviews.slice(0, 8).map((url, i) => (
              <div
                key={i}
                className="flex-1 rounded overflow-hidden flex items-center justify-center"
                style={{ minWidth: 0, height: 80, background: 'var(--bg)' }}
              >
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
        )
      )}

      <div className="p-4 space-y-5">
        {/* Style name */}
        <p
          className="truncate"
          style={{
            fontFamily: 'Lora, Georgia, serif',
            fontSize: '1rem',
            fontWeight: 400,
            color: 'var(--text)',
          }}
        >
          {style.name}
        </p>

        {sig ? (
          <>
            {/* ① Atmosphere gradient */}
            <AtmosphereBar sig={sig} />

            {/* ② Vibe sentence */}
            <Vibe sig={sig} palette={palette} />

            {/* ③④ Color Cloud 3D — 色・粒子感・ボケ・時間 を1つの3D点群で表現 */}
            {sig.hsvLut && (
              <ColorCloud3D
                hsvLut={sig.hsvLut}
                softnessDepth={sig.softnessMetrics?.meanSoftnessDepth ?? 0}
                grainIntensity={sig.temporalMetrics?.grainIntensity ?? 0}
              />
            )}
          </>
        ) : (
          /* Fallback: styleSignature なし */
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Temp <span style={{ color: 'var(--text)' }}>{style.parameters.colorTemperature}K</span></span>
            <span>Sat <span style={{ color: 'var(--text)' }}>{(style.parameters.saturation * 100).toFixed(0)}%</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
