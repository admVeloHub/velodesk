/**
 * ProconPanel — painel operacional Procon
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { usePcNovaDemandaModals } from '../../../hooks/usePcNovaDemandaModals';
import {
  getFooterSummary,
  getProconKpis,
  getReportSeries,
  groupDemandasByStatus,
  loadDemandas,
} from '../../../services/especiais/proconStore';
import ProconTopBar from './ProconTopBar';
import ProconPageHeader from './ProconPageHeader';
import ProconToolbar from './ProconToolbar';
import ProconKpiRow from './ProconKpiRow';
import ProconTableView from './ProconTableView';
import ProconReportsView from './ProconReportsView';

function loadViewState({ search, activeChips }) {
  const items = loadDemandas({ search, activeChips });
  return {
    items,
    kpis: getProconKpis(items),
    groups: groupDemandasByStatus(items),
    series: getReportSeries(items),
  };
}

export default function ProconPanel() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState('tabela');
  const [search, setSearch] = useState('');
  const [activeChips, setActiveChips] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);

  useEffect(() => {
    const bumpList = () => setListVersion((v) => v + 1);
    window.addEventListener('velodesk:procon-sync', bumpList);
    window.addEventListener('velodesk:refresh-tickets', bumpList);
    return () => {
      window.removeEventListener('velodesk:procon-sync', bumpList);
      window.removeEventListener('velodesk:refresh-tickets', bumpList);
    };
  }, []);

  const { openNovaDemandaFlow, modals: demandaModals } = usePcNovaDemandaModals({ navigate });

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

  const handleRowAction = useCallback((action, item) => {
    if (action === 'responder' && item?.id) {
      if (item.ticketId) {
        navigate(`/especiais/procon/ticket/${item.id}`);
      } else {
        navigate(`/especiais/procon/registro/${item.id}`);
      }
      return;
    }
    showNotification('Ação em breve.', 'info');
  }, [navigate, showNotification]);

  return (
    <div className="ra-panel" id="proconPanel">
      <ProconTopBar />

      <div className="ra-panel__body">
        <button
          type="button"
          className="ra-panel__back"
          onClick={() => navigate('/workspace')}
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Trocar canal
        </button>

        <ProconPageHeader activeTab={activeTab} onTabChange={setActiveTab} />

        <ProconToolbar
          search={search}
          onSearchChange={setSearch}
          activeChips={activeChips}
          onToggleChip={handleToggleChip}
          onAction={handleToolbarAction}
        />

        <ProconKpiRow kpis={view.kpis} />

        <div className="ra-panel__content">
          {activeTab === 'tabela' && (
            <ProconTableView
              groups={view.groups}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onRowAction={handleRowAction}
            />
          )}
          {activeTab === 'relatorios' && (
            <ProconReportsView series={view.series} kpis={view.kpis} />
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
