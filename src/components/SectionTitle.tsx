interface Props {
  label: string;
  heading?: string;
  hint?: string;
}

export function SectionTitle({ label, heading, hint }: Props) {
  return (
    <div className="mb-3">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: 'var(--accent)', letterSpacing: '0.2em' }}>
        {label}
      </p>
      {heading && (
        <h3
          className="mt-1"
          style={{
            fontFamily: 'Lora, Georgia, serif',
            fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
            fontWeight: 400,
            lineHeight: 1.25,
            color: 'var(--text)',
          }}
        >
          {heading}
        </h3>
      )}
      {hint && (
        <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-subtle)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
