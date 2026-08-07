/**
 * WorkflowRequisicaoForm v1.2.0 — erros/bugs: anexos inline, sem evidência coletada
 * VERSION: v1.2.0 | DATE: 2026-08-06
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { getAgentName } from '../../../services/desk/utils';
import { persistAttachmentEntries } from '../../../services/cadastral/cadastralAttachmentStore';
import ProdSolicAttachments, {
  revokeAttachmentPreviews,
} from '../../cadastral/components/ProdSolicAttachments';
import {
  resolveRequisicaoCamposVisiveis,
  validateRequisicaoFormValues,
} from '../../../services/workflow/workflowRequisicao';

const EMPTY_ATTACHMENTS = {
  imagens: [],
  videos: [],
  recusouEvidencias: false,
};

function normalizeFieldToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function shouldHideRequisicaoCampo(campo) {
  const id = normalizeFieldToken(campo.id);
  const label = normalizeFieldToken(campo.label);
  return id.includes('evidencia') || label.includes('evidencia coletada');
}

function isDescricaoCampo(campo) {
  const id = normalizeFieldToken(campo.id);
  const label = normalizeFieldToken(campo.label);
  return id.includes('descri') || label.includes('descri');
}

function isTipoErroCampo(campo) {
  const id = normalizeFieldToken(campo.id);
  const label = normalizeFieldToken(campo.label);
  return (id.includes('tipo') && id.includes('erro')) || label.includes('tipo de erro');
}

export function isErrosBugsWorkflowRequisicao(workflowDef, campos) {
  const title = normalizeFieldToken(workflowDef?.title);
  if (title.includes('erro') && title.includes('bug')) return true;
  return campos.some(isTipoErroCampo) && campos.some(isDescricaoCampo);
}

function mapTipoErroValue(raw) {
  const text = normalizeFieldToken(raw);
  if (text.includes('conta')) return 'conta';
  if (text.includes('app')) return 'app';
  return text || 'app';
}

function buildErrosBugsSolicitacao(ticket, valores, anexosImagens, anexosVideos) {
  const lf = ticket?.lateralForm || {};
  const descricaoKey = Object.keys(valores).find((key) => normalizeFieldToken(key).includes('descri'));
  const tipoKey = Object.keys(valores).find((key) => {
    const n = normalizeFieldToken(key);
    return n.includes('tipo') && n.includes('erro');
  });
  const descricao = String(descricaoKey ? valores[descricaoKey] : '').trim();
  const tipoErro = mapTipoErroValue(tipoKey ? valores[tipoKey] : '');

  return {
    categoria: 'erros-bugs',
    cpf: ticket?.clientCPF || lf.clienteCpf || lf.cpf || '',
    ticketId: String(ticket?.id || ticket?._id || ''),
    tipoErro,
    dadoNovo: descricao,
    observacoes: descricao,
    anexosImagens,
    anexosVideos,
    clienteRecusouEvidencias: false,
    colaborador: getAgentName() || '',
    createdAt: new Date().toISOString(),
  };
}

function RequisicaoFieldInput({ campo, value, onChange, error }) {
  const id = `wf-req-${campo.id}`;

  if (campo.tipo === 'textarea') {
    return (
      <textarea
        id={id}
        className={`wf-requisicao-form__input${error ? ' is-error' : ''}`}
        rows={3}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (campo.tipo === 'select') {
    return (
      <select
        id={id}
        className={`wf-requisicao-form__input${error ? ' is-error' : ''}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione…</option>
        {(campo.opcoes || []).map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>{opcao.label || opcao.valor}</option>
        ))}
      </select>
    );
  }

  if (campo.tipo === 'boolean') {
    return (
      <label className="wf-requisicao-form__boolean">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>Sim</span>
      </label>
    );
  }

  const inputType = campo.tipo === 'number' || campo.tipo === 'currency'
    ? 'number'
    : campo.tipo === 'date'
      ? 'date'
      : 'text';

  return (
    <input
      id={id}
      type={inputType}
      className={`wf-requisicao-form__input${error ? ' is-error' : ''}`}
      value={value ?? ''}
      step={campo.tipo === 'currency' ? '0.01' : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function WorkflowRequisicaoForm({
  workflowDef,
  ticket,
  submitting = false,
  onCancel,
  onSubmit,
}) {
  const { showNotification } = useNotifications();
  const allCampos = useMemo(
    () => resolveRequisicaoCamposVisiveis(workflowDef?.raw || workflowDef),
    [workflowDef],
  );
  const campos = useMemo(
    () => allCampos.filter((campo) => !shouldHideRequisicaoCampo(campo)),
    [allCampos],
  );
  const isErrosBugs = useMemo(
    () => isErrosBugsWorkflowRequisicao(workflowDef, allCampos),
    [workflowDef, allCampos],
  );

  const [valores, setValores] = useState(() => {
    const initial = {};
    campos.forEach((campo) => {
      initial[campo.id] = campo.tipo === 'boolean' ? false : '';
    });
    return initial;
  });
  const [attachments, setAttachments] = useState(EMPTY_ATTACHMENTS);
  const [errors, setErrors] = useState({});

  useEffect(() => () => {
    revokeAttachmentPreviews(attachments.imagens, attachments.videos);
  }, [attachments.imagens, attachments.videos]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateRequisicaoFormValues(campos, valores);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      let solicitacaoProdutos = null;
      if (isErrosBugs && ticket) {
        const hasAnexos = attachments.imagens.length > 0 || attachments.videos.length > 0;
        const { anexosImagens, anexosVideos } = hasAnexos
          ? await persistAttachmentEntries(attachments.imagens, attachments.videos)
          : { anexosImagens: [], anexosVideos: [] };
        solicitacaoProdutos = buildErrosBugsSolicitacao(ticket, valores, anexosImagens, anexosVideos);
        revokeAttachmentPreviews(attachments.imagens, attachments.videos);
      }

      onSubmit?.({
        valores,
        ...(solicitacaoProdutos ? { solicitacaoProdutos } : {}),
      });
    } catch (err) {
      showNotification(err?.message || 'Não foi possível preparar os anexos.', 'error');
    }
  };

  if (!campos.length) return null;

  return (
    <form className="wf-requisicao-form" onSubmit={handleSubmit}>
      <header className="wf-requisicao-form__head">
        <p className="wf-requisicao-form__eyebrow">Iniciar workflow</p>
        <h2 className="wf-requisicao-form__title">{workflowDef?.title || 'Requisição'}</h2>
        <p className="wf-requisicao-form__hint">
          Preencha apenas os dados complementares. CPF, produto, motivo e detalhe já estão na tabulação.
        </p>
      </header>

      <div className="wf-requisicao-form__fields">
        {campos.map((campo) => (
          <div key={campo.id} className="wf-requisicao-form__field">
            <span className="wf-requisicao-form__label">
              {campo.label}
              {campo.obrigatorio ? <em aria-hidden="true"> *</em> : null}
            </span>
            {campo.ajuda ? <span className="wf-requisicao-form__help">{campo.ajuda}</span> : null}
            <RequisicaoFieldInput
              campo={campo}
              value={valores[campo.id]}
              error={errors[campo.id]}
              onChange={(next) => setValores((prev) => ({ ...prev, [campo.id]: next }))}
            />
            {isErrosBugs && isDescricaoCampo(campo) ? (
              <div className="wf-requisicao-form__attachments">
                <ProdSolicAttachments
                  imagens={attachments.imagens}
                  videos={attachments.videos}
                  recusouEvidencias={false}
                  onChange={setAttachments}
                  showNotification={showNotification}
                  hideLabel
                  hideRecusa
                />
              </div>
            ) : null}
            {errors[campo.id] ? (
              <span className="wf-requisicao-form__error">{errors[campo.id]}</span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="wf-requisicao-form__actions">
        <button type="button" className="wf-requisicao-form__btn wf-requisicao-form__btn--ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="wf-requisicao-form__btn wf-requisicao-form__btn--primary" disabled={submitting}>
          {submitting ? 'Iniciando…' : 'Iniciar workflow'}
        </button>
      </div>
    </form>
  );
}
