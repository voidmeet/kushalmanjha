"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PanelLeft,
  LayoutDashboard,
  PanelsLeftBottom,
  PanelTop,
  LayoutTemplate,
} from "lucide-react";

type ModuleKey = "inventory" | "orders" | "bags" | "analytics";

interface NavItem {
  key: ModuleKey;
  label: string;
  icon?: React.ReactNode;
}

interface DashboardLayoutProps {
  className?: string;
  style?: React.CSSProperties;
  items?: NavItem[];
  activeKey?: ModuleKey;
  onNavigate?: (key: ModuleKey) => void;
  onLogout?: () => void;
  children?: React.ReactNode;
  initialCollapsed?: boolean;
}

export default function DashboardLayout({
  className,
  style,
  items,
  activeKey,
  onNavigate,
  onLogout,
  children,
  initialCollapsed = false,
}: DashboardLayoutProps) {
  const [now, setNow] = React.useState<Date>(() => new Date());
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(!initialCollapsed);

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const defaultItems: NavItem[] = [
    {
      key: "inventory",
      label: "Inventory",
      icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "orders",
      label: "Orders",
      icon: <PanelsLeftBottom className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "bags",
      label: "Daily Bags",
      icon: <PanelTop className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "analytics",
      label: "Analytics",
      icon: <LayoutTemplate className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  // If custom items are passed without icons, enrich them with sensible defaults
  const iconMap: Record<ModuleKey, React.ReactNode> = {
    inventory: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
    orders: <PanelsLeftBottom className="h-4 w-4" aria-hidden="true" />,
    bags: <PanelTop className="h-4 w-4" aria-hidden="true" />,
    analytics: <LayoutTemplate className="h-4 w-4" aria-hidden="true" />,
  };

  const navItems = (items && items.length ? items : defaultItems).map((it) => ({
    ...it,
    icon: it.icon ?? iconMap[it.key],
  }));

  const handleNavigate = (key: ModuleKey) => {
    if (onNavigate) onNavigate(key);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    toast.success("Logged out");
  };

  const dateFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    []
  );

  return (
    <div
      style={style}
      className={cn(
        "w-full max-w-full bg-background text-foreground",
        "grid",
        "grid-cols-1",
        "min-h-[60vh]",
        className
      )}
    >
      {/* Header */}
      <header
        className={cn(
          "w-full",
          "bg-card",
          "border-b border-[var(--border)]",
          "sticky top-0 z-40",
          "supports-[backdrop-filter]:bg-card/80 backdrop-blur"
        )}
        role="banner"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Toggle sidebar"
            className={cn(
              "md:hidden",
              "rounded-md",
              "hover:bg-[var(--muted)]",
              "active:scale-[0.98] transition"
            )}
            onClick={() => setSidebarOpen((s) => !s)}
          >
            <PanelLeft className="h-5 w-5" aria-hidden="true" />
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "h-8 w-8 rounded-lg",
                "bg-[var(--color-brand-soft)]",
                "flex items-center justify-center",
                "text-[var(--color-brand)]",
                "ring-1 ring-[var(--border)]"
              )}
              aria-hidden="true"
            >
              <span className="text-xs font-bold">KM</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-none truncate">
                Kushal Patent Manja
              </p>
              <p className="text-xs text-muted-foreground leading-tight truncate">
                Operations Dashboard
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <time
              dateTime={now.toISOString()}
              aria-label="Current date and time"
              className={cn(
                "hidden sm:inline-block",
                "text-sm font-medium",
                "text-muted-foreground",
                "px-2 py-1 rounded-md",
                "bg-[var(--muted)]"
              )}
            >
              {dateFormatter.format(now)}
            </time>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "border-[var(--border)]",
                "bg-card hover:bg-[var(--muted)]"
              )}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="relative w-full max-w-full">
        <div className="mx-auto flex">
          {/* Sidebar - mobile drawer */}
          <aside
            className={cn(
              "md:hidden",
              "fixed z-50 inset-y-0 left-0",
              "w-[82%] max-w-xs",
              "transition-transform duration-200",
              sidebarOpen ? "translate-x-0" : "-translate-x-full",
              "bg-[var(--sidebar-background)]",
              "border-r border-[var(--sidebar-border)]",
              "shadow-lg"
            )}
            aria-label="Sidebar"
          >
            <SidebarContent
              items={navItems}
              activeKey={activeKey}
              onNavigate={(key) => {
                handleNavigate(key);
                setSidebarOpen(false);
              }}
            />
          </aside>

          {/* Overlay for mobile sidebar */}
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "md:hidden",
              "fixed inset-0 z-40",
              sidebarOpen ? "block bg-black/20 backdrop-blur-[1px]" : "hidden"
            )}
          />

          {/* Sidebar - desktop */}
          <aside
            className={cn(
              "hidden md:flex",
              "sticky top-[var(--header-height,0px)]",
              "h-[calc(100dvh-0px)]",
              "shrink-0",
              "w-64",
              "bg-[var(--sidebar-background)]",
              "border-r border-[var(--sidebar-border)]"
            )}
            aria-label="Sidebar"
          >
            <SidebarContent
              items={navItems}
              activeKey={activeKey}
              onNavigate={handleNavigate}
            />
          </aside>

          {/* Main content */}
          <main
            className={cn(
              "min-w-0 flex-1",
              "px-4 md:px-6",
              "py-4 md:py-6",
              "bg-background"
            )}
            role="main"
          >
            <div
              className={cn(
                "w-full max-w-full",
                "bg-card",
                "rounded-xl",
                "border border-[var(--border)]",
                "shadow-sm"
              )}
            >
              <div className="p-4 md:p-6">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  items,
  activeKey,
  onNavigate,
}: {
  items: NavItem[];
  activeKey?: ModuleKey;
  onNavigate: (key: ModuleKey) => void;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-4 pb-2 pt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          Navigation
        </p>
      </div>
      <nav
        className="flex-1 overflow-y-auto px-2 pb-6"
        role="navigation"
        aria-label="Primary"
      >
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <li key={item.key} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  className={cn(
                    "group w-full",
                    "flex items-center gap-3",
                    "px-3 py-2.5",
                    "rounded-lg",
                    "text-sm font-medium",
                    "transition-colors",
                    isActive
                      ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)] ring-1 ring-[var(--sidebar-ring)]/20"
                      : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      isActive
                        ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
                        : "bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)] group-hover:bg-[var(--sidebar-primary)]/10"
                    )}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto px-4 py-4 border-t border-[var(--sidebar-border)]">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Kushal Patent Manja
        </p>
      </div>
    </div>
  );
}