const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export interface AdminFetchResult<T> {
  data: T | null;
  error: string | null;
}

export async function fetchAdmin(path: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Admin API ${path} failed: ${res.status} ${body}`);
  }

  return res.json();
}

export async function fetchAdminSafe<T>(path: string): Promise<AdminFetchResult<T>> {
  try {
    const data = (await fetchAdmin(path)) as T;
    return { data, error: null };
  } catch (error: any) {
    const message = error?.message || "Unknown error while fetching admin data";
    return { data: null, error: message };
  }
}

export const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatAmount = (value: number) =>
  value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
