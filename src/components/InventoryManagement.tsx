"use client"

import React from "react"
import { PackagePlus, PackageSearch, Boxes, Package2, Undo } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog"

type InventoryItem = {
  id: string
  brand: string
  model: string
  boxes: number
  reels: number
}

type CreateItem = Omit<InventoryItem, "id">

type UpdateItem = Partial<Omit<InventoryItem, "id">>

type SortKey = "brand" | "model" | "boxes" | "reels"
type SortDir = "asc" | "desc"

export interface InventoryManagementProps {
  className?: string
  style?: React.CSSProperties
  initialItems?: InventoryItem[]
  brands?: string[]
  pageSizeOptions?: number[]
  defaultPageSize?: number
  onCreate?: (item: CreateItem) => Promise<InventoryItem> | InventoryItem
  onUpdate?: (id: string, updates: UpdateItem) => Promise<InventoryItem> | InventoryItem
  onDelete?: (id: string) => Promise<void> | void
}

function generateId() {
  // Simple unique-ish ID for client-side usage
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export default function InventoryManagement({
  className,
  style,
  initialItems = [],
  brands = [],
  pageSizeOptions = [5, 10, 20, 50],
  defaultPageSize = 10,
  onCreate,
  onUpdate,
  onDelete,
}: InventoryManagementProps) {
  const [items, setItems] = React.useState<InventoryItem[]>(initialItems)
  // Fetch inventory from DB on mount to replace demo/prop data
  React.useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/inventory")
        if (!res.ok) throw new Error("Failed to load inventory")
        const data: Array<{ id: number; productName: string; brandName: string; boxes: number; reels: number }> = await res.json()
        if (!isMounted) return
        setItems(
          data.map((d) => ({
            id: String(d.id),
            brand: d.brandName,
            model: d.productName,
            boxes: d.boxes ?? 0,
            reels: d.reels ?? 0,
          }))
        )
      } catch (e) {
        // keep empty state
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  const [search, setSearch] = React.useState("")
  const [pageSize, setPageSize] = React.useState<number>(defaultPageSize)
  const [page, setPage] = React.useState(1)
  const [sortKey, setSortKey] = React.useState<SortKey>("brand")
  const [sortDir, setSortDir] = React.useState<SortDir>("asc")
  const [submitting, setSubmitting] = React.useState(false)
  const [editing, setEditing] = React.useState<InventoryItem | null>(null)
  const [updating, setUpdating] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Add form state
  const [brand, setBrand] = React.useState<string>("")
  const [productId, setProductId] = React.useState<string>("")
  const [productOptions, setProductOptions] = React.useState<Array<{ id: string; label: string }>>([])
  const [model, setModel] = React.useState<string>("") // keep for edit table display
  const [boxes, setBoxes] = React.useState<string>("")
  const [reels, setReels] = React.useState<string>("")

  // Load products when brand changes
  React.useEffect(() => {
    setProductId("")
    setProductOptions([])
    if (!brand) return
    ;(async () => {
      try {
        const params = new URLSearchParams({ brand })
        const res = await fetch(`/api/products?${params.toString()}`)
        if (!res.ok) throw new Error("Failed to load products")
        const data: Array<{ id: number; name: string; cord: number; reelSize: number; category: string | null }> = await res.json()
        setProductOptions(
          data.map((p) => ({
            id: String(p.id),
            label: `${p.name}${p.category ? ` (${p.category})` : ""} • ${p.cord}-cord • ${p.reelSize}m`,
          }))
        )
      } catch (e) {
        setProductOptions([])
      }
    })()
  }, [brand])

  function validateValues(values: { brand: string; productId: string; boxes: string; reels: string }) {
    const errs: string[] = []
    if (!values.brand) errs.push("Brand is required.")
    if (!values.productId) errs.push("Product is required.")
    const boxesNum = Number(values.boxes ?? "0")
    const reelsNum = Number(values.reels ?? "0")
    if (!Number.isFinite(boxesNum) || boxesNum < 0 || !Number.isInteger(boxesNum)) {
      errs.push("Boxes must be a non-negative integer.")
    }
    if (!Number.isFinite(reelsNum) || reelsNum < 0 || !Number.isInteger(reelsNum)) {
      errs.push("Reels must be a non-negative integer.")
    }
    return { errs, boxesNum, reelsNum }
  }

  function resetForm() {
    setBrand("")
    setProductId("")
    setProductOptions([])
    setModel("")
    setBoxes("")
    setReels("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { errs, boxesNum, reelsNum } = validateValues({ brand, productId, boxes, reels })
    if (errs.length) {
      setError(errs.join(" "))
      toast.error("Please fix the form errors.")
      return
    }
    setSubmitting(true)
    try {
      // Prefer API-backed creation to ensure consistency
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: Number(productId), boxes: boxesNum, reels: reelsNum }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Failed to add item")
      }
      const created = await res.json()
      const mapped: InventoryItem = {
        id: String(created.id),
        brand: created.brandName,
        model: created.productName,
        boxes: created.boxes ?? 0,
        reels: created.reels ?? 0,
      }
      setItems((prev) => [mapped, ...prev])
      toast.success("Item added to inventory.")
      resetForm()
    } catch (err) {
      console.error(err)
      setError("Failed to add item. Please try again.")
      toast.error("Failed to add item.")
    } finally {
      setSubmitting(false)
    }
  }

  function toggleSort(key: SortKey) {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"))
        return prevKey
      }
      setSortDir("asc")
      return key
    })
  }

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((it) => {
      return (
        it.brand.toLowerCase().includes(term) ||
        it.model.toLowerCase().includes(term)
      )
    })
  }, [items, search])

  const sorted = React.useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let av: string | number = a[sortKey]
      let bv: string | number = b[sortKey]
      if (typeof av === "string" && typeof bv === "string") {
        av = av.toLowerCase()
        bv = bv.toLowerCase()
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIdx = (currentPage - 1) * pageSize
  const endIdx = Math.min(startIdx + pageSize, total)
  const pageItems = sorted.slice(startIdx, endIdx)

  function headerSortIndicator(key: SortKey) {
    if (sortKey !== key) return null
    return <span className="ml-1 text-muted-foreground">{sortDir === "asc" ? "▲" : "▼"}</span>
  }

  // Edit dialog state and handlers
  const [editBrand, setEditBrand] = React.useState("")
  const [editModel, setEditModel] = React.useState("")
  const [editBoxes, setEditBoxes] = React.useState("")
  const [editReels, setEditReels] = React.useState("")
  const [editError, setEditError] = React.useState<string | null>(null)

  function openEdit(item: InventoryItem) {
    setEditing(item)
    setEditBrand(item.brand)
    setEditModel(item.model)
    setEditBoxes(String(item.boxes))
    setEditReels(String(item.reels))
    setEditError(null)
  }

  async function handleUpdate() {
    if (!editing) return
    setEditError(null)
    // Only allow boxes/reels update via API; brand/model remain informational
    const { errs, boxesNum, reelsNum } = validateValues({
      brand: editBrand,
      productId: "dummy", // skip product validation for edit
      boxes: editBoxes,
      reels: editReels,
    })
    // remove the product required error
    const filteredErrs = errs.filter((e) => e !== "Product is required.")
    if (filteredErrs.length) {
      setEditError(filteredErrs.join(" "))
      toast.error("Please fix the form errors.")
      return
    }
    setUpdating(true)
    try {
      const res = await fetch(`/api/inventory/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boxes: boxesNum, reels: reelsNum }),
      })
      if (!res.ok) throw new Error("Failed to update")
      const updated = await res.json()
      const mapped: InventoryItem = {
        id: String(updated.id),
        brand: updated.brand.name,
        model: updated.product.name,
        boxes: updated.boxes,
        reels: updated.reels,
      }
      setItems((prev) => prev.map((it) => (it.id === editing.id ? mapped : it)))
      toast.success("Item updated.")
      setEditing(null)
    } catch (err) {
      console.error(err)
      setEditError("Failed to update item. Please try again.")
      toast.error("Failed to update item.")
    } finally {
      setUpdating(false)
    }
  }

  async function confirmDelete(id: string) {
    setDeletingId(id)
  }

  async function handleDelete() {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/inventory?id=${deletingId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setItems((prev) => prev.filter((it) => it.id !== deletingId))
      toast.success("Item deleted.")
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete item.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className={cn("w-full max-w-full space-y-6", className)} style={style}>
      {/* Add / Edit Form */}
      <div className="w-full rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Package2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold sm:text-lg">Inventory</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Add new stock items and manage existing inventory.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <Label htmlFor="brand">Brand</Label>
              <Select
                value={brand || undefined}
                onValueChange={(v) => setBrand(v)}
              >
                <SelectTrigger id="brand" aria-label="Select brand" className="mt-1.5">
                  <SelectValue placeholder="Choose brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.length > 0 ? (
                    brands.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Chain">Chain</SelectItem>
                      <SelectItem value="Panda">Panda</SelectItem>
                      <SelectItem value="Genda">Genda</SelectItem>
                      <SelectItem value="AK56">AK56</SelectItem>
                      <SelectItem value="Others">Others</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="product">Product</Label>
              <Select
                value={productId || undefined}
                onValueChange={(v) => setProductId(v)}
                disabled={!brand}
              >
                <SelectTrigger id="product" className="mt-1.5">
                  <SelectValue placeholder={brand ? "Choose product" : "Select brand first"} />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {brand ? "No products found" : "Select brand first"}
                    </div>
                  ) : (
                    productOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="boxes">Boxes</Label>
              <Input
                id="boxes"
                inputMode="numeric"
                pattern="[0-9]*"
                value={boxes}
                onChange={(e) => setBoxes(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                className="mt-1.5"
                aria-invalid={!!error}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="reels">Reels</Label>
              <Input
                id="reels"
                inputMode="numeric"
                pattern="[0-9]*"
                value={reels}
                onChange={(e) => setReels(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                className="mt-1.5"
                aria-invalid={!!error}
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent" />
                  Adding
                </>
              ) : (
                <>
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  Add Item
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resetForm}
              disabled={submitting}
              className="gap-2"
            >
              <Undo className="h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {/* Table + Search */}
      <div className="w-full rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <h3 className="text-base font-semibold sm:text-lg">Current Stock</h3>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Search, sort, and manage inventory items.
            </p>
          </div>
          <div className="relative w-full min-w-0 sm:w-72">
            <PackageSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brand or model..."
              className="pl-9"
              aria-label="Search inventory"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("brand")}
                    className="inline-flex items-center text-left font-semibold hover:text-foreground"
                    aria-label={`Sort by brand ${sortKey === "brand" ? sortDir : ""}`}
                  >
                    Brand {headerSortIndicator("brand")}
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("model")}
                    className="inline-flex items-center text-left font-semibold hover:text-foreground"
                    aria-label={`Sort by model ${sortKey === "model" ? sortDir : ""}`}
                  >
                    Model {headerSortIndicator("model")}
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("boxes")}
                    className="inline-flex items-center text-left font-semibold hover:text-foreground"
                    aria-label={`Sort by boxes ${sortKey === "boxes" ? sortDir : ""}`}
                  >
                    Boxes {headerSortIndicator("boxes")}
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("reels")}
                    className="inline-flex items-center text-left font-semibold hover:text-foreground"
                    aria-label={`Sort by reels ${sortKey === "reels" ? sortDir : ""}`}
                  >
                    Reels {headerSortIndicator("reels")}
                  </button>
                </TableHead>
                <TableHead className="w-px text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <Boxes className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {items.length === 0
                            ? "No inventory yet."
                            : "No results match your search."}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {items.length === 0
                            ? "Add your first item using the form above."
                            : "Try adjusting your search or filters."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((it) => (
                  <TableRow key={it.id} className="group">
                    <TableCell className="align-middle">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 text-foreground">
                          <span className="text-xs font-semibold">
                            {it.brand?.[0]?.toUpperCase() || "B"}
                          </span>
                        </span>
                        <span className="min-w-0 break-words">{it.brand}</span>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle">
                      <span className="min-w-0 break-words">{it.model}</span>
                    </TableCell>
                    <TableCell className="align-middle">{it.boxes}</TableCell>
                    <TableCell className="align-middle">{it.reels}</TableCell>
                    <TableCell className="align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEdit(it)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => confirmDelete(it.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-xs text-muted-foreground sm:text-sm">
            {total > 0 ? (
              <>
                Showing <span className="font-medium text-foreground">{startIdx + 1}</span>–
                <span className="font-medium text-foreground">{endIdx}</span> of{" "}
                <span className="font-medium text-foreground">{total}</span>
              </>
            ) : (
              "No items to display"
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="page-size" className="text-xs text-muted-foreground">
                Rows per page
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger id="page-size" className="h-9 w-[90px]">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((opt) => (
                    <SelectItem key={opt} value={String(opt)}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                Prev
              </Button>
              <div className="min-w-[80px] text-center text-sm">
                Page <span className="font-medium">{currentPage}</span> / {totalPages}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Edit Item
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="edit-brand">Brand</Label>
              <Select
                value={editBrand || undefined}
                onValueChange={(v) => setEditBrand(v)}
              >
                <SelectTrigger id="edit-brand" className="mt-1.5">
                  <SelectValue placeholder="Choose brand" />
                </SelectTrigger>
                <SelectContent>
                  {(brands.length ? brands : ["Chain", "Panda", "Genda", "AK56", "Others"]).map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="edit-model">Product Model</Label>
              <Input
                id="edit-model"
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
                placeholder="Model name"
                className="mt-1.5"
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="edit-boxes">Boxes</Label>
              <Input
                id="edit-boxes"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editBoxes}
                onChange={(e) => setEditBoxes(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                className="mt-1.5"
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="edit-reels">Reels</Label>
              <Input
                id="edit-reels"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editReels}
                onChange={(e) => setEditReels(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                className="mt-1.5"
              />
            </div>
          </div>
          {editError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {editError}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent" />
                  Saving
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => (!open ? setDeletingId(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the item from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}