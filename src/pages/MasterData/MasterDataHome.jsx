import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../firebaseClient";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { usePermissions } from "../../hooks/usePermissions";
import {
  Database,
  Building2,
  Globe,
  Layers,
  ClipboardList,
  GitMerge,
  Shield,
  ArrowRight,
  CheckCircle2,
  Package,
  Lock,
  Sparkles,
} from "lucide-react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function StatPill({ label, value, loading }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
        {loading ? "…" : value}
      </span>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</div>
        {subtitle ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</div>
        ) : null}
      </div>
      <div className="p-4 flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}

function Badge({ tone = "success", children }) {
  const cls =
    tone === "success"
      ? "bg-green-50 text-green-700 dark:bg-green-900/25 dark:text-green-200 border-green-200 dark:border-green-800"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-200 border-amber-200 dark:border-amber-800"
      : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700";

  return (
    <span className={classNames("text-[11px] px-2 py-0.5 rounded-full border shrink-0", cls)}>
      {children}
    </span>
  );
}

function RowItem({ title, desc, to, icon, status = "ready", disabled }) {
  const isComingSoon = status === "coming";
  const isDisabled = disabled || isComingSoon;

  const card = (
    <div
      className={classNames(
        "group w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900",
        "px-4 py-3 transition",
        isDisabled
          ? "opacity-65 cursor-not-allowed"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
            {icon}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {title}
              </div>
              {isComingSoon ? (
                <Badge tone="default">Coming soon</Badge>
              ) : (
                <Badge tone="success">Ready</Badge>
              )}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
              {desc}
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {isDisabled ? (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500">
              <Lock className="w-4 h-4" />
              Locked
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-gray-900 dark:text-gray-100">
              <span className="group-hover:underline">Open</span>
              <ArrowRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isDisabled) return card;

  return (
    <Link to={to} className="block">
      {card}
    </Link>
  );
}

/** Placeholder row to keep 4-slot fixed height */
function PlaceholderRow() {
  return (
    <div className="w-full rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/40 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-400 dark:text-gray-500">
              —
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
              Add more modules anytime
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold text-gray-300 dark:text-gray-600">
          —
        </div>
      </div>
    </div>
  );
}

function paginate(items, perPage) {
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function Dots({ totalPages, pageIndex, onChange }) {
  if (totalPages <= 1) return <div className="h-6" />;

  return (
    <div className="flex items-center justify-center gap-2 pt-3 select-none">
      {Array.from({ length: totalPages }).map((_, i) => {
        const active = i === pageIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={classNames(
              "px-1 leading-none",
              active
                ? "text-gray-900 dark:text-gray-100 font-extrabold"
                : "text-gray-400 dark:text-gray-500 font-semibold hover:text-gray-700 dark:hover:text-gray-300"
            )}
            aria-label={`Go to page ${i + 1}`}
            title={`Page ${i + 1}`}
          >
            .
          </button>
        );
      })}
    </div>
  );
}

/**
 * Adds mouse drag (swipe) support for paging.
 * - drag left -> next page
 * - drag right -> prev page
 */
function useSwipePaging({ pageIndex, setPageIndex, totalPages, thresholdPx = 60 }) {
  const ref = useRef(null);
  const state = useRef({
    down: false,
    startX: 0,
    lastX: 0,
    dragging: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPointerDown = (e) => {
      // only primary button for mouse
      if (e.pointerType === "mouse" && e.button !== 0) return;

      state.current.down = true;
      state.current.dragging = false;
      state.current.startX = e.clientX;
      state.current.lastX = e.clientX;

      // capture pointer to keep receiving move events
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerMove = (e) => {
      if (!state.current.down) return;
      state.current.lastX = e.clientX;
      const dx = state.current.lastX - state.current.startX;
      if (Math.abs(dx) > 6) state.current.dragging = true;
    };

    const onPointerUp = (e) => {
      if (!state.current.down) return;
      state.current.down = false;

      const dx = state.current.lastX - state.current.startX;

      if (state.current.dragging && Math.abs(dx) >= thresholdPx && totalPages > 1) {
        if (dx < 0) {
          // next
          setPageIndex((p) => clamp(p + 1, 0, totalPages - 1));
        } else {
          // prev
          setPageIndex((p) => clamp(p - 1, 0, totalPages - 1));
        }
      }

      state.current.dragging = false;

      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    };

    // wheel horizontal / trackpad swipe (shift+wheel or touchpad)
    const onWheel = (e) => {
      if (totalPages <= 1) return;

      // if user scrolls horizontally, treat as swipe
      const x = Math.abs(e.deltaX);
      const y = Math.abs(e.deltaY);

      if (x > y && x > 20) {
        e.preventDefault();
        if (e.deltaX > 0) setPageIndex((p) => clamp(p + 1, 0, totalPages - 1));
        else setPageIndex((p) => clamp(p - 1, 0, totalPages - 1));
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [setPageIndex, totalPages, thresholdPx]);

  return ref;
}

export default function MasterDataHome() {
  const { can, role } = usePermissions({
    defaultRole: "viewer",
    roleCollection: "roles",
    roleField: "role",
    rolePermissionsCollection: "rolePermissions",
  });

  const canViewMaster = can("masterData.view") || can("masterData.*");

  const [loadingCounts, setLoadingCounts] = useState(true);
  const [distCount, setDistCount] = useState(0);
  const [activeDistCount, setActiveDistCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoadingCounts(true);

        const totalSnap = await getCountFromServer(collection(db, "master_distributors"));
        const total = totalSnap.data().count || 0;

        const activeQ = query(collection(db, "master_distributors"), where("active", "==", true));
        const activeSnap = await getCountFromServer(activeQ);
        const active = activeSnap.data().count || 0;

        if (!alive) return;
        setDistCount(total);
        setActiveDistCount(active);
      } catch {
        // ignore
      } finally {
        if (alive) setLoadingCounts(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  // ===== Items =====
  const mainDataItems = useMemo(
    () => [
      {
        key: "distributors",
        title: "Distributors",
        desc: "Distributor code & name used for autosuggest and validations.",
        to: "/master-data/distributors",
        icon: <Building2 className="w-5 h-5 text-gray-900 dark:text-gray-100" />,
        status: "ready",
      },
      {
        key: "countries",
        title: "Countries",
        desc: "Country list for forms and reporting filters.",
        to: "/master-data/countries",
        icon: <Globe className="w-5 h-5 text-gray-900 dark:text-gray-100" />,
        status: "ready",
      },
      {
        key: "business",
        title: "Business Types",
        desc: "Maintain allowed business types (HPC / IC).",
        to: "/master-data/business",
        icon: <Layers className="w-5 h-5 text-gray-900 dark:text-gray-100" />,
        status: "ready",
      },
      {
        key: "report-types",
        title: "Report Types",
        desc: "Maintain report type master list used in mapping & manual entry.",
        to: "/master-data/report-types",
        icon: <ClipboardList className="w-5 h-5 text-gray-900 dark:text-gray-100" />,
        status: "ready",
      },
      // next page
      {
        key: "sku",
        title: "SKU",
        desc: "SKU master list for product validations and reporting.",
        to: "/master-data/sku",
        icon: <Package className="w-5 h-5 text-gray-900 dark:text-gray-100" />,
        status: "coming",
        disabled: true,
      },
    ],
    []
  );

  const mappingItems = useMemo(
    () => [
      {
        key: "map-report-business",
        title: "Business Type → Report Type Mapping",
        desc: "Control which report types are available under each business type.",
        to: "/master-data/map-report-business",
        icon: <GitMerge className="w-5 h-5 text-gray-900 dark:text-gray-100" />,
        status: "ready",
      },
      // Add more mapping modules here; empty slots will fill placeholders.
    ],
    []
  );

  const PER_PAGE = 4;

  const mainPages = useMemo(() => paginate(mainDataItems, PER_PAGE), [mainDataItems]);
  const mappingPages = useMemo(() => paginate(mappingItems, PER_PAGE), [mappingItems]);

  const [mainPageIndex, setMainPageIndex] = useState(0);
  const [mappingPageIndex, setMappingPageIndex] = useState(0);

  useEffect(() => {
    if (mainPageIndex > mainPages.length - 1) setMainPageIndex(Math.max(0, mainPages.length - 1));
  }, [mainPages.length, mainPageIndex]);

  useEffect(() => {
    if (mappingPageIndex > mappingPages.length - 1)
      setMappingPageIndex(Math.max(0, mappingPages.length - 1));
  }, [mappingPages.length, mappingPageIndex]);

  const mainCurrent = mainPages[mainPageIndex] || [];
  const mappingCurrent = mappingPages[mappingPageIndex] || [];

  // Fill up to 4 fixed slots
  const mainSlotRows = useMemo(() => {
    const rows = [...mainCurrent];
    while (rows.length < PER_PAGE) rows.push(null);
    return rows;
  }, [mainCurrent]);

  const mappingSlotRows = useMemo(() => {
    const rows = [...mappingCurrent];
    while (rows.length < PER_PAGE) rows.push(null);
    return rows;
  }, [mappingCurrent]);

  // Swipe refs
  const mainSwipeRef = useSwipePaging({
    pageIndex: mainPageIndex,
    setPageIndex: setMainPageIndex,
    totalPages: mainPages.length,
    thresholdPx: 60,
  });

  const mappingSwipeRef = useSwipePaging({
    pageIndex: mappingPageIndex,
    setPageIndex: setMappingPageIndex,
    totalPages: mappingPages.length,
    thresholdPx: 60,
  });

  if (!canViewMaster) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Shield className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </div>
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Access restricted
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                You don’t have permission to view Master Data.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Adjust to your layout to avoid scroll
  const TOP_OFFSET = 140;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-gray-900 dark:text-gray-100" />
            </div>

            <div className="min-w-0">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Master Data
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Reference lists and mappings used across MDM Tools.
              </div>

              <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-2.5 py-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Role: <span className="font-semibold">{role || "-"}</span>
                </span>
                <span className="text-gray-500 dark:text-gray-400 hidden md:inline">
                  Tip: drag left/right inside a panel to switch pages.
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <StatPill label="Total DT" value={distCount} loading={loadingCounts} />
            <StatPill label="Active DT" value={activeDistCount} loading={loadingCounts} />
          </div>
        </div>
      </div>

      {/* Two panels same size */}
      <div
        className={classNames(
          "grid grid-cols-1 lg:grid-cols-2 gap-6",
          `h-[calc(100vh-${TOP_OFFSET}px)]`,
          "overflow-hidden"
        )}
      >
        {/* LEFT */}
        <div className="h-full min-h-0">
          <Panel title="Reference Data" subtitle="Maintain master lists (single-source-of-truth).">
            <div className="flex-1 min-h-0 flex flex-col justify-between">
              {/* Swipe area */}
              <div
                ref={mainSwipeRef}
                className={classNames(
                  "space-y-3",
                  "select-none",
                  "touch-pan-y", // allow vertical panning; we handle horizontal swipe
                  "cursor-grab active:cursor-grabbing"
                )}
                role="region"
                aria-label="Reference Data pages"
              >
                {mainSlotRows.map((it, idx) =>
                  it ? (
                    <RowItem
                      key={it.key}
                      title={it.title}
                      desc={it.desc}
                      to={it.to}
                      icon={it.icon}
                      status={it.status}
                      disabled={it.disabled}
                    />
                  ) : (
                    <PlaceholderRow key={`main-ph-${idx}`} />
                  )
                )}
              </div>

              <Dots
                totalPages={mainPages.length}
                pageIndex={mainPageIndex}
                onChange={setMainPageIndex}
              />
            </div>
          </Panel>
        </div>

        {/* RIGHT */}
        <div className="h-full min-h-0">
          <Panel title="Mappings & Rules" subtitle="Configure relationships and logic between master lists.">
            <div className="flex-1 min-h-0 flex flex-col justify-between">
              {/* Swipe area */}
              <div
                ref={mappingSwipeRef}
                className={classNames(
                  "space-y-3",
                  "select-none",
                  "touch-pan-y",
                  "cursor-grab active:cursor-grabbing"
                )}
                role="region"
                aria-label="Mappings pages"
              >
                {mappingSlotRows.map((it, idx) =>
                  it ? (
                    <RowItem
                      key={it.key}
                      title={it.title}
                      desc={it.desc}
                      to={it.to}
                      icon={it.icon}
                      status={it.status}
                      disabled={it.disabled}
                    />
                  ) : (
                    <PlaceholderRow key={`map-ph-${idx}`} />
                  )
                )}
              </div>

              <Dots
                totalPages={mappingPages.length}
                pageIndex={mappingPageIndex}
                onChange={setMappingPageIndex}
              />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}