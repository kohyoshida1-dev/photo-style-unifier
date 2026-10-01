import type { ReactNode } from 'react';

interface LegalShellProps {
  onBack: () => void;
  title: string;
  subtitle: string;
  updated: string;
  children: ReactNode;
}

export function LegalShell({ onBack, title, subtitle, updated, children }: LegalShellProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">

        <button
          onClick={onBack}
          className="text-xs mb-10 flex items-center gap-1.5 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ← Legal
        </button>

        <p className="text-[11px] font-medium tracking-widest uppercase mb-2" style={{ color: 'var(--text-subtle)' }}>
          Legal
        </p>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text)' }}>{title}</h1>
        <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        <p className="text-xs mb-12" style={{ color: 'var(--text-subtle)' }}>Effective {updated}</p>

        <div className="space-y-10">{children}</div>
      </div>
    </div>
  );
}

interface SectionProps {
  n: number;
  en: string;
  ja: string;
  children: ReactNode;
}

export function Section({ n, en, ja, children }: SectionProps) {
  return (
    <section>
      <div className="mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {n}. {en} / {ja}
        </h2>
      </div>
      <div className="text-sm space-y-3" style={{ lineHeight: '1.75' }}>
        {children}
      </div>
    </section>
  );
}

export function Ja({ children }: { children: ReactNode }) {
  return (
    <p style={{ color: 'var(--text-subtle)', marginTop: '-4px' }}>{children}</p>
  );
}

export function JaUl({ children }: { children: ReactNode }) {
  return (
    <ul className="pl-4 list-disc space-y-0.5" style={{ color: 'var(--text-subtle)' }}>
      {children}
    </ul>
  );
}
