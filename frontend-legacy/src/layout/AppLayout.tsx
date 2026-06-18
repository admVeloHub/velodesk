/** AppLayout v1.3.1 — stack retrátil VeloHub + Velodesk */
import { ReactNode, useState } from 'react';
import RetractableHeaderStack from './RetractableHeaderStack';
import VelohubRouteSync from './VelohubRouteSync';
import DialerWidget from '../features/dialer/DialerWidget';
import AiAssistantDialog from '../features/ai/AiAssistantDialog';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="app-shell">
      <VelohubRouteSync />
      <RetractableHeaderStack onOpenAi={() => setAiOpen(true)} />
      <main className="app-main">{children}</main>
      <DialerWidget />
      <AiAssistantDialog open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
