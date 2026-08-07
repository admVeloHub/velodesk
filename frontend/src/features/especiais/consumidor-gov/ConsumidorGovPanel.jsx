/**
 * ConsumidorGovPanel — painel operacional ConsumidorGov
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { useCgNovaDemandaModals } from '../../../hooks/useCgNovaDemandaModals';
import {
  getFooterSummary,
  getConsumidorGovKpis,
  getReportSeries,
  groupDemandasByStatus,
  loadDemandas,
} from '../../../services/especiais/consumidorGovStore';
import { loadConsumidorGovTicketsFromApi, ensureCgTicketForRespond } from '../../../services/especiais/consumidorGovTicketService';
import ConsumidorGovTopBar from './ConsumidorGovTopBar';
import ConsumidorGovPageHeader from './ConsumidorGovPageHeader';
import ConsumidorGovToolbar from './ConsumidorGovToolbar';
import ConsumidorGovKpiRow from './ConsumidorGovKpiRow';
import ConsumidorGovTableView from './ConsumidorGovTableView';
import ConsumidorGovReportsView from './ConsumidorGovReportsView';

function loadViewState({ search, activeChips }) {
  const items = loadDemandas({ search, activeChips });
  return {
    items,
    kpis: getConsumidorGovKpis(items),
    groups: groupDemandasByStatus(items),
    series: getReportSeries(items),
  };
}

export default function ConsumidorGovPanel() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState('tabela');
  const [search, setSearch] = useState('');
  const [activeChips, setActiveChips] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);
  const [respondingId, setRespondingId] = useState(null);

  useEffect(() => {
    const refreshFromApi = () => {
      loadConsumidorGovTicketsFromApi().catch(() => {});
    };
    refreshFromApi();
    const bumpList = () => setListVersion((v) => v + 1);
    window.addEventListener('velodesk:consumidor-gov-sync', bumpList);
    window.addEventListener('velodesk:refresh-tickets', refreshFromApi);
    return () => {
      window.removeEventListener('velodesk:consumidor-gov-sync', bumpList);
      window.removeEventListener('velodesk:refresh-tickets', refreshFromApi);
    };
  }, []);

  const { openNovaDemandaFlow, modals: demandaModals } = useCgNovaDemandaModals({ navigate });

  const view = useMemo(
    () => loadViewState({ search, activeChips }),
    [search, activeChips, listVersion],
  );

  const footerText = getFooterSummary(view.items, selectedIds.length);

  const handleToggleChip = useCallback((chipId) => {
    setActiveChips((prev) =>
      prev.includes(chipId) ? prev.filter((c) => c !== chipId) : [...prev, chipId],
    );
    setPage(1);
  }, []);

  const handleToolbarAction = useCallback((action) => {
    if (action === 'nova') {
      openNovaDemandaFlow();
      return;
    }
    const messages = {
      filtrar: 'Filtros avançados em breve.',
      ordenar: 'Ordenação em breve.',
      exportar: 'Exportação em breve.',
    };
    showNotification(messages[action] || 'Em breve.', 'info');
  }, [openNovaDemandaFlow, showNotification]);

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleToggleSelectAll = useCallback((ids, select) => {
    setSelectedIds(select ? [...ids] : []);
  }, []);

  const handleRowAction = useCallback(async (action, item) => {
    if (action === 'responder' && item?.id) {
      setRespondingId(item.id);
      try {
        const ensured = await ensureCgTicketForRespond(item);
        setListVersion((v) => v + 1);
        navigate(`/especiais/consumidor-gov/ticket/${ensured.cgItem.id}`);
      } catch (err) {
        showNotification(err?.message || 'Não foi possível abrir o ticket.', 'error');
      } finally {
        setRespondingId(null);
      }
      return;
    }
    showNotification('Ação em breve.', 'info');
  }, [navigate, showNotification]);

  return (
    <div className="ra-panel" id="consumidorGovPanel">
      <ConsumidorGovTopBar />

      <div className="ra-panel__body">
        <button
          type="button"
          className="ra-panel__back"
          onClick={() => navigate('/workspace')}
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Trocar canal
        </button>

        <ConsumidorGovPageHeader activeTab={activeTab} onTabChange={setActiveTab} />

        <ConsumidorGovToolbar
          search={search}
          onSearchChange={setSearch}
          activeChips={activeChips}
          onToggleChip={handleToggleChip}
          onAction={handleToolbarAction}
        />

        <ConsumidorGovKpiRow kpis={view.kpis} />

        <div className="ra-panel__content">
          {activeTab === 'tabela' && (
            <ConsumidorGovTableView
              groups={view.groups}
              selectedIds={selectedIds}
              respondingId={respondingId}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onRowAction={handleRowAction}
            />
          )}
          {activeTab === 'relatorios' && (
            <ConsumidorGovReportsView series={view.series} kpis={view.kpis} />
          )}
        </div>

        {activeTab === 'tabela' ? (
          <footer className="ra-panel__footer">
            <div className="ra-panel__footer-left">
              <span>{footerText}</span>
            </div>
            <div className="ra-panel__pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
                <i className="ti ti-chevron-left" />
              </button>
              <span>{page} de 2 páginas</span>
              <button type="button" disabled={page >= 2} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
                <i className="ti ti-chevron-right" />
              </button>
            </div>
          </footer>
        ) : null}
      </div>

      {demandaModals}
    </div>
  );
}
