export interface HeaderMapping {
  header: string;
  column: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'DATETIME';
}

export interface Version {
  id: number;
  project_id: number;
  version_number: number;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  headers: HeaderMapping[];
  activeVersion: number | null;
  created_at: string;
  versions?: Version[];
}

export interface ProjectDetail extends Project {
  versions: Version[];
}

export interface DataMeta {
  headers: HeaderMapping[];
  total: number;
  activeVersion: number | null;
}

export interface DataResponse {
  rows: Record<string, unknown>[];
  total: number;
  offset: number;
  limit: number;
}

export interface Config {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
}

export interface ExecutionMeta {
  status: 'pending' | 'ok' | 'error';
  rowCount?: number;
  durationMs?: number;
  error?: string;
}
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string | null;
  sql: string | null;
  execution: ExecutionMeta | null;
  created_at: string;
  /** Result rows from the just-executed query (not persisted in history). */
  result?: { columns: string[]; rows: Record<string, unknown>[] } | null;
}

export interface ChatResponse {
  assistantText: string;
  sql: string | null;
  execution: ExecutionMeta;
  result: { columns: string[]; rows: Record<string, unknown>[] } | null;
  sessionId: number;
}

export interface ChatSession {
  id: number;
  created_at: string;
  message_count: number;
}

export interface UploadVersionResponse {
  version: Version;
  headersMatch: boolean;
  activeVersion: number | null;
  requiresActivation: boolean;
}
