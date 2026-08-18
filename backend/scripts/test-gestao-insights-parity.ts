/**
 * test-gestao-insights-parity v1.0.0 — valida que as agregações de volume/resumo/motivos
 * produzem EXATAMENTE os mesmos números da implementação JS anterior (find + laço).
 * Rode: npx tsx scripts/test-gestao-insights-parity.ts
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main() {
  const mem = await MongoMemoryServer.create();
  const uri = mem.getUri('velodesk');
  // Precisa existir ANTES de importar env (validado no import). Aponta para o mongo em memória.
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';

  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(uri, { dbName: 'velodesk' });

  const { ChamadoN1 } = await import('../src/models/ChamadoN1');
  const svc = await import('../src/services/gestaoInsights.service');

  const TZ = 'America/Sao_Paulo';
  const TERMINAL = new Set(['resolvido', 'cancelado', 'fechado']);
  const EM_ABERTO = ['novo', 'em-andamento', 'pendente'];

  // ---- implementações de referência (cópia da lógica JS anterior) ----
  function dayKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
  }
  function refResolvedAt(regs: any[]): Date | null {
    for (let i = regs.length - 1; i >= 0; i--) {
      if (TERMINAL.has(regs[i].status)) return new Date(regs[i].data);
    }
    return null;
  }
  function refFirstResp(regs: any[]): Date | null {
    for (const reg of regs) {
      if (reg.origin === 'agente' && String(reg.mensagemPublica ?? '').trim()) return new Date(reg.data);
    }
    return null;
  }
  function refLastStatus(regs: any[]): string {
    return regs.length ? regs[regs.length - 1].status || 'novo' : 'novo';
  }
  function fmt(ms: number): string {
    const totalMin = Math.max(0, Math.round(ms / 60000));
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  // ---- seed de casos-limite (mês corrente) ----
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = (day: number, h = 12) => new Date(Date.UTC(y, m, day, h + 3, 0, 0)); // ~horário BR
  const reg = (status: string, data: Date, extra: any = {}) => ({
    data, origin: 'agente', autor: 't', mensagemPublica: '', anexosMensagemPublica: [],
    anotacaoInterna: '', anexosAnotacaoInterna: [], alteracoes: [], metadados: {}, status, ...extra,
  });

  const docs: any[] = [
    // novo, sem resposta
    { createdAt: d(2), tabulacao: [{ produto: 'Cartão', motivo: 'Fatura' }], registro: [reg('novo', d(2))] },
    // em-andamento com 1ª resposta pública
    { createdAt: d(3), tabulacao: [{ produto: 'Cartão', motivo: 'Fatura' }],
      registro: [reg('novo', d(3)), reg('em-andamento', d(3, 2), { mensagemPublica: 'olá' })] },
    // resolvido no período (2 dias depois)
    { createdAt: d(4), tabulacao: [{ produto: 'Empréstimo', motivo: 'Juros' }],
      registro: [reg('novo', d(4)), reg('em-andamento', d(5), { mensagemPublica: 'oi' }), reg('resolvido', d(6))] },
    // múltiplos terminais: último vence (fechado)
    { createdAt: d(4), tabulacao: [{ produto: 'Empréstimo', motivo: 'Juros' }],
      registro: [reg('resolvido', d(7)), reg('em-andamento', d(8)), reg('fechado', d(9))] },
    // status final vazio => 'novo'
    { createdAt: d(5), tabulacao: [{ produto: '  Cartão  ', motivo: '  Fatura  ' }], registro: [reg('', d(5))] },
    // sem registro => 'novo', sem tabulacao válida
    { createdAt: d(5), tabulacao: [{ produto: '', motivo: '' }], registro: [] },
    // pendente
    { createdAt: d(6), tabulacao: [{ produto: 'PIX', motivo: 'Erro' }], registro: [reg('pendente', d(6))] },
    // em-espera (não conta em em-aberto)
    { createdAt: d(6), tabulacao: [{ produto: 'PIX', motivo: 'Erro' }], registro: [reg('em-espera', d(6))] },
    // cancelado no período
    { createdAt: d(7), tabulacao: [{ produto: 'PIX', motivo: 'Estorno' }], registro: [reg('cancelado', d(8))] },
    // criado ANTES do período (mês passado) mas resolvido no período — entra em encerrados, não em abertos
    { createdAt: new Date(Date.UTC(y, m - 1, 15, 15)), tabulacao: [{ produto: 'Cartão', motivo: 'Bloqueio' }],
      registro: [reg('novo', new Date(Date.UTC(y, m - 1, 15, 15))), reg('resolvido', d(10))] },
  ];
  // insere via driver bruto para permitir casos-limite (status '' legado, registro vazio)
  await ChamadoN1.collection.insertMany(docs);

  const range = svc.resolvePeriodRange({ period: 'mes' });
  const all = await ChamadoN1.find().lean();

  // ===== referência: getVolumeSeries (granularity dia) =====
  const keys = svc.dayKeysBetween(range);
  const refAbertos = new Map(keys.map((k) => [k, 0]));
  const refEnc = new Map(keys.map((k) => [k, 0]));
  for (const c of all as any[]) {
    const created = c.createdAt ? new Date(c.createdAt) : null;
    if (created && created >= range.start && created <= range.end) {
      const k = dayKey(created);
      if (refAbertos.has(k)) refAbertos.set(k, (refAbertos.get(k) ?? 0) + 1);
    }
    const rAt = refResolvedAt(c.registro ?? []);
    if (rAt && rAt >= range.start && rAt <= range.end) {
      const k = dayKey(rAt);
      if (refEnc.has(k)) refEnc.set(k, (refEnc.get(k) ?? 0) + 1);
    }
  }
  const newSeries = await svc.getVolumeSeries({ period: 'mes', granularity: 'dia' });
  for (const day of newSeries.series) {
    const a = refAbertos.get(day.date) ?? 0;
    const e = refEnc.get(day.date) ?? 0;
    assert(day.abertos === a, `volume abertos ${day.date}: novo=${day.abertos} ref=${a}`);
    assert(day.encerrados === e, `volume encerrados ${day.date}: novo=${day.encerrados} ref=${e}`);
  }

  // ===== referência: getVolumeSummary =====
  let refTotal = 0, refNovo = 0, refEmAberto = 0;
  for (const c of all as any[]) {
    const created = c.createdAt ? new Date(c.createdAt) : null;
    if (!(created && created >= range.start && created <= range.end)) continue;
    refTotal++;
    const st = refLastStatus(c.registro ?? []);
    if (st === 'novo') refNovo++;
    if (EM_ABERTO.includes(st)) refEmAberto++;
  }
  let tmaSum = 0, tmaN = 0, tmeSum = 0, tmeN = 0;
  for (const c of all as any[]) {
    const rAt = refResolvedAt(c.registro ?? []);
    if (!rAt || rAt < range.start || rAt > range.end) continue;
    const created = c.createdAt ? new Date(c.createdAt) : rAt;
    tmaSum += rAt.getTime() - created.getTime();
    tmaN++;
    const fr = refFirstResp(c.registro ?? []);
    if (fr) { tmeSum += fr.getTime() - created.getTime(); tmeN++; }
  }
  const newSummary = await svc.getVolumeSummary({ period: 'mes' });
  assert(newSummary.totalAbertos === refTotal, `resumo totalAbertos novo=${newSummary.totalAbertos} ref=${refTotal}`);
  assert(newSummary.totalNovo === refNovo, `resumo totalNovo novo=${newSummary.totalNovo} ref=${refNovo}`);
  assert(newSummary.totalEmAberto === refEmAberto, `resumo totalEmAberto novo=${newSummary.totalEmAberto} ref=${refEmAberto}`);
  const refTma = tmaN > 0 ? fmt(tmaSum / tmaN) : null;
  const refTme = tmeN > 0 ? fmt(tmeSum / tmeN) : null;
  assert(newSummary.tmaMedio === refTma, `resumo tma novo=${newSummary.tmaMedio} ref=${refTma}`);
  assert(newSummary.tmeMedio === refTme, `resumo tme novo=${newSummary.tmeMedio} ref=${refTme}`);

  // ===== referência: getTopMotivosPorProduto =====
  const refCounts = new Map<string, { produto: string; motivo: string; count: number }>();
  let refMotTotal = 0;
  for (const c of all as any[]) {
    const created = c.createdAt ? new Date(c.createdAt) : null;
    if (!(created && created >= range.start && created <= range.end)) continue;
    const tab = c.tabulacao?.[c.tabulacao.length - 1];
    const produto = String(tab?.produto ?? '').trim();
    const motivo = String(tab?.motivo ?? '').trim();
    if (!produto || !motivo) continue;
    refMotTotal++;
    const key = `${produto}::${motivo}`;
    const ex = refCounts.get(key);
    if (ex) ex.count++; else refCounts.set(key, { produto, motivo, count: 1 });
  }
  const refItems = [...refCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10)
    .map((e) => ({ ...e, pct: refMotTotal > 0 ? Math.round((e.count / refMotTotal) * 1000) / 10 : 0 }));
  const newMot = await svc.getTopMotivosPorProduto({ period: 'mes' }, 10);
  assert(newMot.total === refMotTotal, `motivos total novo=${newMot.total} ref=${refMotTotal}`);
  assert(newMot.items.length === refItems.length, `motivos len novo=${newMot.items.length} ref=${refItems.length}`);
  // compara ordenado por chave para não depender de empates de ordenação
  const sortKey = (i: any) => `${i.produto}::${i.motivo}`;
  const na = [...newMot.items].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const ra = [...refItems].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  for (let i = 0; i < ra.length; i++) {
    assert(na[i].produto === ra[i].produto && na[i].motivo === ra[i].motivo, `motivos chave[${i}] novo=${sortKey(na[i])} ref=${sortKey(ra[i])}`);
    assert(na[i].count === ra[i].count, `motivos count ${sortKey(ra[i])} novo=${na[i].count} ref=${ra[i].count}`);
    assert(na[i].pct === ra[i].pct, `motivos pct ${sortKey(ra[i])} novo=${na[i].pct} ref=${ra[i].pct}`);
  }

  console.log('OK — paridade confirmada (volume, resumo, motivos)');
  console.log(`  resumo: totalAbertos=${refTotal} novo=${refNovo} emAberto=${refEmAberto} tma=${refTma} tme=${refTme}`);
  console.log(`  motivos: total=${refMotTotal} itens=${refItems.length}`);

  await mongoose.disconnect();
  await mem.stop();
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FALHA DE PARIDADE: ${msg}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
