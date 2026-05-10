import { apiFetch } from "./client";
import type { Member, MemberAttachment, Role } from "../types/member";

const API_BASE = "http://DEPLOY_SERVER_IP:3000";

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

export async function uploadAvatar(memberId: number, file: File): Promise<Member> {
  const token = localStorage.getItem("token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/members/${memberId}/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function deleteAvatar(memberId: number): Promise<void> {
  return apiFetch(`/members/${memberId}/avatar`, { method: "DELETE" });
}

export function fetchMemberAttachments(memberId: number): Promise<MemberAttachment[]> {
  return apiFetch(`/members/${memberId}/attachments`);
}

export async function uploadMemberAttachment(memberId: number, file: File): Promise<MemberAttachment> {
  const token = localStorage.getItem("token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/members/${memberId}/attachments`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function downloadMemberAttachment(memberId: number, attachmentId: number, filename: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/members/${memberId}/attachments/${attachmentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteMemberAttachment(memberId: number, attachmentId: number): Promise<void> {
  return apiFetch(`/members/${memberId}/attachments/${attachmentId}`, { method: "DELETE" });
}

export async function fetchMemberAttachmentBlob(memberId: number, attachmentId: number): Promise<{ url: string; mimeType: string }> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/members/${memberId}/attachments/${attachmentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), mimeType: blob.type };
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
