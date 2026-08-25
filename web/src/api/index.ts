import axios, { type AxiosInstance } from 'axios';
import type {
  Project,
  ProjectDetail,
  DataMeta,
  DataResponse,
  Config,
  ChatMessage,
  ChatResponse,
  ChatSession,
  UploadVersionResponse,
} from './types';

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

function configToken(): string | null {
  return sessionStorage.getItem('configToken');
}

function authHeaders(): Record<string, string> {
  const token = configToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (err.message) return err.message;
  }
  return fallback;
}

// ---- Projects ----
export async function getProjects(): Promise<Project[]> {
  const { data } = await http.get<Project[]>('/projects');
  return data;
}

export async function createProject(body: { name: string; description: string }): Promise<Project> {
  const { data } = await http.post<Project>('/projects', body);
  return data;
}

export async function getProject(id: number): Promise<ProjectDetail> {
  const { data } = await http.get<ProjectDetail>(`/projects/${id}`);
  return data;
}

export async function updateProject(
  id: number,
  body: { name: string; description: string },
): Promise<Project> {
  const { data } = await http.patch<Project>(`/projects/${id}`, body);
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await http.delete(`/projects/${id}`);
}

// ---- Versions ----
export async function uploadVersion(
  projectId: number,
  file: File,
): Promise<UploadVersionResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<UploadVersionResponse>(
    `/projects/${projectId}/versions`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function activateVersion(projectId: number, versionId: number): Promise<Project> {
  const { data } = await http.post<Project>(
    `/projects/${projectId}/versions/${versionId}/activate`,
  );
  return data;
}

export async function deleteVersion(projectId: number, versionId: number): Promise<void> {
  await http.delete(`/projects/${projectId}/versions/${versionId}`);
}

// ---- Data ----
export async function getDataMeta(projectId: number): Promise<DataMeta> {
  const { data } = await http.get<DataMeta>(`/projects/${projectId}/data/meta`);
  return data;
}

export async function getData(
  projectId: number,
  params: {
    sort?: string;
    order?: 'asc' | 'desc';
    filters?: Record<string, string>;
    offset?: number;
    limit?: number;
  },
): Promise<DataResponse> {
  const { data } = await http.get<DataResponse>(`/projects/${projectId}/data`, {
    params: {
      sort: params.sort || undefined,
      order: params.order || undefined,
      filters: params.filters && Object.keys(params.filters).length
        ? JSON.stringify(params.filters)
        : undefined,
      offset: params.offset,
      limit: params.limit,
    },
  });
  return data;
}

export async function downloadData(projectId: number): Promise<void> {
  const response = await http.get<Blob>(`/projects/${projectId}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition ? /filename="?([^"]+)"?/.exec(disposition) : null;
  link.href = url;
  link.download = match ? match[1] : `project-${projectId}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ---- Config ----
export async function verifyConfigPassword(password: string): Promise<{ token: string }> {
  const { data } = await http.post<{ token: string }>('/config/verify', { password });
  return data;
}

export async function getConfig(): Promise<Config> {
  const { data } = await http.get<Config>('/config', { headers: authHeaders() });
  return data;
}

export async function updateConfig(body: {
  baseUrl: string;
  apiKey?: string;
  model: string;
}): Promise<Config> {
  const { data } = await http.put<Config>('/config', body, { headers: authHeaders() });
  return data;
}

// ---- Chat ----
export async function postChatMessage(
  projectId: number,
  message: string,
  sessionId?: number | null,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const { data } = await http.post<ChatResponse>(
    `/projects/${projectId}/chat`,
    {
      message,
      sessionId: sessionId ?? null,
    },
    { signal },
  );
  return data;
}

export async function getChatHistory(projectId: number): Promise<ChatMessage[]> {
  const { data } = await http.get<ChatMessage[]>(`/projects/${projectId}/chat`);
  return data;
}

export async function createChatSession(projectId: number): Promise<ChatSession> {
  const { data } = await http.post<ChatSession>(`/projects/${projectId}/chat/sessions`);
  return data;
}

export async function getChatSessions(projectId: number): Promise<ChatSession[]> {
  const { data } = await http.get<ChatSession[]>(`/projects/${projectId}/chat/sessions`);
  return data;
}

export async function getChatSessionMessages(
  projectId: number,
  sessionId: number,
): Promise<ChatMessage[]> {
  const { data } = await http.get<ChatMessage[]>(
    `/projects/${projectId}/chat/sessions/${sessionId}`,
  );
  return data;
}

export async function deleteChatSession(projectId: number, sessionId: number): Promise<void> {
  await http.delete(`/projects/${projectId}/chat/sessions/${sessionId}`);
}

export { errMessage };
