export type CategoryType = "อาหาร" | "อุปกรณ์สำนักงาน" | "บริการ" | "อื่นๆ" | "Food" | "Material" | "Service" | "Other";

export interface PriceMatrixItem {
  id: string;
  itemName: string;
  category: string;
  maxPrice: number;
  unit: string;
  updatedAt?: number;
}

export type PriceMatrixFormData = Omit<PriceMatrixItem, "id" | "updatedAt">;
