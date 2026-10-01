import React from 'react';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 進捗 0-1。0 = アイドル（通常の accent ボタン）、0〜1 = フィル中、1 = 完了 */
  progress?: number;
  children: React.ReactNode;
}

/**
 * 処理の進行に合わせて左から右へ accent カラーが充填されるボタン。
 * progress=0 のときは通常の accent ボタンとまったく同じ見た目。
 */
export function ProgressButton({ progress = 0, style, children, ...rest }: Props) {
  const pct = `${(Math.min(1, Math.max(0, progress)) * 100).toFixed(2)}%`;

  const background = progress <= 0
    ? 'var(--accent)'
    : `linear-gradient(to right, var(--accent) ${pct}, rgba(255,255,255,0.08) ${pct})`;

  // アイドル時（全面accent=明色）は暗い文字、処理中は白文字
  const color = progress <= 0 ? '#0b0b0c' : 'rgba(255,255,255,0.92)';

  return (
    <button
      {...rest}
      style={{
        background,
        color,
        transition: 'background 0.08s linear, color 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
