/** TicketsOpenTabs v1.5.2 — onCreateNew síncrono (rascunho local) */
import { FormEvent, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { Button, TextField } from '@mui/material';
import { isAxiosError } from 'axios';
import { Ticket } from '../../types';
import { getTicketTabLabel } from './ticketTabLabel';

interface Props {
  tabs: Ticket[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onSearchProtocol: (protocolo: string) => Promise<void>;
  onCreateNew: () => void;
}

export default function TicketsOpenTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onSearchProtocol,
  onCreateNew,
}: Props) {
  const [protocolQuery, setProtocolQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const submitSearch = async () => {
    const protocolo = protocolQuery.trim();
    if (!protocolo || isSearching) return;

    setSearchError(null);
    setIsSearching(true);

    try {
      await onSearchProtocol(protocolo);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        setSearchError('Protocolo não encontrado');
      } else {
        setSearchError('Não foi possível buscar o protocolo');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitSearch();
  };

  const handleCreateNew = () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      onCreateNew();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="tickets-tab-bar">
      <div className="tickets-tab-bar__faixa" aria-hidden="true" />
      <div className="tickets-tab-bar__row">
        <div className="tickets-tab-bar__tabs" role="tablist" aria-label="Chamados abertos">
          {tabs.map((ticket) => {
            const isActive = ticket._id === activeId;
            const tabLabel = getTicketTabLabel(ticket);

            return (
              <div
                key={ticket._id}
                role="tab"
                aria-selected={isActive}
                className={`tickets-tab-bar__tab${isActive ? ' tickets-tab-bar__tab--active' : ''}`}
              >
                <button
                  type="button"
                  className="tickets-tab-bar__label"
                  onClick={() => onSelect(ticket._id)}
                  title={tabLabel}
                >
                  {tabLabel}
                </button>
                <button
                  type="button"
                  className="tickets-tab-bar__close"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(ticket._id);
                  }}
                  aria-label={`Fechar ${tabLabel}`}
                  title="Fechar chamado"
                >
                  <CloseIcon fontSize="inherit" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="tickets-tab-bar__actions">
          <Button
            type="button"
            variant="contained"
            color="primary"
            size="small"
            className="tickets-tab-bar__novo-btn"
            disabled={isCreating || isSearching}
            onClick={() => void handleCreateNew()}
          >
            Novo
          </Button>
          <form className="tickets-tab-bar__search-wrap" onSubmit={handleSubmit}>
            <TextField
              className="tickets-tab-bar__search"
              label={
                <span className="tickets-tab-bar__search-label">
                  <SearchIcon className="tickets-tab-bar__search-label-icon" aria-hidden="true" />
                  protocolo
                </span>
              }
              variant="outlined"
              size="small"
              value={protocolQuery}
              disabled={isSearching || isCreating}
              error={Boolean(searchError)}
              helperText={searchError || undefined}
              onChange={(event) => {
                setProtocolQuery(event.target.value);
                if (searchError) setSearchError(null);
              }}
              slotProps={{ htmlInput: { 'aria-label': 'Buscar por protocolo' } }}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
