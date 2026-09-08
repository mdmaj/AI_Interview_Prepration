import apiRequest from "@/lib/api";
import type { InterviewKit } from "@/types/kit";

export interface GetMyKitsResponse {
  kits: InterviewKit[];
}

export interface GetKitResponse {
  kit: InterviewKit;
}

export interface CreateKitData {
  company: string;
  company_url: string;
  role: string;
  jd: string;
  days_available: number;
}

export interface CreateKitResponse {
  kit: InterviewKit;
}

export async function getMyKits(token: string): Promise<GetMyKitsResponse> {
  return apiRequest<GetMyKitsResponse>("/kits", {
    method: "GET",
    token,
  });
}

export async function getKit(
  id: string,
  token: string,
): Promise<GetKitResponse> {
  return apiRequest<GetKitResponse>(`/kits/${id}`, {
    method: "GET",
    token,
  });
}

export async function createKit(
  data: CreateKitData,
  token: string,
): Promise<CreateKitResponse> {
  return apiRequest<CreateKitResponse>("/kits", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateKit(
  id: string,
  data: Partial<InterviewKit>,
  token: string,
): Promise<GetKitResponse> {
  return apiRequest<GetKitResponse>(`/kits/${id}`, {
    method: "PUT",
    token,
    body: data,
  });
}

export async function deleteKit(id: string, token: string): Promise<void> {
  await apiRequest(`/kits/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function startKitGeneration(
  id: string,
  token: string,
): Promise<GetKitResponse> {
  return apiRequest<GetKitResponse>(
    `/kits/${id}/generate`,
    {
      method: "POST",
      token,
    },
  );
}