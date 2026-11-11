'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname === '/quotations';

  return (
    <main
      className={`flex-1 min-w-0 ${
        isStudio
          ? 'w-full h-full p-0 max-w-none overflow-hidden'
          : 'p-3 sm:p-6 md:p-8 max-w-7xl w-full mx-auto'
      }`}
    >
      {children}
    </main>
  );
}
