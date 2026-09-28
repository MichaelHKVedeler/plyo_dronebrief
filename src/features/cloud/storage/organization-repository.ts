import { z } from 'zod'
import { callCloud } from '../auth/firebase'
import { writeCloud } from './read-request'
import { grantSchema, membershipSchema, roleSchema } from '../model/cloud'

export const cloudOrganizations = {
  async list(orgId: string) { return z.object({ grants: z.array(grantSchema), members: z.array(membershipSchema) }).parse(await callCloud('organization', { orgId, action: 'list' })) },
  add(orgId: string, email: string) { return writeCloud('organization', { orgId, action: 'add', email, role: 'member' }) },
  setRole(orgId: string, grantId: string, role: string) { return writeCloud('organization', { orgId, action: 'role', grantId, role: roleSchema.parse(role) }) },
  remove(orgId: string, grantId: string) { return writeCloud('organization', { orgId, action: 'remove', grantId }) },
  create(sourceOrgId: string, name: string, operationId: string) { return writeCloud('createOrganization', { sourceOrgId, name, operationId }) },
}
