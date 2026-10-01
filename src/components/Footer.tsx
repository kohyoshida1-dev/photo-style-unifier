import { navigate } from '../lib/router';
import { REPO_URL, AUTHOR_NAME, AUTHOR_URL } from '../config';

export function Footer() {
  const linkStyle = { color: 'var(--text-muted)' };
  const hoverIn  = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.color = 'var(--text)');
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.color = 'var(--text-muted)');

  return (
    <footer
      className="mt-6 py-4 px-4"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="max-w-4xl mx-auto flex flex-wrap gap-x-6 gap-y-2 justify-center">
        <button onClick={() => navigate('/privacy')} className="text-xs transition-colors" style={linkStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
          Privacy
        </button>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-xs transition-colors" style={linkStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
          Source code (GitHub)
        </a>
      </div>
      <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
        Made by{' '}
        {AUTHOR_URL ? (
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            {AUTHOR_NAME}
          </a>
        ) : AUTHOR_NAME}
      </p>
      <p className="text-center text-[10px] mt-2" style={{ color: 'var(--text-subtle)' }}>
        Photo Style Unifier · Free and open source under the MIT License
      </p>
    </footer>
  );
}
