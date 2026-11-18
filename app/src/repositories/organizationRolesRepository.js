/**
 * organizationRolesRepository.js
 * Repositorio para `organization_roles` (PK `role_key`, GEMINI.md §3) sobre `_baseRepository.js` + `OrganizationRoleSchema`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { OrganizationRoleSchema } from '../schemas/organizationRoles.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createOrganizationRolesRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'organization_roles',
    primaryKey: 'role_key',
    schema: OrganizationRoleSchema,
    client,
  })

  return {
    ...base,

    async listRoles({ select = '*', orderBy = [{ column: 'department', ascending: true }] } = {}) {
      return base.findAll({ select, orderBy })
    },

    async countRoles() {
      return base.findAll({ select: 'role_key', head: true })
    },

    async updateRoleByKey(roleKey, patch, opts = {}) {
      return base.updateById(roleKey, patch, opts)
    },

    async upsertRole(payload, opts = {}) {
      return base.upsertOne(payload, { onConflict: 'role_key', ...opts })
    },
  }
}

export const organizationRolesRepository = createOrganizationRolesRepository()
export default organizationRolesRepository
