"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { PriceMatrixItem } from "@/lib/types";
import { initialPriceMatrixData } from "@/lib/mockData";
import {
  UploadCloud,
  Camera,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Building2,
  Lock,
  ExternalLink,
  ImageIcon,
  Brain,
} from "lucide-react";

const IMGBB_API_KEY = "5f6ccb81e79ea0735182d9a7870bff69";

interface AnalysisResult {
  status: "PASS" | "FAIL";
  message: string;
  item: string;
  detectedPrice: number;
  matrixMaxPrice: number;
  unit: string;
}

export default function UserFrontendPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Firestore Price Matrix items state
  const [priceMatrix, setPriceMatrix] = useState<PriceMatrixItem[]>([]);

  // AI Analysis Result state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Firestore `price_matrix` on page load
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const matrixRef = collection(db, "price_matrix");
      const unsubscribe = onSnapshot(
        matrixRef,
        (snapshot) => {
          const list: PriceMatrixItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              itemName: data.itemName || "",
              category: data.category || "อื่นๆ",
              maxPrice: Number(data.maxPrice || data.unitPrice) || 0,
              unit: data.unit || data.unitType || "",
              updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
            };
          });
          setPriceMatrix(list);
        },
        (err) => {
          console.error("Firestore snapshot error:", err);
          setPriceMatrix(initialPriceMatrixData);
        }
      );
      return () => unsubscribe();
    } else {
      setPriceMatrix(initialPriceMatrixData);
    }
  }, []);

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAnalysisResult(null);
      setUploadedImageUrl(null);
      setUploadError(null);

      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  // Sample file preview simulation
  const handleSelectSample = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("SUT Receipt Sample", 100, 150);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const sampleFile = new File([blob], "ใบเสนอราคา_ข้าวกล่อง_มทส.jpg", { type: "image/jpeg" });
        setSelectedFile(sampleFile);
        setPreviewUrl(URL.createObjectURL(sampleFile));
        setAnalysisResult(null);
        setUploadedImageUrl(null);
        setUploadError(null);
      }
    }, "image/jpeg");
  };

  // Clear selected file & reset state
  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedImageUrl(null);
    setAnalysisResult(null);
    setUploadError(null);
    setIsProcessing(false);
    setProcessingStep(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // ImgBB API Upload & Gemini AI Analysis Handler
  const handleStartAudit = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProcessingStep(1); // 1. กำลังอัปโหลดเอกสารไปยัง ImgBB API...
    setUploadError(null);
    setAnalysisResult(null);

    try {
      // 1. Construct FormData for ImgBB API
      const formData = new FormData();
      formData.append("key", IMGBB_API_KEY);
      formData.append("image", selectedFile);

      // 2. Send POST Request to ImgBB API
      const resImgBB = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: formData,
      });

      if (!resImgBB.ok) {
        throw new Error(`อัปโหลดไฟล์ไปที่ ImgBB ไม่สำเร็จ (Status ${resImgBB.status})`);
      }

      const imgBBData = await resImgBB.json();

      if (!imgBBData.success || !imgBBData.data?.url) {
        throw new Error(imgBBData.error?.message || "ไม่สามารถดึง URL รูปภาพจาก ImgBB ได้");
      }

      // Extract Direct Link URL
      const directUrl = imgBBData.data.url;
      setUploadedImageUrl(directUrl);
      console.log("ImgBB Uploaded Image Direct URL:", directUrl);

      // 3. Step 2: Send Image URL & Price Matrix to Gemini AI Route (/api/analyze)
      setProcessingStep(2); // 2. กำลังวิเคราะห์ใบเสร็จด้วย Gemini AI...

      const aiRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: directUrl,
          priceMatrix: priceMatrix,
        }),
      });

      if (!aiRes.ok) {
        const errorJson = await aiRes.json().catch(() => ({}));
        throw new Error(errorJson.details || errorJson.error || `AI API returned status ${aiRes.status}`);
      }

      const aiData: AnalysisResult = await aiRes.json();
      console.log("Gemini AI Analysis Result:", aiData);

      setProcessingStep(3); // 3. สรุปผลการตรวจสอบอนุมัติ...
      await new Promise((r) => setTimeout(r, 400));

      // 4. Update Result State with Real Gemini AI Output
      setAnalysisResult(aiData);
    } catch (err: any) {
      console.error("Audit Processing Error:", err);
      setUploadError(err.message || "เกิดข้อผิดพลาดในการประมวลผลวิเคราะห์เอกสาร");
    } finally {
      setIsProcessing(false);
      setProcessingStep(0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Header Bar (Orange & Amber SUT Identity) */}
      <header className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white shadow-inner">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">
                  SUT PRE-AUDIT SYSTEM
                </h1>
                <span className="bg-amber-400/20 border border-amber-300/30 text-amber-100 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  STUDENT COUNCIL
                </span>
              </div>
              <p className="text-[11px] text-orange-100 hidden sm:block">
                ระบบตรวจสอบราคากลางงบประมาณสโมสรนักศึกษา มทส.
              </p>
            </div>
          </div>

          <Link
            href="/login"
            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-mono py-2 px-3.5 rounded-lg transition flex items-center space-x-1.5 backdrop-blur-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบ Admin</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        
        {/* Banner Section */}
        <section className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/80 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center space-x-2 bg-orange-500/10 border border-orange-500/20 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full">
              <Brain className="w-3.5 h-3.5 text-orange-600" />
              <span>ระบบวิเคราะห์ใบเสร็จอัตโนมัติด้วย Gemini 1.5 Flash AI</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              ตรวจสอบราคากลางโครงการนักศึกษา
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              อัปโหลดใบเสนอราคาหรือถ่ายรูปเอกสารโครงการเพื่อเปรียบเทียบกับฐานข้อมูลราคากลาง (<code className="text-orange-700 font-semibold font-mono">price_matrix</code>) 
              ของสโมสรนักศึกษา มหาวิทยาลัยเทคโนโลยีสุรนารี
            </p>
          </div>
        </section>

        {/* Step Process Bar */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div className={`p-3 rounded-xl border text-xs sm:text-sm font-medium transition ${
            selectedFile ? "bg-orange-500 text-white border-orange-500 shadow-sm" : "bg-white text-slate-500 border-slate-200"
          }`}>
            <span className="block font-mono text-[10px] uppercase opacity-80">ขั้นตอน 1</span>
            1. อัปโหลดเอกสาร
          </div>
          <div className={`p-3 rounded-xl border text-xs sm:text-sm font-medium transition ${
            isProcessing ? "bg-amber-500 text-white border-amber-500 shadow-sm animate-pulse" : "bg-white text-slate-500 border-slate-200"
          }`}>
            <span className="block font-mono text-[10px] uppercase opacity-80">ขั้นตอน 2</span>
            2. วิเคราะห์ด้วย Gemini AI
          </div>
          <div className={`p-3 rounded-xl border text-xs sm:text-sm font-medium transition ${
            analysisResult ? (analysisResult.status === "PASS" ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-rose-600 text-white border-rose-600 shadow-sm") : "bg-white text-slate-500 border-slate-200"
          }`}>
            <span className="block font-mono text-[10px] uppercase opacity-80">ขั้นตอน 3</span>
            3. ผลการตรวจสอบ
          </div>
        </div>

        {/* Error Alert Box */}
        {uploadError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs font-mono text-rose-700 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-rose-900">[ERROR]: เกิดข้อผิดพลาดในระบบ</span>
              <p className="font-sans text-xs text-rose-700">{uploadError}</p>
            </div>
          </div>
        )}

        {/* Upload Section (2 Large Buttons) */}
        {!selectedFile && (
          <div className="bg-white border-2 border-dashed border-orange-200 rounded-2xl p-6 sm:p-10 shadow-sm text-center space-y-6">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl mx-auto flex items-center justify-center shadow-md">
              <UploadCloud className="w-8 h-8 stroke-[2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                เลือกวิธีอัปโหลดเอกสารใบเสนอราคา
              </h3>
              <p className="text-xs text-slate-500">
                รองรับไฟล์ภาพ (JPG, PNG) และเอกสาร PDF
              </p>
            </div>

            {/* Hidden Input Elements */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* 2 Main Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 px-5 rounded-xl shadow-sm hover:shadow-md transition flex items-center justify-center space-x-3 group"
              >
                <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-sm">อัปโหลดไฟล์ (PDF/รูปภาพ)</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-5 rounded-xl shadow-sm hover:shadow-md transition flex items-center justify-center space-x-3 group"
              >
                <Camera className="w-5 h-5 group-hover:scale-110 transition-transform text-amber-400" />
                <span className="text-sm">ถ่ายรูปด้วยมือถือ</span>
              </button>
            </div>

            {/* Sample Button */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSelectSample}
                className="inline-flex items-center space-x-2 text-xs font-medium text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100/80 px-4 py-2 rounded-lg transition"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>ทดลองใช้เอกสารตัวอย่าง (ใบเสนอราคาข้าวกล่อง)</span>
              </button>
            </div>
          </div>
        )}

        {/* Selected File & Preview Section */}
        {selectedFile && !analysisResult && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB • เอกสารพร้อมสำหรับวิเคราะห์ด้วย Gemini AI
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                disabled={isProcessing}
                className="text-xs text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition border border-slate-200 disabled:opacity-50"
              >
                เปลี่ยนไฟล์
              </button>
            </div>

            {/* Image Preview Window */}
            {previewUrl && (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 max-h-80 flex items-center justify-center">
                {/* eslint-disable-next-html-element-suppression */}
                <img
                  src={previewUrl}
                  alt="Document Preview"
                  className="max-h-80 object-contain w-full"
                />
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3 px-4 text-center">
                    <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent animate-spin rounded-full"></div>
                    <span className="font-mono text-xs tracking-wider text-orange-400 font-semibold">
                      {processingStep === 1 && "กำลังอัปโหลดเอกสารไปยัง ImgBB API..."}
                      {processingStep === 2 && "กำลังวิเคราะห์ข้อความและเปรียบเทียบด้วย Gemini 1.5 Flash AI..."}
                      {processingStep === 3 && "สรุปผลการตรวจสอบอนุมัติ..."}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Audit Action Button (ImgBB + Gemini AI) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartAudit}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-base py-4 px-6 rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center space-x-3 disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>กำลังวิเคราะห์เอกสาร...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-200 group-hover:rotate-12 transition-transform" />
                    <span>ตรวจสอบราคากลางด้วย Gemini AI</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Real Gemini AI Analysis Result Display */}
        {analysisResult && (
          <div className={`bg-white border-2 ${
            analysisResult.status === "PASS" ? "border-emerald-500" : "border-rose-500"
          } rounded-2xl shadow-xl overflow-hidden space-y-0 animate-in fade-in slide-in-from-bottom-4 duration-300`}>
            
            {/* Header Banner (Green for PASS / Red for FAIL) */}
            <div className={`bg-gradient-to-r ${
              analysisResult.status === "PASS" ? "from-emerald-600 to-teal-600" : "from-rose-600 to-red-700"
            } text-white p-6 sm:p-8 flex items-center space-x-4`}>
              <div className={`w-14 h-14 bg-white ${
                analysisResult.status === "PASS" ? "text-emerald-600" : "text-rose-600"
              } rounded-2xl flex items-center justify-center shadow-lg shrink-0`}>
                {analysisResult.status === "PASS" ? (
                  <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
                ) : (
                  <XCircle className="w-9 h-9 stroke-[2.2]" />
                )}
              </div>
              <div className="space-y-1">
                <div className={`inline-block ${
                  analysisResult.status === "PASS" ? "bg-emerald-400/20 text-emerald-100 border-emerald-300/30" : "bg-rose-400/20 text-rose-100 border-rose-300/30"
                } text-xs font-mono px-2.5 py-0.5 rounded-full border font-semibold`}>
                  AUDIT RESULT: {analysisResult.status}
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                  {analysisResult.status === "PASS" ? "ผ่านเกณฑ์ราคากลาง" : "ไม่ผ่านเกณฑ์ราคากลาง (เกินเพดานราคากลาง)"}
                </h3>
                <p className="text-xs sm:text-sm text-white/90">
                  {analysisResult.message}
                </p>
              </div>
            </div>

            {/* Breakdown Card Grid */}
            <div className="p-6 sm:p-8 space-y-6">
              
              {/* ImgBB Direct URL Display */}
              {uploadedImageUrl && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 space-y-2">
                  <div className="flex items-center justify-between text-amber-400 font-bold">
                    <div className="flex items-center space-x-1.5">
                      <ImageIcon className="w-4 h-4" />
                      <span>IMGBB DIRECT LINK URL:</span>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">GEMINI ANALYZED</span>
                  </div>
                  <div className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded border border-slate-800 overflow-x-auto">
                    <span className="text-slate-200 select-all font-mono text-[11px] truncate">
                      {uploadedImageUrl}
                    </span>
                    <a
                      href={uploadedImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-orange-400 hover:text-orange-300 shrink-0 flex items-center space-x-1 text-[11px]"
                    >
                      <span>เปิดดูรูป</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-medium">รายการที่ตรวจพบ (Gemini AI)</span>
                  <div className="text-base font-bold text-slate-900">{analysisResult.item || "ไม่ระบุชื่อรายการ"}</div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-medium">สถานะการอนุมัติ</span>
                  <div className={`text-sm font-bold ${analysisResult.status === "PASS" ? "text-emerald-600" : "text-rose-600"}`}>
                    {analysisResult.status === "PASS" ? "อนุมัติเสนอเบิกจ่ายได้" : "ไม่อนุมัติ (ราคาสูงเกินเกณฑ์)"}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-medium">ราคาที่เสนอในใบเสร็จ</span>
                  <div className="text-lg font-extrabold text-slate-900 font-mono">
                    ฿{Number(analysisResult.detectedPrice).toFixed(2)}{" "}
                    <span className="text-xs font-normal text-slate-500">{analysisResult.unit || "กล่อง"}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-500 font-medium">ราคากลางสูงสุดที่กำหนด</span>
                  <div className="text-lg font-extrabold text-amber-600 font-mono">
                    ฿{Number(analysisResult.matrixMaxPrice).toFixed(2)}{" "}
                    <span className="text-xs font-normal text-slate-500">{analysisResult.unit || "กล่อง"}</span>
                  </div>
                </div>
              </div>

              {/* Price Difference Highlight Box */}
              {analysisResult.status === "PASS" ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <TrendingDown className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-emerald-900">
                        ประหยัดงบประมาณ ฿{(analysisResult.matrixMaxPrice - analysisResult.detectedPrice).toFixed(2)} / {analysisResult.unit}
                      </div>
                      <div className="text-xs text-emerald-700">
                        ราคาที่ขออนุมัติต่ำกว่าเพดานราคากลางของมหาวิทยาลัย
                      </div>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    ผ่านเกณฑ์
                  </span>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-6 h-6 text-rose-600 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-rose-900">
                        ราคาสูงเกินเกณฑ์ ฿{(analysisResult.detectedPrice - analysisResult.matrixMaxPrice).toFixed(2)} / {analysisResult.unit}
                      </div>
                      <div className="text-xs text-rose-700">
                        ราคาเสนอขออนุมัติตั้งสูงกว่าเพดานราคากลางที่กำหนดไว้
                      </div>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    ไม่ผ่านเกณฑ์
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs py-3 px-5 rounded-xl border border-slate-300 transition flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>ตรวจสอบเอกสารอื่น</span>
                </button>

                <Link
                  href="/admin"
                  className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-3 px-5 rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>เข้าสู่ระบบจัดการ Admin Matrix</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Informational Footer Section */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 text-xs text-slate-600 space-y-3">
          <div className="flex items-center space-x-2 font-bold text-slate-800">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span>คำแนะนำเพิ่มเติมสำหรับการจัดเตรียมเอกสาร</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-slate-500 leading-relaxed">
            <li>โปรดถ่ายภาพหรือสแกนเอกสารใบเสนอราคาให้เห็นข้อความและตัวเลขราคาต่อหน่วยชัดเจน</li>
            <li>ระบบประมวลผลด้วย Gemini 1.5 Flash AI และเปรียบเทียบกับคอลเลกชัน <code className="text-slate-800 font-mono">price_matrix</code> ล่าสุด</li>
          </ul>
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            © {new Date().getFullYear()} สโมสรนักศึกษา มหาวิทยาลัยเทคโนโลยีสุรนารี (SUT Student Council)
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px] text-slate-500">
            <span>Pre-Audit System v1.0</span>
            <span>•</span>
            <Link href="/login" className="hover:text-amber-400 transition">
              Admin Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
