/** GitHub リポジトリの URL（公開後に確定させる） */
export const REPO_URL = 'https://github.com/kohyoshida1-dev/photo-style-unifier';

/** public/ 配下のファイルを、公開先のサブパスに関係なく参照する */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
