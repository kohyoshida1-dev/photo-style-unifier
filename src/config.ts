/** 制作者の表記とリンク先（URL が空ならリンクなしの文字だけ表示） */
export const AUTHOR_NAME = 'office 未来圏';
export const AUTHOR_URL = '';

/** GitHub リポジトリの URL（公開後に確定させる） */
export const REPO_URL = 'https://github.com/kohyoshida1-dev/photo-style-unifier';

/** public/ 配下のファイルを、公開先のサブパスに関係なく参照する */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
