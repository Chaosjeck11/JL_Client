export type FormColumn = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "checkbox" | string;
};

export type VeranstaltungFormRow = {
  id: number;
  formId: number;
  rowIndex: number;
  cells: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type VeranstaltungForm = {
  id: number;
  veranstaltungId: number;
  columns: FormColumn[];
  createdAt: string;
  updatedAt: string;
  rows?: VeranstaltungFormRow[];
};

export type VeranstaltungAttachment = {
  id: number;
  veranstaltungId: number;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type VeranstaltungTransaction = {
  id: number;
  date: string;
  description: string;
  type: "EINZAHLUNG" | "AUSZAHLUNG" | "RUECKBUCHUNG";
  amount: number;
  tag?: "ONLINE" | "BAR" | null;
  relatedTransactionId?: number | null;
  category: { id: number; name: string };
  member?: { id: number; firstname: string; lastname: string } | null;
};

export type Veranstaltung = {
  id: number;
  name: string;
  date: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    transactions: number;
    attachments: number;
  };
  transactions?: VeranstaltungTransaction[];
  attachments?: VeranstaltungAttachment[];
  form?: VeranstaltungForm;
};

export type VeranstaltungSchichtMitglied = {
  id: number;
  firstname: string;
  lastname: string;
};

export type VeranstaltungSchicht = {
  id: number;
  veranstaltungId: number;
  name: string;
  startTime?: string | null;
  endTime?: string | null;
  kapazitaet?: number | null;
  beschreibung?: string | null;
  createdAt: string;
  updatedAt: string;
  mitglieder: VeranstaltungSchichtMitglied[];
};

export type VeranstaltungFinancials = {
  einnahmen: number;
  ausgaben: number;
  saldo: number;
};

export type VeranstaltungFormTemplate = {
  id: number;
  columns: FormColumn[];
  updatedAt: string;
};

export type VeranstaltungKategorie = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { veranstaltungen: number };
};

export type AllAttachments = {
  direct: VeranstaltungAttachment[];
  fromTransactions: Array<{
    id: number;
    transactionId: number;
    filename: string;
    storedName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
    transaction?: { id: number; date: string; description: string };
  }>;
};
