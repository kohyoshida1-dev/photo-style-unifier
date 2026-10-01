import { useMemo, useId } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// ParticleField — decorative colour-particle background for the landing page.
// Same rendering technique as ColorCloud3D: SVG circles with Gaussian blur
// filters to create bokeh depth, and the cfDevelop animation.
//
// No external data needed — particles are generated from a photographic
// colour palette and scattered pseudo-randomly using a seeded PRNG.
// ─────────────────────────────────────────────────────────────────────────────

// Seeded LCG so the scatter is deterministic (no flash on re-render)
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223 >>> 0;
    return s / 0xffffffff;
  };
}

// Photographic colour palette — warm golds, soft oranges, cool blues, neutrals
// Matches the tones found in the app's colour cloud analysis
const PALETTE = [
  // Warm highlights — golden hour, sun flare
  '#e8a040', '#d48030', '#f0b860', '#c87028', '#e09050', '#f0c878',
  // Warm mids — amber, ochre
  '#b86820', '#d07840', '#a05818', '#c86830', '#b87030',
  // Warm neutrals — skin, wood
  '#c8a880', '#b09070', '#a08060', '#d0b898',
  // Cool shadows — deep blue, indigo
  '#2850a0', '#3868b8', '#204880', '#4878c0', '#2a3e70',
  // Cool mids — steel, slate
  '#507090', '#406080', '#608098',
  // Neutral grey-warm
  '#807060', '#a09080', '#c0b0a0', '#686060',
];

interface Particle {
  cx: number; cy: number;
  r: number;
  color: string;
  opacity: number;
  blur: number;   // 0=sharpest 3=blurriest
  delay: number;
}

function generateParticles(count: number, W: number, H: number, seed = 42): Particle[] {
  const rng = makePrng(seed);
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const x = rng();
    const y = rng();
    const z = rng();         // depth 0=back (blurry) 1=front (sharp)
    const ci = Math.floor(rng() * PALETTE.length);

    // Distribute: more particles in centre, fewer toward edges
    const cx = W * (0.08 + x * 0.84);
    const cy = H * (0.06 + y * 0.88);

    // Size: back particles smaller, front bigger (perspective)
    const r = 4 + z * 16 + rng() * 6;

    // Opacity: deeper = more transparent
    const opacity = 0.20 + z * 0.55 + rng() * 0.10;

    // Blur tier: 4 levels like ColorCloud3D
    const blur = z < 0.22 ? 3 : z < 0.48 ? 2 : z < 0.74 ? 1 : 0;

    // Stagger: back-particles develop first (deeper in the liquid)
    const delay = (1 - z) * 400 + (i % 12) * 18;

    particles.push({ cx, cy, r, color: PALETTE[ci], opacity, blur, delay });
  }

  // Sort back-to-front for correct overlap
  return particles.sort((a, b) => a.blur - b.blur);
}

interface ParticleFieldProps {
  /** Number of particles to render (default 120) */
  count?: number;
  /** SVG width (default 100%) — pass a number for fixed width */
  width?: number;
  height?: number;
  /** Random seed for deterministic layout */
  seed?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ParticleField({
  count = 120,
  width = 900,
  height = 420,
  seed = 42,
  className,
  style,
}: ParticleFieldProps) {
  const uid = useId().replace(/:/g, '_');
  const particles = useMemo(
    () => generateParticles(count, width, height, seed),
    [count, width, height, seed],
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ display: 'block', ...style }}
      aria-hidden
    >
      <style>{`
        @keyframes pf_develop {
          from { opacity: 0; transform: scale(0.3); }
          to   { opacity: 1; transform: scale(1);   }
        }
        .pf_particle {
          opacity: 0;
          animation: pf_develop 480ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>

      <defs>
        {/* 4 blur tiers — same as ColorCloud3D */}
        <filter id={`${uid}_b0`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={`${uid}_b1`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <filter id={`${uid}_b2`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <filter id={`${uid}_b3`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      {particles.map((p, i) => (
        <circle
          key={i}
          className="pf_particle"
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={p.color}
          opacity={p.opacity}
          filter={`url(#${uid}_b${p.blur})`}
          style={{ animationDelay: `${p.delay}ms` }}
        />
      ))}
    </svg>
  );
}
