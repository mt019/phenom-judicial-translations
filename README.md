# phenom-foreignlaw

司法院外國法中譯與德中法學譯語表的獨立靜態前端。內容主本在 private
`mt019/phenom-foreignlaw-data`；本站只消費其可攜、可驗證的公開 snapshot。

```sh
npm install
npm run data:local
npm run build
npm run dev
```

`data:local` 預設讀同層 `../phenom-foreignlaw-data`，也可用
`FOREIGNLAW_DATA_DIR=/path/to/phenom-foreignlaw-data` 指定。

公開路由：

- `/`：報告、案件與譯者檢索。
- `/glossary/`：1,864 組德中法學譯語與多譯狀態。
- `/404.html`：可操作的站內尋路頁。

PDF 不進 Pages artifact；snapshot 只帶內容定址的 R2 key，前端以
`PUBLIC_ASSET_BASE`（預設 `https://assets.phenomcanvas.com`）組成 immutable URL。
