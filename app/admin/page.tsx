"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import StatCards from "@/components/StatCards";
import PriceMatrixTable from "@/components/PriceMatrixTable";
import ItemModal from "@/components/ItemModal";
import ConfirmModal from "@/components/ConfirmModal";
import { PriceMatrixItem, PriceMatrixFormData } from "@/lib/types";
import { initialPriceMatrixData } from "@/lib/mockData";
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
import { ShieldCheck, Info, Sparkles } from "lucide-react";

const LOCAL_STORAGE_KEY = "sut_price_matrix_items_demo";

export default function AdminDashboardPage() {
  const { user, loading, isDemoMode } = useAuth();

  const [items, setItems] = useState<PriceMatrixItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Modal States
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<PriceMatrixItem | null>(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PriceMatrixItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load / Subscribe to Data
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      // Real-time Firestore sync
      const priceMatrixRef = collection(db, "priceMatrix");
      const unsubscribe = onSnapshot(
        priceMatrixRef,
        (snapshot) => {
          const list: PriceMatrixItem[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              itemName: data.itemName || "",
              category: data.category || "Other",
              unitPrice: Number(data.unitPrice) || 0,
              unitType: data.unitType || "",
              updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
            };
          });
          setItems(list);
          setDataLoading(false);
        },
        (error) => {
          console.error("Firestore snapshot error:", error);
          // Fallback to local data on permission or network error
          loadDemoData();
        }
      );
      return () => unsubscribe();
    } else {
      loadDemoData();
    }
  }, []);

  const loadDemoData = () => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          setItems(JSON.parse(stored));
        } catch {
          setItems(initialPriceMatrixData);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialPriceMatrixData));
        }
      } else {
        setItems(initialPriceMatrixData);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialPriceMatrixData));
      }
    }
    setDataLoading(false);
  };

  const saveDemoDataToLocal = (newItems: PriceMatrixItem[]) => {
    setItems(newItems);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
    }
  };

  // Open Create Modal
  const handleOpenAddModal = () => {
    setSelectedItemForEdit(null);
    setIsItemModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: PriceMatrixItem) => {
    setSelectedItemForEdit(item);
    setIsItemModalOpen(true);
  };

  // Save (Create or Update) Handler
  const handleSaveItem = async (data: PriceMatrixFormData, id?: string) => {
    if (isFirebaseConfigured && db) {
      if (id) {
        // Update Firestore document
        const itemRef = doc(db, "priceMatrix", id);
        await updateDoc(itemRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new Firestore document
        const priceMatrixRef = collection(db, "priceMatrix");
        await addDoc(priceMatrixRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      // Demo Mode local save
      if (id) {
        const updated = items.map((item) =>
          item.id === id ? { ...item, ...data, updatedAt: Date.now() } : item
        );
        saveDemoDataToLocal(updated);
      } else {
        const newItem: PriceMatrixItem = {
          id: `sut-demo-${Date.now()}`,
          ...data,
          updatedAt: Date.now(),
        };
        saveDemoDataToLocal([newItem, ...items]);
      }
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (item: PriceMatrixItem) => {
    setItemToDelete(item);
    setIsConfirmModalOpen(true);
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleteLoading(true);

    try {
      if (isFirebaseConfigured && db) {
        const itemRef = doc(db, "priceMatrix", itemToDelete.id);
        await deleteDoc(itemRef);
      } else {
        const updated = items.filter((item) => item.id !== itemToDelete.id);
        saveDemoDataToLocal(updated);
      }
      setIsConfirmModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Seed Initial Demo Data to Firestore
  const handleSeedFirestore = async () => {
    if (!isFirebaseConfigured || !db) return;
    setDataLoading(true);
    try {
      const priceMatrixRef = collection(db, "priceMatrix");
      for (const item of initialPriceMatrixData) {
        const { id, ...rest } = item;
        await addDoc(priceMatrixRef, {
          ...rest,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Seeding error:", err);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-sm">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
          <span>VERIFYING AUTHENTICATION STATE...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-white selection:text-black">
      {/* System Navbar */}
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Banner Notice */}
        {isDemoMode ? (
          <div className="bg-neutral-900 border border-neutral-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-start space-x-3">
              <Info className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-white font-bold uppercase">DEMO PREVIEW ACTIVE</span>
                <p className="text-neutral-400 font-sans text-xs">
                  Running with in-memory & local state storage. Add your Firebase keys to `.env.local` to enable live Cloud Firestore sync.
                </p>
              </div>
            </div>
            <div className="text-neutral-400 shrink-0 text-[11px]">
              Collection: <span className="text-white font-bold">priceMatrix</span>
            </div>
          </div>
        ) : (
          items.length === 0 && !dataLoading && (
            <div className="bg-neutral-900 border border-neutral-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
              <div className="flex items-center space-x-2 text-neutral-300">
                <Sparkles className="w-4 h-4 text-white" />
                <span>Firestore collection &quot;priceMatrix&quot; is empty. Seed initial standard SUT dataset?</span>
              </div>
              <button
                onClick={handleSeedFirestore}
                className="bg-white hover:bg-neutral-200 text-black font-semibold font-mono py-1.5 px-3 border border-white transition rounded-none shrink-0"
              >
                SEED SAMPLE DATA
              </button>
            </div>
          )
        )}

        {/* Dashboard Title & Overview */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-mono text-neutral-400 uppercase">
            <span>SUT STUDENT COUNCIL</span>
            <span>/</span>
            <span>PRE-AUDIT SYSTEM</span>
            <span>/</span>
            <span className="text-white">CENTRAL PRICE MATRIX</span>
          </div>
          <h2 className="text-2xl font-bold font-mono tracking-tight text-white uppercase">
            Admin Management Console
          </h2>
        </div>

        {/* Summary Metrics Bar */}
        <StatCards items={items} />

        {/* Real-time Data Table & Action Toolbar */}
        <PriceMatrixTable
          items={items}
          loading={dataLoading}
          onAddNew={handleOpenAddModal}
          onEdit={handleOpenEditModal}
          onDelete={handleOpenDeleteModal}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950 py-6 text-center text-xs font-mono text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            SUT Student Council Budget Pre-Audit System • Firestore Collection: <code className="text-neutral-300">priceMatrix</code>
          </div>
          <div>Strict Minimalist Design System v1.0</div>
        </div>
      </footer>

      {/* Add / Edit Modal */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        onSave={handleSaveItem}
        initialData={selectedItemForEdit}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={itemToDelete?.itemName}
        loading={deleteLoading}
      />
    </div>
  );
}
