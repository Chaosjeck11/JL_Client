import { apiFetch } from "./client";
import type { MemberAttributeDefinition, AttributeType } from "../types/memberAttributes";

export function fetchMemberAttributes(): Promise<MemberAttributeDefinition[]> {
  return apiFetch("/member-attributes");
}

export function createMemberAttribute(data: {
  key: string;
  label: string;
  type: AttributeType;
  options?: string[];
  sortOrder?: number;
}): Promise<MemberAttributeDefinition> {
  return apiFetch("/member-attributes", { method: "POST", body: JSON.stringify(data) });
}

export function updateMemberAttribute(
  id: number,
  data: Partial<{ key: string; label: string; type: AttributeType; options: string[]; sortOrder: number }>,
): Promise<MemberAttributeDefinition> {
  return apiFetch(`/member-attributes/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteMemberAttribute(id: number): Promise<void> {
  return apiFetch(`/member-attributes/${id}`, { method: "DELETE" });
}
