/** seed.service v1.1.3 — dev seed em b2c_chamados (chamados_n1 + auxiliares) */
import bcrypt from 'bcryptjs';
import { Box } from '../models/Box';
import { ChamadoN1 } from '../models/ChamadoN1';
import { User } from '../models/User';
import { Form } from '../models/Form';
import { env } from '../config/env';
import { createChamadoFromBody } from './chamado.mapper';

const DEFAULT_BOXES = ['Novos', 'Em aberto', 'Em espera', 'Pendente', 'Resolvido'];

export async function seedDevelopmentData() {
  if (env.nodeEnv !== 'development') return;

  let admin = await User.findOne({ email: 'admin@velodesk.local' });
  if (!admin) {
    const hash = await bcrypt.hash('admin123', 10);
    admin = await User.create({
      name: 'Admin Velodesk',
      email: 'admin@velodesk.local',
      password: hash,
      role: 'supervisor',
    });
    console.log('Seed: usuário admin@velodesk.local / admin123');
  }

  const boxCount = await Box.countDocuments();
  if (boxCount === 0) {
    await Box.insertMany(DEFAULT_BOXES.map((name, order) => ({ name, order })));
    console.log('Seed: colunas Kanban criadas');
  } else {
    await Box.updateOne({ name: 'Novo' }, { name: 'Novos' });
  }

  const chamadoCount = await ChamadoN1.countDocuments();
  if (chamadoCount === 0) {
    await ChamadoN1.create(
      createChamadoFromBody(
        {
          chamadoTitulo: 'Lentidão Internet Fibra',
          title: 'Lentidão Internet Fibra',
          description: 'Cliente reporta lentidão no plano 500Mbps',
          clientName: 'Maria Silva',
          clientCPF: '12345678901',
          responsibleAgent: admin.name,
          lateralForm: {
            classificacaoTipo: 'Reclamação',
            produto: 'Internet Fibra',
            motivo: 'Lentidão',
            detalhe: 'Em análise',
            responsavel: admin.name,
          },
        },
        'novo'
      )
    );
    console.log('Seed: chamado demo em chamados_n1');
  } else {
    await ChamadoN1.updateMany(
      { $or: [{ chamadoTitulo: '' }, { chamadoTitulo: { $exists: false } }] },
      [{ $set: { chamadoTitulo: { $ifNull: [{ $arrayElemAt: ['$tabulacao.motivo', 0] }, ''] } } }]
    );
    await ChamadoN1.updateMany(
      { $or: [{ 'tabulacao.responsavel': '' }, { 'tabulacao.responsavel': { $exists: false } }] },
      { $set: { 'tabulacao.0.responsavel': admin.name } }
    );
  }

  const formCount = await Form.countDocuments();
  if (formCount === 0) {
    await Form.create({
      name: 'Tabulação padrão',
      description: 'Formulário de classificação',
      fields: [{ id: '1', label: 'Tabulação', type: 'tree' }],
    });
  }
}
