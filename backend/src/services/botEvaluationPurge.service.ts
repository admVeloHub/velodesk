/** botEvaluationPurge.service v1.0.0 — expurgo tickets pesquisa avaliação bot */
import { ChamadoN1 } from '../models/ChamadoN1';

export function buildBotEvaluationTicketFilter() {
  return {
    $or: [
      { 'registro.metadados.emailFrom': { $regex: /^info@velotax\.info$/i } },
      {
        chamadoTitulo: {
          $regex: /avaliação da central de ajuda|avaliacao da central de ajuda|pesquisa de satisfação|pesquisa de satisfacao/i,
        },
      },
      {
        'registro.metadados.emailSubject': {
          $regex: /avaliação da central de ajuda|avaliacao da central de ajuda|pesquisa de satisfação|pesquisa de satisfacao/i,
        },
      },
      {
        $and: [
          { 'registro.metadados.emailFrom': { $regex: /^mailer-daemon@googlemail\.com$/i } },
          {
            $or: [
              { chamadoTitulo: { $regex: /delivery status notification|mail delivery failed|undelivered mail/i } },
              {
                'registro.metadados.emailSubject': {
                  $regex: /delivery status notification|mail delivery failed|undelivered mail/i,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

export async function purgeBotEvaluationTickets(): Promise<number> {
  const result = await ChamadoN1.deleteMany(buildBotEvaluationTicketFilter());
  return result.deletedCount ?? 0;
}

export async function countBotEvaluationTickets(): Promise<number> {
  return ChamadoN1.countDocuments(buildBotEvaluationTicketFilter());
}
