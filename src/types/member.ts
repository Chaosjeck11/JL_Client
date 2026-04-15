export type Member = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  birthday?: string | null;
  phone?: string | null;
  address?: string | null;
  active: boolean;
  accessLevel: number;
  role?: {
    id: number;
    name: string;
  };
};
