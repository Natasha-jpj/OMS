// lib/serverAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Employee from '@/models/Employee';
import Role, { IPermissions } from '@/models/Role';

export type PermissionKey = keyof IPermissions;

export const defaultPermissions: IPermissions = {
  canCheckIn: false,
  canManageEmployees: false,
  canManageDepartments: false,
  canManageRoles: false,
  canAssignTasks: false,
  canViewAllTasks: false,
  canViewTasks: true,
  canViewReports: false,
};

export async function getUserAndPerms(req: NextRequest) {
  await dbConnect();

  // You already pass x-user-id from the client in many places.
  const userId = req.headers.get('x-user-id') || '';

  if (!userId) {
    return { user: null as any, role: null as any, permissions: { ...defaultPermissions } };
  }

  const user = await Employee.findById(userId).lean();
  if (!user) {
    return { user: null as any, role: null as any, permissions: { ...defaultPermissions } };
  }

  // Employee.role is a string name (e.g., "Admin", "Employee")
  const roleDoc = await Role.findOne({ name: user.role }).lean();
  const permissions: IPermissions = roleDoc?.permissions ?? { ...defaultPermissions };

  return { user, role: roleDoc, permissions };
}

/**
 * Quick guard for API routes:
 *   const forbidden = await requirePermission(req, 'canManageEmployees');
 *   if (forbidden) return forbidden;
 */
export async function requirePermission(req: NextRequest, key: PermissionKey) {
  const { permissions } = await getUserAndPerms(req);
  if (!permissions?.[key]) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
