/**
 * Workspace360NewsPopover v1.1.0 — noticiário breve + modal ao clicar
 */
import React, { useEffect, useState, useCallback } from 'react';
import Workspace360NewsModal from './Workspace360NewsModal';

export const WS360_DEMO_NEWS = [
  {
    id: 'news-desk-tabs',
    category: 'Produto',
    title: 'Abas de tickets no Desk CRM',
    excerpt: 'Agora você pode abrir vários tickets ao mesmo tempo e alternar entre eles sem perder o rascunho da resposta.',
    time: 'Hoje · 09:15',
    unread: true,
    body: [
      'O Desk CRM passa a suportar múltiplas abas de tickets na coluna central do atendimento. Cada ticket aberto mantém sua própria sessão: rascunho de resposta, aba Conversa ou Notas, campos do painel lateral e chat WhatsApp.',
      'Para abrir uma nova aba, basta selecionar outro ticket na lista — o ticket anterior permanece aberto no topo, acima do perfil do cliente. Use o botão × em cada aba para fechá-la. Ao alternar entre abas, o conteúdo digitado é preservado automaticamente.',
      'Esta melhoria reduz o tempo de contexto ao atender clientes simultâneos e evita perda de rascunhos ao alternar filas ou prioridades durante o turno.',
    ],
  },
  {
    id: 'news-sla',
    category: 'Operação',
    title: 'SLA reforçado na fila Urgente',
    excerpt: 'Tickets com prioridade alta passam a exibir alerta visual após 12 minutos sem resposta do agente.',
    time: 'Ontem · 17:40',
    unread: true,
    body: [
      'A fila Urgente recebeu um reforço no monitoramento de SLA de primeira resposta. Tickets classificados como prioridade alta exibem indicador visual no Painel 360° após 12 minutos sem interação do agente responsável.',
      'O alerta aparece na seção "Ação imediata" e também no badge de fila. Supervisores podem acompanhar casos escalados em tempo real pelo painel operacional, sem necessidade de consultar relatórios externos.',
      'Recomendação: priorize tickets com indicador vermelho antes de iniciar novos atendimentos em filas secundárias. Em caso de dúvida sobre priorização, consulte o líder de turno.',
    ],
  },
  {
    id: 'news-macros',
    category: 'Dica',
    title: 'Macros F1–F4 no atendimento',
    excerpt: 'Use a Central de opções no compose para inserir saudação, aguardar retorno, escalonamento ou encerramento NPS.',
    time: '18 jun · 11:00',
    unread: true,
    body: [
      'As macros de resposta rápida estão disponíveis na aba Conversa do Desk CRM, no menu "Central de opções" abaixo do campo de texto.',
      'F1 — Saudação padrão: mensagem de boas-vindas para abertura do atendimento. F2 — Aguardar retorno: confirma análise em andamento. F3 — Escalonamento: informa encaminhamento à equipe especializada. F4 — Encerramento NPS: solicita avaliação ao finalizar o ticket.',
      'Personalize o texto após inserir a macro, se necessário, antes de enviar ao cliente. As macros funcionam apenas em resposta pública — anotações internas continuam no fluxo da aba Notas ou no modo interno do compose.',
    ],
  },
];

export function getWs360NewsUnreadCount(items = WS360_DEMO_NEWS, readIds = []) {
  const readSet = new Set(readIds);
  return items.filter((item) => item.unread && !readSet.has(item.id)).length;
}

export default function Workspace360NewsPopover({ open, onClose, anchorRef, onUnreadChange }) {
  const [selectedNews, setSelectedNews] = useState(null);
  const [readIds, setReadIds] = useState([]);

  const markRead = useCallback((id) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      onUnreadChange?.(getWs360NewsUnreadCount(WS360_DEMO_NEWS, next));
      return next;
    });
  }, [onUnreadChange]);

  useEffect(() => {
    if (!open) setSelectedNews(null);
  }, [open]);

  useEffect(() => {
    onUnreadChange?.(getWs360NewsUnreadCount(WS360_DEMO_NEWS, readIds));
  }, [onUnreadChange, readIds]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointer = (e) => {
      if (selectedNews) return;
      if (anchorRef?.current?.contains(e.target)) return;
      if (e.target.closest?.('.ws360-news-popover')) return;
      onClose();
    };

    const handleKey = (e) => {
      if (selectedNews) return;
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose, anchorRef, selectedNews]);

  const handleOpenArticle = (item) => {
    markRead(item.id);
    setSelectedNews(item);
  };

  const handleCloseModal = () => {
    setSelectedNews(null);
  };

  return (
    <>
      {open ? (
        <div className="ws360-news-popover" role="dialog" aria-label="Noticiário Velodesk">
        <div className="ws360-news-popover__header">
          <div>
            <h3 className="ws360-news-popover__title">Noticiário Velodesk</h3>
            <p className="ws360-news-popover__subtitle">Atualizações e avisos para o time de atendimento</p>
          </div>
          <button
            type="button"
            className="ws360-news-popover__close"
            onClick={onClose}
            aria-label="Fechar noticiário"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <ul className="ws360-news-popover__list">
          {WS360_DEMO_NEWS.map((item) => {
            const isUnread = item.unread && !readIds.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={'ws360-news-popover__item' + (isUnread ? ' is-unread' : '')}
                  onClick={() => handleOpenArticle(item)}
                >
                  <span className="ws360-news-popover__category">{item.category}</span>
                  <strong className="ws360-news-popover__item-title">{item.title}</strong>
                  <p className="ws360-news-popover__excerpt">{item.excerpt}</p>
                  <time className="ws360-news-popover__time">{item.time}</time>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="ws360-news-popover__footer">
          <span className="ws360-news-popover__hint">Toque em uma notícia para ler o conteúdo completo.</span>
        </div>
      </div>
      ) : null}
      <Workspace360NewsModal
        open={!!selectedNews}
        article={selectedNews}
        onClose={handleCloseModal}
      />
    </>
  );
}
