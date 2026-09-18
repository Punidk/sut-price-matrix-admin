import {
  writeBatch,
  doc,
  collection,
  getDocs,
  serverTimestamp,
  Firestore,
  WriteBatch,
} from "firebase/firestore";
import rawData from "@/data/priceMatrix2569.json";

export interface PriceMatrixMasterItem {
  category: string;
  name: string;
  price: number;
  unit: string;
  note: string;
  condition?: "WEEKDAY" | "WEEKEND" | string;
}

export const PRICE_MATRIX_2569: PriceMatrixMasterItem[] = rawData as PriceMatrixMasterItem[];

/**
 * สร้าง Document ID เป็น Composite Key: `${category}_${name}_${unit}`
 * แปลงช่องว่างและอักขระพิเศษ (รวมถึง '/') เป็น underscore '_'
 * เพื่อป้องกันปัญหาชื่อซ้ำแต่คนละหน่วยนับ และป้องกัน Firestore subcollection path error
 */
export function getCompositeKey(category: string, name: string, unit: string): string {
  const sanitize = (val: string) =>
    (val || "")
      .trim()
      .replace(/[\s/\\#?\[\]().,+-]+/g, "_")
      .replace(/^_+|_+$/g, "");
  return `${sanitize(category)}_${sanitize(name)}_${sanitize(unit)}`;
}

export interface SyncMasterOptions {
  clearOldData?: boolean;
  dbInstance: Firestore;
  onProgress?: (current: number, total: number, message: string) => void;
}

export interface SyncMasterResult {
  success: boolean;
  totalSynced: number;
  deletedOldCount: number;
  categories: string[];
}

/**
 * ฟังก์ชันซิงค์ราคากลางปีการศึกษา 2569 จากชุดข้อมูลเอกสาร PDF ทั้ง 7 หมวด
 * - หาก clearOldData = true จะล้างข้อมูลเดิมใน price_matrix ออกทั้งหมดด้วย WriteBatch (ชุดละ <= 400)
 * - บันทึกข้อมูล 368 รายการด้วย WriteBatch (ชุดละ <= 400 รายการ)
 */
export async function syncMasterPriceMatrix2569({
  clearOldData = true,
  dbInstance,
  onProgress,
}: SyncMasterOptions): Promise<SyncMasterResult> {
  if (!dbInstance) {
    throw new Error("Firestore instance is required for seeding master price matrix");
  }

  let deletedOldCount = 0;

  // 1. ล้างข้อมูลเดิมใน collection `price_matrix` (ถ้ากำหนด clearOldData = true)
  if (clearOldData) {
    onProgress?.(0, PRICE_MATRIX_2569.length, "กำลังค้นหารายการเดิมเพื่อล้างข้อมูล...");
    const existingSnapshot = await getDocs(collection(dbInstance, "price_matrix"));
    deletedOldCount = existingSnapshot.size;

    if (deletedOldCount > 0) {
      const deleteBatches: WriteBatch[] = [];
      let currentDeleteBatch = writeBatch(dbInstance);
      let opCount = 0;

      for (const docSnap of existingSnapshot.docs) {
        currentDeleteBatch.delete(docSnap.ref);
        opCount++;
        if (opCount % 400 === 0) {
          deleteBatches.push(currentDeleteBatch);
          currentDeleteBatch = writeBatch(dbInstance);
        }
      }
      if (opCount % 400 !== 0) {
        deleteBatches.push(currentDeleteBatch);
      }

      onProgress?.(0, PRICE_MATRIX_2569.length, `กำลังล้างข้อมูลเดิม ${deletedOldCount} รายการ...`);
      for (const b of deleteBatches) {
        await b.commit();
      }
    }
  }

  // 2. บันทึกข้อมูล Master 2569 แบบ Write Batch (ชุดละไม่เกิน 400 รายการ)
  const totalItems = PRICE_MATRIX_2569.length;
  const insertBatches: WriteBatch[] = [];
  let currentInsertBatch = writeBatch(dbInstance);
  let insertCount = 0;

  for (const item of PRICE_MATRIX_2569) {
    const docId = getCompositeKey(item.category, item.name, item.unit);
    const docRef = doc(dbInstance, "price_matrix", docId);

    currentInsertBatch.set(docRef, {
      itemName: item.name,
      name: item.name,
      category: item.category,
      maxPrice: item.price,
      price: item.price,
      unit: item.unit,
      note: item.note || "",
      condition: item.condition || "",
      source: "MASTER_SEED_2569",
      updatedAt: serverTimestamp(),
    });

    insertCount++;
    if (insertCount % 400 === 0) {
      insertBatches.push(currentInsertBatch);
      currentInsertBatch = writeBatch(dbInstance);
    }
  }

  if (insertCount % 400 !== 0) {
    insertBatches.push(currentInsertBatch);
  }

  onProgress?.(0, totalItems, `กำลังบันทึกข้อมูลราคากลางใหม่ ${totalItems} รายการ...`);
  for (let bIndex = 0; bIndex < insertBatches.length; bIndex++) {
    await insertBatches[bIndex].commit();
    const doneSoFar = Math.min((bIndex + 1) * 400, totalItems);
    onProgress?.(doneSoFar, totalItems, `บันทึกแล้ว ${doneSoFar} / ${totalItems} รายการ...`);
  }

  const uniqueCategories = Array.from(new Set(PRICE_MATRIX_2569.map((i) => i.category)));

  return {
    success: true,
    totalSynced: totalItems,
    deletedOldCount,
    categories: uniqueCategories,
  };
}
