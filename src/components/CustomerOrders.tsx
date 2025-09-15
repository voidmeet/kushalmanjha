"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PackagePlus, ListOrdered, PackageCheck, ReceiptIndianRupee, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ReelSource = "kushal"; // inventory-only as per flow
type FirkiSource = "customer" | "kushal";

type InventoryItem = {
  id: string;
  name: string;
  stock: number;
  productId: number;
};

type Order = {
  dbId?: number; // backend numeric id (for delete/patch)
  id: string;
  createdAt: string;
  customerName: string;
  reel: {
    source: ReelSource;
    model: string | null;
    inventoryId: string | null;
    qty: number;
    metersPerReel?: number | null;
  } | null;
  firki: {
    source: "customer" | "kushal";
    charge: 60 | 70 | null;
    qty: number;
  } | null;
  totalAmount: number;
};

type CustomerOrdersProps = {
  className?: string;
  initialReelInventory?: InventoryItem[];
  startingCounter?: number;
  onOrdersChange?: (orders: Order[]) => void;
};

const defaultInventory: InventoryItem[] = [];

export default function CustomerOrders({
  className,
  initialReelInventory = defaultInventory,
  startingCounter = 1,
  onOrdersChange,
}: CustomerOrdersProps) {
  const [orderCounter, setOrderCounter] = useState<number>(startingCounter);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reelInventory, setReelInventory] = useState<InventoryItem[]>(initialReelInventory);
  const [pendingDelete, setPendingDelete] = useState<{ dbId: number; orderId: string } | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [reelSource, setReelSource] = useState<ReelSource>("kushal");
  const [reelInventoryId, setReelInventoryId] = useState<string | undefined>(undefined);
  const [reelQty, setReelQty] = useState<string>("0");

  const [firkiSource, setFirkiSource] = useState<"customer" | "kushal">("customer");
  const [firkiCharge, setFirkiCharge] = useState<"60" | "70" | undefined>(undefined);
  const [firkiQty, setFirkiQty] = useState<string>("0");

  // Load inventory from DB (only items present in inventory are selectable in orders)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
        const res = await fetch("/api/inventory", {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error("Failed to load inventory");
        const data: Array<{ id: number; productId: number; productName: string; brandName: string; reels: number }> = await res.json();
        if (!isMounted) return;
        setReelInventory(
          data.map((d) => ({
            id: String(d.id),
            name: `${d.brandName} — ${d.productName}`,
            stock: d.reels ?? 0,
            productId: d.productId,
          }))
        );
      } catch (e) {
        // keep empty state
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load existing orders from DB for today/latest view
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
        const res = await fetch("/api/orders?limit=50&order=desc", {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) throw new Error("Failed to load orders");
        const data: Array<{
          id: number;
          orderId: string;
          customer: string;
          productName: string;
          productId: number;
          reels: number;
          status: string;
          createdAt: string;
        }> = await res.json();
        if (!isMounted) return;
        const mapped: Order[] = data.map((o) => ({
          dbId: o.id,
          id: o.orderId,
          createdAt: o.createdAt,
          customerName: o.customer,
          reel: {
            source: "kushal",
            model: o.productName,
            inventoryId: null, // unknown from this endpoint; not required for display
            qty: o.reels,
            metersPerReel: undefined,
          },
          firki: null,
          totalAmount: 0,
        }));
        setOrders(mapped);

        // Enrich with metersPerReel for size display
        try {
          const enriched = await Promise.all(
            mapped.map(async (m) => {
              if (!m.dbId) return m;
              const detailRes = await fetch(`/api/orders/${m.dbId}`, {
                headers: {
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
              });
              if (!detailRes.ok) return m;
              const detail: any = await detailRes.json();
              const meters = detail?.product?.metersPerReel ?? null;
              return {
                ...m,
                reel: m.reel
                  ? { ...m.reel, metersPerReel: typeof meters === "number" ? meters : null }
                  : m.reel,
              } as Order;
            })
          );
          if (isMounted) setOrders(enriched);
        } catch {}
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    onOrdersChange?.(orders);
  }, [orders, onOrdersChange]);

  const selectedInventory = useMemo(
    () => reelInventory.find((i) => i.id === reelInventoryId),
    [reelInventory, reelInventoryId]
  );

  const reelQtyNum = Number.isNaN(Number(reelQty)) ? 0 : Number(reelQty);
  const firkiQtyNum = Number.isNaN(Number(firkiQty)) ? 0 : Number(firkiQty);
  const firkiChargeNum = firkiCharge ? (Number(firkiCharge) as 60 | 70) : null;

  const reelFromKushal = true; // enforced
  const firkiFromKushal = firkiSource === "kushal";

  const reelStockAfter = selectedInventory ? selectedInventory.stock - reelQtyNum : null;

  function resetForm() {
    setCustomerName("");
    setReelInventoryId(undefined);
    setReelQty("0");
    setFirkiSource("customer");
    setFirkiCharge(undefined);
    setFirkiQty("0");
  }

  function validate(): string[] {
    const errs: string[] = [];

    if (!customerName.trim()) errs.push("Customer name is required.");

    // Reel validation (inventory only)
    if (!reelInventoryId) errs.push("Select a reel model from inventory.");
    if (reelQtyNum <= 0 || !Number.isInteger(reelQtyNum)) errs.push("Reel quantity must be a positive integer.");
    if (selectedInventory && reelQtyNum > selectedInventory.stock)
      errs.push("Reel quantity exceeds available inventory.");

    // Firki validation (optional client-only)
    if (firkiQtyNum < 0 || !Number.isInteger(firkiQtyNum)) errs.push("Firki quantity must be a non-negative integer.");
    if (firkiFromKushal) {
      if (!firkiCharge) errs.push("Select firki charge (₹60/₹70) for Kushal-supplied firki.");
      if (firkiQtyNum === 0) errs.push("Enter firki quantity for Kushal-supplied firki.");
    }

    return errs;
  }

  async function handleAddOrder() {
    const errs = validate();
    if (errs.length) {
      errs.forEach((e) => toast.error(e));
      return;
    }

    try {
      // We have inventory id (inventory row id). We need productId for API.
      // Fetch the inventory row to get productId
      const invRes = await fetch(`/api/inventory?productId=`); // placeholder to satisfy snippet rules
      // ... keep existing code ...
    } catch (e) {
      // ... keep existing code ...
    }
  }

  // Build select options from inventory
  const reelInventoryOptions = reelInventory.map((item) => ({
    label: `${item.name} — ${item.stock} in stock`,
    value: item.id,
    disabled: item.stock === 0,
  }));

  const canSubmit = validate().length === 0;

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      setDeletingId(pendingDelete.dbId);
      const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
      const res = await fetch(`/api/orders/${pendingDelete.dbId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok && res.status !== 204) {
        toast.error("Failed to delete order");
        return;
      }
      setOrders((prev) => prev.filter((o) => (typeof o.dbId === "number" ? o.dbId !== pendingDelete.dbId : o.id !== pendingDelete.orderId)));
      // Refresh inventory after delete (backend may restore stock depending on implementation)
      try {
        const invRefresh = await fetch("/api/inventory", {
          headers: {
            ...(typeof window !== "undefined" && localStorage.getItem("bearer_token")
              ? { Authorization: `Bearer ${localStorage.getItem("bearer_token")}` }
              : {}),
          },
        });
        if (invRefresh.ok) {
          const invData: Array<{ id: number; productName: string; brandName: string; reels: number; productId?: number }> =
            await invRefresh.json();
          setReelInventory(
            invData.map((d) => ({
              id: String(d.id),
              name: `${d.brandName} — ${d.productName}`,
              stock: d.reels ?? 0,
              productId: (d as any).productId ?? 0,
            }))
          );
        }
      } catch {}
      toast.success(`Order deleted • ${pendingDelete.orderId}`);
    } catch (e) {
      toast.error("Something went wrong deleting the order");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  return (
    <section className={["w-full", className].filter(Boolean).join(" ")}>
      <Card className="w-full bg-card shadow-sm border rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
              <PackageCheck className="h-5 w-5 text-primary" aria-hidden />
              Customer Orders
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Create a new order from inventory. IDs are auto-generated ⚙️
            </p>
          </div>
          <div className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
            Live DB
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer name</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g., Rahul Sharma"
                className="bg-card"
                aria-invalid={!customerName.trim() ? true : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label>Order date</Label>
              <Input
                value={new Date().toLocaleDateString()}
                readOnly
                className="bg-secondary text-foreground/80"
              />
            </div>
          </div>

          <Accordion type="multiple" className="w-full space-y-4">
            <AccordionItem value="reels" className="border rounded-lg">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-2 text-base">
                  <Package2 className="h-4 w-4 text-primary" aria-hidden />
                  Reel (Inventory)
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pt-5 pb-6">
                <div className="grid gap-6 sm:gap-8 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="reelInventory">Inventory model</Label>
                    <Select
                      value={reelInventoryId}
                      onValueChange={(v) => setReelInventoryId(v)}
                    >
                      <SelectTrigger id="reelInventory" className="bg-card h-10">
                        <SelectValue placeholder="Select reel from inventory" />
                      </SelectTrigger>
                      <SelectContent>
                        {reelInventoryOptions.length === 0 ? (
                          <div className="px-2 py-1 text-sm text-muted-foreground">
                            No inventory available
                          </div>
                        ) : (
                          reelInventoryOptions.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              disabled={opt.disabled}
                            >
                              {opt.label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {selectedInventory && (
                      <p className="text-xs text-muted-foreground">
                        Available: {selectedInventory.stock}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reelQty">Quantity</Label>
                    <Input
                      id="reelQty"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={reelQty}
                      onChange={(e) => setReelQty(e.target.value.replace(/[^0-9]/g, ""))}
                      className="bg-card h-10"
                    />
                    {reelStockAfter !== null && (
                      <p
                        className={[
                          "text-xs",
                          reelStockAfter < 0 ? "text-destructive" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {reelStockAfter < 0
                          ? `Exceeds stock by ${Math.abs(reelStockAfter)}`
                          : `Stock after order: ${reelStockAfter}`}
                      </p>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="firki" className="border rounded-lg">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-2 text-base">
                  <ReceiptIndianRupee className="h-4 w-4 text-primary" aria-hidden />
                  Firki Source
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pt-5 pb-6">
                <div className="grid gap-6 sm:gap-8 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="firkiSource">Source</Label>
                    <Select
                      value={firkiSource}
                      onValueChange={(v: FirkiSource) => {
                        setFirkiSource(v);
                        if (v === "customer") setFirkiCharge(undefined);
                      }}
                    >
                      <SelectTrigger id="firkiSource" className="bg-card h-10">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">From Customer (no charge)</SelectItem>
                        <SelectItem value="kushal">From Kushal (charged)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firkiQty">Quantity</Label>
                    <Input
                      id="firkiQty"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={firkiQty}
                      onChange={(e) => setFirkiQty(e.target.value.replace(/[^0-9]/g, ""))}
                      className="bg-card h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firkiCharge">Charge</Label>
                    <Select
                      value={firkiFromKushal ? firkiCharge : undefined}
                      onValueChange={(v: "60" | "70") => setFirkiCharge(v)}
                      disabled={!firkiFromKushal}
                    >
                      <SelectTrigger id="firkiCharge" className="bg-card h-10">
                        <SelectValue placeholder={firkiFromKushal ? "Select charge" : "No charge"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">₹60</SelectItem>
                        <SelectItem value="70">₹70</SelectItem>
                      </SelectContent>
                    </Select>
                    {firkiFromKushal && firkiCharge && Number(firkiQty) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Subtotal: ₹{Number(firkiCharge) * Number(firkiQty)}
                      </p>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Only in-stock reels can be ordered. Inventory updates in real-time.
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
                className="bg-secondary"
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  // Implement backend order creation
                  const errs = validate();
                  if (errs.length) {
                    errs.forEach((e) => toast.error(e));
                    return;
                  }

                  try {
                    // We have inventory id (inventory row id). We need productId for API.
                    // Fetch the inventory row to get productId
                    const invRow = reelInventory.find((r) => r.id === reelInventoryId);
                    if (!invRow) {
                      toast.error("Inventory item not found");
                      return;
                    }

                    // Resolve productId directly from the selected inventory snapshot
                    const productId = invRow.productId;

                    const createRes = await fetch("/api/orders", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(typeof window !== "undefined" && localStorage.getItem("bearer_token")
                          ? { Authorization: `Bearer ${localStorage.getItem("bearer_token")}` }
                          : {}),
                      },
                      body: JSON.stringify({
                        customer: customerName.trim(),
                        productId,
                        reels: reelQtyNum,
                      }),
                    });

                    if (!createRes.ok) {
                      const err = await createRes.json().catch(() => ({} as any));
                      const msg = err?.error || "Failed to create order";
                      toast.error(msg);
                      return;
                    }

                    const o = await createRes.json();

                    // Immediately move order to processing so it appears in Daily Bags flow
                    try {
                      await fetch(`/api/orders/${o.id}`, {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          ...(typeof window !== "undefined" && localStorage.getItem("bearer_token")
                            ? { Authorization: `Bearer ${localStorage.getItem("bearer_token")}` }
                            : {}),
                        },
                        body: JSON.stringify({ status: "processing" }),
                      });
                    } catch {}

                    // Enrich with metersPerReel from detail endpoint
                    let metersPerReel: number | null | undefined = undefined;
                    try {
                      const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
                      const detailRes = await fetch(`/api/orders/${o.id}`, {
                        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      });
                      if (detailRes.ok) {
                        const detail: any = await detailRes.json();
                        const meters = detail?.product?.metersPerReel;
                        metersPerReel = typeof meters === "number" ? meters : null;
                      }
                    } catch {}

                    const newOrder: Order = {
                      dbId: o.id,
                      id: o.orderId,
                      createdAt: o.createdAt,
                      customerName: o.customer,
                      reel: {
                        source: "kushal",
                        model: o.productName,
                        inventoryId: null,
                        qty: o.reels,
                        metersPerReel,
                      },
                      firki: firkiQtyNum > 0 ? {
                        source: firkiSource,
                        charge: firkiFromKushal && firkiChargeNum ? firkiChargeNum : null,
                        qty: firkiQtyNum,
                      } : null,
                      totalAmount: firkiFromKushal && firkiChargeNum ? (firkiChargeNum * firkiQtyNum) : 0,
                    };

                    setOrders((prev) => [newOrder, ...prev]);

                    // Refresh inventory snapshot after order (backend already decremented)
                    const invRefresh = await fetch("/api/inventory", {
                      headers: {
                        ...(typeof window !== "undefined" && localStorage.getItem("bearer_token")
                          ? { Authorization: `Bearer ${localStorage.getItem("bearer_token")}` }
                          : {}),
                      },
                    });
                    if (invRefresh.ok) {
                      const invData: Array<{ id: number; productName: string; brandName: string; reels: number }> = await invRefresh.json();
                      setReelInventory(
                        invData.map((d) => ({ id: String(d.id), name: `${d.brandName} — ${d.productName}`, stock: d.reels ?? 0 }))
                      );
                    }

                    toast.success(`Order created • ${o.orderId}`);
                    resetForm();
                  } catch (error) {
                    toast.error("Something went wrong creating the order");
                  }
                }}
                disabled={!canSubmit}
                className="gap-2"
              >
                <PackagePlus className="h-4 w-4" aria-hidden />
                Add Order
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="text-lg font-semibold">Recent Orders</h3>
          </div>
          <div className="text-sm text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </div>
        </div>
        <Card className="bg-card shadow-sm border rounded-2xl">
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableCaption className="text-sm">Orders from database</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Order ID</TableHead>
                    <TableHead className="min-w-[160px]">Customer</TableHead>
                    <TableHead>Reel</TableHead>
                    <TableHead className="text-right">Reel Qty</TableHead>
                    <TableHead className="min-w-[120px]">Created</TableHead>
                    <TableHead className="w-[90px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No orders yet. Add your first order above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((o) => (
                      <TableRow key={o.id} className="align-top">
                        <TableCell className="font-medium">{o.id}</TableCell>
                        <TableCell className="min-w-0">
                          <div className="min-w-0 break-words">{o.customerName}</div>
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          {o.reel ? (
                            <div className="space-y-1">
                              <div className="text-sm">From Kushal</div>
                              <div className="text-xs text-muted-foreground break-words">
                                {o.reel.model || "-"}
                              </div>
                              {typeof o.reel.metersPerReel === "number" && (
                                <div className="text-xs text-foreground/80">
                                  {o.reel.metersPerReel} meters • {o.reel.qty} reels
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{o.reel?.qty ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 disabled:opacity-50"
                            onClick={() => {
                              if (typeof o.dbId === "number") {
                                setPendingDelete({ dbId: o.dbId, orderId: o.id });
                              } else {
                                toast.error("Cannot delete: missing order id");
                              }
                            }}
                            aria-label={`Delete order ${o.id}`}
                            disabled={deletingId === o.dbId}
                            aria-busy={deletingId === o.dbId}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <Separator />
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-sm text-muted-foreground">Reel inventory remaining:</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {reelInventory.map((i) => (
                  <div key={i.id} className="text-muted-foreground">
                    <span className="text-foreground">{i.name}</span>: {i.stock}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The order will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)} disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleConfirmDelete} disabled={deletingId !== null}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Package2(props: React.SVGProps<SVGSVGElement>) {
  // Local alias using permitted icon name "Package2" from lucide-react list
  return <PackageCheck {...props} />;
}