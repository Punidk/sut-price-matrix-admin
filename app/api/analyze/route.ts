import { NextRequest, NextResponse } from "next/server";

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

    // 3. คำสั่ง Prompt (Part 1)
    const prompt = `จงตรวจสอบรายการค่าใช้จ่ายจากข้อมูลทั้งหมดที่แนบมานี้ (ทั้งรูปภาพ, PDF, หรือข้อความ) หาว่าแต่ละรายการตรงกับหรือใกล้เคียงกับรายการไหนใน priceMatrix ต่อไปนี้:
${matrixContext}

คำสั่งและเงื่อนไขการประเมิน:
1. สำหรับรายการที่ตรงกับหรือใกล้เคียงกับข้อมูลใน priceMatrix:
   - หากราคาที่ตรวจพบ (detectedPrice) <= ราคากลางสูงสุด (matrixMaxPrice) ให้กำหนด "status": "PASS"
   - หากราคาที่ตรวจพบ (detectedPrice) > ราคากลางสูงสุด (matrixMaxPrice) ให้กำหนด "status": "FAIL"
2. สำหรับรายการในใบเสร็จที่ค้นหาไม่พบ หรือไม่มีความใกล้เคียงกับข้อมูลใน priceMatrix เลย ให้ตอบกลับด้วย:
   - "status": "NOT_FOUND"
   - "message": "ไม่อยู่ในฐานข้อมูลราคากลาง"
   - "matchedMatrixItem": null
   - "matrixMaxPrice": null

ให้ตอบกลับเป็น JSON Array โครงสร้างคือ:
[
  {
    "status": "PASS" | "FAIL" | "NOT_FOUND",
    "message": "คำอธิบายผลการตรวจสอบอย่างละเอียดภาษาไทย",
    "itemInReceipt": "ชื่อที่ตรวจพบ",
    "matchedMatrixItem": "ชื่อในราคากลาง หรือ null หากไม่พบ",
    "detectedPrice": ตัวเลขราคาต่อหน่วยที่ตรวจพบ,
    "matrixMaxPrice": ตัวเลขราคากลางสูงสุด หรือ null หากไม่พบ,
    "unit": "หน่วยนับ เช่น กล่อง, ชิ้น, ครั้ง"
  }
]
ห้ามมีข้อความอื่นปนเด็ดขาด`;

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

    // 5. ยิง Native Fetch ตรงไปที่ Google Generative Language API
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
              parts: parts,
            },
          ],
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
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsedData = JSON.parse(text);
    if (!Array.isArray(parsedData)) {
      parsedData = [parsedData];
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
