import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV_ITEMS } from './profiles.js';

test('sidebar exposes finalized workflow item under Busca de Tickets', () => {
  const buscaIndex = NAV_ITEMS.findIndex((item) => item.id === 'busca-tickets');
  const finalizadosIndex = NAV_ITEMS.findIndex((item) => item.id === 'workflow-finalizados');

  assert.ok(buscaIndex >= 0, 'Busca de Tickets should exist');
  assert.ok(finalizadosIndex >= 0, 'Finalizados item should exist');
  assert.ok(finalizadosIndex > buscaIndex, 'Finalizados should be placed below Busca de Tickets');
  assert.equal(NAV_ITEMS[finalizadosIndex].label, 'Finalizados');
});
