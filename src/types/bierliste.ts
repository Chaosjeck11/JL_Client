export interface BierDrink {
  id: number;
  name: string;
  pricePerUnit: number;
  description?: string;
  category?: string;
  imagePath?: string;
  sortOrder: number;
  active: boolean;
  fridge?: BierFridge;
  createdAt: string;
  updatedAt: string;
}

export interface BierFridge {
  drinkId: number;
  stock: number;
  minStock?: number;
  maxStock?: number;
  location?: string;
  updatedAt: string;
  drink?: BierDrink;
}

export interface BierConsumption {
  id: number;
  memberId: number;
  drinkId: number;
  amount: number;
  note?: string;
  createdAt: string;
  drink?: BierDrink;
  member?: { id: number; firstname: string; lastname: string };
}

export interface BierMemberBalance {
  memberId: number;
  openAmount: number;
  paidAmount: number;
  member?: { id: number; firstname: string; lastname: string };
}

export interface BierCashboxTransaction {
  id: number;
  amount: number;
  direction: "IN" | "OUT" | "CORRECTION";
  reason?: string;
  paymentType?: string;
  createdAt: string;
  createdBy?: { id: number; firstname: string; lastname: string };
  userPaid?: { id: number; firstname: string; lastname: string };
}

export interface BierCashbox {
  balance: number;
  transactions: BierCashboxTransaction[];
}

export interface BierUserStat {
  memberId: number;
  member: { id: number; firstname: string; lastname: string };
  totalAmount: number;
  totalCost: number;
  openAmount: number;
  paidAmount: number;
  byDrink: { drinkId: number; drinkName: string; amount: number; cost: number }[];
}
