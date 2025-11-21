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
  cord?: string
  reelSize?: string
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
      ; (async () => {
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
  const [selectedReelSize, setSelectedReelSize] = React.useState<string>("")

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
    } catch { }
  }, [])

  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return
      localStorage.setItem("inventory_catalog_entries", JSON.stringify(catalogEntries))
    } catch { }
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
      if (option.productId) {
        // Auto-fill specs if product exists
        if (option.cord) setSelectedCord(option.cord)
        if (option.reelSize) setSelectedReelSize(option.reelSize)
      }
    }
  }, [productOptions, selectedCatalogId, productId])

  // Load products when brand changes
  React.useEffect(() => {
    let isMounted = true
      ; (async () => {
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

    // Note: We don't filter by cord here anymore because we want to show all options
    // and let the user select the specific product variant if it exists, or define it if not.
    // However, if we want to filter the dropdown based on selectedCord, we can.
    // But for "creating new product", we need to allow selecting the name first.

    const options = allowedEntries.map((entry) => {
      const normalizedName = entry.product.trim().toLowerCase()
      const normalizedBrand = entry.brand.trim().toLowerCase()

      const primaryMatch = allProducts.find((product) => {
        const brandMatch = product.brandName.trim().toLowerCase() === normalizedBrand
        const nameMatch = product.name.trim().toLowerCase() === normalizedName
        const cordMatch = selectedCord ? product.cord === Number(selectedCord) : true
        return brandMatch && nameMatch && cordMatch
      })

      const fallbackMatch = primaryMatch
        ? primaryMatch
        : allProducts.find((product) => {
          if (selectedCord && product.cord !== Number(selectedCord)) return false
          return product.name.trim().toLowerCase() === normalizedName
        })

      const match = fallbackMatch ?? null
      return {
        entryId: entry.id,
        label: entry.product,
        detail: match ? `${match.cord}-cord • ${match.reelSize}m` : "New Product",
        productId: match ? String(match.id) : "",
        cord: match ? String(match.cord) : undefined,
        reelSize: match ? String(match.reelSize) : undefined,
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
    // Product ID check moved to handleSubmit to allow new products
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
    setSelectedReelSize("")
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
      productId: selectedCatalogId || productId, // Just to pass validation check if we wanted to enforce it there
      boxes,
      reels,
    })

    if (!selectedCatalogId) {
      errs.push("Product is required.")
    }

    if (errs.length) {
      setError(errs.join(" "))
      toast.error("Please fix the form errors.")
      return
    }

    // If productId is missing, we need cord and reelSize to create it
    if (!productId) {
      if (!selectedCord) {
        setError("Cord type is required for new products.")
        toast.error("Please select a cord type.")
        return
      }
      if (!selectedReelSize) {
        setError("Reel size is required for new products.")
        toast.error("Please select a reel size.")
        return
      }
    }

    setSubmitting(true)
    try {
      const catalogEntry = catalogEntries.find(e => e.id === selectedCatalogId)
      const productName = catalogEntry?.product || ""

      const payload: any = {
        boxes: boxesNum,
        reels: reelsNum,
      }

      if (productId) {
        payload.productId = Number(productId)
      } else {
        payload.brandName = brand
        payload.productName = productName
        payload.cord = selectedCord
        payload.reelSize = selectedReelSize
      }

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

      // Update items list
      setItems((prev) => {
        // Check if item already exists in list (by ID) and update it, or add new
        const idx = prev.findIndex(p => p.id === mapped.id)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = mapped
          return copy
        }
        return [mapped, ...prev]
      })

      // Refresh products list so next time it's found
      const prodRes = await fetch("/api/products")
      if (prodRes.ok) {
        const prodData = await prodRes.json()
        setAllProducts(prodData)
      }

      toast.success("Item added to inventory.")
      resetForm()
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to add item. Please try again.")
      toast.error(err.message || "Failed to add item.")
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
    <section className={cn("w-full max-w-full space-y-8", className)} style={style}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Brand/Product Catalog - Side Panel on Large Screens */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="w-full rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Tag className="h-4 w-4" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-semibold">Brand Catalog</h2>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-4">
                Define brand & product pairs here to quickly use them when adding inventory.
              </p>
              <form onSubmit={handleAddCatalogEntry} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-brand" className="text-xs">Brand Name</Label>
                  <Input
                    id="catalog-brand"
                    value={catalogBrand}
                    onChange={(e) => setCatalogBrand(e.target.value)}
                    placeholder="e.g. Kushal"
                    list="brand-suggestions"
                    className="h-9"
                  />
                  <datalist id="brand-suggestions">
                    {brands.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-product" className="text-xs">Product Name</Label>
                  <Input
                    id="catalog-product"
                    value={catalogProduct}
                    onChange={(e) => setCatalogProduct(e.target.value)}
                    placeholder="e.g. Super Sankal"
                    className="h-9"
                  />
                </div>
                <Button type="submit" className="w-full h-9 text-xs" size="sm">
                  Add to Catalog
                </Button>
              </form>

              <div className="mt-6 space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saved Entries</h3>
                {catalogEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No entries yet.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {catalogEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-sm group"
                      >
                        <span className="font-medium text-foreground">{entry.brand}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{entry.product}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCatalogEntry(entry.id)}
                          className="ml-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Add Inventory Form - Main Area */}
        <div className="lg:col-span-8">
          <div className="w-full rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="border-b bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Add Inventory</h2>
                  <p className="text-xs text-muted-foreground">
                    Record new stock arrivals.
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-1.5">
                  <Label htmlFor="brand" className="text-xs font-medium">Brand</Label>
                  <Select
                    value={brand || undefined}
                    onValueChange={(v) => {
                      setBrand(v)
                      setSelectedCatalogId("")
                      setProductId("")
                    }}
                    disabled={selectableBrands.length === 0}
                  >
                    <SelectTrigger id="brand" className="h-10">
                      <SelectValue placeholder="Select Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableBrands.length > 0 ? (
                        selectableBrands.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          No brands in catalog
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-4 space-y-1.5">
                  <Label htmlFor="product" className="text-xs font-medium">Product Model</Label>
                  <Select
                    value={selectedCatalogId || undefined}
                    onValueChange={(entryId) => {
                      setSelectedCatalogId(entryId)
                      const option = productOptions.find((opt) => opt.entryId === entryId)
                      setProductId(option?.productId ?? "")
                      if (option?.productId) {
                        setSelectedCord(option.cord || "")
                        setSelectedReelSize(option.reelSize || "")
                      }
                    }}
                    disabled={!brand}
                  >
                    <SelectTrigger id="product" className="h-10">
                      <SelectValue placeholder={brand ? "Select Product" : "Wait..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((opt) => (
                        <SelectItem key={opt.entryId} value={opt.entryId}>
                          <span className="flex flex-col text-left">
                            <span className="font-medium">{opt.label}</span>
                            {opt.detail && <span className="text-[10px] text-muted-foreground">{opt.detail}</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2 space-y-1.5">
                  <Label htmlFor="cord" className="text-xs font-medium">Cord Type</Label>
                  <Select
                    value={selectedCord || "any"}
                    onValueChange={(v) => setSelectedCord(v === "any" ? "" : v)}
                    disabled={!brand || !!productId}
                  >
                    <SelectTrigger id="cord" className="h-10">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any" disabled>Select</SelectItem>
                      <SelectItem value="6">6 Cord</SelectItem>
                      <SelectItem value="9">9 Cord</SelectItem>
                      <SelectItem value="12">12 Cord</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2 space-y-1.5">
                  <Label htmlFor="reelSize" className="text-xs font-medium">Reel Size</Label>
                  <Select
                    value={selectedReelSize || "any"}
                    onValueChange={(v) => setSelectedReelSize(v === "any" ? "" : v)}
                    disabled={!brand || !!productId}
                  >
                    <SelectTrigger id="reelSize" className="h-10">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any" disabled>Select</SelectItem>
                      <SelectItem value="1000">1000 m</SelectItem>
                      <SelectItem value="2500">2500 m</SelectItem>
                      <SelectItem value="5000">5000 m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-3 space-y-1.5">
                  <Label htmlFor="boxes" className="text-xs font-medium">Boxes</Label>
                  <div className="relative">
                    <Input
                      id="boxes"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={boxes}
                      onChange={(e) => setBoxes(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      className="h-10 pl-3 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      Qty
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-3 space-y-1.5">
                  <Label htmlFor="reels" className="text-xs font-medium">Reels per Box</Label>
                  <div className="relative">
                    <Input
                      id="reels"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={reels}
                      onChange={(e) => setReels(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      className="h-10 pl-3 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      Qty
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-6 flex items-end gap-3">
                  <Button type="submit" disabled={submitting} className="flex-1 h-10">
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <PackagePlus className="h-4 w-4" />
                        Add to Inventory
                      </span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    disabled={submitting}
                    className="h-10 px-4"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Table + Search */}
      {/* Table + Search */}
      <div className="w-full rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Current Stock</h3>
            <p className="text-xs text-muted-foreground">
              Manage your inventory items.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <PackageSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brand or model..."
              className="pl-9 h-9"
              aria-label="Search inventory"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="w-[250px]">
                  <button
                    type="button"
                    onClick={() => toggleSort("brand")}
                    className="flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    Brand {headerSortIndicator("brand")}
                  </button>
                </TableHead>
                <TableHead className="w-[250px]">
                  <button
                    type="button"
                    onClick={() => toggleSort("model")}
                    className="flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    Model {headerSortIndicator("model")}
                  </button>
                </TableHead>
                <TableHead>Cord</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("boxes")}
                    className="flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    Boxes {headerSortIndicator("boxes")}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("reels")}
                    className="flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    Reels {headerSortIndicator("reels")}
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Boxes className="h-8 w-8 opacity-20" />
                      <p className="text-sm">No items found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((it) => (
                  <TableRow key={it.id} className="group hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-xs">
                          {it.brand?.[0]?.toUpperCase() || "B"}
                        </div>
                        <span className="font-medium">{it.brand}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{it.model}</span>
                    </TableCell>
                    <TableCell>
                      {typeof it.cord === "number" ? (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10">
                          {it.cord} cord
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{it.boxes}</TableCell>
                    <TableCell>{it.reels}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(it)}
                        >
                          <span className="sr-only">Edit</span>
                          <Package2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => confirmDelete(it.id)}
                        >
                          <span className="sr-only">Delete</span>
                          <Trash2 className="h-4 w-4" />
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
        <div className="flex flex-col gap-4 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {total > 0 ? (
              <>
                Showing <span className="font-medium text-foreground">{startIdx + 1}</span> to{" "}
                <span className="font-medium text-foreground">{endIdx}</span> of{" "}
                <span className="font-medium text-foreground">{total}</span> entries
              </>
            ) : (
              "No entries"
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
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
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <span className="sr-only">Previous</span>
                <span aria-hidden="true">‹</span>
              </Button>
              <div className="text-xs font-medium min-w-[3rem] text-center">
                {currentPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <span className="sr-only">Next</span>
                <span aria-hidden="true">›</span>
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