import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import NotificationProvider from '../components/NotificationProvider';

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
});

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
    <html lang="en" className={poppins.variable}>
      <body className={`${poppins.className} bg-[#F8FAFC] min-h-screen text-slate-900 antialiased flex flex-row`}>
        <NotificationProvider />
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <Navbar />
          <main className="flex-1 p-3 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
