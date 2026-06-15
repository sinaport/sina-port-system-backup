import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
    const n = typeof amount === "string" ? parseFloat(amount) : amount;
    if (n === null || n === undefined || isNaN(n as number)) return "-";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n as number);
}

export function formatNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return "-";
    const n = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(n)) return String(value);
    return new Intl.NumberFormat("en-US").format(n);
}

export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return "-";
    try {
        return new Date(iso).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

export type KpiFlag = "green" | "red" | "orange" | "pale" | "blue";

export function flagClass(flag: KpiFlag): string {
    return `kpi-flag-${flag} px-2 py-0.5 rounded text-xs font-semibold`;
}
