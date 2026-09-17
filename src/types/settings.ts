export type Settings = {
  id: number;
  bierlisteAdminLevel: number;
  strafenwartLevel: number;
  strafenVorstandLevel: number;
  strafenKassenwartLevel: number;
  adminLevel: number;
  updatedAt: string;
};

export type UpdateSettingsBody = Partial<
  Omit<Settings, "id" | "updatedAt">
>;
