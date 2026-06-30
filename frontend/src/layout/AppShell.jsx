/**
 * AppShell — layout cockpit
 * VERSION: v2.4.0 | DATE: 2026-06-30
 */
import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TicketTabsBar from '../components/TicketTabsBar';
import AIChatbotModal from '../features/modals/AIChatbotModal';
import { VeloNewsProvider } from '../features/velonews/VeloNewsProvider';
import VeloNewsCriticalBubble from '../features/velonews/VeloNewsCriticalBubble';
import VeloNewsCriticalModal from '../features/velonews/VeloNewsCriticalModal';
import VeloNewsReadModal from '../features/velonews/VeloNewsReadModal';
import VeloNewsHistoryModal from '../features/velonews/VeloNewsHistoryModal';

export default function AppShell() {
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const openAi = () => setAiOpen(true);
    const closeAi = () => setAiOpen(false);
    const toggleAi = () => setAiOpen((v) => !v);
    window.addEventListener('velodesk:open-ai', openAi);
    window.addEventListener('velodesk:close-ai', closeAi);
    window.addEventListener('velodesk:toggle-ai', toggleAi);
    return () => {
      window.removeEventListener('velodesk:open-ai', openAi);
      window.removeEventListener('velodesk:close-ai', closeAi);
      window.removeEventListener('velodesk:toggle-ai', toggleAi);
    };
  }, []);

  return (
    <VeloNewsProvider>
      <div id="mainApp" className="main-app sidebar-collapsed velo-chromeless" style={{ display: 'grid' }}>
        <TicketTabsBar />
        <Sidebar onOpenAI={() => setAiOpen((v) => !v)} />
        <main className="main-content sidebar-collapsed">
          <Outlet />
        </main>
      </div>
      <AIChatbotModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <VeloNewsCriticalBubble />
      <VeloNewsCriticalModal />
      <VeloNewsReadModal />
      <VeloNewsHistoryModal />
    </VeloNewsProvider>
  );
}
