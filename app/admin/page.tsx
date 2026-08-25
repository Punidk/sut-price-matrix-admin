"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Utensils,
  Briefcase,
  Wrench,
} from "lucide-react";

// Data Model Interface
export interface PriceMatrixItem {
  id: string;
  itemName: string;
  category: string;
  maxPrice: number;
  unit: string;
  updatedAt?: number;
}

export type PriceMatrixFormData = Omit<PriceMatrixItem, "id" | "updatedAt">;

// Default categories
const CATEGORIES = ["อาหาร", "อุปกรณ์สำนักงาน", "บริการ", "อื่นๆ"];

// Initial fallback mock data if Firestore keys pending
const INITIAL_DEMO_ITEMS: PriceMatrixItem[] = [
  {
    id: "pm-001",
    itemName: "ข้าวกล่อง (กระเพราไก่ไข่ดาว/สตาฟ)",
    category: "อาหาร",
    maxPrice: 50,
    unit: "กล่อง",
    updatedAt: Date.now() - 86400000 * 2,
  },
  {
    id: "pm-002",
    itemName: "น้ำดื่มบรรจุขวด SUT (600 ml)",
    category: "อาหาร",
    maxPrice: 60,
    unit: "แพ็ค",
    updatedAt: Date.now() - 86400000 * 1,
  },
  {
    id: "pm-003",
    itemName: "กระดาษ A4 (80 แกรม)",
    category: "อุปกรณ์สำนักงาน",
    maxPrice: 135,
    unit: "รีม",
    updatedAt: Date.now() - 43200000,
  },
  {
    id: "pm-004",
    itemName: "ป้ายไวนิลประชาสัมพันธ์ (พร้อมเจาะตาไก่)",
    category: "อุปกรณ์สำนักงาน",
    maxPrice: 150,
    unit: "ตร.ม.",
    updatedAt: Date.now() - 3600000 * 10,
  },
  {
    id: "pm-005",
    itemName: "ค่าบริการเช่าเครื่องเสียงและไฟเวที",
    category: "บริการ",
    maxPrice: 5000,
    unit: "วัน",
    updatedAt: Date.now() - 3600000 * 5,
  },
  {
    id: "pm-006",
    itemName: "ค่าตอบแทนวิทยากรภายนอก",
    category: "บริการ",
    maxPrice: 1200,
    unit: "ชั่วโมง",
    updatedAt: Date.now() - 3600000 * 2,
  },
];

const LOCAL_STORAGE_KEY = "sut_price_matrix_collection_demo";

