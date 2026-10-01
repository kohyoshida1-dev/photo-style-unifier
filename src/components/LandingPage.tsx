import { navigate } from '../lib/router';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { ParticleField } from './ParticleField';
import { Footer } from './Footer';
import { REPO_URL, asset } from '../config';

const DEMO_PAIRS = [
  { before: asset('before-1.JPG'), after: asset('after-1.JPG'), label: 'Reference style · 80% intensity' },
];

// ── Landing page ──
//
// Hero:          MACK     — 220 particles full-screen, large h1
// CTA copy:      Aperture — "Try free preview"
// Problem:       Steidl   — table-row, roman numerals, product name in winner
// Breathing:     Steidl   — single page, particles muted
// Before/After:  Aperture — figcaption-based figure
// How it works:  MACK     — 3-column table (number / title / desc)
// FAQ:           Aperture — 2-column Q/A grid
// Typography:    Cormorant Garamond display + Inter Tight UI
// Base:          MACK     — pure black + pure white
// Accent:        Aperture — Oxblood (#8b3a2a) — not gold, not hot-red
// Color Cloud:   MACK     — hero only, brand asset, no other sections

const DISPLAY = '"Cormorant Garamond", Georgia, serif';
const UI = '"Inter Tight", Inter, system-ui, sans-serif';

const BG = '#000000';
const BG_2 = '#111111';          // Perceptibly distinct from pure black
const TEXT = '#ffffff';
const TEXT_MUTED = '#b0b0b0';    // Lifted from #9a9a9a for hero legibility
const TEXT_SUBTLE = '#555555';
const RULE = 'rgba(255,255,255,0.12)';
const RULE_STRONG = 'rgba(255,255,255,0.22)';
const ACCENT = '#d06040';        // Brightened for WCAG AA contrast on black (~4.6:1)
const ACCENT_DIM = 'rgba(208,96,64,0.10)';

const HERO_REFERENCES = [
  {
    src: asset('sample-02.jpg'),
    alt: 'Reference sample 02',
  },
  {
    src: asset('sample-01.jpg'),
    alt: 'Reference sample 01',
  },
  {
    src: asset('sample-03.jpg'),
    alt: 'Reference sample 03',
  },
];

// ─────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p
    style={{
      fontFamily: UI,
      fontSize: 11,
      letterSpacing: '0.24em',
      color: ACCENT,
      marginBottom: 24,
      textTransform: 'uppercase',
      fontWeight: 500,
    }}
  >
    {children}
  </p>
);

