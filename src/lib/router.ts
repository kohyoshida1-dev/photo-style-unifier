/**
 * ハッシュ方式のルーター（#/app など）
 * GitHub Pages のような静的ホスティングでもリロード時に 404 にならない。
 */
export function currentPath(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

export function navigate(path: string) {
  window.location.hash = path;
  window.scrollTo(0, 0);
}
