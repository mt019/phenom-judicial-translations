// Cloudflare 給每個 Pages 專案一個 <專案>.pages.dev，它回應的是同一份網站，robots.txt 也寫著
// Allow: /。搜尋引擎因此爬得到一份完整副本，在 Search Console 裡長成「替代頁面（有適當的標準
// 標記）」與重複網頁。這裡對非正式主機名回 noindex。
//
// 不改 robots.txt 去擋爬蟲：被 robots.txt 擋掉的網址，爬蟲讀不到這個標頭，Google 仍可能僅依外連
// 將該網址收入索引，且收的是它未讀過內容的版本。正確順序是允許抓取、讓它讀到 noindex。
//
// 判準寫成「主機名以 .pages.dev 結尾」而不是「主機名不等於正式主機名」：後者在網域改名或尚未
// 掛上自訂網域時，會將正式站一併標為 noindex，而該錯誤不會產生任何錯誤訊息。
//
// 只改 HTML 與 PDF 的回應，其餘原樣回傳：搜尋引擎索引的就是這兩種，而資產的回應不必要地重建
// 一次會動到 range request 與 immutable 快取標頭（judicial-translations 的 R2 PDF 走 range，
// 各站的雜湊資產靠 _headers 設 immutable，兩者都有 smoke 在驗）。
const INDEXABLE = /^(?:text\/html|application\/xhtml\+xml|application\/pdf)\b/;

export async function onRequest(context) {
  const response = await context.next();
  if (!new URL(context.request.url).hostname.endsWith('.pages.dev')) return response;
  if (!INDEXABLE.test(response.headers.get('content-type') ?? '')) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
