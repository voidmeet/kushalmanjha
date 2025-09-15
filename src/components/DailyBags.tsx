"use client"

import React from "react"
import {
  Table as TableIcon,
  ShoppingBag,
  ShoppingBasket,
  PackagePlus,
  PackageCheck,
  PackageOpen,
  ArrowUpDown,
  GalleryVerticalEnd,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type OrderStatus = "pending" | "processing" | "ready" | "delayed"

export interface Order {
  id: string
  customer: string
  product: string
  meters: number
  priority?: number
  dueDate?: string
  status?: OrderStatus
}

export interface InventoryReel {
  id: string
  metersAvailable: number
}

type BagItem =
  | { kind: "order"; orderId: string; customer: string; meters: number }
  | { kind: "inventory"; reelId: string; meters: number }

interface Bag {
  bagNumber: number
  items: BagItem[]
  totalMeters: number
  filledFromInventory: number
}

interface DailyBagsProps {
  className?: string
  orders: Order[]
  inventory: InventoryReel[]
  onInventoryUpdate?: (nextInventory: InventoryReel[]) => void
  onExport?: (fileName: string, data: string) => void
  targetMetersPerBag?: number
}

export default function DailyBags({
  className,
  orders,
  inventory,
  onInventoryUpdate,
  onExport,
  targetMetersPerBag = 5000,
}: DailyBagsProps) {
  const [sortKey, setSortKey] = React.useState<keyof Order>("priority")
  const [sortAsc, setSortAsc] = React.useState<boolean>(true)
  const [isCreating, setIsCreating] = React.useState(false)
  const [statusText, setStatusText] = React.useState<string>("")
  const [bags, setBags] = React.useState<Bag[] | null>(null)
  const [partialNeedsInventory, setPartialNeedsInventory] = React.useState<{
    open: boolean
    lastBagIndex: number | null
  }>({ open: false, lastBagIndex: null })
  const [workingInventory, setWorkingInventory] =
    React.useState<InventoryReel[]>(inventory)

  // Live data holders when no props are passed in
  const [apiOrders, setApiOrders] = React.useState<Order[]>([])
  const [apiInventory, setApiInventory] = React.useState<InventoryReel[]>([])

  // Load orders from backend when props.orders is empty
  React.useEffect(() => {
    if (orders.length > 0) return
    let isMounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/orders?status=processing&order=desc&limit=100`)
        if (!res.ok) return
        const data: Array<{
          orderId: string
          customer: string
          productName: string
          brandName: string
          cord: number
          reelSize: number
          reels: number
          status: string
          createdAt: string
        }> = await res.json()
        if (!isMounted) return
        setApiOrders(
          data.map((o) => ({
            id: o.orderId,
            customer: o.customer,
            product: `${o.brandName} — ${o.productName} (${o.cord}-cord • ${o.reelSize}m)`,
            meters: (o.reels ?? 0) * (o.reelSize ?? 0),
            priority: undefined,
            dueDate: undefined,
            status: (o.status as OrderStatus) || "processing",
          }))
        )
      } catch {}
    })()
    return () => { isMounted = false }
  }, [orders.length])

  // Load inventory from backend when props.inventory is empty
  React.useEffect(() => {
    if (inventory.length > 0) return
    let isMounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/inventory`)
        if (!res.ok) return
        const data: Array<{
          id: number
          reels: number
          reelSize: number
        }> = await res.json()
        if (!isMounted) return
        setApiInventory(
          data.map((d) => ({
            id: String(d.id),
            metersAvailable: (d.reels ?? 0) * (d.reelSize ?? 0),
          }))
        )
      } catch {}
    })()
    return () => { isMounted = false }
  }, [inventory.length])

  // keep inventory in sync if props change and we haven't mutated yet
  React.useEffect(() => {
    // prefer explicit props; fallback to API-loaded inventory
    setWorkingInventory(inventory.length > 0 ? inventory : apiInventory)
  }, [inventory, apiInventory])

  const sourceOrders = React.useMemo(() => (orders.length > 0 ? orders : apiOrders), [orders, apiOrders])

  const sortedOrders = React.useMemo(() => {
    const copy = [...sourceOrders]
    copy.sort((a, b) => {
      const dir = sortAsc ? 1 : -1
      switch (sortKey) {
        case "priority":
          return ((a.priority ?? 0) - (b.priority ?? 0)) * dir
        case "meters":
          return (a.meters - b.meters) * dir
        case "customer":
        case "product":
        case "id":
          return a[sortKey] > b[sortKey] ? dir : -dir
        case "dueDate":
          return (new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()) * dir
        case "status": {
          const rank = (s?: OrderStatus) =>
            s === "pending" ? 0 : s === "processing" ? 1 : s === "ready" ? 2 : 3
          return (rank(a.status) - rank(b.status)) * dir
        }
        default:
          return 0
      }
    })
    return copy
  }, [sourceOrders, sortKey, sortAsc])

  function toggleSort(key: keyof Order) {
    if (sortKey === key) {
      setSortAsc((s) => !s)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  function simulateCreateBags(currentOrders: Order[]) {
    // Greedy fill, allow splitting orders across bags
    const output: Bag[] = []
    let bagNum = 1
    let remainingOrders: { id: string; customer: string; meters: number }[] =
      currentOrders.map((o) => ({ id: o.id, customer: o.customer, meters: o.meters }))

    while (remainingOrders.length > 0) {
      let capacity = targetMetersPerBag
      const items: BagItem[] = []
      let filledFromInventory = 0

      for (let i = 0; i < remainingOrders.length && capacity > 0; ) {
        const o = remainingOrders[i]
        if (o.meters <= capacity) {
          items.push({ kind: "order", orderId: o.id, customer: o.customer, meters: o.meters })
          capacity -= o.meters
          remainingOrders.splice(i, 1)
        } else {
          // split the order
          items.push({ kind: "order", orderId: o.id, customer: o.customer, meters: capacity })
          o.meters -= capacity
          capacity = 0
        }
      }

      const totalMeters = targetMetersPerBag - capacity
      output.push({
        bagNumber: bagNum++,
        items,
        totalMeters,
        filledFromInventory,
      })

      // If capacity still remains and no more orders, stop loop (partial bag)
      if (capacity > 0 && remainingOrders.length === 0) {
        break
      }
    }

    return output
  }

  async function handleCreateBags() {
    try {
      setIsCreating(true)
      setStatusText("Optimizing pack plan…")
      await delay(500)

      const baseBags = simulateCreateBags(sortedOrders)
      setStatusText("Finalizing bags…")
      await delay(600)

      // If last bag is partial, prompt for inventory top-up
      const lastIdx = baseBags.length > 0 ? baseBags.length - 1 : -1
      const last = lastIdx >= 0 ? baseBags[lastIdx] : null

      setBags(baseBags)
      if (last && last.totalMeters < targetMetersPerBag) {
        setPartialNeedsInventory({ open: true, lastBagIndex: lastIdx })
        toast("Partial bag detected", {
          description: "You can auto-fill the remaining meters from inventory.",
        } as any)
      } else {
        toast.success("Bags created")
      }
    } catch (e) {
      toast.error("Failed to create bags")
    } finally {
      setIsCreating(false)
      setStatusText("")
    }
  }

  function topUpWithInventory() {
    if (!bags || partialNeedsInventory.lastBagIndex == null) return
    const idx = partialNeedsInventory.lastBagIndex
    const updated = [...bags]
    const bag = { ...updated[idx] }
    let need = Math.max(0, targetMetersPerBag - bag.totalMeters)
    if (need === 0) {
      setPartialNeedsInventory({ open: false, lastBagIndex: null })
      return
    }

    const invCopy = [...workingInventory].map((r) => ({ ...r }))
    const used: { reelIndex: number; take: number }[] = []

    // Greedy: use smallest reels first to minimize leftovers
    invCopy.sort((a, b) => a.metersAvailable - b.metersAvailable)
    for (let i = 0; i < invCopy.length && need > 0; i++) {
      const reel = invCopy[i]
      if (reel.metersAvailable <= 0) continue
      const take = Math.min(reel.metersAvailable, need)
      used.push({ reelIndex: i, take })
      need -= take
    }

    let filled = 0
    const newItems: BagItem[] = [...bag.items]
    used.forEach(({ reelIndex, take }) => {
      if (take > 0) {
        newItems.push({ kind: "inventory", reelId: invCopy[reelIndex].id, meters: take })
        invCopy[reelIndex].metersAvailable -= take
        filled += take
      }
    })

    bag.items = newItems
    bag.totalMeters += filled
    bag.filledFromInventory += filled
    updated[idx] = bag

    setBags(updated)
    setWorkingInventory(invCopy)
    onInventoryUpdate?.(invCopy)

    if (bag.totalMeters >= targetMetersPerBag) {
      toast.success("Partial bag topped up from inventory")
    } else {
      toast("Inventory insufficient", {
        description: `Bag now at ${bag.totalMeters}m; needs ${targetMetersPerBag - bag.totalMeters}m more.`,
      } as any)
    }

    setPartialNeedsInventory({ open: false, lastBagIndex: null })
  }

  function keepPartialBag() {
    setPartialNeedsInventory({ open: false, lastBagIndex: null })
    toast.message?.("Keeping partial bag", {
      description: "You can adjust later from inventory.",
    } as any)
  }

  function exportCSV() {
    if (!bags || bags.length === 0) {
      toast("Nothing to export")
      return
    }
    const rows: string[] = []
    rows.push(
      [
        "Bag Number",
        "Item Type",
        "Reference",
        "Customer",
        "Meters",
        "Total Bag Meters",
        "Filled From Inventory",
      ].join(","),
    )
    bags.forEach((bag) => {
      bag.items.forEach((it) => {
        if (it.kind === "order") {
          rows.push(
            [
              bag.bagNumber,
              "Order",
              it.orderId,
              escapeCsv(it.customer),
              it.meters,
              bag.totalMeters,
              bag.filledFromInventory,
            ].join(","),
          )
        } else {
          rows.push(
            [
              bag.bagNumber,
              "Inventory",
              it.reelId,
              "",
              it.meters,
              bag.totalMeters,
              bag.filledFromInventory,
            ].join(","),
          )
        }
      })
    })
    const csv = rows.join("\n")
    const fileName = `bag-report-${new Date().toISOString().slice(0, 10)}.csv`

    if (onExport) {
      onExport(fileName, csv)
    } else if (typeof window !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
    toast.success("Exported bag report")
  }

  const totals = React.useMemo(() => {
    const totalOrders = sourceOrders.reduce((s, o) => s + o.meters, 0)
    const totalBags = bags?.length ?? 0
    const totalBagMeters = bags?.reduce((s, b) => s + b.totalMeters, 0) ?? 0
    const partial = bags?.some((b) => b.totalMeters < targetMetersPerBag) ?? false
    return { totalOrders, totalBags, totalBagMeters, partial }
  }, [sourceOrders, bags, targetMetersPerBag])

  return (
    <section
      className={[
        "w-full max-w-full bg-card rounded-xl border border-border shadow-sm",
        "p-4 sm:p-6",
        className ?? "",
      ].join(" ")}
      aria-label="Daily Bags"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Daily Bags
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review today&apos;s orders, create optimized bags, and export reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="bg-secondary hover:bg-muted">
                <GalleryVerticalEnd className="mr-2 h-4 w-4" aria-hidden="true" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40">
              <DropdownMenuLabel>Bag Reports</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportCSV}>Export CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={handleCreateBags}
            disabled={isCreating || sourceOrders.length === 0}
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
            {isCreating ? (
              <>
                <PackageOpen className="mr-2 h-4 w-4 animate-pulse" aria-hidden="true" />
                Creating…
              </>
            ) : (
              <>
                <PackagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                Create Bags
              </>
            )}
          </Button>
        </div>
      </div>

      {isCreating && (
        <Card className="mt-4 border-dashed bg-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={65} className="h-2" />
            <p className="text-sm text-muted-foreground">{statusText || "Working…"}</p>
          </CardContent>
        </Card>
      )}

      <Separator className="my-6" />

      <div className="flex items-center gap-3 flex-wrap">
        <StatPill
          icon={<TableIcon className="h-4 w-4" aria-hidden="true" />}
          label="Total Orders"
          value={sourceOrders.length.toString()}
        />
        <StatPill
          icon={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
          label="Total Order Meters"
          value={`${totals.totalOrders.toLocaleString()} m`}
        />
        <StatPill
          icon={<ShoppingBasket className="h-4 w-4" aria-hidden="true" />}
          label="Bags"
          value={(totals.totalBags || 0).toString()}
          tone={totals.partial ? "warning" : "default"}
        />
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold">Today&apos;s Orders</h3>
          <Badge variant="outline" className="rounded-full">
            {new Date().toLocaleDateString()}
          </Badge>
        </div>
        <div className="relative rounded-lg border bg-background overflow-hidden">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <SortableHead onClick={() => toggleSort("id")} active={sortKey === "id"} asc={sortAsc}>
                    Order ID
                  </SortableHead>
                  <SortableHead
                    onClick={() => toggleSort("customer")}
                    active={sortKey === "customer"}
                    asc={sortAsc}
                  >
                    Customer
                  </SortableHead>
                  <SortableHead
                    onClick={() => toggleSort("product")}
                    active={sortKey === "product"}
                    asc={sortAsc}
                  >
                    Product
                  </SortableHead>
                  <SortableHead
                    onClick={() => toggleSort("meters")}
                    active={sortKey === "meters"}
                    asc={sortAsc}
                    align="right"
                  >
                    Meters
                  </SortableHead>
                  <SortableHead
                    onClick={() => toggleSort("priority")}
                    active={sortKey === "priority"}
                    asc={sortAsc}
                    align="center"
                  >
                    Priority
                  </SortableHead>
                  <SortableHead
                    onClick={() => toggleSort("dueDate")}
                    active={sortKey === "dueDate"}
                    asc={sortAsc}
                  >
                    Due
                  </SortableHead>
                  <SortableHead
                    onClick={() => toggleSort("status")}
                    active={sortKey === "status"}
                    asc={sortAsc}
                  >
                    Status
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No orders for today.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOrders.map((o) => (
                    <TableRow key={o.id} className="hover:bg-accent/40">
                      <TableCell className="font-medium break-words">{o.id}</TableCell>
                      <TableCell className="min-w-0">
                        <span className="truncate block">{o.customer}</span>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <span className="truncate block">{o.product}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {o.meters.toLocaleString()} m
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="rounded-full">
                          {o.priority ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.dueDate ? new Date(o.dueDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status ?? "pending"} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {bags && (
        <>
          <Separator className="my-6" />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-base sm:text-lg font-semibold">Results</h3>
            <div className="text-sm text-muted-foreground">
              Total meters packed:{" "}
              <span className="font-medium text-foreground">
                {totals.totalBagMeters.toLocaleString()} m
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:gap-5">
            {bags.map((bag) => (
              <div
                key={bag.bagNumber}
                className="rounded-lg border p-4 bg-secondary/40 hover:bg-secondary/60 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      {bag.totalMeters >= targetMetersPerBag ? (
                        <PackageCheck className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <PackageOpen className="h-5 w-5" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">Bag #{bag.bagNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {bag.totalMeters.toLocaleString()} m
                        {bag.filledFromInventory > 0 && (
                          <span className="ml-2">
                            • {bag.filledFromInventory.toLocaleString()} m from inventory
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={bag.totalMeters >= targetMetersPerBag ? "default" : "outline"}>
                      {bag.totalMeters >= targetMetersPerBag ? "Complete" : "Partial"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 max-w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Meters</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bag.items.map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap">
                            {it.kind === "order" ? (
                              <span className="inline-flex items-center gap-1.5">
                                <ShoppingBag className="h-4 w-4 text-foreground/80" />
                                Order
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <ShoppingBasket className="h-4 w-4 text-foreground/80" />
                                Inventory
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="break-words">
                            {it.kind === "order" ? it.orderId : it.reelId}
                          </TableCell>
                          <TableCell className="min-w-0">
                            {it.kind === "order" ? (
                              <span className="truncate block">{it.customer}</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {it.meters.toLocaleString()} m
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog
        open={partialNeedsInventory.open}
        onOpenChange={(open) => setPartialNeedsInventory((s) => ({ ...s, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add from Inventory?</DialogTitle>
            <DialogDescription>
              A partial bag was created with less than {targetMetersPerBag.toLocaleString()} meters.
              Would you like to auto-select inventory reels to fill the remaining meters?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="text-sm text-muted-foreground">
              Available inventory reels:{" "}
              <span className="text-foreground font-medium">
                {workingInventory.filter((r) => r.metersAvailable > 0).length}
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="secondary" onClick={keepPartialBag}>
              No, keep partial
            </Button>
            <Button onClick={topUpWithInventory} className="bg-primary text-primary-foreground">
              Yes, add from inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

function escapeCsv(val: string) {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-secondary text-foreground" },
    processing: { label: "Processing", className: "bg-accent text-accent-foreground" },
    ready: { label: "Ready", className: "bg-primary text-primary-foreground" },
    delayed: { label: "Delayed", className: "bg-destructive text-destructive-foreground" },
  }
  const s = map[status]
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        s.className,
      ].join(" ")}
    >
      {s.label}
    </span>
  )
}

function StatPill({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "default" | "warning"
}) {
  const toneClass =
    tone === "warning"
      ? "bg-accent text-accent-foreground"
      : "bg-secondary text-foreground"
  return (
    <div
      className={[
        "inline-flex items-center gap-3 rounded-full border px-3 py-2",
        toneClass,
      ].join(" ")}
    >
      <div className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-card border">
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
    </div>
  )
}

function SortableHead({
  children,
  onClick,
  active,
  asc,
  align = "left",
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  asc?: boolean
  align?: "left" | "right" | "center"
}) {
  return (
    <TableHead
      className={[
        "whitespace-nowrap",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        className={[
          "inline-flex items-center gap-1",
          "text-xs sm:text-sm font-medium text-foreground",
          "hover:text-primary transition-colors",
        ].join(" ")}
        aria-pressed={active}
      >
        {children}
        <ArrowUpDown
          className={[
            "h-3.5 w-3.5",
            active ? "opacity-100 text-primary" : "opacity-60",
            asc ? "rotate-180" : "rotate-0",
            "transition-transform",
          ].join(" ")}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  )
}