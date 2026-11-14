import { z } from 'zod';

export const tenantRegistrationSchema = z
  .object({
    organizationName: z.string().trim().min(2).max(120),
  })
  .strict();

export const tenantTestRecordSchema = z
  .object({
    value: z.string().trim().min(1).max(500),
  })
  .strict();

export type TenantRegistrationBody = z.infer<typeof tenantRegistrationSchema>;
export type TenantTestRecordBody = z.infer<typeof tenantTestRecordSchema>;
