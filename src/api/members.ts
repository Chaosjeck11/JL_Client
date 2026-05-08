import { apiFetch } from "./client";
import type { Member, Role } from "../types/member";

export async function fetchMembers(): Promise<Member[]> {
  return apiFetch("/members");
}

export async function fetchRoles(): Promise<Role[]> {
  return apiFetch("/members/roles");
}

export async function fetchMember(id: number): Promise<Member> {
  return apiFetch(`/members/${id}`);
}

export async function updateMember(
  id: number,
  data: Record<string, unknown>,
): Promise<Member> {
  return apiFetch(`/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function createMember(data: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  roleId: number;
  address?: string | null;
  phone?: string | null;
  birthday?: string | null;
  joinedAt?: string | null;
  u18?: boolean;
  bereitsMitglied?: boolean;
  schuelerStudentAzubi?: boolean;
  berufstaetig?: boolean;
}): Promise<Member> {
  return apiFetch("/members", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
