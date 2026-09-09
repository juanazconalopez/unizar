import { supabase } from '../lib/supabase'
import type { ConfigurableRole, PermissionDefinition, PermissionKey, RolePermission } from '../lib/permissions'

export type PermissionConfiguration = {
  definitions: PermissionDefinition[]
  grants: RolePermission[]
}

export async function fetchMyPermissions(): Promise<PermissionKey[]> {
  const { data, error } = await supabase.rpc('get_my_permissions')
  if (error) throw error
  return (data ?? []) as PermissionKey[]
}

export async function fetchPermissionConfiguration(): Promise<PermissionConfiguration> {
  const [definitionsResponse, grantsResponse] = await Promise.all([
    supabase.from('permission_definitions').select('*').eq('active', true).order('sort_order'),
    supabase.from('role_permissions').select('role, permission_key').eq('enabled', true),
  ])
  if (definitionsResponse.error) throw definitionsResponse.error
  if (grantsResponse.error) throw grantsResponse.error
  return {
    definitions: (definitionsResponse.data ?? []) as PermissionDefinition[],
    grants: (grantsResponse.data ?? []) as RolePermission[],
  }
}

export async function saveRolePermissions(role: ConfigurableRole, permissions: PermissionKey[]) {
  const { error } = await supabase.rpc('set_role_permissions', { checked_role: role, checked_permissions: permissions })
  if (error) throw error
}

export async function resetRolePermissions(role: ConfigurableRole) {
  const { error } = await supabase.rpc('reset_role_permissions', { checked_role: role })
  if (error) throw error
}
