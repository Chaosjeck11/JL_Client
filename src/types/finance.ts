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

export type Transaction = {
  id: number;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  categoryId: number;
  category: Category;
  businessYearId: number;
  relatedTransactionId?: number;
  memberId?: number | null;
};

export type RunningBalanceEntry = {
  transaction: Transaction;
  runningBalance: number;
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
