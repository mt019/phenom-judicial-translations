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

PDF 不進 Pages artifact；snapshot 只帶由官方 `pfid`／文件 ID 組成的穩定 R2 key。
Pages Function 透過 private R2 binding 提供同站網址，例如
`https://foreignlaw.phenomcanvas.com/pdf/0000399406.pdf`。
