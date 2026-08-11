/**
 * GestaoAdherenceCard v1.0.0 — Aderência da equipe "ao vivo" (hoje), no estilo compacto do
 * Realtime. Absorvido do antigo Dashboard Executivo para dentro do Painel 360.
 */
import React, { useEffect, useState } from 'react';
import { realtimeApi } from '../../../../api/client';
import GestaoLiveSection from './GestaoLiveSection';
import { MetricCard, EmployeesToggle, UnavailableBlock } from '../../../realtime/RealtimeDashboard';
import '../../../realtime/realtime.css';

export default function GestaoAdherenceCard() {
  const [rt, setRt] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    realtimeApi
      .dashboard()
      .then((result) => {
        if (active) setRt(result);
      })
      .catch(() => {
        if (active) setRt(null);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return null;
  if (!rt) return null;

  if (rt.adherenceUnavailable) {
    return (
      <GestaoLiveSection icon="ti-users" title="Aderência da equipe" defaultOpen={false}>
        <UnavailableBlock message="Aderência indisponível — Supabase Realtime não configurado." />
      </GestaoLiveSection>
    );
  }

  const adherence = rt.adherence;

  return (
    <GestaoLiveSection icon="ti-users" title="Aderência da equipe" badge="Hoje" defaultOpen={false}>
      <div className="realtime-metrics">
        <MetricCard label="Escalados hoje" value={adherence?.escalados} tone="navy">
          <EmployeesToggle employees={adherence?.escaladosNomes} showChamadas />
        </MetricCard>
        <MetricCard label="Logados agora" value={adherence?.logados} tone="green">
          <EmployeesToggle employees={adherence?.logadosNomes} />
        </MetricCard>
        <MetricCard label="No horário" value={adherence?.noHorario} tone="green">
          <EmployeesToggle employees={adherence?.noHorarioNomes} />
        </MetricCard>
        <MetricCard label="Atrasados" value={adherence?.atrasados} tone="yellow">
          <EmployeesToggle employees={adherence?.atrasadosNomes} />
        </MetricCard>
        <MetricCard label="Ausentes" value={adherence?.ausentes} tone="red">
          <EmployeesToggle employees={adherence?.ausentesNomes} />
        </MetricCard>
        <MetricCard label="Folga / Fora" value={adherence?.folgaFora} tone="slate">
          <EmployeesToggle employees={adherence?.folgaForaNomes} />
        </MetricCard>
      </div>
    </GestaoLiveSection>
  );
}
