import { navigate } from '../lib/router';
import { REPO_URL, asset } from '../config';

function IconFilm() {
  return (
    <img src={asset('logo_psu.png')} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }} />
  );
}

export function AppHeader() {
  return (
    <header style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 text-left"
          aria-label="Back to top page"
        >
          {/* ロゴマーク */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}
          >
            <IconFilm />
          </div>

          {/* タイトル */}
          <div>
            <h1
              className="leading-tight"
              style={{
                fontFamily: 'Lora, Georgia, serif',
                fontStyle: 'italic',
                fontSize: '1.05rem',
                fontWeight: 400,
                color: 'var(--text)',
              }}
            >
              Photo Style Unifier
            </h1>
            <p className="mono text-[10px] uppercase tracking-widest leading-tight" style={{ color: 'var(--accent)', letterSpacing: '0.18em' }}>
              Extract the light. Apply the vision.
            </p>
          </div>
        </button>

        {/* スペーサー */}
        <div className="flex-1" />

        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