export default function AdminDashboardPage() {
  const { user, loading: authLoading, logout, isDemoMode } = useAuth();
  const router = useRouter();

  // Firestore Data State
  const [items, setItems] = useState<PriceMatrixItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
  const [sortField, setSortField] = useState<"itemName" | "maxPrice" | "category">("itemName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Modal Control States (Add / Edit) with Aliases
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceMatrixItem | null>(null);

  // Form Field States
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("อาหาร");
  const [maxPrice, setMaxPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Confirm Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<PriceMatrixItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<PriceMatrixItem | null>(null);

  // 1. Auth Guard Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  // 2. Real-time Firestore Subscription (Collection: `price_matrix`)
  useEffect(() => {
    if (!user) return;

    if (isFirebaseConfigured && db) {
      const matrixCollectionRef = collection(db, "price_matrix");
      const unsubscribe = onSnapshot(
        matrixCollectionRef,
        (snapshot) => {
          const list: PriceMatrixItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              itemName: data.itemName || "",
              category: data.category || "อื่นๆ",
              maxPrice: Number(data.maxPrice) || 0,
              unit: data.unit || "",
              updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
            };
          });
          setItems(list);
          setDataLoading(false);
        },
        (error) => {
          console.error("Firestore snapshot error on price_matrix:", error);
          loadDemoData();
        }
      );
      return () => unsubscribe();
    } else {
      loadDemoData();
    }
  }, [user]);

  const loadDemoData = () => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          setItems(JSON.parse(stored));
        } catch {
          setItems(INITIAL_DEMO_ITEMS);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_ITEMS));
        }
      } else {
        setItems(INITIAL_DEMO_ITEMS);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_ITEMS));
      }
    }
    setDataLoading(false);
  };

  const saveDemoData = (newItems: PriceMatrixItem[]) => {
    setItems(newItems);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
    }
  };

  // Reset Form Inputs completely
  const resetFormFields = () => {
    setItemName("");
    setCategory("อาหาร");
    setMaxPrice("");
    setUnit("");
    setEditingItem(null);
    setFormError(null);
    setFormSubmitting(false);
    setIsSaving(false);
  };

  // Close Add/Edit Modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setShowAddModal(false);
    setShowModal(false);
    resetFormFields();
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    resetFormFields();
    setIsModalOpen(true);
    setShowAddModal(true);
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: PriceMatrixItem) => {
    setEditingItem(item);
    setItemName(item.itemName);
    setCategory(item.category);
    setMaxPrice(item.maxPrice.toString());
    setUnit(item.unit);
    setFormError(null);
    setIsModalOpen(true);
    setShowAddModal(true);
    setShowModal(true);
  };

  // Form Submit Handler (handleFormSubmit / handleSave / handleAdd / handleUpdate / onSubmit)
  const handleFormSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    const priceNum = parseFloat(maxPrice);
    if (!itemName.trim()) {
      setFormError("กรุณากรอกชื่อรายการราคากลาง");
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError("กรุณากรอกราคากลางสูงสุดเป็นตัวเลขที่มากกว่า 0");
      return;
    }
    if (!unit.trim()) {
      setFormError("กรุณากรอกหน่วยนับ (เช่น ชิ้น, กล่อง, ตร.ม.)");
      return;
    }

    // 1. เมื่อเริ่มบันทึก: เซ็ต Loading เป็น true
    setFormSubmitting(true);
    setIsSaving(true);

    try {
      const formattedName = itemName.trim();
      const formattedUnit = unit.trim();

      // 2. ใช้ try-catch-finally สำหรับการเรียก Firebase (addDoc / updateDoc)
      if (isFirebaseConfigured && db) {
        if (editingItem) {
          const docRef = doc(db, "price_matrix", editingItem.id);
          await updateDoc(docRef, {
            itemName: formattedName,
            category,
            maxPrice: priceNum,
            unit: formattedUnit,
            updatedAt: serverTimestamp(),
          });
        } else {
          const collectionRef = collection(db, "price_matrix");
          await addDoc(collectionRef, {
            itemName: formattedName,
            category,
            maxPrice: priceNum,
            unit: formattedUnit,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 5. เมื่อเซฟสำเร็จ อัปเดตข้อมูลในตารางหน้าเว็บทันที
      if (editingItem) {
        setItems((prevItems) =>
          prevItems.map((i) =>
            i.id === editingItem.id
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
        setItems((prevItems) => [newItem, ...prevItems]);
      }
    } catch (err: any) {
      console.error("Save price matrix error:", err);
      setFormError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      // 3. ใน block finally {} เด็ดขาด:
      // - เซ็ต Loading สถานะปุ่มกลับเป็น false
      // - สั่งปิดหน้าต่าง Modal ทันที (setIsModalOpen(false) / setShowAddModal(false))
      // - เคลียร์ค่าในฟอร์มให้กลับมาเป็นค่าว่าง (resetFormFields)
      setFormSubmitting(false);
      setIsSaving(false);
      setIsModalOpen(false);
      setShowAddModal(false);
      setShowModal(false);
      resetFormFields();
    }
  };

  const handleSave = handleFormSubmit;
  const handleAdd = handleFormSubmit;
  const handleUpdate = handleFormSubmit;
  const onSubmit = handleFormSubmit;

  // Open Confirm Delete Modal
  const handleOpenDeleteModal = (item: PriceMatrixItem) => {
    setDeletingItem(item);
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
    setShowDeleteModal(true);
  };

  // Close Delete Modal
  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setShowDeleteModal(false);
    setDeletingItem(null);
    setItemToDelete(null);
  };

  // Optimistic Delete Function
  const handleDelete = () => {
    const targetItem = deletingItem || itemToDelete;
    if (!targetItem) return;
    const targetId = targetItem.id;

    setIsDeleteModalOpen(false);
    setShowDeleteModal(false);
    setDeletingItem(null);
    setItemToDelete(null);

    setItems((prevItems) => prevItems.filter((i) => i.id !== targetId));

    if (isFirebaseConfigured && db) {
      const docRef = doc(db, "price_matrix", targetId);
      deleteDoc(docRef).catch((err) => {
        console.error("Background deleteDoc error:", err);
      });
    } else {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          try {
            const list: PriceMatrixItem[] = JSON.parse(stored);
            const updated = list.filter((i) => i.id !== targetId);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
          } catch {}
        }
      }
    }
  };

  const handleConfirmDelete = handleDelete;

  // Filtered & Sorted items calculation
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const matchesSearch = item.itemName
          .toLowerCase()
          .includes(searchTerm.toLowerCase().trim());
        const matchesCat =
          selectedCategory === "ทั้งหมด" || item.category === selectedCategory;
        return matchesSearch && matchesCat;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === "string") {
          valA = (valA as string).toLowerCase();
          valB = (valB as string).toLowerCase();
        }

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

  const activeDeleteTarget = deletingItem || itemToDelete;
  const isDeleteActive = (isDeleteModalOpen || showDeleteModal) && Boolean(activeDeleteTarget);
  const isAddModalActive = isModalOpen || showAddModal || showModal;
  const isSaveLoading = formSubmitting || isSaving;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-white selection:text-black">
      
      {/* 1. Navbar Header */}
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

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Notice Banner */}
        {isDemoMode && (
          <div className="bg-neutral-900 border border-neutral-800 p-4 font-mono text-xs text-neutral-300 flex items-start space-x-3">
            <Info className="w-4 h-4 text-white shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-white font-bold uppercase">FIRESTORE BACKEND READY</span>
              <p className="text-neutral-400 font-sans text-xs">
                ระบบถูกออกแบบให้เชื่อมต่อ Firestore คอลเลกชัน <code className="text-white bg-neutral-950 px-1 py-0.5">price_matrix</code> 
                อัตโนมัติทันทีที่ใส่ API Key ในไฟล์ <code className="text-white bg-neutral-950 px-1 py-0.5">.env.local</code>
              </p>
            </div>
          </div>
        )}

        {/* Header & Stats Overview */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
              SUT STUDENT COUNCIL / BUDGET PRE-AUDIT
            </div>
            <h2 className="text-2xl font-bold font-mono tracking-tight text-white uppercase mt-1">
              จัดการฐานข้อมูลราคากลาง (price_matrix)
            </h2>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="bg-white hover:bg-neutral-200 text-black font-semibold font-mono text-xs py-2.5 px-4 transition border border-white flex items-center justify-center space-x-2 rounded-none shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>เพิ่มรายการราคากลางใหม่</span>
          </button>
        </div>

        {/* Stats Counter Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
          <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-neutral-400 text-[11px]">
              <span>TOTAL ITEMS</span>
              <Database className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-white">{items.length}</div>
            <div className="text-[10px] text-neutral-500">รายการราคากลางทั้งหมด</div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-neutral-400 text-[11px]">
              <span>FOOD CATEGORY</span>
              <Utensils className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-white">
              {items.filter((i) => i.category === "อาหาร" || i.category === "Food").length}
            </div>
            <div className="text-[10px] text-neutral-500">หมวดหมู่ อาหาร</div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-neutral-400 text-[11px]">
              <span>OFFICE SUPPLIES</span>
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-white">
              {items.filter((i) => i.category === "อุปกรณ์สำนักงาน" || i.category === "Material").length}
            </div>
            <div className="text-[10px] text-neutral-500">หมวดหมู่ อุปกรณ์สำนักงาน</div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-2">
            <div className="flex items-center justify-between text-neutral-400 text-[11px]">
              <span>SERVICES & OTHERS</span>
              <Wrench className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-white">
              {items.filter((i) => i.category === "บริการ" || i.category === "อื่นๆ" || i.category === "Service" || i.category === "Other").length}
            </div>
            <div className="text-[10px] text-neutral-500">หมวดหมู่ บริการ/อื่นๆ</div>
          </div>
        </div>

        {/* 3. Data Table Section */}
        <div className="bg-neutral-900 border border-neutral-800 space-y-0 rounded-none shadow-xl">
          
          {/* Controls Bar */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
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

            {/* Category Filter Tabs */}
            <div className="flex items-center space-x-1 bg-neutral-950 border border-neutral-800 p-1 text-xs font-mono overflow-x-auto">
              <Filter className="w-3.5 h-3.5 text-neutral-500 ml-1 mr-1 shrink-0" />
              {["ทั้งหมด", "อาหาร", "อุปกรณ์สำนักงาน", "บริการ", "อื่นๆ"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-[11px] whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? "bg-white text-black font-bold"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 text-xs font-mono uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold w-12 text-center">#</th>
                  <th className="py-3.5 px-4 font-semibold">
                    <button
                      onClick={() => toggleSort("itemName")}
                      className="flex items-center space-x-1.5 hover:text-white transition"
                    >
                      <span>ชื่อรายการ (itemName)</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 font-semibold">
                    <button
                      onClick={() => toggleSort("category")}
                      className="flex items-center space-x-1.5 hover:text-white transition"
                    >
                      <span>หมวดหมู่ (category)</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    <button
                      onClick={() => toggleSort("maxPrice")}
                      className="flex items-center space-x-1.5 hover:text-white transition ml-auto"
                    >
                      <span>ราคากลางสูงสุด (maxPrice)</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 font-semibold">หน่วยนับ (unit)</th>
                  <th className="py-3.5 px-4 font-semibold text-center w-28">เครื่องมือ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80 text-sm">
                {dataLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-500 font-mono">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                        <span>กำลังโหลดข้อมูล real-time จาก Firestore...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-500 font-mono space-y-2">
                      <div className="text-neutral-300 font-semibold">ไม่พบรายการราคากลาง</div>
                      <p className="text-xs text-neutral-500">
                        {searchTerm ? `ไม่พบรายการที่ค้นหา "${searchTerm}"` : "ยังไม่มีข้อมูลในคอลเลกชัน price_matrix"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-neutral-850/60 transition font-sans text-neutral-200 group"
                    >
                      <td className="py-3.5 px-4 text-xs font-mono text-neutral-500 text-center">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">
                        {item.itemName}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block border border-neutral-700 bg-neutral-950 text-neutral-300 px-2 py-0.5 text-[11px] font-mono">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        ฿{item.maxPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-neutral-400">
                        {item.unit}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition"
                            title="แก้ไขรายการ"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(item)}
                            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition"
                            title="ลบรายการ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-500">
            <div>
              แสดง {filteredItems.length} จากทั้งหมด {items.length} รายการ
            </div>
            <div>COLLECTION: price_matrix</div>
          </div>
        </div>
      </main>

      {/* 4. Modal (Create / Edit Document) */}
      {isAddModalActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-lg shadow-2xl rounded-none overflow-hidden space-y-0">
            
            {/* Modal Header */}
            <div className="bg-neutral-950 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Database className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold font-mono uppercase tracking-tight text-white">
                  {editingItem ? "แก้ไขข้อมูลราคากลาง" : "เพิ่มรายการราคากลางใหม่"}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-neutral-400 hover:text-white p-1 border border-transparent hover:border-neutral-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="bg-neutral-950 border border-neutral-700 p-3 text-xs font-mono text-neutral-200 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* itemName */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-neutral-300">
                  ชื่อรายการ (itemName) <span className="text-neutral-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="เช่น ข้าวกล่อง, ป้ายไวนิล, กระดาษ A4"
                  className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 rounded-none font-sans"
                />
              </div>

              {/* category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-neutral-300">
                  หมวดหมู่ (category) <span className="text-neutral-400">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition rounded-none font-mono"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* maxPrice & unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-neutral-300">
                    ราคากลางสูงสุด (maxPrice - THB) <span className="text-neutral-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="เช่น 50"
                    className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 font-mono rounded-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-neutral-300">
                    หน่วยนับ (unit) <span className="text-neutral-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="เช่น กล่อง, ชิ้น, ตร.ม."
                    className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 rounded-none font-sans"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-neutral-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 px-4 py-2 text-xs font-mono transition rounded-none"
                >
                  ยกเลิก (CANCEL)
                </button>
                <button
                  type="submit"
                  disabled={isSaveLoading}
                  className="bg-white hover:bg-neutral-200 text-black font-semibold border border-white px-5 py-2 text-xs font-mono transition disabled:opacity-50 rounded-none flex items-center space-x-2"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaveLoading ? "กำลังบันทึก..." : editingItem ? "อัปเดตข้อมูล" : "บันทึกข้อมูล"}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 5. Optimistic Delete Confirm Modal (Instant Close on Click) */}
      {isDeleteActive && activeDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="bg-neutral-900 border border-neutral-700 w-full max-w-md shadow-2xl rounded-none p-6 space-y-5">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 bg-neutral-950 border border-neutral-700 text-white shrink-0">
                <AlertTriangle className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-base font-bold font-mono uppercase tracking-tight text-white">
                  ยืนยันการลบเอกสาร
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้ออกจากคอลเลกชัน <code className="text-white">price_matrix</code>?
                </p>
              </div>
            </div>

            <div className="bg-neutral-950 border border-neutral-800 p-3 text-xs font-mono text-white space-y-1">
              <span className="text-neutral-500 uppercase text-[10px] block">รายการที่จะลบ:</span>
              <div className="font-semibold text-sm">{activeDeleteTarget.itemName}</div>
              <div className="text-neutral-400">ราคากลาง: ฿{activeDeleteTarget.maxPrice} / {activeDeleteTarget.unit}</div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                className="bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 px-4 py-2 text-xs font-mono transition rounded-none"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="bg-white hover:bg-neutral-200 text-black font-semibold border border-white px-5 py-2 text-xs font-mono transition rounded-none flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันการลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
