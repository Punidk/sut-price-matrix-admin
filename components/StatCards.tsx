"use client";

import React from "react";
import { PriceMatrixItem } from "@/lib/types";
import { Database, UtensilsCrossed, Package, Wrench, Grid } from "lucide-react";

interface StatCardsProps {
  items: PriceMatrixItem[];
}

export default function StatCards({ items }: StatCardsProps) {
  const total = items.length;
  const foodCount = items.filter((i) => i.category === "Food").length;
  const materialCount = items.filter((i) => i.category === "Material").length;
  const serviceCount = items.filter((i) => i.category === "Service").length;
  const otherCount = items.filter((i) => i.category === "Other").length;

  const stats = [
    {
      title: "TOTAL ITEMS",
      count: total,
      label: "Standard Entries",
      icon: Database,
    },
    {
      title: "FOOD & DRINK",
      count: foodCount,
      label: "Category: Food",
      icon: UtensilsCrossed,
    },
    {
      title: "MATERIALS",
      count: materialCount,
      label: "Category: Material",
      icon: Package,
    },
    {
      title: "SERVICES & RENTALS",
      count: serviceCount,
      label: "Category: Service",
      icon: Wrench,
    },
    {
      title: "OTHER EXPENSES",
      count: otherCount,
      label: "Category: Other",
      icon: Grid,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className="bg-neutral-900 border border-neutral-800 p-4 flex flex-col justify-between space-y-3 hover:border-neutral-700 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                {stat.title}
              </span>
              <Icon className="w-4 h-4 text-neutral-400 stroke-[1.8]" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-white tracking-tight">
                {stat.count}
              </div>
              <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
                {stat.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
