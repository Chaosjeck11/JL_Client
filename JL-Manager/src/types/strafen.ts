export interface Strafe {
  id: number;
  name: string;
  beschreibung?: string | null;
  betrag: number;
  createdAt: string;
  updatedAt: string;
  _count?: { eintraege: number };
}

export interface StrafeEintrag {
  id: number;
  memberId: number;
  strafeId: number;
  businessYearId: number;
  grund?: string | null;
  bezahlt: boolean;
  createdAt: string;
  updatedAt: string;
  member?: { id: number; firstname: string; lastname: string; active?: boolean };
  strafe?: Strafe;
  businessYear?: { id: number; year: number };
}
