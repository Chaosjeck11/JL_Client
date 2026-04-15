import { apiFetch } from "./client";
import type { Member } from "../types/member";

export async function fetchMembers(): Promise<Member[]> {
  return apiFetch("/members");
}

export async function updateMember(
  id: number,
  data: Partial<Member>
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
}): Promise<Member> {
  return apiFetch("/members", {
    method: "POST",
    body: JSON.stringify(data),
  });
}