# phenom-foreignlaw

司法院外國法中譯的獨立公開前端。資料主本永遠是 private
`mt019/phenom-foreignlaw-data`；本 repo 不收 corpus、PDF、raw HTML、notes 或 token。

## 固定契約

- 只消費 data repo 的 `export:web` snapshot，不猜私有 repo 目錄。
- production／preview 一律使用 clean snapshot、完整 data SHA、逐檔 SHA-256。
- PDF 只從 snapshot `assets.json` allowlist 上傳至 R2；公開 key 使用官方 `pfid`／文件 ID，
  SHA-256 留在完整性驗證層。
- 讀者網址固定為同站 `/pdf/<id>.pdf`；Pages Function 經 private R2 binding 取檔，
  不暴露 R2 managed URL 或共用 assets hostname。
- 公開 canonical：`https://foreignlaw.phenomcanvas.com/` 與 `/glossary/`。
- glossary 必須清楚標示工作表性質與未逐條複核的範圍。
- preview 不得使用 `main` 分支標記或掛正式 hostname；production 必須先通過 preview。
- 不把 reader 全文、TXT 或頁面 JSON 塞進 Pages；Pages 只帶 UI、metadata、搜尋資料。

## 驗證

```sh
npm test
npm run build
```

建置會驗 snapshot、精確 data revision、PDF allowlist、canonical、JSON-LD、sitemap、
404、搜尋介面與 deployment manifest。
