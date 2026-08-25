export type CategoryType = "Food" | "Material" | "Service" | "Other";

export interface PriceMatrixItem {
  id: string;
  itemName: string;
  category: CategoryType;
  unitPrice: number;
  unitType: string;
  updatedAt?: number;
}

export type PriceMatrixFormData = Omit<PriceMatrixItem, "id" | "updatedAt">;
