/**
 * Client DB localStorage
 * VERSION: v1.0.0 | DATE: 2026-06-18
 */
export function getClientDB() {
  try {
    return JSON.parse(localStorage.getItem('velodeskClientDB') || '{}');
  } catch {
    return {};
  }
}

export function saveClientDB(db) {
  localStorage.setItem('velodeskClientDB', JSON.stringify(db));
}

export function lookupClient(cpfRaw) {
  const digits = String(cpfRaw || '').replace(/\D/g, '');
  if (!digits) return null;
  return getClientDB()[digits] || null;
}

export function searchClients(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const db = getClientDB();
  return Object.keys(db)
    .map((k) => db[k])
    .filter((c) => {
      const hay = [c.name, c.cpf, c.email, c.telefone].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0 || String(c.cpf || '').replace(/\D/g, '').indexOf(q.replace(/\D/g, '')) >= 0;
    });
}

export function resetClientDB() {
  const db = {
    '12345678901': {
      cpf: '123.456.789-01', name: 'Maria Oliveira', email: 'maria.oliveira@email.com',
      telefone: '(11) 98765-4321', situacao: 'Adimplente', produtos: ['Internet Fibra', 'TV'],
      risco: 'Baixo', termometro: 38, termometroLabel: 'Estável'
    },
    '98765432100': {
      cpf: '987.654.321-00', name: 'João Pereira', email: 'joao.pereira@email.com',
      telefone: '(11) 91234-5678', situacao: 'Inadimplente', produtos: ['Móvel', 'Combo'],
      risco: 'Alto', termometro: 88, termometroLabel: 'Crítico'
    },
    '11122233344': {
      cpf: '111.222.333-44', name: 'Empresa Tech Ltda', email: 'contato@empresatech.com.br',
      telefone: '(11) 3456-7890', situacao: 'Adimplente', produtos: ['Internet Fibra'],
      risco: 'Médio', termometro: 62, termometroLabel: 'Atenção'
    },
    '45678912345': {
      cpf: '456.789.123-45', name: 'João Ferreira', email: 'joao.ferreira@email.com',
      telefone: '(11) 99876-5432', situacao: 'Adimplente', produtos: ['Internet Fibra'],
      risco: 'Baixo', termometro: 45, termometroLabel: 'Estável'
    },
    '55566677788': {
      cpf: '555.666.777-88', name: 'Carlos Mendes', email: 'carlos.mendes@email.com',
      telefone: '(11) 97654-3210', situacao: 'Adimplente', produtos: ['TV'],
      risco: 'Médio', termometro: 52, termometroLabel: 'Atenção'
    }
  };
  saveClientDB(db);
  return db;
}

export function getAgentName() {
  try {
    const user = JSON.parse(localStorage.getItem('velodesk_user') || '{}');
    return user.name || 'Ana Silva';
  } catch {
    return 'Ana Silva';
  }
}
