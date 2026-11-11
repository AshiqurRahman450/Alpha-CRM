import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import NotificationProvider from '../components/NotificationProvider';
import MainContainer from '../components/MainContainer';

export const metadata: Metadata = {
  title: 'Alpha Elevators CRM & WhatsApp Automation',
  description: 'Production CRM for residential elevator customer tracking and Meta WhatsApp Group automation',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800;900&family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-poppins bg-[#F8FAFC] h-[100dvh] md:h-screen overflow-hidden text-slate-900 antialiased flex flex-row">
        <NotificationProvider />
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-[100dvh] md:h-screen overflow-hidden">
          <Navbar />
          <MainContainer>{children}</MainContainer>
        </div>
      </body>
    </html>
  );
}
