"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ShieldCheck,
  LogOut,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  AlertTriangle,
  Database,
  Filter,
  ArrowUpDown,
  Info,
  Sparkles,
  UploadCloud,
  RefreshCw,
  FileText,
  CheckCircle2,
} from "lucide-react";

export interface PriceMatrixItem {
  id: string;
  itemName: string;
  category: string;
  maxPrice: number;
  unit: string;
  updatedAt?: number;
}

const CATEGORIES = ["อาหาร", "อุปกรณ์สำนักงาน", "บริการ", "อื่นๆ"];

export default function AdminDashboardPage() {
  const { user, loading: authLoading, logout, isDemoMode } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<PriceMatrixItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
  const [sortField, setSortField] = useState<"itemName" | "maxPrice" | "category">("itemName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // ควบคุมหน้าต่าง Add / Edit
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceMatrixItem | null>(null);

  // ควบคุมหน้าต่าง Delete
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<PriceMatrixItem | null>(null);

  // ควบคุมหน้าต่าง AI Scan Matrix Modal
  const [isAIScanModalOpen, setIsAIScanModalOpen] = useState(false);
  const [aiScanFile, setAiScanFile] = useState<File | null>(null);
  const [aiScanPreview, setAiScanPreview] = useState<string | null>(null);
  const [aiScanStep, setAiScanStep] = useState(0); // 0: idle, 1: extract Gemini, 2: saving Firestore
  const [aiScanStatusText, setAiScanStatusText] = useState("");
  const [aiScanError, setAiScanError] = useState<string | null>(null);

  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("อาหาร");
  const [maxPrice, setMaxPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    if (isFirebaseConfigured && db) {
      const matrixCollectionRef = collection(db, "price_matrix");
      const unsubscribe = onSnapshot(
        matrixCollectionRef,
        (snapshot) => {
          const list: PriceMatrixItem[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            itemName: docSnap.data().itemName || "",
            category: docSnap.data().category || "อื่นๆ",
            maxPrice: Number(docSnap.data().maxPrice) || 0,
            unit: docSnap.data().unit || "",
            updatedAt: docSnap.data().updatedAt?.toMillis ? docSnap.data().updatedAt.toMillis() : Date.now(),
          }));
          setItems(list);
          setDataLoading(false);
        },
        (error) => {
          console.error("Firestore snapshot error:", error);
          setDataLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      setDataLoading(false);
    }
  }, [user]);

  const resetFormFields = () => {
    setItemName("");
    setCategory("อาหาร");
    setMaxPrice("");
    setUnit("");
    setEditingItem(null);
    setFormError(null);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    resetFormFields();
  };

  const handleOpenCreateModal = () => {
    resetFormFields();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: PriceMatrixItem) => {
    setEditingItem(item);
    setItemName(item.itemName);
    setCategory(item.category);
    setMaxPrice(item.maxPrice.toString());
    setUnit(item.unit);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // 🔥 ฟังก์ชัน Save แบบ Optimistic (ทำงานทันที ไม่ต้องรอเน็ต)
  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    const priceNum = parseFloat(maxPrice);
    if (!itemName.trim() || isNaN(priceNum) || priceNum <= 0 || !unit.trim()) {
      setFormError("กรุณากรอกข้อมูลให้ครบและถูกต้อง");
      return;
    }

    const formattedName = itemName.trim();
    const formattedUnit = unit.trim();
    const currentEdit = editingItem;

    // 1. สั่งปิด Modal ทันที! ป้องกัน UI ค้าง
    setIsAddModalOpen(false);

    // 2. อัปเดตตารางหน้าเว็บให้เห็นผลทันที
    if (currentEdit) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === currentEdit.id
            ? { ...i, itemName: formattedName, category, maxPrice: priceNum, unit: formattedUnit, updatedAt: Date.now() }
            : i
        )
      );
    } else {
      const newItem: PriceMatrixItem = {
        id: `pm-${Date.now()}`,
        itemName: formattedName,
        category,
        maxPrice: priceNum,
        unit: formattedUnit,
        updatedAt: Date.now(),
      };
      setItems((prev) => [newItem, ...prev]);
    }

    resetFormFields();

    // 3. ปล่อยให้มันเซฟลง Firebase อยู่เบื้องหลังแบบเงียบๆ
    if (isFirebaseConfigured && db) {
      if (currentEdit) {
        updateDoc(doc(db, "price_matrix", currentEdit.id), {
          itemName: formattedName,
          category,
          maxPrice: priceNum,
          unit: formattedUnit,
          updatedAt: serverTimestamp(),
        }).catch(console.error);
      } else {
        addDoc(collection(db, "price_matrix"), {
          itemName: formattedName,
          category,
          maxPrice: priceNum,
          unit: formattedUnit,
          updatedAt: serverTimestamp(),
        }).catch(console.error);
      }
    }
  };

  const handleOpenDeleteModal = (item: PriceMatrixItem) => {
    setDeletingItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingItem(null);
  };

  // 🔥 ฟังก์ชัน Delete แบบ Optimistic (ปิดหน้าต่างลบแถวทันที)
  const handleDelete = () => {
    if (!deletingItem) return;
    const targetId = deletingItem.id;

    // 1. ปิดหน้าต่างทันที
    setIsDeleteModalOpen(false);
    
    // 2. เตะข้อมูลออกจากตารางทันที
    setItems((prev) => prev.filter((i) => i.id !== targetId));
    setDeletingItem(null);

    // 3. ปล่อยคำสั่งลบลง Firebase ไปทำงานเบื้องหลัง
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, "price_matrix", targetId)).catch(console.error);
    }
  };

  // --- AI Scan Matrix Modal Handlers ---
  const handleOpenAIScanModal = () => {
    setAiScanFile(null);
    setAiScanPreview(null);
    setAiScanStep(0);
    setAiScanStatusText("");
    setAiScanError(null);
    setIsAIScanModalOpen(true);
  };

  const handleCloseAIScanModal = () => {
    if (aiScanStep > 0) return; // Prevent closing while processing
    setIsAIScanModalOpen(false);
    setAiScanFile(null);
    setAiScanPreview(null);
    setAiScanStep(0);
    setAiScanStatusText("");
    setAiScanError(null);
  };

  const handleAIScanFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAiScanFile(file);
      setAiScanError(null);
      if (file.type.startsWith("image/")) {
        setAiScanPreview(URL.createObjectURL(file));
      } else {
        setAiScanPreview(null);
      }
    }
  };

  // Helper to convert file to Base64 String (excluding data URL prefix)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1] || result;
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Automated AI Extraction & Firestore Batch Upload
  const handleAIScanSubmit = async () => {
    if (!aiScanFile) return;

    setAiScanError(null);

    try {
      // 1. Convert Image to Base64 and send directly to Gemini AI
      setAiScanStep(1);
      setAiScanStatusText("กำลังแปลงไฟล์รูปภาพและส่งให้ Gemini AI อ่านตารางราคากลาง...");

      const base64Data = await fileToBase64(aiScanFile);

      const resExtract = await fetch("/api/extract-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: aiScanFile.type || "image/jpeg",
        }),
      });

      if (!resExtract.ok) {
        const errJson = await resExtract.json().catch(() => ({}));
        throw new Error(errJson.details || errJson.error || "ไม่สามารถสกัดข้อมูลจากรูปภาพด้วย Gemini AI ได้");
      }

      const extractedItems: Array<{
        itemName: string;
        category: string;
        maxPrice: number;
        unit: string;
      }> = await resExtract.json();

      if (!Array.isArray(extractedItems) || extractedItems.length === 0) {
        throw new Error("Gemini AI ไม่พบข้อมูลรายการราคากลางในรูปภาพนี้");
      }

      // 2. Saving Extracted Items to Firestore collection `price_matrix`
      setAiScanStep(2);
      setAiScanStatusText(`กำลังบันทึกรายการราคากลางใหม่ ${extractedItems.length} รายการ ลงฐานข้อมูล Firestore (price_matrix)...`);

      const newLocalItems: PriceMatrixItem[] = [];

      for (const itemData of extractedItems) {
        const formattedItem = {
          itemName: itemData.itemName || "รายการไม่มีชื่อ",
          category: CATEGORIES.includes(itemData.category) ? itemData.category : "อื่นๆ",
          maxPrice: Number(itemData.maxPrice) || 0,
          unit: itemData.unit || "รายการ",
        };

        if (isFirebaseConfigured && db) {
          const docRef = await addDoc(collection(db, "price_matrix"), {
            ...formattedItem,
            updatedAt: serverTimestamp(),
          });
          newLocalItems.push({
            id: docRef.id,
            ...formattedItem,
            updatedAt: Date.now(),
          });
        } else {
          newLocalItems.push({
            id: `pm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            ...formattedItem,
            updatedAt: Date.now(),
          });
        }
      }

      // Update table local state immediately
      setItems((prev) => [...newLocalItems, ...prev]);

      // Complete & Close Modal
      setIsAIScanModalOpen(false);
      setAiScanFile(null);
      setAiScanPreview(null);
      setAiScanStep(0);
      setAiScanStatusText("");
    } catch (err: any) {
      console.error("AI Scan submit error:", err);
      setAiScanError(err.message || "เกิดข้อผิดพลาดในการสกัดราคากลางด้วย AI");
      setAiScanStep(0);
    }
  };

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase().trim());
        const matchesCat = selectedCategory === "ทั้งหมด" || item.category === selectedCategory;
        return matchesSearch && matchesCat;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === "string") { valA = valA.toLowerCase(); valB = (valB as string).toLowerCase(); }
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [items, searchTerm, selectedCategory, sortField, sortDirection]);

  const toggleSort = (field: "itemName" | "maxPrice" | "category") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
          <span>AUTHENTICATING SECURITY ACCESS...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Navbar Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-white text-black font-bold flex items-center justify-center text-lg rounded-none">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold font-mono tracking-tight text-white uppercase">
                  SUT CENTRAL PRICE MATRIX
                </h1>
                {isDemoMode && (
                  <span className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-mono px-2 py-0.5 uppercase">
                    DEMO MODE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 font-mono hidden sm:block">
                Firestore Collection: <code className="text-white">price_matrix</code>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex flex-col items-end text-xs font-mono">
              <span className="text-neutral-500">ADMIN USER</span>
              <span className="text-white font-semibold truncate max-w-[200px]">
                {user.email || "Admin User"}
              </span>
            </div>
            <div className="h-6 w-px bg-neutral-800 hidden md:block"></div>
            <button
              onClick={logout}
              className="bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-mono py-2 px-3 border border-neutral-800 hover:border-neutral-700 transition flex items-center space-x-2 rounded-none group"
            >
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>LOGOUT</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {isDemoMode && (
          <div className="bg-neutral-900 border border-neutral-800 p-4 font-mono text-xs text-neutral-300 flex items-start space-x-3">
            <Info className="w-4 h-4 text-white shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-white font-bold uppercase">FIRESTORE BACKEND READY</span>
              <p className="text-neutral-400 font-sans text-xs">
                ระบบถูกออกแบบให้เชื่อมต่อ Firestore คอลเลกชัน <code className="text-white bg-neutral-950 px-1 py-0.5">price_matrix</code> อัตโนมัติทันทีที่ใส่ API Key
              </p>
            </div>
          </div>
        )}

        {/* Header & Stats Overview with AI Button */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
              SUT STUDENT COUNCIL / BUDGET PRE-AUDIT
            </div>
            <h2 className="text-2xl font-bold font-mono tracking-tight text-white uppercase mt-1">
              จัดการฐานข้อมูลราคากลาง
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* AI Matrix Scan Button */}
            <button
              onClick={handleOpenAIScanModal}
              className="bg-amber-400 hover:bg-amber-300 text-black font-bold font-mono text-xs py-2.5 px-4 transition border border-amber-400 flex items-center justify-center space-x-2 rounded-none shadow-sm"
            >
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              <span>สแกนจากรูปภาพ (AI)</span>
            </button>

            {/* Create Item Button */}
            <button
              onClick={handleOpenCreateModal}
              className="bg-white hover:bg-neutral-200 text-black font-semibold font-mono text-xs py-2.5 px-4 transition border border-white flex items-center justify-center space-x-2 rounded-none shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>เพิ่มรายการราคากลางใหม่</span>
            </button>
          </div>
        </div>

        {/* Data Table Section */}
        <div className="bg-neutral-900 border border-neutral-800 space-y-0 rounded-none shadow-xl">
          <div className="p-4 sm:p-5 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหารายการราคากลาง..."
                className="w-full bg-neutral-950 border border-neutral-800 text-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 rounded-none"
              />
            </div>
            <div className="flex items-center space-x-1 bg-neutral-950 border border-neutral-800 p-1 text-xs font-mono overflow-x-auto">
              <Filter className="w-3.5 h-3.5 text-neutral-500 ml-1 mr-1 shrink-0" />
              {["ทั้งหมด", "อาหาร", "อุปกรณ์สำนักงาน", "บริการ", "อื่นๆ"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-[11px] whitespace-nowrap transition ${
                    selectedCategory === cat ? "bg-white text-black font-bold" : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 text-xs font-mono uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold w-12 text-center">#</th>
                  <th className="py-3.5 px-4 font-semibold">
                    <button onClick={() => toggleSort("itemName")} className="flex items-center space-x-1.5 hover:text-white transition">
                      <span>ชื่อรายการ</span> <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 font-semibold">
                    <button onClick={() => toggleSort("category")} className="flex items-center space-x-1.5 hover:text-white transition">
                      <span>หมวดหมู่</span> <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    <button onClick={() => toggleSort("maxPrice")} className="flex items-center space-x-1.5 hover:text-white transition ml-auto">
                      <span>ราคากลางสูงสุด</span> <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 font-semibold">หน่วยนับ</th>
                  <th className="py-3.5 px-4 font-semibold text-center w-28">เครื่องมือ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80 text-sm">
                {dataLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-500 font-mono">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                        <span>กำลังโหลดข้อมูล...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-500 font-mono">ไม่พบรายการราคากลาง</td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-neutral-850/60 transition font-sans text-neutral-200 group">
                      <td className="py-3.5 px-4 text-xs font-mono text-neutral-500 text-center">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-medium text-white">{item.itemName}</td>
                      <td className="py-3.5 px-4"><span className="inline-block border border-neutral-700 bg-neutral-950 text-neutral-300 px-2 py-0.5 text-[11px] font-mono">{item.category}</span></td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">฿{item.maxPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-4 text-xs font-mono text-neutral-400">{item.unit}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button onClick={() => handleOpenEditModal(item)} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent transition"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleOpenDeleteModal(item)} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent transition"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 1. Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-lg shadow-2xl rounded-none overflow-hidden space-y-0">
            <div className="bg-neutral-950 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Database className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold font-mono uppercase tracking-tight text-white">
                  {editingItem ? "แก้ไขข้อมูลราคากลาง" : "เพิ่มรายการราคากลางใหม่"}
                </h3>
              </div>
              <button onClick={handleCloseModal} className="text-neutral-400 hover:text-white p-1 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="bg-neutral-950 border border-neutral-700 p-3 text-xs font-mono text-neutral-200 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-neutral-300">ชื่อรายการ <span className="text-neutral-400">*</span></label>
                <input type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="เช่น ข้าวกล่อง" className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition rounded-none" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-neutral-300">หมวดหมู่ <span className="text-neutral-400">*</span></label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition rounded-none font-mono">
                  {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-neutral-300">ราคากลางสูงสุด <span className="text-neutral-400">*</span></label>
                  <input type="number" step="0.01" min="0" required value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="เช่น 50" className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition font-mono rounded-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-neutral-300">หน่วยนับ <span className="text-neutral-400">*</span></label>
                  <input type="text" required value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="เช่น กล่อง, ชิ้น" className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition rounded-none" />
                </div>
              </div>
              <div className="pt-4 border-t border-neutral-800 flex items-center justify-end space-x-3">
                <button type="button" onClick={handleCloseModal} className="bg-neutral-950 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 px-4 py-2 text-xs font-mono transition rounded-none">ยกเลิก</button>
                <button type="submit" className="bg-white hover:bg-neutral-200 text-black font-semibold border border-white px-5 py-2 text-xs font-mono transition rounded-none flex items-center space-x-2">
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึกข้อมูล</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Delete Modal */}
      {isDeleteModalOpen && deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-md shadow-2xl rounded-none p-6 space-y-5">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 bg-neutral-950 border border-neutral-700 text-white shrink-0"><AlertTriangle className="w-6 h-6 stroke-[2]" /></div>
              <div>
                <h3 className="text-base font-bold font-mono uppercase tracking-tight text-white">ยืนยันการลบเอกสาร</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?</p>
              </div>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 p-3 text-xs font-mono text-white space-y-1">
              <span className="text-neutral-500 uppercase text-[10px] block">รายการที่จะลบ:</span>
              <div className="font-semibold text-sm">{deletingItem.itemName}</div>
              <div className="text-neutral-400">ราคากลาง: ฿{deletingItem.maxPrice} / {deletingItem.unit}</div>
            </div>
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end space-x-3">
              <button type="button" onClick={handleCloseDeleteModal} className="bg-neutral-950 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 px-4 py-2 text-xs font-mono transition rounded-none">ยกเลิก</button>
              <button type="button" onClick={handleDelete} className="bg-white hover:bg-neutral-200 text-black font-semibold border border-white px-5 py-2 text-xs font-mono transition rounded-none flex items-center space-x-1.5"><Trash2 className="w-3.5 h-3.5" /><span>ยืนยันการลบ</span></button>
            </div>
          </div>
        </div>
      )}

      {/* 3. AI Scan Matrix Modal */}
      {isAIScanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-lg shadow-2xl rounded-none overflow-hidden space-y-0">
            <div className="bg-neutral-950 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold font-mono uppercase tracking-tight text-white">
                  สแกนราคากลางจากรูปภาพด้วย Gemini AI
                </h3>
              </div>
              <button
                onClick={handleCloseAIScanModal}
                disabled={aiScanStep > 0}
                className="text-neutral-400 hover:text-white p-1 transition disabled:opacity-30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {aiScanError && (
                <div className="bg-neutral-950 border border-neutral-700 p-3 text-xs font-mono text-neutral-200 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>{aiScanError}</span>
                </div>
              )}

              {!aiScanFile ? (
                <div
                  onClick={() => aiFileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-700 hover:border-amber-400 bg-neutral-950 p-8 text-center cursor-pointer transition space-y-3 group"
                >
                  <div className="w-12 h-12 bg-neutral-900 border border-neutral-800 text-amber-400 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">คลิกเพื่ออัปโหลดรูปภาพประกาศราคากลาง</p>
                    <p className="text-xs text-neutral-500 font-mono">รองรับไฟล์รูปภาพ JPG, PNG (ตารางประกาศราคากลาง)</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-neutral-950 p-3 border border-neutral-800 text-xs font-mono">
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-white truncate">{aiScanFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAiScanFile(null)}
                      disabled={aiScanStep > 0}
                      className="text-neutral-500 hover:text-white ml-2 shrink-0 disabled:opacity-30"
                    >
                      เปลี่ยนรูป
                    </button>
                  </div>

                  {aiScanPreview && (
                    <div className="bg-neutral-950 border border-neutral-800 max-h-56 flex items-center justify-center overflow-hidden p-2">
                      {/* eslint-disable-next-html-element-suppression */}
                      <img src={aiScanPreview} alt="Matrix Document" className="max-h-52 object-contain" />
                    </div>
                  )}
                </div>
              )}

              <input
                type="file"
                ref={aiFileInputRef}
                accept="image/*"
                onChange={handleAIScanFileChange}
                className="hidden"
              />

              {/* Step Progress Display */}
              {aiScanStep > 0 && (
                <div className="bg-neutral-950 border border-neutral-800 p-4 space-y-2 font-mono text-xs">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span>{aiScanStatusText}</span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1.5 rounded-none overflow-hidden">
                    <div
                      className="bg-amber-400 h-full transition-all duration-300"
                      style={{
                        width: aiScanStep === 1 ? "50%" : "95%",
                      }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-neutral-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseAIScanModal}
                  disabled={aiScanStep > 0}
                  className="bg-neutral-950 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 px-4 py-2 text-xs font-mono transition rounded-none disabled:opacity-30"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleAIScanSubmit}
                  disabled={!aiScanFile || aiScanStep > 0}
                  className="bg-amber-400 hover:bg-amber-300 text-black font-bold border border-amber-400 px-5 py-2 text-xs font-mono transition disabled:opacity-40 rounded-none flex items-center space-x-2"
                >
                  {aiScanStep > 0 ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>เริ่มสแกนด้วย Gemini AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
