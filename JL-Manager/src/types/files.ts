export interface AppFile {
  id: number;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: string;
  description?: string;
  uploadedBy: number;
}
