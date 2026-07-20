/**
 * FuncoesPermissoesSection v2.2.0 — funções RBAC + acordeão agentes VeloHub
 * VERSION: v2.2.0 | DATE: 2026-07-20
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../api/client';
import { agentesDeskApi } from '../../../api/client';
import { usePermissions } from '../../../context/PermissionContext';
import { useNotifications } from '../../../context/NotificationContext';
import FuncoesDeskAccordion from './FuncoesDeskAccordion';
import FuncoesAgentesAccordion from './FuncoesAgentesAccordion';
import FuncaoOverridesModal from './FuncaoOverridesModal';
import FuncaoConfigurarModal from './FuncaoConfigurarModal';
import { buildDraftFromFuncao, listFuncoesPendentes } from './funcaoPermissoesLabels';
import './funcoes-permissoes.css';

export default function FuncoesPermissoesSection() {
  const { reload: reloadSessionPerms } = usePermissions();
  const { showNotification } = useNotifications();
  const [funcoes, setFuncoes] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [velohub, setVelohub] = useState([]);
  const [accordionDeskOpen, setAccordionDeskOpen] = useState(true);
  const [accordionAgentesOpen, setAccordionAgentesOpen] = useState(false);
  const [configurarModalOpen, setConfigurarModalOpen] = useState(false);
  const [selectedVelohub, setSelectedVelohub] = useState(null);
  const [configDraft, setConfigDraft] = useState(null);
  const [modalFuncaoSlug, setModalFuncaoSlug] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingAgentes, setSyncingAgentes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, catalogRes, agentesRes] = await Promise.all([
        api.get('/funcoes-permissoes'),
        api.get('/funcoes-permissoes/catalog'),
        agentesDeskApi.list().catch(() => []),
      ]);
      setFuncoes(listRes.data || []);
      setCatalog(catalogRes.data?.catalog || {});
      setVelohub(catalogRes.data?.velohub || []);
      setAgentes(Array.isArray(agentesRes) ? agentesRes : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Erro ao carregar funções');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pendentes = useMemo(
    () => listFuncoesPendentes(velohub, funcoes),
    [velohub, funcoes],
  );

  const velohubAvailable = velohub.length > 0;

  const modalFuncao = useMemo(
    () => funcoes.find((f) => f.slug === modalFuncaoSlug) || null,
    [funcoes, modalFuncaoSlug],
  );

  const openModal = (slug) => {
    const funcao = funcoes.find((f) => f.slug === slug);
    if (!funcao) return;
    setModalFuncaoSlug(slug);
    setDraft(buildDraftFromFuncao(funcao));
  };

  const closeModal = () => {
    setModalFuncaoSlug(null);
    setDraft(null);
  };

  const openConfigurarModal = () => {
    setSelectedVelohub(null);
    setConfigDraft(null);
    setConfigurarModalOpen(true);
  };

  const closeConfigurarModal = () => {
    setConfigurarModalOpen(false);
    setSelectedVelohub(null);
    setConfigDraft(null);
  };

  const syncAgentes = async () => {
    setSyncingAgentes(true);
    setError(null);
    try {
      const result = await agentesDeskApi.sync();
      setAgentes(Array.isArray(result?.agentes) ? result.agentes : []);
      await reloadSessionPerms();
      showNotification(
        `${result.synced} agente(s) importado(s) do VeloHub.`,
        'success',
      );
      setAccordionAgentesOpen(true);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao importar agentes';
      setError(msg);
      showNotification(msg, 'error');
    } finally {
      setSyncingAgentes(false);
    }
  };

  const save = async () => {
    if (!modalFuncaoSlug || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.put(`/funcoes-permissoes/${modalFuncaoSlug}`, draft);
      setFuncoes((prev) => prev.map((f) => (f.slug === modalFuncaoSlug ? { ...f, ...data } : f)));
      await reloadSessionPerms();
      showNotification('Overrides salvos com sucesso.', 'success');
      closeModal();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar';
      setError(msg);
      showNotification(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveNovaFuncao = async () => {
    if (!selectedVelohub || !configDraft) return;
    const slug = selectedVelohub.funcaoSlug;
    setSavingConfig(true);
    setError(null);
    try {
      const payload = { ...configDraft, nome: selectedVelohub.funcao };
      await api.put(`/funcoes-permissoes/${slug}`, payload);
      await reloadSessionPerms();
      showNotification(`Função "${selectedVelohub.funcao}" configurada com sucesso.`, 'success');
      closeConfigurarModal();
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar configuração';
      setError(msg);
      showNotification(msg, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="config-loading" role="status">
        <i className="ti ti-loader-2 config-loading__icon" aria-hidden="true" />
        <span>Carregando funções…</span>
      </div>
    );
  }

  return (
    <div className="funcoes-permissoes-section">
      {error ? (
        <div className="lista-agentes-panel__error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <div className="fp-toolbar">
        <p className="fp-intro">
          Configure overrides RBAC por função em <strong>Funções Desk</strong>.
          Agentes recebem função e cargo automaticamente do VeloHub (atuação).
        </p>
        <div className="fp-toolbar__actions">
          <button
            type="button"
            className="config-action-btn"
            onClick={syncAgentes}
            disabled={syncingAgentes}
          >
            {syncingAgentes ? 'Importando…' : 'Importar agentes do VeloHub'}
          </button>
          <button
            type="button"
            className="config-action-btn config-action-btn--create"
            onClick={openConfigurarModal}
            disabled={!velohubAvailable || pendentes.length === 0}
            title={
              !velohubAvailable
                ? 'Sync VeloHub indisponível'
                : pendentes.length === 0
                  ? 'Todas as funções já estão configuradas'
                  : 'Configurar nova função do VeloHub'
            }
          >
            Configurar função
          </button>
        </div>
      </div>

      <div className="fp-accordions">
        <FuncoesDeskAccordion
          open={accordionDeskOpen}
          onToggle={() => setAccordionDeskOpen((v) => !v)}
          funcoes={funcoes}
          onSelectFuncao={openModal}
        />
        <FuncoesAgentesAccordion
          open={accordionAgentesOpen}
          onToggle={() => setAccordionAgentesOpen((v) => !v)}
          agentes={agentes}
          onSyncRequest={syncAgentes}
          syncing={syncingAgentes}
        />
      </div>

      {modalFuncao && draft ? (
        <FuncaoOverridesModal
          funcao={modalFuncao}
          catalog={catalog}
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onSave={save}
          onCancel={closeModal}
        />
      ) : null}

      {configurarModalOpen ? (
        <FuncaoConfigurarModal
          pendentes={pendentes}
          catalog={catalog}
          draft={configDraft}
          setDraft={setConfigDraft}
          selectedVelohub={selectedVelohub}
          onSelectVelohub={setSelectedVelohub}
          saving={savingConfig}
          onSave={saveNovaFuncao}
          onCancel={closeConfigurarModal}
          velohubAvailable={velohubAvailable}
        />
      ) : null}
    </div>
  );
}
