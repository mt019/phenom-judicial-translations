# phenom-judicial-translations

司法院外國法中譯與德中法學譯語表的獨立 React/Vite 前端。內容主本在 private
`mt019/phenom-judicial-translations-data`；本站只消費其可攜、可驗證的公開 snapshot。
頁面保留 Canvas Lab 原有的互動與版面，共用元件、設計 token 與授權字體由
`@phenomcanvas/ui` 的固定 release 提供；升級 UI 套件必須重新做桌面與行動版視覺驗收。

```sh
npm install
npm run data:local
npm run build
npm run dev
```

`data:local` 預設讀同層 `../phenom-judicial-translations-data`，也可用
`FOREIGNLAW_DATA_DIR=/path/to/phenom-judicial-translations-data` 指定。

公開路由：

- `/`：報告、案件與譯者檢索。
- `/glossary/`：1,864 組德中法學譯語與多譯狀態。
- `/404.html`：可操作的站內尋路頁。

PDF 不進 Pages artifact；snapshot 只帶由官方 `pfid`／文件 ID 組成的穩定 R2 key。
Pages Function 透過 private R2 binding 提供同站網址，例如
`https://judicial-translations.phenomcanvas.com/pdf/0000399406.pdf`。

R2 物件仍使用既有 `foreignlaw/pdf/` legacy prefix，避免因產品改名複製 912 份相同
PDF；這個實作 key 不出現在讀者網址。
