/**
 * AppShell — layout cockpit
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import TicketTabsBar from '../components/TicketTabsBar';
import AIChatbotModal from '../features/modals/AIChatbotModal';
import QuickRegisterModal from '../features/modals/QuickRegisterModal';

export default function AppShell() {
  const [aiOpen, setAiOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    const openQuick = () => setQuickOpen(true);
    const closeQuick = () => setQuickOpen(false);
    window.addEventListener('velodesk:quick-register', openQuick);
    window.addEventListener('velodesk:quick-register-close', closeQuick);
    return () => {
      window.removeEventListener('velodesk:quick-register', openQuick);
      window.removeEventListener('velodesk:quick-register-close', closeQuick);
    };
  }, []);

  return (
    <>
      <div id="mainApp" className="main-app sidebar-collapsed" style={{ display: 'grid' }}>
        <Header onQuickRegister={() => setQuickOpen(true)} />
        <TicketTabsBar />
        <Sidebar onOpenAI={() => setAiOpen(true)} />
        <main className="main-content sidebar-collapsed">
          <Outlet />
        </main>
      </div>
      <AIChatbotModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <QuickRegisterModal open={quickOpen} onClose={() => setQuickOpen(false)} />
    </>
  );
}
