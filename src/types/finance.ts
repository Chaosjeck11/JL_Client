export type TransactionType = "EINZAHLUNG" | "AUSZAHLUNG" | "RUECKBUCHUNG";

export type Category = {
  id: number;
  name: string;
  description?: string;
};

export type BusinessYear = {
  id: number;
  year: number;
  carryOver: number;
  totalIncome?: number;
  totalExpenses?: number;
  balance?: number;
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
};

export type RunningBalanceEntry = {
  transaction: Transaction;
  runningBalance: number;
};
