import type { RequestHandler } from 'express';
import { sendSuccess } from '../../common/http/api-response';
import type { HealthQuery } from './health.schema';
import { getHealthReport } from './health.service';

export const getHealth: RequestHandler = async (req, res) => {
  // `req.query` has been parsed by the validate middleware.
  const { details } = req.query as unknown as HealthQuery;
  const report = await getHealthReport(details);

  if (report.status === 'ok') {
    sendSuccess(res, report);
  } else {
    res.status(503).json({ success: false, data: report });
  }
};
