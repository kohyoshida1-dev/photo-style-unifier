import { useRef, useEffect, useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { HsvLut } from '../types';

// ── Lab → sRGB ───────────────────────────────────────────────────────────────
function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const f2 = (f: number) => f ** 3 > 0.008856 ? f ** 3 : (f - 16 / 116) / 7.787;
  const x = f2(fx) * 0.95047, y = f2(fy), z = f2(fz) * 1.08883;
  const rL =  x * 3.2406 + y * -1.5372 + z * -0.4986;
  const gL = -x * 0.9689 + y *  1.8758 + z *  0.0415;
  const bL =  x * 0.0557 + y * -0.2040 + z *  1.0570;
  const gam = (v: number) =>
    v > 0.0031308 ? 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055 : 12.92 * v;
  return [
    Math.max(0, Math.min(1, gam(rL))),
    Math.max(0, Math.min(1, gam(gL))),
    Math.max(0, Math.min(1, gam(bL))),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function rgbNormToHex(r: number, g: number, b: number): string {
  return rgbToHex(r * 255, g * 255, b * 255);
}

// ── 3D Projection ─────────────────────────────────────────────────────────────
//
// World coordinate system (darkroom developing tray viewed from front-above):
//   wx ∈ [-W3D/2, +W3D/2]  saturation  (Fade=left,  Vivid=right)
//   wy ∈ [-D3D/2, +D3D/2]  brightness  (Dark=front/bottom, Bright=back/top)
//   wz ∈ [0, H3D]          clarity     (Soft=floor=0, Clear=lifted=H3D)
//
// Visual result:
//   BRIGHT appears at the TOP   (back of tray, perspective recedes upward)
//   DARK   appears at the BOTTOM (front of tray)
//   SOFT   is on the LEFT  (low saturation)
//   VIVID  is on the RIGHT (high saturation)
//   CLEAR  particles float HIGH above floor
//   FADE   particles sit ON the floor
//
const W3D  = 1.28;  // horizontal extent (saturation) — wider for better proportion
const D3D  = 1.34;  // depth extent (brightness)
const H3D  = 0.50;  // height extent (clarity)
const TILT = 26 * Math.PI / 180;
const COS_T = Math.cos(TILT);
const SIN_T = Math.sin(TILT);
const PERSP = 0.18; // perspective shrink: back face is 18% narrower than front

function makeProjector(PX: number, VIEW_CX: number, VIEW_CY: number) {
  return (wx: number, wy: number, wz: number): [number, number] => {
    const yn = wy / D3D + 0.5;       // 0 = front(dark), 1 = back(bright)
    const xShrink = 1 - PERSP * yn;
    const sx = VIEW_CX + wx * xShrink * PX;
    const sy = VIEW_CY + (-wy * COS_T - wz * SIN_T * 1.55) * PX;
    return [sx, sy];
  };
}

// ── Photo pixel sampling ──────────────────────────────────────────────────────
function sobelEdge(data: Uint8ClampedArray, W: number, H: number, px: number, py: number): number {
  const lum = (x: number, y: number) => {
    x = Math.max(0, Math.min(W - 1, x));
    y = Math.max(0, Math.min(H - 1, y));
    const i = (y * W + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  const tl = lum(px-1,py-1), t = lum(px,py-1), tr = lum(px+1,py-1);
  const l  = lum(px-1,py  ),                    r  = lum(px+1,py  );
  const bl = lum(px-1,py+1), b = lum(px,py+1), br = lum(px+1,py+1);
  const gx = (tr + 2*r + br) - (tl + 2*l + bl);
  const gy = (bl + 2*b + br) - (tl + 2*t + tr);
  return Math.min(1, Math.sqrt(gx*gx + gy*gy) / 255);
}

async function samplePhoto(
  url: string,
  n: number,
): Promise<Array<{ r: number; g: number; b: number; edge: number }>> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const W = 90, H = 90;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0, W, H);
      let data: Uint8ClampedArray;
      try { data = ctx.getImageData(0, 0, W, H).data; }
      catch (_) { resolve([]); return; }
      const out: Array<{ r: number; g: number; b: number; edge: number }> = [];
      for (let i = 0; i < n; i++) {
        const px = 2 + Math.floor(Math.random() * (W - 4));
        const py = 2 + Math.floor(Math.random() * (H - 4));
        const idx = (py * W + px) * 4;
        out.push({
          r: data[idx], g: data[idx + 1], b: data[idx + 2],
          edge: sobelEdge(data, W, H, px, py),
        });
      }
      resolve(out);
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}

function rgbToSV(r: number, g: number, b: number): { s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return { s: max === 0 ? 0 : (max - min) / max, v: max };
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Particle {
  wx: number; wy: number; wz: number;
  color: string;
  size: number;
}

interface ProjectedParticle extends Particle {
  sx: number; sy: number;
  fx: number; fy: number;
  depthKey: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface ColorCloud3DProps {
  hsvLut: HsvLut;
  softnessDepth: number;
  grainIntensity: number;
  samplePreviews?: string[];
}

export function ColorCloud3D({
  hsvLut,
  softnessDepth,
  grainIntensity,
  samplePreviews,
}: ColorCloud3DProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [svgW, setSvgW] = useState(320);
  const [pixelParticles, setPixelParticles] = useState<Particle[] | null>(null);
  const [animKey, setAnimKey] = useState(0); // bump to re-trigger animation

  // ── Responsive width ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setSvgW(Math.floor(w));
    });
    ro.observe(el);
    const w = el.getBoundingClientRect().width;
    if (w > 0) setSvgW(Math.floor(w));
    return () => ro.disconnect();
  }, []);

  // ── Photo pixel sampling ──────────────────────────────────────────────────
  useEffect(() => {
    if (!samplePreviews?.length) {
      setPixelParticles(null);
      return;
    }
    let alive = true;
    // Sample more densely: 150+ pixels per photo so even clustered colours form visible clouds
    const perPhoto = Math.max(150, Math.floor(800 / Math.min(samplePreviews.length, 8)));
    Promise.all(
      samplePreviews.slice(0, 8).map(url => samplePhoto(url, perPhoto)),
    ).then(all => {
      if (!alive) return;
      const MARGIN = 0.88;
      // Jitter: wide enough that same-colour pixels from 1 photo form visible clouds.
      // ±0.24 > bin-spacing/2 so adjacent colour groups merge organically.
      const jitter = () => (Math.random() - 0.5) * 0.48;
      const ps: Particle[] = all.flat().map(s => {
        const { s: sat, v } = rgbToSV(s.r, s.g, s.b);
        const importance = 0.45 + sat * 0.45;
        // Larger base size so sparse clusters are still readable
        const size = 5.0 + importance * 7.0;
        // Sharp edge → Clear (high wz = lifted), flat → Soft (low wz = floor)
        const clarity = Math.max(0.05, Math.min(0.96,
          s.edge * 0.82 + 0.10 + (Math.random() - 0.5) * 0.10,
        ));
        return {
          wx: Math.max(-W3D / 2 * MARGIN, Math.min(W3D / 2 * MARGIN,
            (sat - 0.5) * W3D * 0.90 + jitter())),
          wy: Math.max(-D3D / 2 * MARGIN, Math.min(D3D / 2 * MARGIN,
            (v   - 0.5) * D3D * 0.86 + jitter())),
          wz: Math.max(0, Math.min(H3D * MARGIN,
            clarity * H3D + (Math.random() - 0.5) * 0.08)),
          color: rgbToHex(s.r, s.g, s.b),
          size,
        };
      });
      setPixelParticles(ps);
      setAnimKey(k => k + 1);
    });
    return () => { alive = false; };
  }, [(samplePreviews ?? []).join('|')]);

  // ── HsvLut fallback particles ─────────────────────────────────────────────
  const lutParticles = useMemo<Particle[]>(() => {
    if (!hsvLut?.cells?.length) return [];
    const N = Math.max(2, hsvLut.size ?? 5);
    const minCoverage = 0.002;
    const filtered = hsvLut.cells
      .map((c, i) => ({ cell: c, idx: i }))
      .filter(({ cell }) => (cell.coverage ?? 0) >= minCoverage);
    const cells = (filtered.length > 0
      ? filtered
      : hsvLut.cells.map((c, i) => ({ cell: c, idx: i }))
    ).sort((a, b) => (a.cell.coverage ?? 0) - (b.cell.coverage ?? 0));

    // LUT has N=5 bins spaced 0.25 world-units apart (wx) / 0.335 (wy).
    // To visually dissolve the grid, scatter must cover ≥ bin-spacing.
    // Use uniform random (flat distribution) so particles fill *between* bins evenly.
    // scatter = ±half-range of the uniform draw; 0.22 > bin-spacing/2 (0.125) → full mixing.
    const scatter = 0.22 + softnessDepth * 0.06;   // ±0.22 .. ±0.28
    const u = () => (Math.random() - 0.5) * 2;     // uniform [-1, 1]
    const MARGIN = 0.88;

    const ps: Particle[] = [];
    cells.forEach(({ cell, idx }) => {
      const sBin  = Math.floor((idx % (N * N)) / N);
      const vBin  = idx % N;
      const sNorm = sBin / (N - 1);
      const vNorm = vBin / (N - 1);
      const tNorm = cell.temporalWeight ?? 0.45;  // 0=Clear, 1=Soft

      const L = 10 + vNorm * 82;
      const aMean = isFinite(cell.aMean) ? cell.aMean : 0;
      const bMean = isFinite(cell.bMean) ? cell.bMean : 0;
      const chromaScale = 2.0 * (0.38 + sNorm * 0.92);
      const [r, g, b] = labToRgb(L, aMean * chromaScale, bMean * chromaScale);
      const color = rgbNormToHex(r, g, b);
      const numPts = Math.min(80, Math.max(3, Math.round((cell.coverage ?? 0) * 600)));
      const size = 5.0 + (0.45 + sNorm * 0.45) * 7.0 + grainIntensity * 2;

      for (let i = 0; i < numPts; i++) {
        ps.push({
          wx: Math.max(-W3D / 2 * MARGIN, Math.min(W3D / 2 * MARGIN,
            (sNorm - 0.5) * W3D + u() * scatter)),
          wy: Math.max(-D3D / 2 * MARGIN, Math.min(D3D / 2 * MARGIN,
            (vNorm - 0.5) * D3D + u() * scatter)),
          wz: Math.max(0, Math.min(H3D * MARGIN,
            (1 - tNorm) * H3D + u() * scatter * 0.5)),
          color,
          size,
        });
      }
    });
    return ps;
  }, [hsvLut, softnessDepth, grainIntensity]);

  const particles = pixelParticles ?? lutParticles;

  // ── Projection parameters ─────────────────────────────────────────────────
  const svgH     = Math.round(svgW * 1.15);
  const PX       = svgW * 0.565;  // scaled down to fit wider W3D=1.28 within canvas
  const VIEW_CX  = svgW / 2;
  const VIEW_CY  = svgH / 2 + H3D / 2 * SIN_T * 1.55 * PX;

  // ── Box corners ───────────────────────────────────────────────────────────
  const project = makeProjector(PX, VIEW_CX, VIEW_CY);
  const corner  = (xb: number, yb: number, zb: number) =>
    project(xb * W3D / 2, yb * D3D / 2, zb * H3D);
  const poly    = (...pts: [number, number][]) => pts.map(p => p.join(',')).join(' ');

  const FBL = corner(-1, -1, 0), FBR = corner(+1, -1, 0);
  const BBL = corner(-1, +1, 0), BBR = corner(+1, +1, 0);
  const FTL = corner(-1, -1, 1), FTR = corner(+1, -1, 1);
  const BTL = corner(-1, +1, 1), BTR = corner(+1, +1, 1);

  // ── Projected + sorted particles ──────────────────────────────────────────
  const projected = useMemo<ProjectedParticle[]>(() => {
    const proj = makeProjector(PX, VIEW_CX, VIEW_CY);
    return particles.map(p => {
      const [sx, sy] = proj(p.wx, p.wy, p.wz);
      const [fx, fy] = proj(p.wx, p.wy, 0);
      return { ...p, sx, sy, fx, fy, depthKey: -p.wy * COS_T + p.wz * SIN_T * 0.4 };
    }).sort((a, b) => a.depthKey - b.depthKey);
  }, [particles, PX, VIEW_CX, VIEW_CY]);

  // ── Font size (scales with SVG width, capped) ─────────────────────────────
  const labelFz = Math.max(8, Math.min(11, svgW * 0.028));

  const monoStyle: CSSProperties = {
    fontFamily: 'ui-monospace, Menlo, "SF Mono", monospace',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'rgba(212,165,116,0.65)',
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%',
        background: 'radial-gradient(ellipse at 50% 42%, rgba(180,138,80,0.06), rgba(200,180,140,0.012) 44%, transparent 72%)',
        borderRadius: 10,
        overflow: 'visible',
      }}
    >
      {/* keyframes injected once */}
      <style>{`
        @keyframes cfDevelop {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1);   }
        }
        .cf-particle {
          opacity: 0;
          animation: cfDevelop 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>

      {/* ── 3-col × 3-row axis label grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr 36px',
        gridTemplateRows: '10px 1fr 10px',
        width: '100%',
      }}>
        {/* ↑ BRIGHT */}
        <div style={{ gridColumn: 2, gridRow: 1, paddingBottom: 2, ...monoStyle }}>
          ↑ BRIGHT
        </div>

        {/* SOFT ← — left horizontal */}
        <div style={{ gridColumn: 1, gridRow: 2, paddingRight: 4, flexDirection: 'column', gap: 1, ...monoStyle }}>
          <span>SOFT</span>
          <span>←</span>
        </div>

        {/* ── SVG Field ── */}
        <div style={{ gridColumn: 2, gridRow: 2, position: 'relative', aspectRatio: '20/23', width: '100%' }}>
          <svg
            key={animKey}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              {/* 4-level blur for depth */}
              <filter id="cfB0" x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur stdDeviation="3.2" />
              </filter>
              <filter id="cfB1" x="-55%" y="-55%" width="210%" height="210%">
                <feGaussianBlur stdDeviation="1.7" />
              </filter>
              <filter id="cfB2" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="0.55" />
              </filter>
              <filter id="cfB3" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="0.18" />
              </filter>
              <filter id="cfBshadow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.2" />
              </filter>

              {/* Floor: warm amber-dark — distinct from app bg, coheres with wall lines */}
              <radialGradient id="cfFloor" cx="50%" cy="50%" r="72%">
                <stop offset="0%"   stopColor="rgba(52,34,14,0.96)" />
                <stop offset="55%"  stopColor="rgba(34,20,7,0.97)" />
                <stop offset="100%" stopColor="rgba(14,8,2,0.98)" />
              </radialGradient>

              {/* Back wall: amber glow fading downward */}
              <linearGradient id="cfBackWall" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%"   stopColor="rgba(212,165,116,0.10)" />
                <stop offset="100%" stopColor="rgba(212,165,116,0.02)" />
              </linearGradient>

              {/* Box silhouette mask — <mask> contains filter/blur output unlike <clipPath> */}
              <mask id="cfBoxMask">
                <polygon points={poly(FBL, FBR, FTR, BTR, BTL, FTL)} fill="white" />
              </mask>
            </defs>

            {/* ── Walls (drawn first, behind particles) ── */}
            {/* Back wall */}
            <polygon
              points={poly(BBL, BBR, BTR, BTL)}
              fill="url(#cfBackWall)"
              stroke="rgba(212,165,116,0.34)"
              strokeWidth="0.9"
            />
            {/* Left side wall */}
            <polygon
              points={poly(FBL, BBL, BTL, FTL)}
              fill="rgba(0,0,0,0.38)"
              stroke="rgba(212,165,116,0.18)"
              strokeWidth="0.6"
            />
            {/* Right side wall */}
            <polygon
              points={poly(FBR, BBR, BTR, FTR)}
              fill="rgba(0,0,0,0.30)"
              stroke="rgba(212,165,116,0.18)"
              strokeWidth="0.6"
            />

            {/* ── Floor (developer surface) ── */}
            <polygon
              points={poly(FBL, FBR, BBR, BBL)}
              fill="url(#cfFloor)"
              stroke="rgba(212,165,116,0.34)"
              strokeWidth="0.9"
            />

            {/* Floor grid — subtle depth cue */}
            {[0.25, 0.5, 0.75].map(t => {
              const a = project(-W3D / 2, (t - 0.5) * D3D, 0);
              const b = project( W3D / 2, (t - 0.5) * D3D, 0);
              return <line key={`fy${t}`}
                x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                stroke="rgba(212,165,116,0.10)" strokeWidth="0.5" strokeDasharray="2 3" />;
            })}
            {[0.25, 0.5, 0.75].map(t => {
              const a = project((t - 0.5) * W3D, -D3D / 2, 0);
              const b = project((t - 0.5) * W3D,  D3D / 2, 0);
              return <line key={`fx${t}`}
                x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                stroke="rgba(212,165,116,0.10)" strokeWidth="0.5" strokeDasharray="2 3" />;
            })}

            {/* Back corner pillars (full height, visible above floor) */}
            <line x1={BBL[0]} y1={BBL[1]} x2={BTL[0]} y2={BTL[1]}
              stroke="rgba(212,165,116,0.40)" strokeWidth="0.9" />
            <line x1={BBR[0]} y1={BBR[1]} x2={BTR[0]} y2={BTR[1]}
              stroke="rgba(212,165,116,0.40)" strokeWidth="0.9" />

            {/* ── Particles (depth-sorted, back→front) ── */}
            <g mask="url(#cfBoxMask)">
            {projected.map((p, i) => {
              const z = Math.max(0, Math.min(1, p.wz / H3D));
              const filterId = z < 0.20 ? 'cfB0'
                             : z < 0.45 ? 'cfB1'
                             : z < 0.72 ? 'cfB2'
                             : 'cfB3';
              const opacity = 0.38 + z * 0.57;
              const radius  = p.size * (0.48 + z * 0.62);
              const shadowOp = 0.12 + z * 0.30;
              // Rear particles develop first (they emerge from deep in the liquid)
              const delay = (1 - z) * 380 + (i % 9) * 12;

              return (
                <g key={i} className="cf-particle" style={{ animationDelay: `${delay}ms` }}>
                  {/* Floor shadow — ellipse directly below lifted particle */}
                  <ellipse
                    cx={p.fx} cy={p.fy + 1}
                    rx={radius * (0.55 + z * 0.35)}
                    ry={radius * 0.20}
                    fill="#000"
                    opacity={shadowOp}
                    filter="url(#cfBshadow)"
                  />
                  {/* Particle */}
                  <circle
                    cx={p.sx} cy={p.sy}
                    r={radius}
                    fill={p.color}
                    opacity={opacity}
                    filter={`url(#${filterId})`}
                  />
                </g>
              );
            })}
            </g>

            {/* ── Front-facing silhouette edges (drawn on top of particles) ── */}
            <g fill="none" strokeLinecap="round">
              {/* Front bottom edge (closest to viewer, brightest) */}
              <line x1={FBL[0]} y1={FBL[1]} x2={FBR[0]} y2={FBR[1]}
                stroke="rgba(212,165,116,0.68)" strokeWidth="1.4" />
              {/* Back top edge */}
              <line x1={BTL[0]} y1={BTL[1]} x2={BTR[0]} y2={BTR[1]}
                stroke="rgba(212,165,116,0.44)" strokeWidth="1.0" />
              {/* Front top edge (open-top rim) */}
              <line x1={FTL[0]} y1={FTL[1]} x2={FTR[0]} y2={FTR[1]}
                stroke="rgba(212,165,116,0.50)" strokeWidth="1.0" />
              {/* Front pillars */}
              <line x1={FBL[0]} y1={FBL[1]} x2={FTL[0]} y2={FTL[1]}
                stroke="rgba(212,165,116,0.50)" strokeWidth="1.0" />
              <line x1={FBR[0]} y1={FBR[1]} x2={FTR[0]} y2={FTR[1]}
                stroke="rgba(212,165,116,0.50)" strokeWidth="1.0" />
              {/* Back bottom edge (faint, behind) */}
              <line x1={BBL[0]} y1={BBL[1]} x2={BBR[0]} y2={BBR[1]}
                stroke="rgba(212,165,116,0.24)" strokeWidth="0.7" />
              {/* Top depth rails (dashed) */}
              <line x1={FTL[0]} y1={FTL[1]} x2={BTL[0]} y2={BTL[1]}
                stroke="rgba(212,165,116,0.32)" strokeWidth="0.7" strokeDasharray="2 3" />
              <line x1={FTR[0]} y1={FTR[1]} x2={BTR[0]} y2={BTR[1]}
                stroke="rgba(212,165,116,0.32)" strokeWidth="0.7" strokeDasharray="2 3" />
            </g>

            {/* ── Z-axis labels: CLEAR (top-front) / FADE (bottom-front) ── */}
            <g
              fontFamily='ui-monospace, Menlo, "SF Mono", monospace'
              fontSize={labelFz}
              letterSpacing="0.18em"
              fill="rgba(212,165,116,0.76)"
            >
              <text x={(FTL[0] + FTR[0]) / 2} y={FTL[1] - 7} textAnchor="middle">CLEAR</text>
              <text x={(FBL[0] + FBR[0]) / 2} y={FBL[1] + 14} textAnchor="middle">FADE</text>
            </g>
          </svg>
        </div>

        {/* VIVID → — right horizontal */}
        <div style={{ gridColumn: 3, gridRow: 2, paddingLeft: 4, flexDirection: 'column', gap: 1, ...monoStyle }}>
          <span>VIVID</span>
          <span>→</span>
        </div>

        {/* DARK ↓ */}
        <div style={{ gridColumn: 2, gridRow: 3, paddingTop: 2, ...monoStyle }}>
          DARK ↓
        </div>
      </div>
    </div>
  );
}
