import {
  collection,
  getDocs,
  writeBatch,
  Firestore,
  WriteBatch,
} from "firebase/firestore";

export interface ClearPriceMatrixOptions {
  dbInstance: Firestore;
  onProgress?: (deletedCount: number, totalCount: number, message: string) => void;
}

export interface ClearPriceMatrixResult {
  success: boolean;
  deletedCount: number;
}

/**
 * ลบเอกสารทั้งหมดในคอลเลกชัน `price_matrix` แบบ Batch Delete
 * แบ่งเป็นรอบละไม่เกิน 400 รายการ (ไม่เกินขีดจำกัด 500 รายการของ Firestore Write Batch)
 * วนลูปจนกระทั่งลบข้อมูลหมดทุกเอกสาร
 */
export async function clearAllPriceMatrix({
  dbInstance,
  onProgress,
}: ClearPriceMatrixOptions): Promise<ClearPriceMatrixResult> {
  if (!dbInstance) {
    throw new Error("Firestore instance is required to clear price matrix");
  }

  onProgress?.(0, 0, "กำลังดึงรายการทั้งหมดจากคอลเลกชัน price_matrix...");
  const snapshot = await getDocs(collection(dbInstance, "price_matrix"));
  const totalCount = snapshot.size;

  if (totalCount === 0) {
    return {
      success: true,
      deletedCount: 0,
    };
  }

  // แบ่งเป็นรอบละไม่เกิน 400 รายการ
  const deleteBatches: WriteBatch[] = [];
  let currentBatch = writeBatch(dbInstance);
  let opCount = 0;

  for (const docSnap of snapshot.docs) {
    currentBatch.delete(docSnap.ref);
    opCount++;
    if (opCount % 400 === 0) {
      deleteBatches.push(currentBatch);
      currentBatch = writeBatch(dbInstance);
    }
  }

  if (opCount % 400 !== 0) {
    deleteBatches.push(currentBatch);
  }

  onProgress?.(0, totalCount, `กำลังเริ่มลบข้อมูล ${totalCount} รายการ...`);

  for (let bIndex = 0; bIndex < deleteBatches.length; bIndex++) {
    await deleteBatches[bIndex].commit();
    const deletedSoFar = Math.min((bIndex + 1) * 400, totalCount);
    onProgress?.(deletedSoFar, totalCount, `ลบแล้ว ${deletedSoFar} / ${totalCount} รายการ...`);
  }

  return {
    success: true,
    deletedCount: totalCount,
  };
}
