import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  Banknote,
  Box,
  Briefcase,
  Check,
  ChevronDown,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  Fingerprint,
  Info,
  Key,
  LayoutGrid,
  Loader2,
  LogOut,
  Mail,
  Menu,
  Minus,
  PenLine,
  Plus,
  PlusCircle,
  Search,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Icon name → lucide component. Names match the Material Symbols ligatures
 * we used in Pass 1 (the Material Symbols Outlined font dependency was
 * removed — it broke production first paint on Vercel because the @import
 * race-conditioned with hero render). Lucide ships per-icon SVGs that
 * tree-shake; no font load, no FOIT.
 *
 * Add new entries here when a new glyph is needed; typed lookup keeps
 * stale-name regressions visible at compile time.
 */
const ICON_MAP = {
  account_balance_wallet: Wallet,
  add: Plus,
  add_circle: PlusCircle,
  arrow_back: ArrowLeft,
  arrow_forward: ArrowRight,
  arrow_outward: ArrowUpRight,
  business_center: Briefcase,
  check: Check,
  close: X,
  content_copy: Copy,
  deployed_code: Box,
  edit_note: PenLine,
  error: AlertCircle,
  expand_more: ChevronDown,
  explore: Compass,
  fingerprint: Fingerprint,
  grid_view: LayoutGrid,
  groups: Users,
  info: Info,
  key: Key,
  logout: LogOut,
  mail: Mail,
  menu: Menu,
  open_in_new: ExternalLink,
  payments: Banknote,
  progress_activity: Loader2,
  remove: Minus,
  search: Search,
  settings: Settings,
  swap_horiz: ArrowLeftRight,
  visibility: Eye,
  workspace_premium: Award,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICON_MAP;

const SIZE_CLASSES = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-7 h-7",
} as const;

export function Icon({
  name,
  size = "md",
  className,
  filled,
}: {
  name: IconName;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  /** No-op kept for source-compat with the legacy `material-symbols-outlined.filled` class. Lucide outlines look correct without a fill variant. */
  filled?: boolean;
}) {
  void filled;
  const Component = ICON_MAP[name];
  return (
    <Component
      className={cn(SIZE_CLASSES[size], "shrink-0", className)}
      strokeWidth={2.25}
      aria-hidden
    />
  );
}
