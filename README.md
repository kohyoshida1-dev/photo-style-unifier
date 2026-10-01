# Photo Style Unifier

**Extract the light. Apply the vision.**

Upload a few reference photos. Photo Style Unifier reads the colour, tone and atmosphere that runs through them, then applies the same feel to your own photos.

- **Free.** No account, no limits, no watermark.
- **Private.** Everything runs in your browser. Your photos are never uploaded anywhere.
- **Open source.** MIT licence.
- Made by [**office 未来圏**](https://mumble-mumble.com/).

👉 **Use it here: https://kohyoshida1-dev.github.io/photo-style-unifier/**

---

## How to use

1. **Reference.** Drop in 1–8 photos whose look you like (3+ recommended).
2. **Analyze.** The app extracts a *style signature*: tonal zones, hue-by-hue saturation, light-chroma correlation, softness, grain and more.
3. **Apply.** Drop in your photos, preview live, adjust intensity, and download at full resolution.

Saved styles are kept in your browser's local storage.

Supported formats: JPEG, PNG, WebP (and HEIC in Safari). Convert RAW files to JPEG first.

## How it works

The algorithm doesn't copy a LUT or a single average colour. Instead it:

- splits each image into shadow / midtone / highlight zones (with smooth cross-fades) and measures the Lab colour cast in each,
- measures average chroma in 12 hue buckets of 30°,
- takes the **median** across all reference photos, so one odd photo doesn't skew the result,
- shifts the target's zones towards the reference while protecting skin tones and already-saturated colours,
- adds film-like highlight roll-off, softness, micro-contrast and grain where the references have them.

All processing lives in [`src/engine/`](src/engine) and runs in a Web Worker.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
```

Pushing to `main` deploys to GitHub Pages automatically (see `.github/workflows/deploy.yml`).

---

## 日本語

参考にしたい写真を数枚選ぶと、その色・トーン・空気感を読み取り、自分の写真に同じ雰囲気を適用できるツールです。

- **無料**：会員登録・枚数制限・透かしはありません
- **プライバシー**：処理はすべてブラウザ内で行われ、写真がどこかへ送信されることはありません
- **オープンソース**：MIT ライセンス
- **制作**：[office 未来圏](https://mumble-mumble.com/)

**使い方**：上の URL を開き、「お手本の写真」を入れて解析し、加工したい写真を入れて強度を調整し、ダウンロードするだけです。

## License

[MIT](LICENSE)
