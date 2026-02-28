export interface ReqallConfig {
  apiKey?: string;
  url: string;
  projectName?: string;
  contextLimit: number;
  recencyHours: number;
}

export function loadConfig(): ReqallConfig {
  return {
    apiKey: process.env.REQALL_API_KEY || undefined,
    url: process.env.REQALL_URL || 'https://reqall.net',
    projectName: process.env.REQALL_PROJECT_NAME || undefined,
    contextLimit: parseInt(process.env.REQALL_CONTEXT_LIMIT || '', 10) || 5,
    recencyHours: parseInt(process.env.REQALL_RECENCY_HOURS || '', 10) || 1,
  };
}
