"use client";

import React from "react";
import { toast } from "sonner";
import {
  ChartLine,
  ChartBar,
  ChartPie,
  TrendingUp,
  FileChartLine,
  FileChartColumn,
  ChartArea,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type OrderType = "retail" | "wholesale" | "custom" | "internal";

export interface Transaction {
  id: string;
  date: string; // ISO date string "YYYY-MM-DD"
  customer: string;
  orderType: OrderType;
  meters: number;
  revenue: number;
  bags: number;
  inventoryUsed: number; // units used from inventory
}

interface AnalyticsProps {
  className?: string;
  initialData?: Transaction[];
  isLoading?: boolean;
}

function seededRandom(seed: number) {
  // Simple LCG for deterministic mock data
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function generateMockData(days = 60, seed = 42): Transaction[] {
  const rand = seededRandom(seed);
  const customers = ["Shree Traders", "Ganesh Stores", "Om Enterprises", "Patel Mart", "Navkar Hub"];
  const types: OrderType[] = ["retail", "wholesale", "custom", "internal"];
  const today = new Date();
  const data: Transaction[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    // Create 1-5 orders per day
    const orders = 1 + Math.floor(rand() * 5);
    for (let j = 0; j < orders; j++) {
      const customer = customers[Math.floor(rand() * customers.length)];
      const orderType = types[Math.floor(rand() * types.length)];
      const meters = Math.floor(50 + rand() * 950); // 50 - 1000
      const revenue = Math.round(meters * (5 + rand() * 15)); // per meter rate
      const bags = Math.max(1, Math.floor(meters / (100 + rand() * 150)));
      const inventoryUsed = Math.round(meters * (0.7 + rand() * 0.6)); // usage ratio
      data.push({
        id: `${date}-${j}`,
        date,
        customer,
        orderType,
        meters,
        revenue,
        bags,
        inventoryUsed,
      });
    }
  }
  return data.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function formatNumber(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function toCSV(rows: Transaction[]) {
  const headers = [
    "id",
    "date",
    "customer",
    "orderType",
    "meters",
    "revenue",
    "bags",
    "inventoryUsed",
  ];
  const escape = (v: string | number) => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.date,
        r.customer,
        r.orderType,
        r.meters,
        r.revenue,
        r.bags,
        r.inventoryUsed,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

function groupByDate(rows: Transaction[]) {
  const map = new Map<
    string,
    { revenue: number; meters: number; bags: number; inventoryUsed: number }
  >();
  for (const r of rows) {
    const entry = map.get(r.date) ?? { revenue: 0, meters: 0, bags: 0, inventoryUsed: 0 };
    entry.revenue += r.revenue;
    entry.meters += r.meters;
    entry.bags += r.bags;
    entry.inventoryUsed += r.inventoryUsed;
    map.set(r.date, entry);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({ date, ...v }));
}

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function Analytics({
  className,
  initialData,
  isLoading: loadingProp,
}: AnalyticsProps) {
  // Live summary from backend
  const [summary, setSummary] = React.useState<null | {
    totalInventoryReelsByBrand: { brandName: string; totalReels: number }[];
    todayOrdersCount: number;
    ordersByStatus: { status: string; count: number }[];
    reelsPickedToday: number;
    topProductsByOrders: { productName: string; brandName: string; orderCount: number }[];
  }>(null);
  const [summaryLoading, setSummaryLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setSummaryLoading(true);
        const res = await fetch("/api/analytics/summary");
        if (!res.ok) throw new Error("Failed to load analytics summary");
        const data = await res.json();
        if (!mounted) return;
        setSummary(data);
      } catch (e) {
        // keep mock fallback below
      } finally {
        setSummaryLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const data = React.useMemo(() => initialData ?? generateMockData(90, 77), [initialData]);

  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [customer, setCustomer] = React.useState("");
  const debouncedCustomer = useDebounced(customer, 300);
  const [orderType, setOrderType] = React.useState<OrderType | "all">("all");
  const [exporting, setExporting] = React.useState<"csv" | "pdf" | null>(null);
  const [localLoading, setLocalLoading] = React.useState(false);

  const isLoading = !!loadingProp || localLoading;
  const isSummaryLoading = summaryLoading;

  const filtered = React.useMemo(() => {
    const s = startDate ? new Date(startDate) : null;
    const e = endDate ? new Date(endDate) : null;
    return data.filter((t) => {
      const d = new Date(t.date);
      if (s && d < s) return false;
      if (e && d > e) return false;
      if (debouncedCustomer && !t.customer.toLowerCase().includes(debouncedCustomer.toLowerCase()))
        return false;
      if (orderType !== "all" && t.orderType !== orderType) return false;
      return true;
    });
  }, [data, startDate, endDate, debouncedCustomer, orderType]);

  const series = React.useMemo(() => groupByDate(filtered), [filtered]);

  const totals = React.useMemo(() => {
    let meters = 0,
      revenue = 0,
      inventory = 0,
      bags = 0;
    for (const r of filtered) {
      meters += r.meters;
      revenue += r.revenue;
      inventory += r.inventoryUsed;
      bags += r.bags;
    }
    const revPrev =
      series.length > 1 ? series[series.length - 2].revenue : revenue;
    const revTrend = revPrev > 0 ? ((series.at(-1)?.revenue ?? 0) - revPrev) / revPrev : 0;
    return { meters, revenue, inventory, bags, revTrend };
  }, [filtered, series]);

  const uniqueCustomers = React.useMemo(() => {
    return Array.from(new Set(data.map((d) => d.customer))).sort();
  }, [data]);

  function handleExportCSV() {
    try {
      setExporting("csv");
      const csv = toCSV(filtered);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "analytics-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (e) {
      toast.error("Failed to export CSV");
    } finally {
      setExporting(null);
    }
  }

  function handleExportPDF() {
    try {
      setExporting("pdf");
      const title = "Analytics Report";
      const html = `
        <html>
          <head>
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Arial, sans-serif; margin: 24px; color: #111827; }
              h1 { font-size: 20px; margin: 0 0 16px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
              th { background: #f3f4f6; }
              .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
              .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #fff; }
              .muted { color: #6b7280; font-size: 12px; }
              @media print { @page { size: A4; margin: 16mm; } }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <div class="grid">
              <div class="card"><div class="muted">Total Meters</div><div style="font-weight:700;font-size:16px;">${formatNumber(
                totals.meters,
              )}</div></div>
              <div class="card"><div class="muted">Revenue</div><div style="font-weight:700;font-size:16px;">${formatCurrency(
                totals.revenue,
              )}</div></div>
              <div class="card"><div class="muted">Inventory Used</div><div style="font-weight:700;font-size:16px;">${formatNumber(
                totals.inventory,
              )}</div></div>
              <div class="card"><div class="muted">Bags Created</div><div style="font-weight:700;font-size:16px;">${formatNumber(
                totals.bags,
              )}</div></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Customer</th><th>Order Type</th><th>Meters</th><th>Revenue</th><th>Bags</th><th>Inventory Used</th>
                </tr>
              </thead>
              <tbody>
                ${filtered
                  .map(
                    (r) => `<tr>
                    <td>${r.date}</td>
                    <td>${r.customer}</td>
                    <td>${r.orderType}</td>
                    <td>${formatNumber(r.meters)}</td>
                    <td>${formatCurrency(r.revenue)}</td>
                    <td>${formatNumber(r.bags)}</td>
                    <td>${formatNumber(r.inventoryUsed)}</td>
                  </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `.trim();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) {
        // Let the new window load, then trigger print
        const timer = setInterval(() => {
          try {
            if (w.document && w.document.readyState === "complete") {
              clearInterval(timer);
              w.focus();
              w.print();
            }
          } catch {
            // cross-origin or blocked; ignore
          }
        }, 200);
      }
      toast.success("PDF ready to print/save");
    } catch (e) {
      toast.error("Failed to export PDF");
    } finally {
      setExporting(null);
    }
  }

  // Simulate loading on filter changes to showcase skeleton states
  React.useEffect(() => {
    setLocalLoading(true);
    const id = setTimeout(() => setLocalLoading(false), 300);
    return () => clearTimeout(id);
  }, [startDate, endDate, debouncedCustomer, orderType]);

  return (
    <section
      className={cn(
        "w-full max-w-full bg-background",
        className,
      )}
      aria-label="Analytics Dashboard"
    >
      <div className="w-full max-w-full space-y-4">
        {/* Header + Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold tracking-tight">
              Analytics
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Insights across meters, revenue, inventory, and bags
            </p>
            {summary && (
              <div className="mt-1 text-xs text-accent-foreground bg-accent inline-flex px-2 py-0.5 rounded">
                Live summary • {summary.todayOrdersCount} orders today
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-card hover:bg-accent"
              onClick={handleExportCSV}
              disabled={exporting !== null || filtered.length === 0}
              aria-label="Export CSV"
            >
              <FileChartColumn className="size-4 mr-2" aria-hidden />
              Export CSV
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:opacity-95"
              onClick={handleExportPDF}
              disabled={exporting !== null || filtered.length === 0}
              aria-label="Export PDF"
            >
              <FileChartLine className="size-4 mr-2" aria-hidden />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Metric Cards - Live if available, else fallback to mock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {summary ? (
            <>
              <StatCard
                title="Inventory Reels"
                value={formatNumber(summary.totalInventoryReelsByBrand.reduce((s, b) => s + (Number(b.totalReels) || 0), 0))}
                subtitle={`${summary.totalInventoryReelsByBrand.length} brands`}
                icon={ChartBar}
                colorClass="text-[--chart-2]"
                loading={isSummaryLoading}
                data={[]}
              />
              <StatCard
                title="Orders Today"
                value={formatNumber(summary.todayOrdersCount)}
                subtitle={(summary.ordersByStatus || []).map((o) => `${o.status}:${o.count}`).join(" • ") || ""}
                icon={ChartLine}
                colorClass="text-[--chart-1]"
                loading={isSummaryLoading}
                data={[]}
                highlight
              />
              <StatCard
                title="Reels Picked"
                value={formatNumber(summary.reelsPickedToday)}
                subtitle="today"
                icon={ChartArea}
                colorClass="text-[--chart-3]"
                loading={isSummaryLoading}
                data={[]}
              />
              <StatCard
                title="Top Product"
                value={summary.topProductsByOrders[0] ? String(summary.topProductsByOrders[0].orderCount) : "—"}
                subtitle={summary.topProductsByOrders[0] ? `${summary.topProductsByOrders[0].brandName} — ${summary.topProductsByOrders[0].productName}` : "No orders"}
                icon={ChartPie}
                colorClass="text-[--chart-5]"
                loading={isSummaryLoading}
                data={[]}
              />
            </>
          ) : (
            <>
              {/* Fallback to existing mock-driven cards */}
              <StatCard
                title="Total Meters"
                value={formatNumber(totals.meters)}
                subtitle={`${series.length} days`}
                icon={ChartBar}
                colorClass="text-[--chart-2]"
                loading={isLoading}
                data={series.map((s) => s.meters)}
              />
              <StatCard
                title="Revenue"
                value={formatCurrency(totals.revenue)}
                subtitle={totals.revTrend ? `${Math.round(totals.revTrend * 100)}% vs prev` : "—"}
                icon={ChartLine}
                colorClass="text-[--chart-1]"
                loading={isLoading}
                data={series.map((s) => s.revenue)}
                highlight
              />
              <StatCard
                title="Inventory Used"
                value={formatNumber(totals.inventory)}
                subtitle="units"
                icon={ChartArea}
                colorClass="text-[--chart-3]"
                loading={isLoading}
                data={series.map((s) => s.inventoryUsed)}
              />
              <StatCard
                title="Bags Created"
                value={formatNumber(totals.bags)}
                subtitle="total"
                icon={ChartPie}
                colorClass="text-[--chart-5]"
                loading={isLoading}
                data={series.map((s) => s.bags)}
              />
            </>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Revenue trend"
            description="Daily revenue over time"
            icon={TrendingUp}
            colorClass="stroke-[--chart-1] fill-[color-mix(in_srgb,var(--chart-1)_16%,transparent)]"
            data={series.map((s) => ({ x: s.date, y: s.revenue }))}
            loading={isLoading}
            yFormatter={formatCurrency}
          />
          <ChartCard
            title="Meters processed"
            description="Daily meters over time"
            icon={ChartBar}
            colorClass="stroke-[--chart-2] fill-[color-mix(in_srgb,var(--chart-2)_18%,transparent)]"
            data={series.map((s) => ({ x: s.date, y: s.meters }))}
            loading={isLoading}
            yFormatter={formatNumber}
          />
        </div>

        {/* Table */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Transaction history</CardTitle>
            <CardDescription className="break-words">
              {filtered.length} records
              {debouncedCustomer ? ` • filtered by "${debouncedCustomer}"` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="relative">
              {isLoading ? (
                <div className="grid gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-10 rounded-md bg-muted animate-pulse"
                      aria-hidden
                    />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="min-w-[120px]">Date</TableHead>
                        <TableHead className="min-w-[180px]">Customer</TableHead>
                        <TableHead className="min-w-[120px]">Order Type</TableHead>
                        <TableHead className="text-right min-w-[120px]">Meters</TableHead>
                        <TableHead className="text-right min-w-[120px]">Revenue</TableHead>
                        <TableHead className="text-right min-w-[100px]">Bags</TableHead>
                        <TableHead className="text-right min-w-[160px]">Inventory Used</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <TableRow key={r.id} className="hover:bg-accent/50">
                          <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                          <TableCell className="min-w-0 max-w-[240px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="size-2.5 rounded-full bg-[--chart-4]" aria-hidden />
                              <span className="truncate">{r.customer}</span>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{r.orderType}</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(r.meters)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(r.revenue)}</TableCell>
                          <TableCell className="text-right">{formatNumber(r.bags)}</TableCell>
                          <TableCell className="text-right">{formatNumber(r.inventoryUsed)}</TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No records match the filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick insights */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Summary</CardTitle>
            <CardDescription>High-level performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SummaryItem
                label="Top customer"
                value={getTopCustomer(filtered) ?? "—"}
              />
              <SummaryItem
                label="Avg. revenue / day"
                value={
                  series.length
                    ? formatCurrency(
                        Math.round(series.reduce((a, b) => a + b.revenue, 0) / series.length),
                      )
                    : "—"
                }
              />
              <SummaryItem
                label="Avg. meters / order"
                value={
                  filtered.length
                    ? formatNumber(
                        Math.round(filtered.reduce((a, b) => a + b.meters, 0) / filtered.length),
                      )
                    : "—"
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function getTopCustomer(rows: Transaction[]) {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.customer, (map.get(r.customer) ?? 0) + r.revenue);
  let best: string | null = null;
  let max = -Infinity;
  for (const [k, v] of map.entries()) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass,
  loading,
  data,
  highlight,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  colorClass: string;
  loading?: boolean;
  data?: number[];
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "bg-card transition-shadow duration-200",
        "hover:shadow-sm",
        highlight && "ring-1 ring-[--chart-1]/25",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription className="text-xs">{subtitle}</CardDescription>
        </div>
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-md bg-accent p-2",
            colorClass,
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <div className="h-6 w-24 rounded bg-muted animate-pulse" aria-hidden />
            <div className="h-16 w-full rounded bg-muted animate-pulse" aria-hidden />
          </>
        ) : (
          <>
            <div className="text-xl font-semibold tracking-tight">{value}</div>
            <MiniSparkline data={data ?? []} className={colorClass} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MiniSparkline({
  data,
  className,
}: {
  data: number[];
  className?: string;
}) {
  const w = 300;
  const h = 56;
  const padding = 4;
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const range = Math.max(1, max - min);
  const points = data.map((y, i) => {
    const x = (i / Math.max(1, data.length - 1)) * (w - padding * 2) + padding;
    const yy = h - padding - ((y - min) / range) * (h - padding * 2);
    return [x, yy] as const;
  });
  const d = points
    .map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`))
    .join(" ");
  const area =
    points.length > 1
      ? `${d} L ${points.at(-1)?.[0]},${h - padding} L ${points[0][0]},${h - padding} Z`
      : "";
  return (
    <div className="w-full max-w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Sparkline"
        className="w-full h-14"
      >
        <path d={area} className={cn("fill-[--chart-1]/15", className)} />
        <path
          d={d}
          className={cn("stroke-[--chart-1] fill-none", className)}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function ChartCard({
  title,
  description,
  icon: Icon,
  colorClass,
  data,
  loading,
  yFormatter,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  colorClass: string;
  data: { x: string; y: number }[];
  loading?: boolean;
  yFormatter?: (n: number) => string;
}) {
  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center rounded-md bg-accent p-2 text-[--chart-1]">
            <Icon className="size-4" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
            {description ? (
              <CardDescription className="text-xs">{description}</CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="h-56 w-full rounded-md bg-muted animate-pulse" aria-hidden />
        ) : (
          <ResponsiveAreaChart data={data} colorClass={colorClass} yFormatter={yFormatter} />
        )}
      </CardContent>
    </Card>
  );
}

function ResponsiveAreaChart({
  data,
  colorClass,
  yFormatter,
}: {
  data: { x: string; y: number }[];
  colorClass: string;
  yFormatter?: (n: number) => string;
}) {
  // Basic responsive SVG area/line chart with axes
  const [containerRef, setContainerRef] = React.useState<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ w: 640, h: 260 });
  React.useEffect(() => {
    if (!containerRef) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ w: Math.max(320, cr.width), h: 260 });
      }
    });
    ro.observe(containerRef);
    return () => ro.disconnect();
  }, [containerRef]);

  const padding = { t: 12, r: 6, b: 24, l: 36 };
  const w = size.w;
  const h = size.h;
  const innerW = Math.max(1, w - padding.l - padding.r);
  const innerH = Math.max(1, h - padding.t - padding.b);

  const ys = data.map((d) => d.y);
  const max = Math.max(1, ...ys);
  const min = Math.min(0, ...ys);
  const range = Math.max(1, max - min);

  const xTickCount = Math.min(6, Math.max(2, Math.floor(innerW / 120)));
  const yTickCount = 4;

  const points = data.map((d, i) => {
    const x = padding.l + (i / Math.max(1, data.length - 1)) * innerW;
    const y = padding.t + innerH - ((d.y - min) / range) * innerH;
    return [x, y] as const;
  });

  const path =
    points.length > 0
      ? points.map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(" ")
      : "";

  const area =
    points.length > 1
      ? `${path} L ${padding.l + innerW},${padding.t + innerH} L ${padding.l},${
          padding.t + innerH
        } Z`
      : "";

  const xLabels = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1)) * (data.length - 1));
    const d = data[Math.max(0, Math.min(data.length - 1, idx))];
    return { x: points[idx]?.[0] ?? padding.l, label: d?.x ?? "" };
  });

  const yLabels = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const val = min + (i / yTickCount) * range;
    const y = padding.t + innerH - (i / yTickCount) * innerH;
    return { y, label: yFormatter ? yFormatter(val) : String(Math.round(val)) };
  });

  return (
    <div ref={setContainerRef} className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[260px]">
        {/* Grid */}
        {yLabels.map((t, i) => (
          <line
            key={`y-${i}`}
            x1={padding.l}
            y1={t.y}
            x2={padding.l + innerW}
            y2={t.y}
            stroke="var(--border)"
            strokeDasharray="3,3"
          />
        ))}
        {/* Area and line */}
        <path d={area} className={cn("fill-[--chart-1]/15", colorClass)} />
        <path
          d={path}
          className={cn("stroke-[--chart-1] fill-none", colorClass)}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* X labels */}
        {xLabels.map((t, i) => (
          <text
            key={`x-${i}`}
            x={t.x}
            y={h - 6}
            textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
            fontSize="10"
            fill="var(--muted-foreground)"
          >
            {t.label}
          </text>
        ))}
        {/* Y labels */}
        {yLabels.map((t, i) => (
          <text
            key={`yl-${i}`}
            x={8}
            y={t.y + 3}
            fontSize="10"
            fill="var(--muted-foreground)"
          >
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}