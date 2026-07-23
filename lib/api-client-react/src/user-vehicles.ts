import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  QueryKey, UseQueryOptions,
  UseMutationOptions,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ── Types ─────────────────────────────────────────────────────────────────
export type UserVehicleCatalog = {
  id: number;
  name: string;
  connector_type: "CCS2" | "CHAdeMO" | "Type2" | "GB-T";
  battery_kwh: number;
  range_km: number;
  make: string | null;
  model: string | null;
  year: number | null;
  body_style: string | null;
  vehicle_type: string | null;
  data_source: string;
  is_verified: boolean;
};

export type UserVehicle = {
  id: number;
  user_id: string;
  vehicle_id: number;
  nickname: string | null;
  current_battery_pct: number | null;
  is_default: boolean;
  created_at: string;
  vehicle: UserVehicleCatalog | null;
};

export type CreateUserVehicleInput = {
  user_id: string;
  vehicle_id?: number;          // link to existing catalog vehicle
  // OR supply vehicle data for find-or-create:
  name?: string;
  connector_type?: "CCS2" | "CHAdeMO" | "Type2" | "GB-T";
  battery_kwh?: number;
  range_km?: number;
  make?: string;
  model?: string;
  year?: number;
  body_style?: string;
  vehicle_type?: string;
  nickname?: string;
  is_default?: boolean;
};

export type PatchUserVehicleInput = {
  nickname?: string | null;
  current_battery_pct?: number | null;
  is_default?: boolean;
};

// ── Query key ─────────────────────────────────────────────────────────────
export const getGetUserVehiclesQueryKey = (userId: string): QueryKey =>
  ["getUserVehicles", userId] as const;

// ── Fetch functions ───────────────────────────────────────────────────────
const getUserVehicles = (userId: string, options?: RequestInit): Promise<UserVehicle[]> =>
  customFetch<UserVehicle[]>(`/api/user-vehicles?user_id=${encodeURIComponent(userId)}`, options);

const createUserVehicle = (data: CreateUserVehicleInput, options?: RequestInit): Promise<UserVehicle> =>
  customFetch<UserVehicle>("/api/user-vehicles", {
    method: "POST", body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" }, ...options,
  });

const patchUserVehicle = (id: number, data: PatchUserVehicleInput, options?: RequestInit): Promise<UserVehicle> =>
  customFetch<UserVehicle>(`/api/user-vehicles/${id}`, {
    method: "PATCH", body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" }, ...options,
  });

const deleteUserVehicle = (id: number, options?: RequestInit): Promise<void> =>
  customFetch<void>(`/api/user-vehicles/${id}`, { method: "DELETE", ...options });

// ── Hooks ─────────────────────────────────────────────────────────────────
export function useGetUserVehicles(
  userId: string,
  options?: { query?: Omit<UseQueryOptions<UserVehicle[], unknown, UserVehicle[], QueryKey>, "queryKey" | "queryFn"> }
) {
  return useQuery<UserVehicle[], unknown, UserVehicle[]>({
    queryKey: getGetUserVehiclesQueryKey(userId),
    queryFn: ({ signal }) => getUserVehicles(userId, { signal }),
    enabled: !!userId,
    ...options?.query,
  });
}

export function useCreateUserVehicle<TError = unknown, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<UserVehicle, TError, CreateUserVehicleInput, TContext> }
) {
  return useMutation<UserVehicle, TError, CreateUserVehicleInput, TContext>({
    mutationFn: (data) => createUserVehicle(data),
    ...options?.mutation,
  });
}

export function usePatchUserVehicle<TError = unknown, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<UserVehicle, TError, { id: number; data: PatchUserVehicleInput }, TContext> }
) {
  return useMutation<UserVehicle, TError, { id: number; data: PatchUserVehicleInput }, TContext>({
    mutationFn: ({ id, data }) => patchUserVehicle(id, data),
    ...options?.mutation,
  });
}

export function useDeleteUserVehicle<TError = unknown, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<void, TError, { id: number }, TContext> }
) {
  return useMutation<void, TError, { id: number }, TContext>({
    mutationFn: ({ id }) => deleteUserVehicle(id),
    ...options?.mutation,
  });
}
