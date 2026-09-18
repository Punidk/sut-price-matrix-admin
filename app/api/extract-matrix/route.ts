import { NextResponse } from "next/server";

export const maxDuration = 60; // ป้องกัน Vercel Timeout สำหรับไฟล์ PDF หลายหน้า

export async function POST(req: Request) {
  try {
    // รับค่า Base64 และ mimeType ที่ส่งมาจากหน้าเว็บ
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "ไม่พบข้อมูลรูปภาพหรือไฟล์ PDF" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ" }, { status: 500 });
    }

    const resolvedMimeType = mimeType === "application/pdf" ? "application/pdf" : (mimeType || "image/jpeg");

    // คำสั่ง System Prompt
    const prompt = `คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์เอกสารทางการเงินและพัสดุ
เอกสารนี้คือตารางประกาศราคากลาง (อาจมีหลายหน้า) ให้ดึงรายการสินค้าทุกรายการ โดยระบุ:
- ลำดับ (id/index)
- หมวดหมู่ (จัดเข้า 1 ใน 6 หมวดตามเอกสาร ได้แก่ 'หมวดค่าตอบแทน', 'หมวดโภชนาการ', 'หมวดยานพาหนะ', 'หมวดอุปกรณ์ก่อสร้าง', 'หมวดอุปกรณ์สำนักงาน', 'หมวดอุปกรณ์อิเล็กทรอนิกส์')
- ชื่อรายการ (name)
- ราคาต่อหน่วย (price) เป็นตัวเลข
- หน่วยนับ (unit) เช่น กล่อง, แพ็ก, ชิ้น, อัน, วัน, ชม., รีม, เล่ม, ชุด, ม้วน, คน/วัน, คน/ชม.
- เงื่อนไขวันทำงาน (condition): หากมีเงื่อนไขวันทำงานให้ระบุ 'WEEKDAY' (วันจันทร์-ศุกร์ เวลาราชการ) หรือ 'WEEKEND' (วันเสาร์-อาทิตย์ / วันหยุดนักขัตฤกษ์) หากไม่มีให้ใส่ null
- หมายเหตุ (note) ถ้ามี

[กฎพิเศษสำหรับการแยกรายการค่าตอบแทนตามวันทำงาน (Weekday vs Weekend Rates)]:
- หากพบรายการใน 'หมวดค่าตอบแทน' (หรือรายการใดๆ) ที่มีเงื่อนไขในหมายเหตุหรือในตารางระบุแยกวันทำงาน เช่น "วันจันทร์-วันศุกร์" กับ "วันเสาร์-วันอาทิตย์ / วันหยุดนักขัตฤกษ์" หรือ "เวลาราชการ" กับ "นอกเวลาราชการ":
  * ต้องสร้างรายการแยกออกจากกันเป็นคนละรายการอย่างชัดเจน ห้ามรวมเป็นรายการเดียว
  * ให้ระบุเงื่อนไขต่อท้ายชื่อรายการในวงเล็บเสมอ เช่น:
    - "ค่าจ้างพนักงานไฟฟ้าและซ่อมบำรุง (วันจันทร์-ศุกร์ เวลาราชการ)"
    - "ค่าจ้างพนักงานไฟฟ้าและซ่อมบำรุง (วันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์)"
  * กำหนด condition เป็น 'WEEKDAY' หรือ 'WEEKEND' ตามเงื่อนไข
  * บันทึกรายละเอียดใน note ให้ครบถ้วน

ตอบกลับเป็น JSON array ของรายการทั้งหมด ห้ามใส่ markdown หรือข้อความอื่นนอก JSON เช่น:
[
  {
    "id": 1,
    "category": "หมวดค่าตอบแทน",
    "name": "ค่าจ้างพนักงานไฟฟ้าและซ่อมบำรุง (วันจันทร์-ศุกร์ เวลาราชการ)",
    "price": 240,
    "unit": "คน/วัน",
    "condition": "WEEKDAY",
    "note": "วันจันทร์-วันศุกร์ ในเวลาราชการ"
  },
  {
    "id": 2,
    "category": "หมวดค่าตอบแทน",
    "name": "ค่าจ้างพนักงานไฟฟ้าและซ่อมบำรุง (วันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์)",
    "price": 420,
    "unit": "คน/วัน",
    "condition": "WEEKEND",
    "note": "วันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์"
  }
]`;

    // 🚀 ยิงตรงเข้า API ของ Google โดยไม่ใช้ SDK (ข้ามปัญหา Vercel แคชแพ็กเกจเก่า)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: resolvedMimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    // ดัก Error ที่ตีกลับมาจาก Google
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Google API Error: ${response.status}`);
    }

    // แกะกล่องข้อความที่ AI ตอบกลับมา
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // ทำความสะอาดข้อความ (เผื่อ AI ส่ง ```json กลับมาด้วย)
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // แปลงเป็น JSON Object ส่งกลับไปให้หน้าเว็บ
    const parsedData = JSON.parse(text);

    // Map ให้รองรับทั้ง key 'name'/'itemName' และ 'price'/'maxPrice' พร้อมจัดการเงื่อนไขวันทำงาน
    const formattedData = Array.isArray(parsedData)
      ? parsedData.map((it: any, idx: number) => {
          let itemName = (it.name || it.itemName || "รายการไม่มีชื่อ").trim();
          const maxPrice = Number(it.price != null ? it.price : it.maxPrice) || 0;
          let condition = it.condition || "";
          const note = (it.note || "").trim();

          const lowerCombined = (itemName + " " + note).toLowerCase();
          const isWeekend =
            condition === "WEEKEND" ||
            lowerCombined.includes("วันเสาร์") ||
            lowerCombined.includes("วันอาทิตย์") ||
            lowerCombined.includes("เสาร์-อาทิตย์") ||
            lowerCombined.includes("วันหยุด");
          const isWeekday =
            !isWeekend &&
            (condition === "WEEKDAY" ||
              lowerCombined.includes("วันจันทร์") ||
              lowerCombined.includes("จันทร์-ศุกร์") ||
              lowerCombined.includes("วันธรรมดา") ||
              lowerCombined.includes("เวลาราชการ"));

          if (isWeekend) {
            condition = "WEEKEND";
            if (!itemName.includes("เสาร์") && !itemName.includes("วันหยุด")) {
              itemName = `${itemName} (วันเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์)`;
            }
          } else if (isWeekday) {
            condition = "WEEKDAY";
            if (!itemName.includes("จันทร์") && !itemName.includes("เวลาราชการ")) {
              itemName = `${itemName} (วันจันทร์-ศุกร์ เวลาราชการ)`;
            }
          }

          return {
            id: it.id ?? (idx + 1),
            index: it.id ?? (idx + 1),
            name: itemName,
            itemName: itemName,
            category: it.category || "หมวดอุปกรณ์สำนักงาน",
            price: maxPrice,
            maxPrice: maxPrice,
            unit: (it.unit || "รายการ").trim(),
            note: note,
            condition: condition || undefined,
          };
        })
      : [];

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error("Direct API Error:", error);
    return NextResponse.json({ error: error.message || "เกิดข้อผิดพลาดในการวิเคราะห์ AI" }, { status: 500 });
  }
}