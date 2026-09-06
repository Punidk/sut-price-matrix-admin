import { NextRequest, NextResponse } from "next/server";

/**
 * Helper function สำหรับเรียก Gemini API พร้อมระบบ Auto-Retry และ Exponential Backoff + Jitter
 * รองรับการลองซ้ำเมื่อเจอ Error 429 (Rate Limit) หรือ 503 (High Demand / Service Unavailable)
 */
async function fetchGeminiWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, options);

      // หากผ่านฉลุย คืนค่า response ทันที
      if (response.ok) {
        return response;
      }

      // หากเจอ Rate Limit หรือ High Demand ให้เข้าเงื่อนไข Retry
      if (response.status === 429 || response.status === 503) {
        attempt++;
        if (attempt >= maxRetries) {
          return response; // หมดโควต้าลองซ้ำ ให้ส่ง response เดิมออกไปจัดการ error
        }

        // คำนวณเวลาถอยหน่วง: 2^attempt * 1000ms + สุ่ม Jitter (0 - 500ms)
        const delay = Math.pow(2, attempt) * 1000 + (Math.random() * 500);
        console.warn(`[Gemini API] Encountered status ${response.status}. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // หากเป็น Error อื่นๆ เช่น 400 Bad Request ไม่ต้อง Retry
      return response;
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000 + (Math.random() * 500);
      console.warn(`[Gemini API] Network error. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Exceeded maximum retry attempts for Gemini API");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { files = [], excelText = "", priceMatrix = [], imageUrl, imageBase64, mimeType } = body;

    // 1. เช็ก API Key
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ" },
        { status: 500 }
      );
    }

    // เตรียมรายการไฟล์มีเดีย (รูปภาพ / PDF)
    const mediaFiles: Array<{ mimeType: string; base64Data: string }> = [...files];

    // รองรับ fallback กรณีส่งแบบเดี่ยว imageBase64 หรือ imageUrl มา
    if (imageBase64) {
      mediaFiles.push({
        mimeType: mimeType || "image/jpeg",
        base64Data: imageBase64,
      });
    } else if (imageUrl) {
      const imageRes = await fetch(imageUrl);
      if (imageRes.ok) {
        const arrayBuffer = await imageRes.arrayBuffer();
        const b64 = Buffer.from(arrayBuffer).toString("base64");
        const detectedMime = imageRes.headers.get("content-type") || "image/jpeg";
        mediaFiles.push({
          mimeType: detectedMime,
          base64Data: b64,
        });
      }
    }

    if (mediaFiles.length === 0 && !excelText) {
      return NextResponse.json(
        { error: "กรุณาแนบไฟล์รูปภาพ, PDF หรือ Excel เพื่อวิเคราะห์" },
        { status: 400 }
      );
    }

    // 2. แปลงข้อมูล priceMatrix เป็น String
    const matrixContext = JSON.stringify(priceMatrix || [], null, 2);

    // 3. คำสั่ง System Prompt - ผู้ตรวจสอบบัญชี (Auditor) สภานักศึกษา มทส.
    const prompt = `คุณคือผู้ตรวจสอบบัญชีและพัสดุ (Auditor) ประจำสภานักศึกษา มหาวิทยาลัยเทคโนโลยีสุรนารี
หน้าที่ของคุณคือตรวจสอบเอกสารใบเสร็จ / บิลเงินสด / ใบเสนอราคา / เอกสารเบิกจ่ายงบประมาณที่แนบมา เทียบกับฐานข้อมูลราคากลาง (priceMatrix):
${matrixContext}

จงตรวจสอบเอกสารอย่างละเอียดตามกฎระเบียบ 4 ข้อดังต่อไปนี้:

========================================
1. กฎการตรวจสอบคณิตศาสตร์ ภาษี และส่วนลด (Math, Discount & VAT 7% Rules):
========================================
- ตรวจสอบระดับรายการย่อย (Line Items):
  * ตรวจสอบความถูกต้องว่า จำนวน (receiptData.qty) × ราคาต่อหน่วย (receiptData.unitPrice) เท่ากับ ราคารวม (receiptData.totalPrice) หรือไม่
  * หากคูณแล้วผลลัพธ์ไม่ตรงกับราคารวมในบิลอย่างมีนัยสำคัญ ให้ถือว่า "คำนวณเลขผิด"
- ตรวจสอบสรุปยอดท้ายบิล (Financial Summary):
  * บิลอาจมีส่วนลด (Discount ท้ายบิล หรือโปรโมชั่น) และภาษีมูลค่าเพิ่ม (VAT 7% หรือคิดตามระเบียบ)
  * subtotal = ผลรวมของราคารวมทุกรายการย่อยก่อนหักส่วนลด (number)
  * discount = ยอดส่วนลดท้ายบิล (ถ้ามี ให้ระบุเป็นตัวเลขบวก >= 0, ถ้าไม่มีให้ใส่ 0)
  * vat = ยอดภาษีมูลค่าเพิ่ม (เช่น VAT 7% ถ้ามีระบุในบิลหรือคำนวณจากยอดหลังลด ให้ระบุตัวเลข >= 0, ถ้าไม่มีให้ใส่ 0)
  * total = ยอดเงินสุทธิรวมท้ายบิลที่ต้องจ่ายจริง (subtotal - discount + vat)
  * [สำคัญยิ่ง]: การที่ยอดรวมสุทธิท้ายบิล (Grand Total) เกิดจากการนำ Subtotal มาหักส่วนลด (Discount) หรือบวกภาษีมูลค่าเพิ่ม (VAT 7%) "ถือว่าเป็นการคำนวณที่ถูกต้องตามมาตรฐานการบัญชี ห้ามตีความเป็นคำนวณเลขผิดเด็ดขาด"

========================================
2. การตรวจสอบความสมบูรณ์ของเอกสาร (Document Integrity & Handwritten Signature Rules):
========================================
- ตรวจหาข้อมูลหัวบิลและผู้รับเงินในเอกสาร:
  * name: ชื่อร้านค้า / ผู้จำหน่าย / ผู้ให้บริการ (หากไม่ระบุหรืออ่านไม่ได้ ให้ใส่ "ไม่ระบุ")
  * date: วันที่ที่ระบุในเอกสาร (เช่น "15 ม.ค. 2567" หรือ "2024-01-15", หากไม่พบ ให้ใส่ "ไม่ระบุ")
  * hasReceiptSign: ตรวจสอบว่าพบลายมือชื่อ (ลายเซ็นสด) ของผู้รับเงิน หรือมีตรายางประทับ "รับเงินแล้ว / ชำระเงินแล้ว / PAID" หรือไม่ (boolean true/false)
  * isHandwritten: เอกสารเป็นบิลเงินสดเขียนด้วยมือ / ใบเสร็จรับเงินเล่มเขียนมือหรือไม่ (boolean true/false)
- [กฎการแจ้งเตือนความสมบูรณ์]:
  * หากเอกสารเป็นบิลเขียนมือ (isHandwritten: true) แล้ว "ขาดลายเซ็นผู้รับเงิน" (hasReceiptSign: false) ให้เพิ่มข้อความแจ้งเตือนลงใน Array warnings:
    "[เอกสารไม่สมบูรณ์: ขาดลายเซ็นผู้รับเงิน]"

========================================
3. การตรวจสอบรายการและดักจับรายการคลุมเครือ (Item Audit & Ambiguous Item Rules):
========================================
สำหรับแต่ละรายการในเอกสาร ให้ตรวจสอบตามเงื่อนไขดังนี้:
1. [รายการคลุมเครือ]: หากชื่อรายการมีลักษณะกว้าง คลุมเครือ ไม่แจกแจงรายละเอียดว่าคือสิ่งของชนิดใด เช่น "ค่าวัสดุ", "ค่าอุปกรณ์", "วัสดุอุปกรณ์", "ค่าใช้จ่ายเบ็ดเตล็ด", "ค่าสิ่งของ", "ค่าของ", "อุปกรณ์จัดกิจกรรม", "ของใช้":
   - กำหนด status: "FAIL"
   - เพิ่ม "[รายการคลุมเครือ: ต้องแนบใบแจกแจงรายการย่อย]" ลงใน errorFlags
   - ระบุใน message ว่า "รายการมีลักษณะคลุมเครือ ไม่แจกแจงชนิดสิ่งของ ต้องแนบใบแจกแจงรายการย่อยตามระเบียบ"
2. [ไม่อยู่ในราคากลาง (NOT_FOUND)]: หากค้นหาไม่พบหรือไม่ใกล้เคียงกับรายการใดใน priceMatrix:
   - กำหนด status: "NOT_FOUND", errorFlags: [], และกำหนดข้อมูลใน matrixData เป็น null ทั้งหมด
3. [ราคาต่อหน่วยเกินราคากลาง]: ราคาต่อหน่วยในบิล (receiptData.unitPrice) สูงกว่าเพดานราคากลาง (matrixData.maxPrice):
   - กำหนด status: "FAIL" และเพิ่ม "ราคาเกินเกณฑ์" ลงใน errorFlags
4. [หน่วยนับไม่ตรง]: หน่วยในบิล (receiptData.unit) ไม่ตรงกับหน่วยในราคากลาง (matrixData.unit) เช่น กล่อง vs ชิ้น:
   - กำหนด status: "FAIL" และเพิ่ม "หน่วยไม่ตรง" ลงใน errorFlags
5. [คำนวณเลขผิด]: จำนวน (qty) × ราคาต่อหน่วย (unitPrice) ไม่เท่ากับ ราคารวม (totalPrice):
   - กำหนด status: "FAIL" และเพิ่ม "คำนวณเลขผิด" ลงใน errorFlags
- [ผ่านเกณฑ์ (PASS)]: หากไม่มีข้อผิดพลาดใดๆ ให้กำหนด status: "PASS" และ errorFlags: []

========================================
4. รูปแบบ Response Schema (JSON Object เท่านั้น):
========================================
จงส่งคำตอบกลับมาเป็น JSON Object ตามโครงสร้างนี้เท่านั้น (ห้ามครอบ markdown หรือมีข้อความอื่นนอก JSON):
{
  "merchant": {
    "name": "ชื่อร้านค้าหรือผู้ให้บริการ (หรือ 'ไม่ระบุ')",
    "date": "วันที่ในเอกสาร (หรือ 'ไม่ระบุ')",
    "hasReceiptSign": true,
    "isHandwritten": false
  },
  "financialSummary": {
    "subtotal": 0.00,
    "discount": 0.00,
    "vat": 0.00,
    "total": 0.00
  },
  "overallStatus": "PASS" | "FAIL" | "NOT_FOUND",
  "warnings": [
    "[เอกสารไม่สมบูรณ์: ขาดลายเซ็นผู้รับเงิน]"
  ],
  "items": [
    {
      "status": "PASS" | "FAIL" | "NOT_FOUND",
      "errorFlags": ["ราคาเกินเกณฑ์", "หน่วยไม่ตรง", "คำนวณเลขผิด", "[รายการคลุมเครือ: ต้องแนบใบแจกแจงรายการย่อย]"],
      "message": "คำอธิบายผลการตรวจสอบอย่างละเอียดภาษาไทย",
      "receiptData": {
        "itemName": "ชื่อในบิล",
        "qty": 1,
        "unit": "หน่วยในบิล",
        "unitPrice": 0.00,
        "totalPrice": 0.00
      },
      "matrixData": {
        "itemName": "ชื่อในฐานข้อมูล (null ถ้าไม่เจอ)",
        "category": "หมวดหมู่ (null ถ้าไม่เจอ)",
        "maxPrice": 0.00,
        "unit": "หน่วยนับในฐานข้อมูล (null ถ้าไม่เจอ)"
      }
    }
  ]
}`;

    // 4. เตรียมโครงสร้าง parts สำหรับส่งให้ Gemini API
    const parts: any[] = [{ text: prompt }];

    // Part 2: แนบข้อมูล Text จาก Excel (ถ้ามี)
    if (excelText && excelText.trim().length > 0) {
      parts.push({
        text: `ข้อมูลบิลจากไฟล์ Excel:\n${excelText}`,
      });
    }

    // Part 3: แนบไฟล์รูปภาพ / PDF ผ่าน inline_data
    for (const file of mediaFiles) {
      if (file.base64Data) {
        parts.push({
          inline_data: {
            mime_type: file.mimeType || "image/jpeg",
            data: file.base64Data,
          },
        });
      }
    }

    // 5. ยิง Native Fetch ตรงไปที่ Google Generative Language API พร้อมระบบ Auto-Retry
    const response = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: parts,
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
          },
        }),
      }
    );

    // ดักจับ Error ที่ตีกลับมาจาก Google
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Google API Error: ${response.status}`);
    }

    // แกะ JSON ที่ได้จาก AI ตอบกลับมา
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsedData = JSON.parse(text);

    // ปรับโครงสร้างข้อมูลให้อยู่ในรูปแบบ Standard Schema เสมอ
    if (Array.isArray(parsedData)) {
      parsedData = {
        merchant: {
          name: "ไม่ระบุ",
          date: "ไม่ระบุ",
          hasReceiptSign: true,
          isHandwritten: false,
        },
        financialSummary: {
          subtotal: 0,
          discount: 0,
          vat: 0,
          total: 0,
        },
        overallStatus: parsedData.some((i: any) => i.status === "FAIL")
          ? "FAIL"
          : parsedData.some((i: any) => i.status === "NOT_FOUND")
          ? "NOT_FOUND"
          : "PASS",
        warnings: [],
        items: parsedData,
      };
    } else {
      if (!Array.isArray(parsedData.items)) {
        parsedData.items = [];
      }
      if (!Array.isArray(parsedData.warnings)) {
        parsedData.warnings = [];
      }
      if (!parsedData.merchant) {
        parsedData.merchant = {
          name: "ไม่ระบุ",
          date: "ไม่ระบุ",
          hasReceiptSign: true,
          isHandwritten: false,
        };
      }
      if (!parsedData.financialSummary) {
        parsedData.financialSummary = {
          subtotal: 0,
          discount: 0,
          vat: 0,
          total: 0,
        };
      }
    }

    // Double-check: ดักจับรายการคลุมเครือเพิ่มเติม (เช่น ค่าวัสดุ, ค่าอุปกรณ์ ที่ไม่แจกแจง)
    const AMBIGUOUS_KEYWORDS = [
      "ค่าวัสดุ",
      "ค่าอุปกรณ์",
      "วัสดุอุปกรณ์",
      "ค่าวัสดุอุปกรณ์",
      "ค่าสิ่งของ",
      "ค่าของ",
      "ค่าใช้จ่ายเบ็ดเตล็ด",
      "ของใช้",
    ];

    parsedData.items.forEach((item: any) => {
      const name = (item.receiptData?.itemName || "").trim();
      const isAmbiguous = AMBIGUOUS_KEYWORDS.some(
        (kw) => name === kw || name.startsWith(kw + " ") || name.endsWith(" " + kw)
      );

      if (isAmbiguous) {
        item.status = "FAIL";
        item.errorFlags = item.errorFlags || [];
        if (!item.errorFlags.includes("[รายการคลุมเครือ: ต้องแนบใบแจกแจงรายการย่อย]")) {
          item.errorFlags.push("[รายการคลุมเครือ: ต้องแนบใบแจกแจงรายการย่อย]");
        }
        if (!item.message || !item.message.includes("รายการคลุมเครือ")) {
          item.message = item.message
            ? `${item.message} - [รายการคลุมเครือ: ต้องแนบใบแจกแจงรายการย่อย]`
            : "รายการมีลักษณะคลุมเครือ ไม่แจกแจงชนิดสิ่งของ ต้องแนบใบแจกแจงรายการย่อยตามระเบียบ";
        }
      }
    });

    // Double-check: ตรวจสอบบิลเขียนมือที่ขาดลายเซ็น
    if (parsedData.merchant?.isHandwritten && !parsedData.merchant?.hasReceiptSign) {
      if (!parsedData.warnings.includes("[เอกสารไม่สมบูรณ์: ขาดลายเซ็นผู้รับเงิน]")) {
        parsedData.warnings.push("[เอกสารไม่สมบูรณ์: ขาดลายเซ็นผู้รับเงิน]");
      }
    }

    // สรุป Overall Status ให้แม่นยำ
    if (parsedData.items.some((i: any) => i.status === "FAIL")) {
      parsedData.overallStatus = "FAIL";
    } else if (parsedData.items.some((i: any) => i.status === "NOT_FOUND")) {
      parsedData.overallStatus = "NOT_FOUND";
    } else {
      parsedData.overallStatus = "PASS";
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Analyze API Error:", error);
    return NextResponse.json(
      {
        error: "เกิดข้อผิดพลาดในการวิเคราะห์เอกสารด้วย Gemini AI",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
