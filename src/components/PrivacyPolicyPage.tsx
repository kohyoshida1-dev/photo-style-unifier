import { LegalShell, Section, Ja } from './LegalShell';
import { REPO_URL } from '../config';

export function PrivacyPolicyPage({ onBack }: { onBack: () => void }) {
  return (
    <LegalShell onBack={onBack} title="Privacy" subtitle="プライバシー" updated="October 1, 2026">

      <Section n={1} en="Your photos stay on your device" ja="写真は端末の外に出ません">
        <p style={{ color: 'var(--text-muted)' }}>All analysis and processing happens inside your web browser. Photos are never uploaded to any server.</p>
        <Ja>解析・変換はすべてお使いのブラウザ内で行われます。写真がサーバーへ送信されることはありません。</Ja>
      </Section>

      <Section n={2} en="No account, no tracking" ja="アカウント・トラッキングなし">
        <p style={{ color: 'var(--text-muted)' }}>There is no sign-up, no analytics and no advertising cookies.</p>
        <Ja>会員登録はなく、アクセス解析や広告用 Cookie も使用していません。</Ja>
      </Section>

      <Section n={3} en="Saved styles" ja="保存したスタイル">
        <p style={{ color: 'var(--text-muted)' }}>Styles you save are stored only in your browser's local storage. Clearing your browser data removes them.</p>
        <Ja>保存したスタイルはお使いのブラウザ内（localStorage）にのみ保存されます。ブラウザのデータを消去すると削除されます。</Ja>
      </Section>

      <Section n={4} en="Hosting and fonts" ja="ホスティングとフォント">
        <p style={{ color: 'var(--text-muted)' }}>The site is hosted on GitHub Pages and loads fonts from Google Fonts. These providers may log standard request data such as your IP address, under their own privacy policies.</p>
        <Ja>本サイトは GitHub Pages で配信され、Google Fonts からフォントを読み込みます。これらの事業者は、IP アドレスなど通常のアクセス情報を各社のポリシーに基づき記録する場合があります。</Ja>
      </Section>

      <Section n={5} en="Contact" ja="お問い合わせ">
        <p style={{ color: 'var(--text-muted)' }}>Questions or bug reports: please open an issue on <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>GitHub</a>.</p>
        <Ja>ご質問・不具合報告は GitHub の Issues へお寄せください。</Ja>
      </Section>

    </LegalShell>
  );
}
