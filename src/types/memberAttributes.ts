export type AttributeType = "BOOLEAN" | "TEXT" | "NUMBER" | "SELECT";

export type MemberAttributeDefinition = {
  id: number;
  key: string;
  label: string;
  type: AttributeType;
  options?: string[] | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MemberAttributeValue = {
  id: number;
  memberId: number;
  definitionId: number;
  value: string;
  definition?: MemberAttributeDefinition;
};
