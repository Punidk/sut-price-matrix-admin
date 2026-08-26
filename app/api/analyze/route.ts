import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, priceMatrix } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Missing imageUrl parameter" },
        { status: 400 }
      );
    }

    // 1. Fetch image from ImgBB direct URL and convert to Base64
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageUrl} (Status: ${imageRes.status})`);
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imageRes.headers.get("content-type") || "image/jpeg";

    // 2. เช็ก API Key
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ" },
        { status: 500 }
      );
    }

    // 3. แปลงข้อมูล priceMatrix เป็น String
    const matrixContext = JSON.stringify(priceMatrix || [], null, 2);

    // 4. คำสั่ง Prompt
    const prompt = `จงอ่านรายการในรูปใบเสร็จนี้ หาว่าตรงกับรายการไหนในข้อมูล priceMatrix ต่อไปนี้บ้าง:
${matrixContext}

สกัดราคาที่ตรวจพบ และเปรียบเทียบว่าเกิน maxPrice หรือไม่ ให้ตอบกลับมาเป็น JSON ล้วนๆ ในรูปแบบ:
{
  "status": "PASS" | "FAIL",
  "message": "คำอธิบายผลการตรวจสอบอย่างละเอียดภาษาไทย",
  "item": "ชื่อรายการ",
  "detectedPrice": ตัวเลข,
  "matrixMaxPrice": ตัวเลข,
  "unit": "หน่วย"
}
ห้ามมีข้อความอื่นปนเด็ดขาด`;

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
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
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
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsedData = JSON.parse(text);
    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error("Gemini Analyze API Error:", error);
    return NextResponse.json(
      {
        error: "เกิดข้อผิดพลาดในการวิเคราะห์ใบเสร็จด้วย Gemini AI",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
