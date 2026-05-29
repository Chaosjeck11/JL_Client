import { getCurrentUser } from "./currentUser";

// L2+ — see full member details (not just name)
export function canSeeMemberDetails(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 2;
}

// L3+ — edit/create/deactivate members
export function canEditMembers(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 3;
}

export function canCreateMembers(): boolean {
  return canEditMembers();
}

// L5 only — write member attachments (upload/delete)
export function canWriteMemberAttachments(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 5;
}

// L2+ — create/edit/delete events, kategorien, form rows
export function canWriteEvents(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 2;
}

// L5 only — PATCH form template
export function canWriteFormTemplate(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 5;
}

// L1 || L3+  (non-linear: NOT L2)
export function canWriteStrafen(): boolean {
  const user = getCurrentUser();
  return !!user && (user.accessLevel === 1 || user.accessLevel >= 3);
}

// L1 || L3+ — read all strafen entries, not just own
export function canSeeAllStrafen(): boolean {
  const user = getCurrentUser();
  return !!user && (user.accessLevel === 1 || user.accessLevel >= 3);
}

// L1 || L3+ — create/edit grund/delete strafen entries
export function canWriteStrafeEintraege(): boolean {
  const user = getCurrentUser();
  return !!user && (user.accessLevel === 1 || user.accessLevel >= 3);
}

// L1 || L4+ — mark bezahlt / stornieren on strafen entries
export function canMarkStrafeGezahlt(): boolean {
  const user = getCurrentUser();
  return !!user && (user.accessLevel === 1 || user.accessLevel >= 4);
}

// L3+ — read finance (kassenbuch, beitraege)
export function canSeeFinance(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 3;
}

// L4+ — write finance (transactions, business years, categories, attachments)
export function canWriteFinance(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 4;
}

// L4+ — mark beitraege as bezahlt / stornieren
export function canPayBeitraege(): boolean {
  const user = getCurrentUser();
  return !!user && user.accessLevel >= 4;
}

// kept for backward compat — same as canWriteFinance
export function canManageFinance(): boolean {
  return canWriteFinance();
}
