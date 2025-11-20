"use client"

import React from "react"
import { PackagePlus, PackageSearch, Boxes, Package2, Undo, Tag, Trash2 } from "lucide-react"
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
  cord?: number | null
}

type CreateItem = Omit<InventoryItem, "id">

type UpdateItem = Partial<Omit<InventoryItem, "id">>

type SortKey = "brand" | "model" | "boxes" | "reels"
type SortDir = "asc" | "desc"

type CatalogEntry = {
  id: string
  brand: string
  product: string
}

type ProductRecord = {
  id: number
  brandName: string
  name: string
  cord: number
  reelSize: number
  category: string | null
}

type ProductOption = {
  entryId: string
  label: string
  detail?: string
  productId: string
}

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
        const data: Array<{ id: number; productName: string; brandName: string; boxes: number; reels: number; cord?: number | null }> = await res.json()
        if (!isMounted) return
        setItems(
          data.map((d) => ({
            id: String(d.id),
            brand: d.brandName,
            model: d.productName,
            boxes: d.boxes ?? 0,
            reels: d.reels ?? 0,
            cord: d.cord ?? null,
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

  const [catalogEntries, setCatalogEntries] = React.useState<CatalogEntry[]>([])
  const [catalogBrand, setCatalogBrand] = React.useState("")
  const [catalogProduct, setCatalogProduct] = React.useState("")
  const [allProducts, setAllProducts] = React.useState<ProductRecord[]>([])
  const [productsLoaded, setProductsLoaded] = React.useState(false)
  const [productOptions, setProductOptions] = React.useState<ProductOption[]>([])
  const [selectedCatalogId, setSelectedCatalogId] = React.useState("")

  // Add form state
  const [brand, setBrand] = React.useState<string>("")
  const [productId, setProductId] = React.useState<string>("")
  const [model, setModel] = React.useState<string>("") // keep for edit table display
  const [boxes, setBoxes] = React.useState<string>("")
  const [reels, setReels] = React.useState<string>("")
  const [selectedCord, setSelectedCord] = React.useState<string>("")

  // Load catalog entries from storage
  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const saved = localStorage.getItem("inventory_catalog_entries")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setCatalogEntries(parsed)
        }
      }
    } catch {}
  }, [])

  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return
      localStorage.setItem("inventory_catalog_entries", JSON.stringify(catalogEntries))
    } catch {}
  }, [catalogEntries])

  React.useEffect(() => {
    setSelectedCatalogId("")
    setProductId("")
  }, [brand])

  React.useEffect(() => {
    if (!selectedCatalogId) return
    const exists = catalogEntries.some(
      (entry) => entry.id === selectedCatalogId && entry.brand.trim().toLowerCase() === brand.trim().toLowerCase(),
    )
    if (!exists) {
      setSelectedCatalogId("")
      setProductId("")
    }
  }, [catalogEntries, selectedCatalogId, brand])

  React.useEffect(() => {
    if (!selectedCatalogId) return
    const option = productOptions.find((opt) => opt.entryId === selectedCatalogId)
    if (!option) {
      setSelectedCatalogId("")
      setProductId("")
      return
    }
    if (option.productId !== productId) {
      setProductId(option.productId)
    }
  }, [productOptions, selectedCatalogId, productId])

  // Load products when brand changes
  React.useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/products")
        if (!res.ok) throw new Error("Failed to load products")
        const data: ProductRecord[] = await res.json()
        if (!isMounted) return
        setAllProducts(data)
      } catch (error) {
        if (!isMounted) return
        setAllProducts([])
      } finally {
        if (!isMounted) return
        setProductsLoaded(true)
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  // Build product options from catalog entries once products are loaded
  React.useEffect(() => {
    if (!brand || !productsLoaded) {
      setProductOptions([])
      return
    }

    const allowedEntries = catalogEntries.filter(
      (entry) => entry.brand.trim().toLowerCase() === brand.trim().toLowerCase(),
    )
    if (allowedEntries.length === 0) {
      setProductOptions([])
      return
    }

    const cordFilter = selectedCord ? Number(selectedCord) : null
    const options = allowedEntries.map((entry) => {
      const normalizedName = entry.product.trim().toLowerCase()
      const normalizedBrand = entry.brand.trim().toLowerCase()

      const primaryMatch = allProducts.find((product) => {
        const brandMatch = product.brandName.trim().toLowerCase() === normalizedBrand
        const nameMatch = product.name.trim().toLowerCase() === normalizedName
        const cordMatch = cordFilter ? product.cord === cordFilter : true
        return brandMatch && nameMatch && cordMatch
      })

      const fallbackMatch = primaryMatch
        ? primaryMatch
        : allProducts.find((product) => {
            if (cordFilter && product.cord !== cordFilter) return false
            return product.name.trim().toLowerCase() === normalizedName
          })

      const match = fallbackMatch ?? null
      return {
        entryId: entry.id,
        label: entry.product,
        detail: match ? `${match.cord}-cord • ${match.reelSize}m` : undefined,
        productId: match ? String(match.id) : "",
      }
    })

    setProductOptions(options)
  }, [brand, catalogEntries, allProducts, productsLoaded, selectedCord])

  // Ensure selected brand remains valid if catalog changes
  React.useEffect(() => {
    if (!brand) return
    if (catalogEntries.length === 0) return
    const exists = catalogEntries.some((entry) => entry.brand.toLowerCase() === brand.toLowerCase())
    if (!exists) {
      setBrand("")
      setProductId("")
      setProductOptions([])
    }
  }, [catalogEntries, brand])

  const catalogBrands = React.useMemo(() => {
    const uniques = new Set<string>()
    catalogEntries.forEach((entry) => {
      uniques.add(entry.brand)
    })
    return Array.from(uniques)
  }, [catalogEntries])

  const selectableBrands = catalogBrands

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
    setSelectedCord("")
    setSelectedCatalogId("")
    setError(null)
  }

  function handleAddCatalogEntry(e: React.FormEvent) {
    e.preventDefault()
    const trimmedBrand = catalogBrand.trim()
    const trimmedProduct = catalogProduct.trim()
    if (!trimmedBrand || !trimmedProduct) {
      toast.error("Brand and product name are required.")
      return
    }
    const exists = catalogEntries.some(
      (entry) =>
        entry.brand.toLowerCase() === trimmedBrand.toLowerCase() &&
        entry.product.toLowerCase() === trimmedProduct.toLowerCase(),
    )
    if (exists) {
      toast("This brand/product is already in the catalog.")
      return
    }
    const next: CatalogEntry = {
      id: generateId(),
      brand: trimmedBrand,
      product: trimmedProduct,
    }
    setCatalogEntries((prev) => [next, ...prev])
    setCatalogProduct("")
    toast.success("Saved to catalog.")
  }

  function handleRemoveCatalogEntry(id: string) {
    setCatalogEntries((prev) => prev.filter((entry) => entry.id !== id))
    toast("Removed from catalog.")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { errs, boxesNum, reelsNum } = validateValues({
      brand,
      productId: selectedCatalogId || productId,
      boxes,
      reels,
    })
    if (errs.length) {
      setError(errs.join(" "))
      toast.error("Please fix the form errors.")
      return
    }
    if (!productId) {
      setError("Selected product is not linked to the database yet.")
      toast.error("Product not found in database.")
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
        cord: created.cord ?? null,
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

  const editBrandOptions = React.useMemo(() => {
    const opts = new Set(selectableBrands)
    if (editing?.brand) {
      opts.add(editing.brand)
    }
    return Array.from(opts)
  }, [selectableBrands, editing?.brand])

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
        cord: updated.product?.cord ?? null,
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
      {/* Brand/Product Catalog */}
      <div className="w-full rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Tag className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold sm:text-lg">Brand Catalog</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Save the brand/product pairs you want to reuse while adding inventory.
            </p>
          </div>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <form onSubmit={handleAddCatalogEntry} className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label htmlFor="catalog-brand">Brand</Label>
              <Input
                id="catalog-brand"
                value={catalogBrand}
                onChange={(e) => setCatalogBrand(e.target.value)}
                placeholder="e.g. Kushal"
                list="brand-suggestions"
                className="mt-1.5"
              />
              <datalist id="brand-suggestions">
                {brands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="catalog-product">Product name</Label>
              <Input
                id="catalog-product"
                value={catalogProduct}
                onChange={(e) => setCatalogProduct(e.target.value)}
                placeholder="e.g. Super Sankal 9 cord"
                className="mt-1.5"
              />
            </div>
            <div className="lg:col-span-1 flex items-end">
              <Button type="submit" className="w-full">
                Add to catalog
              </Button>
            </div>
          </form>

          {catalogEntries.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No catalog entries yet. Add a brand and product name to create your shortlist.
            </p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-3">
              {catalogEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm shadow-sm"
                >
                  <div>
                    <div className="font-semibold">{entry.brand}</div>
                    <div className="text-xs text-muted-foreground">{entry.product}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCatalogEntry(entry.id)}
                    aria-label={`Remove ${entry.brand} ${entry.product}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-2">
              <Label htmlFor="brand">Brand</Label>
              <Select
                value={brand || undefined}
                onValueChange={(v) => {
                  setBrand(v)
                  setSelectedCatalogId("")
                  setProductId("")
                }}
                disabled={selectableBrands.length === 0}
              >
                <SelectTrigger id="brand" aria-label="Select brand" className="mt-1.5">
                  <SelectValue placeholder="Choose brand" />
                </SelectTrigger>
                <SelectContent>
                  {selectableBrands.length > 0 ? (
                    selectableBrands.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Add brands in the catalog above first.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 lg:col-span-1">
              <Label htmlFor="cord">Cord</Label>
              <Select
                value={selectedCord || "any"}
                onValueChange={(v) => setSelectedCord(v === "any" ? "" : v)}
                disabled={!brand}
              >
                <SelectTrigger id="cord" className="mt-1.5">
                  <SelectValue placeholder="Choose cord" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any cord</SelectItem>
                  <SelectItem value="6">6 cord</SelectItem>
                  <SelectItem value="9">9 cord</SelectItem>
                  <SelectItem value="12">12 cord</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 lg:col-span-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={selectedCatalogId || undefined}
                onValueChange={(entryId) => {
                  setSelectedCatalogId(entryId)
                  const option = productOptions.find((opt) => opt.entryId === entryId)
                  setProductId(option?.productId ?? "")
                }}
                disabled={!brand}
              >
                <SelectTrigger id="product" className="mt-1.5">
                  <SelectValue placeholder={brand ? "Choose product" : "Select brand first"} />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {brand
                        ? productsLoaded
                          ? "No matching products found in the database for this brand."
                          : "Loading products…"
                        : selectableBrands.length === 0
                          ? "Add a brand in the catalog first."
                          : "Select brand first"}
                    </div>
                  ) : (
                    productOptions.map((opt) => (
                      <SelectItem key={opt.entryId} value={opt.entryId}>
                        <span className="flex flex-col text-left">
                          <span>{opt.label}</span>
                          {opt.detail ? (
                            <span className="text-xs text-muted-foreground">{opt.detail}</span>
                          ) : null}
                        </span>
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
                <TableHead className="whitespace-nowrap">Cord</TableHead>
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
                      <TableCell className="align-middle">
                        {typeof it.cord === "number" ? `${it.cord}-cord` : "-"}
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
                  {editBrandOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Add a brand in the catalog to edit.
                    </div>
                  ) : (
                    editBrandOptions.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))
                  )}
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