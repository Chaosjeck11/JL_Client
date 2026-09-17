import type { MemberAttributeValue } from "./memberAttributes";

export type MemberAttachment = {
  id: number;
  memberId: number;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type Role = {
  id: number;
  name: string;
  description?: string | null;
  accessLevel: number;
};

export type MemberBeitrag = {
  id: number;
  businessYearId: number;
  betragJL: number;
  betragKG: number;
  bezahltJL: number;
  bezahltKG: number;
  status: "AUSSTEHEND" | "TEILWEISE" | "BEZAHLT";
  businessYear?: { id: number; year: number };
};

export type Member = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  birthday?: string | null;
  phone?: string | null;
  address?: string | null;
  avatarPath?: string | null;
  active: boolean;
  accessLevel: number;
  roleId?: number;
  role?: Role;
  inactiveSince?: string | null;
  beitragsklasseId?: number | null;
  beitragsklasse?: { id: number; name: string; betragJL: number; betragKG: number } | null;
  attributeValues?: MemberAttributeValue[];
  excludeFromBeitrag: boolean;
  joinedAt: string;
  mitgliedsbeitraege?: MemberBeitrag[];
};
