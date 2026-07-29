import { useLocation } from 'react-router-dom';
import JirsForeignLaw from './pages/JirsForeignLaw.jsx';
import LegalGlossary from './pages/LegalGlossary.jsx';

export function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper paper-texture px-6 text-ink">
      <section className="max-w-xl border-l-2 border-line pl-5">
        <p className="font-accent text-token-xs font-bold uppercase tracking-[0.26em] text-ink-muted">404</p>
        <h1 className="mt-2 text-token-2xl">找不到這一頁。</h1>
        <p className="mt-3 text-token-sm leading-relaxed text-ink-muted">
          這個網址沒有對應的裁判譯文或譯語頁。
        </p>
        <a className="mt-5 inline-block text-token-sm text-accent underline decoration-line" href="/">
          回外國法翻譯索引
        </a>
      </section>
    </main>
  );
}

export function SiteRoutes() {
  const { pathname } = useLocation();
  if (pathname === '/' || pathname === '/index.html') return <JirsForeignLaw />;
  if (pathname === '/glossary' || pathname === '/glossary/') return <LegalGlossary />;
  return <NotFound />;
}

export default function App() {
  return <SiteRoutes />;
}
