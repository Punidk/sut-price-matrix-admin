import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // รับค่า Base64 ที่ส่งมาจากหน้าเว็บ
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "ไม่พบข้อมูลรูปภาพ" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ" }, { status: 500 });
    }

    // คำสั่ง Prompt
    const prompt = `จงอ่านตารางราคากลางจากรูปภาพนี้ แล้วสกัดข้อมูลออกมาเป็น JSON Array เท่านั้น โดยแต่ละ object ต้องมีโครงสร้างคือ {"itemName": "ชื่อรายการ", "category": "หมวดหมู่", "maxPrice": ตัวเลข, "unit": "หน่วยนับ"} ห้ามมีข้อความอธิบายอื่นปนเด็ดขาด`;

    // 🚀 ยิงตรงเข้า API ของ Google โดยไม่ใช้ SDK (ข้ามปัญหา Vercel แคชแพ็กเกจเก่า)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
                    mime_type: mimeType || "image/jpeg",
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
    let text = data.candidates[0].content.parts[0].text;
    
    // ทำความสะอาดข้อความ (เผื่อ AI ส่ง ```json กลับมาด้วย)
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // แปลงเป็น JSON Object ส่งกลับไปให้หน้าเว็บ
    const parsedData = JSON.parse(text);
    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error("Direct API Error:", error);
    return NextResponse.json({ error: error.message || "เกิดข้อผิดพลาดในการวิเคราะห์ AI" }, { status: 500 });
  }
}