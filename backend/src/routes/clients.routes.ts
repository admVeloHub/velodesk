/** clients.routes v1.0.5 — GET por cpf ou e-mail */
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth';
import { getClienteModel } from '../models/Cliente';
import { findClienteByCpf, findClienteByEmail, normalizeCpf } from '../services/cliente.service';
import { env } from '../config/env';
import { getMongoStorageLabel, isCadastrosConnected } from '../config/database';

const router = Router();

router.get('/', authMiddleware, async (req, res: Response) => {
  try {
    if (!isCadastrosConnected()) {
      return res.status(503).json({ message: 'Banco b2c_cadastros indisponível' });
    }

    const cpf = normalizeCpf(req.query.cpf);
    const email = String(req.query.email ?? '').trim().toLowerCase();

    if (!cpf && !email) {
      return res.status(400).json({ message: 'Query cpf ou email é obrigatória' });
    }

    const cliente = cpf ? await findClienteByCpf(cpf) : await findClienteByEmail(email);
    if (!cliente) {
      const lookup = cpf ? `cpf=${cpf}` : `email=${email}`;
      console.log(`[clients] GET ${lookup} → 404 | db=${env.mongoCadastrosDbName} storage=${getMongoStorageLabel()}`);
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    const lookup = cpf ? `cpf=${cpf}` : `email=${email}`;
    console.log(`[clients] GET ${lookup} → 200 _id=${cliente._id} | storage=${getMongoStorageLabel()}`);
    res.json(cliente);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[clients] GET falhou:', message);
    res.status(500).json({ message: 'Erro ao consultar cliente' });
  }
});

router.get('/:id', authMiddleware, async (req, res: Response) => {
  if (!isCadastrosConnected()) {
    return res.status(503).json({ message: 'Banco b2c_cadastros indisponível' });
  }

  const id = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  const Cliente = getClienteModel();
  const cliente = await Cliente.findById(id);
  if (!cliente) return res.status(404).json({ message: 'Cliente não encontrado' });
  res.json(cliente);
});

router.post('/', authMiddleware, async (req, res: Response) => {
  if (!isCadastrosConnected()) {
    return res.status(503).json({ message: 'Banco b2c_cadastros indisponível' });
  }

  const dados = req.body?.clienteDados;
  if (!Array.isArray(dados) || dados.length === 0) {
    return res.status(400).json({ message: 'clienteDados[] é obrigatório' });
  }

  const cpf = normalizeCpf(dados[0]?.clienteCpf);
  if (cpf) {
    const exists = await findClienteByCpf(cpf);
    if (exists) {
      return res.status(409).json({ message: 'CPF já cadastrado' });
    }
  }

  const Cliente = getClienteModel();
  const cliente = await Cliente.create({
    clienteDados: dados,
    atendimentoHistorico: Array.isArray(req.body?.atendimentoHistorico)
      ? req.body.atendimentoHistorico
      : [],
  });
  const nome = String(dados[0]?.clienteNome ?? '').trim() || '(sem nome)';
  console.log(
    `[clients] POST criado _id=${cliente._id} cpf=${cpf || '-'} nome=${nome} | db=${env.mongoCadastrosDbName} storage=${getMongoStorageLabel()}`
  );
  res.status(201).json(cliente);
});

router.put('/:id', authMiddleware, async (req, res: Response) => {
  if (!isCadastrosConnected()) {
    return res.status(503).json({ message: 'Banco b2c_cadastros indisponível' });
  }

  const id = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  const Cliente = getClienteModel();
  const cliente = await Cliente.findById(id);
  if (!cliente) return res.status(404).json({ message: 'Cliente não encontrado' });

  if (Array.isArray(req.body?.clienteDados) && req.body.clienteDados.length > 0) {
    cliente.clienteDados = req.body.clienteDados;
  }

  if (Array.isArray(req.body?.atendimentoHistorico)) {
    cliente.atendimentoHistorico = req.body.atendimentoHistorico;
  }

  await cliente.save();
  res.json(cliente);
});

router.delete('/:id', authMiddleware, async (req, res: Response) => {
  if (!isCadastrosConnected()) {
    return res.status(503).json({ message: 'Banco b2c_cadastros indisponível' });
  }

  const id = String(req.params.id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  const Cliente = getClienteModel();
  const cliente = await Cliente.findByIdAndDelete(id);
  if (!cliente) return res.status(404).json({ message: 'Cliente não encontrado' });
  console.log(`[clients] DELETE _id=${id}`);
  res.json({ success: true });
});

export default router;
