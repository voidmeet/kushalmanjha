"use client";

import React from "react";

import AuthLogin from "@/components/AuthLogin";
import DashboardLayout from "@/components/DashboardLayout";
import InventoryManagement from "@/components/InventoryManagement";
import CustomerOrders from "@/components/CustomerOrders";
import DailyBags from "@/components/DailyBags";
import { InventoryReel as BagInventoryReel, Order as BagOrder } from "@/components/DailyBags";
import Analytics from "@/components/Analytics";

type ModuleKey = "inventory" | "orders" | "bags" | "analytics";

export default function Page() {
  const [user, setUser] = React.useState<{ username: string; role: string } | null>(null);
  const [active, setActive] = React.useState<ModuleKey>("inventory");

  // Lightweight cross-module state examples (kept simple and decoupled)
  const [ordersTodayCount, setOrdersTodayCount] = React.useState<number>(0);

  // Seed data for DailyBags module (independent of CustomerOrders form)
  const [bagOrders] = React.useState<BagOrder[]>([]);

  const [bagInventory, setBagInventory] = React.useState<BagInventoryReel[]>([]);

  const navItems = React.useMemo(
    () => [
      { key: "inventory" as ModuleKey, label: "Inventory" },
      { key: "orders" as ModuleKey, label: "Orders" },
      { key: "bags" as ModuleKey, label: "Daily Bags" },
      { key: "analytics" as ModuleKey, label: "Analytics" },
    ],
    []
  );

  function handleLogout() {
    setUser(null);
    setActive("inventory");
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] w-full grid place-items-center bg-background px-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <span className="text-sm font-bold">KM</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Kushal Patent Manja</h1>
            <p className="text-sm text-muted-foreground">Operations Dashboard</p>
          </div>
          <AuthLogin
            onSuccess={({ user: u }) => {
              setUser(u);
            }}
          />
          <p className="text-xs text-muted-foreground text-center">
            Admin access only. Use your organization credentials to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      items={navItems}
      activeKey={active}
      onNavigate={(key) => setActive(key)}
      onLogout={handleLogout}
      className="min-h-[100dvh]"
    >
      <div className="space-y-6">
        {/* Persistent page heading area (simple, Apple-like minimalism) */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
              {active === "inventory"
                ? "Inventory Management 📦"
                : active === "orders"
                ? "Customer Orders 🧾"
                : active === "bags"
                ? "Daily Bags 🛍️"
                : "Analytics 📈"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Signed in as {user.username} • {user.role}
            </p>
          </div>
          {active === "orders" ? (
            <div className="rounded-md bg-accent px-3 py-1.5 text-xs text-accent-foreground">
              Today: {ordersTodayCount} {ordersTodayCount === 1 ? "order" : "orders"}
            </div>
          ) : null}
        </div>

        {/* Module content */}
        {active === "inventory" && (
          <InventoryManagement
            brands={["Chain", "Panda", "Genda", "AK56", "Others"]}
            initialItems={[]}
          />
        )}

        {active === "orders" && (
          <CustomerOrders
            initialReelInventory={[]}
            onOrdersChange={(orders) => setOrdersTodayCount(orders.length)}
          />
        )}

        {active === "bags" && (
          <DailyBags
            orders={bagOrders}
            inventory={bagInventory}
            onInventoryUpdate={(next) => setBagInventory(next)}
            targetMetersPerBag={5000}
          />
        )}

        {active === "analytics" && <Analytics />}
      </div>
    </DashboardLayout>
  );
}