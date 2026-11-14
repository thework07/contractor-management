import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ForbiddenError, UnauthorizedError } from '../../../common/errors';
import { getCentralModels } from '../models/central.models';
import { env, isProduction } from '../../../config/env';

const developmentEmailSchema = z.string().trim().email().max(254);
const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 11000;

export const requireAuthentication: RequestHandler = async (req, _res, next) => {
  if (isProduction || !env.DEV_AUTH_ENABLED) {
    return next(new UnauthorizedError('Authentication is not configured'));
  }

  const parsedEmail = developmentEmailSchema.safeParse(req.header('x-dev-user-email'));
  if (!parsedEmail.success) {
    return next(new UnauthorizedError('Development authentication requires x-dev-user-email'));
  }

  try {
    const email = parsedEmail.data.toLowerCase();
    const models = getCentralModels();
    let user;
    try {
      user = await models.User.findOneAndUpdate(
        { email },
        {
          $setOnInsert: {
            email,
            displayName: 'Development User',
            status: 'active',
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      ).select('_id email status');
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      user = await models.User.findOne({ email }).select('_id email status');
    }

    if (!user || user.status !== 'active') {
      return next(new ForbiddenError('This user account is not active'));
    }

    req.auth = { userId: user._id.toString(), email: user.email };
    next();
  } catch (error) {
    next(error);
  }
};
