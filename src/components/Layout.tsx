import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans selection:bg-amber-500/30">
      <header className="border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-amber-500">ARC</span> Raiders 인벤토리 정리
          </h1>
          <nav className="text-xs text-neutral-500">
            v1.1 (클라이언트 전용)
          </nav>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-neutral-800 py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-neutral-500 text-sm">
          <p>모든 이미지는 브라우저 내에서만 처리되며, 서버로 전송되지 않습니다.</p>
        </div>
      </footer>
    </div>
  );
}
