import { z } from 'zod';

export const healthQuerySchema = z.object({
  /** `?details=true` adds runtime diagnostics (memory, node version, DB latency). */
  details: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type HealthQuery = z.infer<typeof healthQuerySchema>;
