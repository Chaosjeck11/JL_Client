import { getCurrentUser } from "./currentUser";

export function canEditMembers(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 5;
}

export function canCreateMembers(): boolean {
  return canEditMembers();
}

export function canManageFinance(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 5;
}
