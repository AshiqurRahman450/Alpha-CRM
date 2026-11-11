'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname === '/quotations';

  if (isStudio) {
    return (
      <main className="flex-1 min-w-0 w-full h-full p-0 max-w-none overflow-hidden">
        {children}
      </main>
    );
  }

  return (
    <main
      id="main-scroll-container"
      className="flex-1 min-w-0 w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar"
    >
      <div className="p-3 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
        {children}
      </div>
    </main>
  );
}

