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
  Unlink,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
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
  // New fields for bag logic
  reels?: number
  reelSize?: number
  brand?: string
  cord?: number
  productNameRaw?: string
}

export interface InventoryReel {
  id: string
  metersAvailable: number
  reels?: number
  reelSize?: number
  productName?: string
  brandName?: string
  cord?: number
}

type BagItem =
  | { kind: "order"; orderId: string; customer: string; meters: number; reelSize?: number }
  | { kind: "inventory"; reelId: string; meters: number; label?: string; reelSize?: number }

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
    missingMeters: number
  }>({ open: false, lastBagIndex: null, missingMeters: 0 })
  const [confirmTopUp, setConfirmTopUp] = React.useState<{
    open: boolean
    missingMeters: number
  }>({ open: false, missingMeters: 0 })
  const [manualTopUp, setManualTopUp] = React.useState<{
    open: boolean
    lastBagIndex: number | null
    allocations: Record<string, number>
  }>({ open: false, lastBagIndex: null, allocations: {} })
  const [workingInventory, setWorkingInventory] =
    React.useState<InventoryReel[]>(inventory)

  // Live data holders when no props are passed in
  const [apiOrders, setApiOrders] = React.useState<Order[]>([])
  const [apiInventory, setApiInventory] = React.useState<InventoryReel[]>([])

  // Load orders from backend when props.orders is empty
  React.useEffect(() => {
    if (orders.length > 0) return
    let isMounted = true
      ; (async () => {
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
              reels: o.reels,
              reelSize: o.reelSize,
              brand: o.brandName,
              cord: o.cord,
              productNameRaw: o.productName,
            }))
          )
        } catch { }
      })()
    return () => { isMounted = false }
  }, [orders.length])

  // Load inventory from backend when props.inventory is empty
  React.useEffect(() => {
    if (inventory.length > 0) return
    let isMounted = true
      ; (async () => {
        try {
          const res = await fetch(`/api/inventory`)
          if (!res.ok) return
          const data: Array<{
            id: number
            reels: number
            reelSize: number
            productName?: string
            brandName?: string
          }> = await res.json()
          if (!isMounted) return
          setApiInventory(
            data.map((d) => ({
              id: String(d.id),
              metersAvailable: (d.reels ?? 0) * (d.reelSize ?? 0),
              reels: d.reels ?? 0,
              reelSize: d.reelSize ?? 0,
              productName: d.productName,
              brandName: d.brandName,
            }))
          )
        } catch { }
      })()
    return () => { isMounted = false }
  }, [inventory.length])

  // keep inventory in sync if props change and we haven't mutated yet
  React.useEffect(() => {
    // prefer explicit props; fallback to API-loaded inventory
    setWorkingInventory(inventory.length > 0 ? inventory : apiInventory)
  }, [inventory, apiInventory])

  // Persistence: load on mount
  React.useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('daily_bags_state') : null
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed.bags)) setBags(parsed.bags)
        if (Array.isArray(parsed.inventory)) setWorkingInventory(parsed.inventory)
      }
    } catch { }
  }, [])

  // Persistence: save on change
  React.useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const payload = JSON.stringify({ bags, inventory: workingInventory })
      localStorage.setItem('daily_bags_state', payload)
    } catch { }
  }, [bags, workingInventory])

  const allOrders = React.useMemo(() => (orders.length > 0 ? orders : apiOrders), [orders, apiOrders])

  const usedOrderIds = React.useMemo(() => {
    const ids = new Set<string>()
    bags?.forEach((bag) => {
      bag.items.forEach((item) => {
        if (item.kind === "order") ids.add(item.orderId)
      })
    })
    return ids
  }, [bags])

  const sourceOrders = React.useMemo(() => {
    if (usedOrderIds.size === 0) return allOrders
    return allOrders.filter((order) => !usedOrderIds.has(order.id))
  }, [allOrders, usedOrderIds])

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

  function simulateCreateBags(currentOrders: Order[], currentInventory: InventoryReel[]) {
    const output: Bag[] = []
    let bagNum = 1

    // 1. Deconstruct orders into individual reels with metadata
    type ReelItem = {
      source: "order"
      id: string // orderId
      customer: string
      reelSize: number
      brand: string
      product: string // raw product name
      cord: number
    }

    const allReels: ReelItem[] = []
    currentOrders.forEach(o => {
      if (o.reels && o.reelSize && o.brand && o.productNameRaw && o.cord) {
        for (let i = 0; i < o.reels; i++) {
          allReels.push({
            source: "order",
            id: o.id,
            customer: o.customer,
            reelSize: o.reelSize,
            brand: o.brand,
            product: o.productNameRaw,
            cord: o.cord
          })
        }
      }
    })

    // 2. Group by Product (Brand + Name + Cord)
    const groups = new Map<string, ReelItem[]>()
    allReels.forEach(r => {
      const key = `${r.brand}|${r.product}|${r.cord}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    })

    // Helper to find inventory for a group
    const findInventory = (brand: string, product: string, cord: number, size: number, count: number) => {
      // Find matching inventory item
      const invItem = currentInventory.find(i =>
        i.brandName === brand &&
        i.productName === product &&
        i.cord === cord &&
        i.reelSize === size &&
        (i.reels ?? 0) >= count
      )
      return invItem
    }

    // Helper to fill a bag from inventory
    const fillFromInventory = (bagItems: BagItem[], currentMeters: number, brand: string, product: string, cord: number) => {
      let meters = currentMeters
      let filled = 0
      const needed = targetMetersPerBag - meters
      if (needed <= 0) return 0

      // Find matching inventory sorted by size descending (greedy)
      const matchingInv = currentInventory.filter(i =>
        i.brandName === brand &&
        i.productName === product &&
        i.cord === cord &&
        (i.reels ?? 0) > 0
      ).sort((a, b) => (b.reelSize ?? 0) - (a.reelSize ?? 0))

      for (const inv of matchingInv) {
        const size = inv.reelSize ?? 0
        if (size <= 0) continue

        // Take as many as fit
        while ((inv.reels ?? 0) > 0 && (meters + size) <= targetMetersPerBag) {
          bagItems.push({
            kind: "inventory",
            reelId: inv.id,
            meters: size,
            label: `${brand} ${product}`,
            reelSize: size
          })
          inv.reels = (inv.reels ?? 0) - 1
          meters += size
          filled += size
        }
      }
      return filled
    }

    // 3. Process each group
    groups.forEach((reels, key) => {
      const [brand, product, cordStr] = key.split("|")
      const cord = Number(cordStr)

      // Prioritize strict combinations
      const reels5000 = reels.filter(r => r.reelSize === 5000)
      const reels2500 = reels.filter(r => r.reelSize === 2500)
      const reels1000 = reels.filter(r => r.reelSize === 1000)

      // Keep track of used reels to identify leftovers
      const usedReels = new Set<ReelItem>()

      // A. 5000m Reels (1 per bag)
      reels5000.forEach(r => {
        output.push({
          bagNumber: bagNum++,
          items: [{ kind: "order", orderId: r.id, customer: r.customer, meters: 5000, reelSize: 5000 }],
          totalMeters: 5000,
          filledFromInventory: 0
        })
        usedReels.add(r)
      })

      // B. 2500m Reels (2 per bag)
      while (reels2500.filter(r => !usedReels.has(r)).length >= 2) {
        const available = reels2500.filter(r => !usedReels.has(r))
        const r1 = available[0]
        const r2 = available[1]
        output.push({
          bagNumber: bagNum++,
          items: [
            { kind: "order", orderId: r1.id, customer: r1.customer, meters: 2500, reelSize: 2500 },
            { kind: "order", orderId: r2.id, customer: r2.customer, meters: 2500, reelSize: 2500 }
          ],
          totalMeters: 5000,
          filledFromInventory: 0
        })
        usedReels.add(r1)
        usedReels.add(r2)
      }

      // C. 1000m Reels (5 per bag)
      while (reels1000.filter(r => !usedReels.has(r)).length >= 5) {
        const available = reels1000.filter(r => !usedReels.has(r))
        const batch = available.slice(0, 5)
        output.push({
          bagNumber: bagNum++,
          items: batch.map(r => ({ kind: "order", orderId: r.id, customer: r.customer, meters: 1000, reelSize: 1000 })),
          totalMeters: 5000,
          filledFromInventory: 0
        })
        batch.forEach(r => usedReels.add(r))
      }

      // D. Process Leftovers (Anything not used above, including odd 2500s, 1000s, and weird sizes like 2000)
      const leftovers = reels.filter(r => !usedReels.has(r))

      // Sort leftovers largest to smallest to pack efficiently
      leftovers.sort((a, b) => b.reelSize - a.reelSize)

      let currentBagItems: BagItem[] = []
      let currentMeters = 0

      leftovers.forEach((r) => {
        if (currentMeters + r.reelSize > targetMetersPerBag) {
          // Bag is full-ish, try to top up and close it
          const filled = fillFromInventory(currentBagItems, currentMeters, brand, product, cord)
          output.push({
            bagNumber: bagNum++,
            items: currentBagItems,
            totalMeters: currentMeters + filled,
            filledFromInventory: filled
          })
          // Start new bag
          currentBagItems = []
          currentMeters = 0
        }

        currentBagItems.push({ kind: "order", orderId: r.id, customer: r.customer, meters: r.reelSize, reelSize: r.reelSize })
        currentMeters += r.reelSize
      })

      // Close final bag if exists
      if (currentBagItems.length > 0) {
        const filled = fillFromInventory(currentBagItems, currentMeters, brand, product, cord)
        output.push({
          bagNumber: bagNum++,
          items: currentBagItems,
          totalMeters: currentMeters + filled,
          filledFromInventory: filled
        })
      }
    })

    return output
  }

  function restoreInventoryFromBag(bag: Bag) {
    // Restore inventory items that were used in this bag
    const invCopy = [...workingInventory]
    bag.items.forEach(item => {
      if (item.kind === "inventory") {
        const invItem = invCopy.find(i => i.id === item.reelId)
        if (invItem && item.reelSize) {
          // Restore the reel count
          invItem.reels = (invItem.reels ?? 0) + 1
          invItem.metersAvailable = (invItem.metersAvailable ?? 0) + item.meters
        }
      }
    })
    setWorkingInventory(invCopy)
    onInventoryUpdate?.(invCopy)
  }

  function handleUntie(bagIndex: number) {
    if (!bags) return
    const bag = bags[bagIndex]

    // Restore inventory
    restoreInventoryFromBag(bag)

    // Remove bag
    const nextBags = bags.filter((_, i) => i !== bagIndex)
    setBags(nextBags.length > 0 ? nextBags : null)

    toast.success(`Bag #${bag.bagNumber} untied`, {
      description: "Orders returned to today's list and inventory restored."
    })
  }

  async function handleCreateBags() {
    try {
      if (!canCreateBags) {
        toast("All available orders are already in bags")
        return
      }

      setIsCreating(true)
      setStatusText("Optimizing pack plan…")
      await delay(500)

      // Clone inventory to avoid mutating state directly during simulation
      const invClone = workingInventory.map(i => ({ ...i }))
      const baseBags = simulateCreateBags(sortedOrders, invClone)

      if (baseBags.length === 0) {
        toast("No valid bags could be formed")
        return
      }

      setStatusText("Finalizing bags…")
      await delay(600)

      const bagOffset = bags?.length ?? 0
      const renumbered = baseBags.map((bag, idx) => ({
        ...bag,
        bagNumber: bagOffset + idx + 1,
      }))
      const nextBags = [...(bags ?? []), ...renumbered]

      setBags(nextBags)
      // Update working inventory with the changes from simulation
      setWorkingInventory(invClone)
      onInventoryUpdate?.(invClone)

      // Check for partial bags and auto-trigger top-up dialog
      const firstPartialIndex = nextBags.findIndex(b => b.totalMeters < targetMetersPerBag)
      if (firstPartialIndex !== -1) {
        const partialBag = nextBags[firstPartialIndex]
        const missing = targetMetersPerBag - partialBag.totalMeters

        toast.warning(`Created ${renumbered.length} bags`, {
          description: "Some bags are partial. Opening inventory selector..."
        })

        // Auto-open the manual top-up dialog for the first partial bag
        setTimeout(() => {
          setManualTopUp({
            open: true,
            lastBagIndex: firstPartialIndex,
            allocations: {}
          })
          setPartialNeedsInventory({
            open: false,
            lastBagIndex: firstPartialIndex,
            missingMeters: missing
          })
        }, 800)
      } else {
        toast.success(`Created ${renumbered.length} bags`)
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
      setPartialNeedsInventory({ open: false, lastBagIndex: null, missingMeters: 0 })
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

    setPartialNeedsInventory({ open: false, lastBagIndex: null, missingMeters: 0 })
  }

  function openManualSelector() {
    if (!bags) return
    const lastIdx = bags.length - 1
    const last = bags[lastIdx]
    const missing = Math.max(0, targetMetersPerBag - (last?.totalMeters ?? 0))
    setManualTopUp({ open: true, lastBagIndex: lastIdx, allocations: {} })
    setPartialNeedsInventory({ open: false, lastBagIndex: lastIdx, missingMeters: missing })
  }

  function applyManualTopUp() {
    if (!bags || manualTopUp.lastBagIndex == null) return
    const idx = manualTopUp.lastBagIndex
    const bag = { ...bags[idx] }
    const missing = Math.max(0, targetMetersPerBag - bag.totalMeters)

    const entries = Object.entries(manualTopUp.allocations).filter(([, v]) => (v ?? 0) > 0)
    // Convert reels to meters
    const invMap = new Map(workingInventory.map((r) => [r.id, r]))
    const sumMeters = entries.reduce((s, [id, reels]) => {
      const inv = invMap.get(id)
      const size = inv?.reelSize ?? 0
      return s + (reels * size)
    }, 0)
    if (sumMeters !== missing) {
      toast.error(`Allocation must equal exactly ${missing} meters`)
      return
    }

    const invCopy = workingInventory.map((r) => ({ ...r }))
    const newItems: BagItem[] = [...bag.items]
    for (const [reelId, reelsToTake] of entries) {
      const inv = invCopy.find((r) => r.id === reelId)
      if (!inv) {
        toast.error("Selected inventory not found")
        return
      }
      const size = inv.reelSize ?? 0
      const meters = reelsToTake * size
      const availableReels = inv.reels ?? Math.floor((inv.metersAvailable || 0) / size)
      if (reelsToTake > availableReels) {
        toast.error("Allocation exceeds available reels")
        return
      }
      inv.reels = (inv.reels ?? availableReels) - reelsToTake
      inv.metersAvailable = (inv.reels ?? 0) * (inv.reelSize ?? 0)
      const label = inv.brandName && inv.productName ? `${inv.brandName} — ${inv.productName} (${inv.reelSize ?? 0} m)` : undefined
      newItems.push({ kind: "inventory", reelId, meters, label })
    }

    bag.items = newItems
    bag.totalMeters += sumMeters
    bag.filledFromInventory += sumMeters

    const nextBags = [...bags]
    nextBags[idx] = bag
    setBags(nextBags)
    setWorkingInventory(invCopy)
    onInventoryUpdate?.(invCopy)
    setManualTopUp({ open: false, lastBagIndex: null, allocations: {} })
    toast.success("Bag completed to exact target")
  }

  function keepPartialBag() {
    setPartialNeedsInventory({ open: false, lastBagIndex: null, missingMeters: 0 })
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

  const canCreateBags = React.useMemo(() => sourceOrders.length > 0, [sourceOrders.length])

  return (
    <section
      className={[
        "w-full max-w-full space-y-6",
        className ?? "",
      ].join(" ")}
      aria-label="Daily Bags"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
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
              <Button variant="outline" className="bg-background">
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
            disabled={isCreating || !canCreateBags}
            className="bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
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
        <Card className="border-dashed bg-muted/50">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<TableIcon className="h-4 w-4" aria-hidden="true" />}
          label="Total Orders"
          value={sourceOrders.length.toString()}
        />
        <StatCard
          icon={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
          label="Total Order Meters"
          value={`${totals.totalOrders.toLocaleString()} m`}
        />
        <StatCard
          icon={<ShoppingBasket className="h-4 w-4" aria-hidden="true" />}
          label="Bags Created"
          value={(totals.totalBags || 0).toString()}
          tone={totals.partial ? "warning" : "default"}
        />
      </div>

      {/* Orders Table Card */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">Today&apos;s Orders</h3>
            <Badge variant="secondary" className="rounded-full text-xs font-normal">
              {new Date().toLocaleDateString()}
            </Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-b border-border">
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
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No orders for today.
                  </TableCell>
                </TableRow>
              ) : (
                sortedOrders.map((o) => (
                  <TableRow key={o.id} className="hover:bg-muted/30">
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
                      <Badge variant="outline" className="rounded-full font-normal">
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

      {bags && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <h3 className="text-lg font-semibold">Packing Results</h3>
            <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
              Total Packed: <span className="font-medium text-foreground">{totals.totalBagMeters.toLocaleString()} m</span>
            </div>
          </div>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {bags.map((bag, bagIdx) => (
              <div
                key={bag.bagNumber}
                className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
              >
                <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      bag.totalMeters >= targetMetersPerBag ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {bag.totalMeters >= targetMetersPerBag ? (
                        <PackageCheck className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <PackageOpen className="h-5 w-5" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">Bag #{bag.bagNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {bag.totalMeters.toLocaleString()} / {targetMetersPerBag.toLocaleString()} m
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleUntie(bagIdx)}
                      title="Untie Bag"
                    >
                      <Unlink className="h-4 w-4" />
                      <span className="sr-only">Untie</span>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <span className="sr-only">Menu</span>
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Bag Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => {
                          setPartialNeedsInventory({
                            open: true,
                            lastBagIndex: bagIdx,
                            missingMeters: Math.max(0, targetMetersPerBag - bag.totalMeters)
                          })
                        }}>
                          Top up from Inventory
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setManualTopUp({
                            open: true,
                            lastBagIndex: bagIdx,
                            allocations: {}
                          })
                        }}>
                          Manual Adjust
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleUntie(bagIdx)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Unlink className="mr-2 h-4 w-4" />
                          Untie Bag
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="p-4 flex-1">
                  <ul className="space-y-3">
                    {bag.items.map((item, idx) => (
                      <li key={idx} className="text-sm flex justify-between gap-2">
                        <div className="min-w-0">
                          {item.kind === "order" ? (
                            <>
                              <div className="font-medium truncate">{item.customer}</div>
                              <div className="text-xs text-muted-foreground truncate">Order #{item.orderId}</div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-amber-600 dark:text-amber-500">Inventory Stock</div>
                              <div className="text-xs text-muted-foreground truncate">{item.label || "Loose stock"}</div>
                            </>
                          )}
                        </div>
                        <div className="font-mono text-xs tabular-nums whitespace-nowrap pt-0.5">
                          {item.meters.toLocaleString()} m
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {bag.filledFromInventory > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-700 dark:text-amber-400 border-t border-amber-100 dark:border-amber-900/50">
                    Includes {bag.filledFromInventory.toLocaleString()} m from inventory
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>


      )}

      {/* Step 1: Confirm that bag is lacking X meters and propose Kushal top-up */}
      <Dialog open={confirmTopUp.open} onOpenChange={(open) => setConfirmTopUp((s) => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bag is short of target</DialogTitle>
            <DialogDescription>
              The last bag is lacking {confirmTopUp.missingMeters.toLocaleString()} meters to reach {targetMetersPerBag.toLocaleString()} meters.
              Would you like to add from Kushal inventory to complete it?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="secondary" onClick={() => setConfirmTopUp({ open: false, missingMeters: 0 })}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmTopUp({ open: false, missingMeters: 0 })
                // proceed to manual selector
                openManualSelector()
              }}
              className="bg-primary text-primary-foreground"
            >
              Choose from inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Manual selector to allocate exact missing meters */}
      <Dialog open={manualTopUp.open} onOpenChange={(open) => setManualTopUp((s) => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Allocate inventory to complete bag</DialogTitle>
            <DialogDescription>
              Select whole reels by product. The total meters must exactly equal the missing amount.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
            {(() => {
              const miss = bags && manualTopUp.lastBagIndex != null ? Math.max(0, targetMetersPerBag - (bags[manualTopUp.lastBagIndex]?.totalMeters ?? 0)) : 0
              const invMap = new Map(workingInventory.map((r) => [r.id, r]))
              const current = Object.entries(manualTopUp.allocations).reduce((s, [id, reels]) => {
                const size = invMap.get(id)?.reelSize ?? 0
                return s + (reels * size)
              }, 0)
              return (
                <div className="text-sm">
                  Missing: <span className="font-medium">{miss.toLocaleString()} m</span>
                  <span className="ml-2 text-muted-foreground">Allocated: {current.toLocaleString()} m</span>
                </div>
              )
            })()}
            <div className="max-h-64 overflow-auto divide-y">
              {workingInventory.map((r) => {
                const reelsAvail = r.reels ?? (r.reelSize ? Math.floor((r.metersAvailable || 0) / r.reelSize) : 0)
                const label = r.brandName && r.productName
                  ? `${r.brandName} — ${r.productName} (${r.reelSize ?? 0} m)`
                  : `Reel #${r.id} (${r.reelSize ?? 0} m)`
                return (
                  <div key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-medium">{label}</div>
                      <div className="text-muted-foreground">
                        {reelsAvail} reels available • {(r.metersAvailable || 0).toLocaleString()} m
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Reels</span>
                      <input
                        aria-label={`Allocate reels from ${label}`}
                        className="h-9 w-24 rounded-md border bg-background px-3 text-right"
                        type="number"
                        min={0}
                        max={reelsAvail}
                        step={1}
                        value={manualTopUp.allocations[r.id] ?? 0}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(Number(e.target.value || 0), reelsAvail))
                          setManualTopUp((s) => ({ ...s, allocations: { ...s.allocations, [r.id]: val } }))
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="secondary" onClick={() => setManualTopUp({ open: false, lastBagIndex: null, allocations: {} })}>
              Cancel
            </Button>
            <Button onClick={applyManualTopUp} className="bg-primary text-primary-foreground">
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section >
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

function StatCard({
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
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
      <div className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full border",
        tone === "warning" ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900" : "bg-primary/10 text-primary border-primary/20"
      )}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
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
      className={cn(
        "whitespace-nowrap",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1",
          "text-xs sm:text-sm font-medium text-foreground",
          "hover:text-primary transition-colors"
        )}
        aria-pressed={active}
      >
        {children}
        <ArrowUpDown
          className={cn(
            "h-3.5 w-3.5",
            active ? "opacity-100 text-primary" : "opacity-60",
            asc ? "rotate-180" : "rotate-0",
            "transition-transform"
          )}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  )
}