const DisplayH2 = ({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' }) => (
  <h2
    style={{
      fontFamily: DISPLAY,
      fontWeight: 400,
      fontSize: 'clamp(2.2rem, 5.5vw, 3.6rem)',
      lineHeight: 1.05,
      letterSpacing: '-0.015em',
      color: TEXT,
      textAlign: align,
    }}
  >
    {children}
  </h2>
);

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div style={{ background: BG, color: TEXT, fontFamily: UI, minHeight: '100vh' }}>
      <style>{`
        @media (max-width: 768px) {
          .v4-grid-3 { grid-template-columns: 1fr !important; }
          .v4-grid-2 { grid-template-columns: 1fr !important; gap: 12px !important; }
          .v4-grid-3 > * { border-right: none !important; }
          .v4-process-row { grid-template-columns: 60px 1fr !important; gap: 16px !important; }
          .v4-process-row > .v4-process-desc { grid-column: 2; padding-top: 8px; }
          .v4-hero-h1 { font-size: clamp(3rem, 12vw, 5rem) !important; }
          .v4-hero-pad { padding: 80px 24px 24px !important; }
          .v4-section-pad { padding: 96px 24px !important; }
          .v4-faq-row { grid-template-columns: 1fr !important; gap: 12px !important; }
        }
        @media (max-width: 920px) {
          .v4-hero-proof { position: relative !important; right: auto !important; bottom: auto !important; margin-top: 36px; width: min(100%, 340px) !important; }
        }
        @media (max-width: 768px) {
          .v4-hero-proof { width: 100% !important; }
        }
      `}</style>

      {/* ─────────────────────────────────────────────────── */}
      {/* Header                                              */}
      {/* ─────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          padding: '18px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${RULE}`,
        }}
      >
        <p style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: 20, color: TEXT, letterSpacing: '0.02em' }}>
          Photo Style Unifier
        </p>
        <button
          onClick={() => navigate('/app')}
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: UI,
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: TEXT,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Open the app →
        </button>
      </header>

      {/* ─────────────────────────────────────────────────── */}
      {/* Hero — MACK-style particles + Aperture-style copy   */}
      {/* ─────────────────────────────────────────────────── */}
      <section
        className="v4-hero-pad"
        style={{
          position: 'relative',
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '64px 64px',
          background: BG,
          overflow: 'hidden',
        }}
      >
        {/* XL Color Cloud — brand signature */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <ParticleField count={220} width={1600} height={1000} seed={9} style={{ width: '100%', height: '100%', opacity: 1 }} />
        </div>

        {/* Soft top/bottom vignette to seat type */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 25%, transparent 65%, rgba(0,0,0,0.75) 92%, #000 100%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <p
            style={{
              fontFamily: UI,
              fontSize: 11,
              letterSpacing: '0.32em',
              color: ACCENT,
              marginBottom: 28,
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            Visual Atmosphere · For Photographers
          </p>

          <h1
            className="v4-hero-h1"
            style={{
              fontFamily: DISPLAY,
              fontWeight: 400,
              fontSize: 'clamp(3.5rem, 9vw, 7.2rem)',
              lineHeight: 0.98,
              letterSpacing: '-0.025em',
              color: TEXT,
              marginBottom: 36,
              maxWidth: '14ch',
            }}
          >
            Extract the light.<br />
            <em style={{ color: TEXT_MUTED, fontWeight: 400 }}>Apply the vision.</em>
          </h1>

          <p
            style={{
              fontFamily: UI,
              fontSize: 'clamp(1rem, 1.5vw, 1.15rem)',
              lineHeight: 1.65,
              color: TEXT_MUTED,
              maxWidth: '46ch',
              marginBottom: 48,
            }}
          >
            Upload one to eight reference photographs. Photo Style Unifier reads the
            colour, tone, and atmosphere that runs through them — and applies
            that same sensibility to your photos.
          </p>

          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/app')}
              style={{
                background: ACCENT,
                color: TEXT,
                border: 'none',
                padding: '20px 44px',
                fontFamily: UI,
                fontSize: 14,
                letterSpacing: '0.12em',
                fontWeight: 600,
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'transform 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = '#d6694a';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = ACCENT;
              }}
            >
              Start for free →
            </button>
            <p style={{ fontFamily: UI, fontSize: 11, letterSpacing: '0.14em', color: TEXT_MUTED, textTransform: 'uppercase' }}>
              Free · No sign-up · Runs in your browser
            </p>
          </div>

          <aside
            className="v4-hero-proof"
            aria-label="Photo style transfer example"
            style={{
              position: 'absolute',
              right: 0,
              bottom: -86,
              width: 316,
              color: TEXT,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 7,
                marginBottom: 8,
              }}
            >
              {HERO_REFERENCES.map((photo, i) => (
                <figure key={photo.src} style={{ margin: 0 }}>
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      display: 'block',
                      border: `1px solid ${RULE_STRONG}`,
                      filter: 'saturate(0.92) contrast(1.04)',
                    }}
                  />
                  {i === 0 && (
                    <figcaption
                      style={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        overflow: 'hidden',
                        clip: 'rect(0 0 0 0)',
                      }}
                    >
                      Reference photos used to extract the style
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>

            <div
              style={{
                padding: 8,
                border: `1px solid ${RULE_STRONG}`,
                background: 'rgba(0,0,0,0.46)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 18px 70px rgba(0,0,0,0.48)',
              }}
            >
              <BeforeAfterSlider before={asset('before-1.JPG')} after={asset('after-1.JPG')} aspectRatio="3/2" />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginTop: 12,
              }}
            >
              <p
                style={{
                  fontFamily: UI,
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  color: ACCENT,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Reference set
              </p>
              <p
                style={{
                  fontFamily: DISPLAY,
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: TEXT_MUTED,
                  whiteSpace: 'nowrap',
                }}
              >
                Style applied · 80% intensity
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── */}
      {/* Problem — Steidl table-row                          */}
      {/* ─────────────────────────────────────────────────── */}
      <section className="v4-section-pad" style={{ padding: '140px 32px', background: BG }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Eyebrow>The Problem</Eyebrow>
          <DisplayH2>Presets are someone else's<br />taste, baked in.</DisplayH2>
          <p
            style={{
              fontFamily: DISPLAY,
              fontStyle: 'italic',
              fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
              lineHeight: 1.55,
              color: TEXT_MUTED,
              marginTop: 28,
              marginBottom: 80,
              maxWidth: '50ch',
            }}
          >
            They look beautiful on the demo. Then you apply them to yours.
          </p>

          <div
            className="v4-grid-3"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 0,
              borderTop: `1px solid ${RULE_STRONG}`,
            }}
          >
            {[
              { n: 'I.',   label: 'Presets',              desc: 'Fixed filters. They flatten different lighting into one look.' },
              { n: 'II.',  label: 'Manual edit',          desc: 'Slow. Consistency erodes across a shoot.' },
              { n: 'III.', label: 'Photo Style Unifier',  desc: 'A reading of multiple references. Adapted faithfully to your image.', winner: true },
            ].map((item, i, arr) => (
              <div
                key={item.label}
                style={{
                  padding: '40px 32px 48px',
                  paddingLeft: item.winner ? 29 : 32,
                  borderLeft: item.winner ? `3px solid ${ACCENT}` : '3px solid transparent',
                  borderRight: i < arr.length - 1 ? `1px solid ${RULE}` : 'none',
                  borderBottom: `1px solid ${RULE_STRONG}`,
                  background: item.winner ? ACCENT_DIM : 'transparent',
                }}
              >
                <p
                  style={{
                    fontFamily: DISPLAY,
                    fontStyle: 'italic',
                    fontSize: 18,
                    color: item.winner ? ACCENT : TEXT_SUBTLE,
                    marginBottom: 16,
                  }}
                >
                  {item.n}
                </p>
                <h3
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 24,
                    fontWeight: 500,
                    color: TEXT,
                    marginBottom: 14,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item.label}
                </h3>
                <p style={{ fontFamily: UI, fontSize: 14, lineHeight: 1.65, color: TEXT_MUTED }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── */}
      {/* Before / After — Aperture figcaption                */}
      {/* ─────────────────────────────────────────────────── */}
      <section className="v4-section-pad" style={{ padding: '140px 32px', background: BG_2 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <Eyebrow>Demonstration</Eyebrow>
            <DisplayH2 align="center">
              The same atmosphere.<br />Applied in seconds.
            </DisplayH2>
            <p
              style={{
                fontFamily: DISPLAY,
                fontStyle: 'italic',
                fontSize: 17,
                color: TEXT_MUTED,
                marginTop: 24,
                maxWidth: '46ch',
                marginInline: 'auto',
              }}
            >
              Drag the slider to compare. Extracted from reference photos —
              not a preset, not a filter.
            </p>
          </div>

          {DEMO_PAIRS.map((p, i) => (
            <figure key={i} style={{ margin: 0 }}>
              <BeforeAfterSlider before={p.before} after={p.after} aspectRatio="3/2" />
              <figcaption
                style={{
                  fontFamily: DISPLAY,
                  fontStyle: 'italic',
                  fontSize: 15,
                  color: TEXT_MUTED,
                  textAlign: 'center',
                  marginTop: 20,
                  letterSpacing: '0.02em',
                }}
              >
                {p.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── */}
      {/* Breathing page — Steidl, single, muted              */}
      {/* ─────────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          background: BG,
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 32px',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.22, pointerEvents: 'none' }}>
          <ParticleField count={60} width={1400} height={500} seed={31} style={{ width: '100%', height: '100%' }} />
        </div>

        <p
          style={{
            position: 'relative',
            fontFamily: DISPLAY,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(1.3rem, 3vw, 1.9rem)',
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.85)',
            maxWidth: '38ch',
            textAlign: 'center',
          }}
        >
          "Not a filter. A reading of how light, tone, and atmosphere move through the frame."
        </p>
      </section>

      {/* ─────────────────────────────────────────────────── */}
      {/* How it works — MACK 3-column table                  */}
      {/* ─────────────────────────────────────────────────── */}
      <section className="v4-section-pad" style={{ padding: '140px 32px', background: BG }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Eyebrow>The Process</Eyebrow>
          <DisplayH2>Three steps.<br />No manual adjustments.</DisplayH2>

          <div style={{ marginTop: 80, borderTop: `1px solid ${RULE_STRONG}` }}>
            {[
              { n: 'I.',   t: 'Upload reference photographs',  d: 'One to eight images — your own portfolio, or work by photographers you admire.' },
              { n: 'II.',  t: 'The signature is extracted',    d: 'Colour, tone, light flow, atmosphere — read across the set to find what is consistent.' },
              { n: 'III.', t: 'Applied to your photographs',   d: 'Preview live, adjust intensity, and download at full resolution — free.' },
            ].map(s => (
              <div
                key={s.n}
                className="v4-process-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 2fr',
                  gap: 32,
                  alignItems: 'baseline',
                  padding: '40px 0',
                  borderBottom: `1px solid ${RULE}`,
                }}
              >
                <span style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: 28, color: ACCENT }}>
                  {s.n}
                </span>
                <h3
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 26,
                    fontWeight: 500,
                    color: TEXT,
                    letterSpacing: '-0.015em',
                  }}
                >
                  {s.t}
                </h3>
                <p
                  className="v4-process-desc"
                  style={{
                    fontFamily: UI,
                    fontSize: 15,
                    lineHeight: 1.65,
                    color: TEXT_MUTED,
                    maxWidth: '52ch',
                  }}
                >
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── */}
      {/* FAQ — Aperture 2-column Q/A                         */}
      {/* ─────────────────────────────────────────────────── */}
      <section className="v4-section-pad" style={{ padding: '140px 32px', background: BG_2 }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <Eyebrow>Questions</Eyebrow>
            <DisplayH2 align="center">Practicalities</DisplayH2>
          </div>

          {[
            { q: 'Is it really free?',                  a: 'Yes. No account, no limits, no watermark. The project is open source (MIT licence).' },
            { q: 'Are my photos uploaded anywhere?',    a: 'No. All analysis and processing happens inside your browser. Nothing is sent to a server.' },
            { q: 'How many reference photos?',          a: 'One is enough to start. For a richer signature, three to eight is ideal.' },
            { q: 'Which formats are supported?',        a: 'JPEG, PNG and WebP in every modern browser. HEIC works in Safari. RAW files need to be converted to JPEG first.' },
          ].map((item, i, arr) => (
            <div
              key={item.q}
              className="v4-faq-row"
              style={{
                padding: '28px 0',
                borderTop: i === 0 ? `1px solid ${RULE_STRONG}` : 'none',
                borderBottom: i === arr.length - 1 ? `1px solid ${RULE_STRONG}` : `1px solid ${RULE}`,
                display: 'grid',
                gridTemplateColumns: '1fr 1.8fr',
                gap: 40,
              }}
            >
              <p style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: 18, color: TEXT }}>
                {item.q}
              </p>
              <p style={{ fontFamily: UI, fontSize: 15, lineHeight: 1.7, color: TEXT_MUTED }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── */}
      {/* Free & open source                                  */}
      {/* ─────────────────────────────────────────────────── */}
      <section className="v4-section-pad" style={{ padding: '140px 32px', background: BG }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow>Free · Open Source</Eyebrow>
          <DisplayH2 align="center">Free, forever.<br />No account. No upload.</DisplayH2>
          <p
            style={{
              fontFamily: DISPLAY,
              fontStyle: 'italic',
              color: TEXT_MUTED,
              fontSize: 17,
              marginTop: 24,
              marginBottom: 48,
              lineHeight: 1.6,
            }}
          >
            Everything runs inside your browser. Your photos never leave your device.
            The source code is public under the MIT licence.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/app')}
              style={{
                background: ACCENT,
                color: TEXT,
                border: 'none',
                padding: '22px 56px',
                fontFamily: UI,
                fontSize: 14,
                letterSpacing: '0.14em',
                fontWeight: 600,
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#d6694a')}
              onMouseLeave={e => (e.currentTarget.style.background = ACCENT)}
            >
              Open the app →
            </button>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                border: `1px solid ${RULE_STRONG}`,
                color: TEXT,
                padding: '22px 40px',
                fontFamily: UI,
                fontSize: 14,
                letterSpacing: '0.14em',
                fontWeight: 600,
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
