export type TransactionType = "EINZAHLUNG" | "AUSZAHLUNG" | "RUECKBUCHUNG";

export type Category = {
  id: number;
  name: string;
  description?: string;
  isMitgliedsbeitrag?: boolean;
};

export type BusinessYear = {
  id: number;
  year: number;
  carryOver: number;
  totalIncome?: number;
  totalExpenses?: number;
  balance?: number;
  startDate?: string;
  endDate?: string;
};

export type PaymentTag = "ONLINE" | "BAR";

export type Transaction = {
  id: number;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  categoryId: number;
  category: Category;
  businessYearId: number;
  beitragYearId?: number | null;
  beitragYear?: { id: number; year: number } | null;
  relatedTransactionId?: number;
  memberId?: number | null;
  tag?: PaymentTag | null;
  veranstaltung?: { id: number; name: string } | null;
};

export type RunningBalanceEntry = {
  transaction: Transaction;
  runningBalance: number;
};

export type TransactionAttachment = {
  id: number;
  transactionId: number;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type Mitgliedsbeitrag = {
  id: number;
  memberId: number;
  businessYearId: number;
  betragJL: number;
  betragKG: number;
  bezahltJL: number;
  bezahltKG: number;
  status: "AUSSTEHEND" | "TEILWEISE" | "BEZAHLT";
  member?: {
    id: number;
    firstname: string;
    lastname: string;
    active: boolean;
  };
  businessYear?: { id: number; year: number };
};
