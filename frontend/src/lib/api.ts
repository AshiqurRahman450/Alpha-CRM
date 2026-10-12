const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('alpha_crm_token');
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('alpha_crm_token', token);
  }
}

export function removeAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('alpha_crm_token');
    localStorage.removeItem('alpha_crm_user');
  }
}

export function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('alpha_crm_user');
  return userStr ? JSON.parse(userStr) : null;
}

export function setStoredUser(user: any): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('alpha_crm_user', JSON.stringify(user));
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  uploadCustomerDocument: async (customerId: string, file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('document', file);
    const res = await fetch(`${API_BASE_URL}/api/customers/${customerId}/documents`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Upload failed');
    return data;
  },
  deleteCustomerDocument: async (customerId: string, docId: string) => {
    return fetchWithAuth(`/api/customers/${customerId}/documents/${docId}`, {
      method: 'DELETE',
    });
  },
  // Auth
  login: async (credentials: { email: string; password: string }) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    if (data.token) {
      setAuthToken(data.token);
      setStoredUser(data.user);
    }
    return data;
  },
  getCurrentUser: () => fetchWithAuth('/api/auth/me'),
  getBDMs: () => fetchWithAuth('/api/auth/bdms'),

  // Dashboard
  getDashboard: () => fetchWithAuth('/api/dashboard'),

  // Customers
  getCustomers: (params?: { search?: string; optIn?: string; customerType?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.optIn) q.append('optIn', params.optIn);
    if (params?.customerType) q.append('customerType', params.customerType);
    return fetchWithAuth(`/api/customers?${q.toString()}`);
  },
  getCustomerById: (id: string) => fetchWithAuth(`/api/customers/${id}`),
  createCustomer: (data: any) =>
    fetchWithAuth('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: any) =>
    fetchWithAuth(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  assignBDM: (id: string, bdmId: string | null) =>
    fetchWithAuth(`/api/customers/${id}/assign-bdm`, { method: 'PATCH', body: JSON.stringify({ bdmId }) }),
  toggleCustomerOptIn: (id: string, whatsappOptIn: boolean, optInSource?: string) =>
    fetchWithAuth(`/api/customers/${id}/opt-in`, {
      method: 'PATCH',
      body: JSON.stringify({ whatsappOptIn, optInSource }),
    }),

  // Projects
  getProjects: (params?: { status?: string; paymentStatus?: string; search?: string; updateDue?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.paymentStatus) q.append('paymentStatus', params.paymentStatus);
    if (params?.search) q.append('search', params.search);
    if (params?.updateDue) q.append('updateDue', params.updateDue);
    return fetchWithAuth(`/api/projects?${q.toString()}`);
  },
  getProjectById: (id: string) => fetchWithAuth(`/api/projects/${id}`),
  createProject: (data: any) =>
    fetchWithAuth('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: any) =>
    fetchWithAuth(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateProjectStatus: (id: string, status: string, notes?: string) =>
    fetchWithAuth(`/api/projects/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }),
  updateProjectStageDates: (id: string, stageKey: string, scheduleDate?: string | null, executedDate?: string | null) =>
    fetchWithAuth(`/api/projects/${id}/stage-dates`, {
      method: 'PATCH',
      body: JSON.stringify({ stageKey, scheduleDate, executedDate }),
    }),
  updateProjectStageDatesBulk: (id: string, updates: { stageKey: string, scheduleDate?: string | null, executedDate?: string | null }[]) =>
    fetchWithAuth(`/api/projects/${id}/stage-dates-bulk`, {
      method: 'PATCH',
      body: JSON.stringify({ updates }),
    }),
  uploadProjectDrawing: async (id: string, file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('drawing', file);
    const res = await fetch(`${API_BASE_URL}/api/projects/${id}/drawing`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Upload failed');
    return data;
  },
  addProjectNote: (id: string, note: string) =>
    fetchWithAuth(`/api/projects/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),

  // Payments
  getPayments: (projectId?: string) =>
    fetchWithAuth(`/api/payments${projectId ? `?projectId=${projectId}` : ''}`),
  getPaymentById: (id: string) =>
    fetchWithAuth(`/api/payments/${id}`),
  recordPayment: (data: any) =>
    fetchWithAuth('/api/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id: string, data: any) =>
    fetchWithAuth(`/api/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (id: string) =>
    fetchWithAuth(`/api/payments/${id}`, { method: 'DELETE' }),

  // WhatsApp Controls
  getChannels: () => fetchWithAuth('/api/whatsapp/channels'),
  linkWhatsAppGroup: (data: { projectId: string; whatsappGroupId: string; groupName?: string }) =>
    fetchWithAuth('/api/whatsapp/link', { method: 'POST', body: JSON.stringify(data) }),
  sendWhatsAppUpdate: (data: { projectId: string; templateNameOverride?: string; customNote?: string }) =>
    fetchWithAuth('/api/whatsapp/send', { method: 'POST', body: JSON.stringify(data) }),
  postponeWhatsAppUpdate: (data: { projectId: string; postponeDays: number; reason?: string }) =>
    fetchWithAuth('/api/whatsapp/postpone', { method: 'POST', body: JSON.stringify(data) }),
  pauseWhatsAppAutomation: (data: { projectId: string; reason?: string }) =>
    fetchWithAuth('/api/whatsapp/pause', { method: 'POST', body: JSON.stringify(data) }),
  resumeWhatsAppAutomation: (data: { projectId: string }) =>
    fetchWithAuth('/api/whatsapp/resume', { method: 'POST', body: JSON.stringify(data) }),
  updateWhatsAppFrequency: (data: { projectId: string; frequencyDays: number }) =>
    fetchWithAuth('/api/whatsapp/frequency', { method: 'PATCH', body: JSON.stringify(data) }),
  replyToWhatsApp: (data: { projectId: string; messageText: string }) =>
    fetchWithAuth('/api/whatsapp/reply', { method: 'POST', body: JSON.stringify(data) }),
  getWhatsAppMessages: (params?: { limit?: number; status?: string; direction?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.status) q.append('status', params.status);
    if (params?.direction) q.append('direction', params.direction);
    return fetchWithAuth(`/api/whatsapp/messages?${q.toString()}`);
  },

  // Templates
  getTemplates: () => fetchWithAuth('/api/templates'),
  createTemplate: (data: any) =>
    fetchWithAuth('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplateStatus: (id: string, status: string) =>
    fetchWithAuth(`/api/templates/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Reports
  getReports: () => fetchWithAuth('/api/reports'),

  // Settings
  getSettings: () => fetchWithAuth('/api/settings'),
  updateSettings: (data: any) =>
    fetchWithAuth('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  triggerScheduler: () =>
    fetchWithAuth('/api/settings/trigger-scheduler', { method: 'POST' }),
  getUsers: () => fetchWithAuth('/api/settings/users'),
  
  // Reminders
  getReminders: (status?: string) => 
    fetchWithAuth(`/api/reminders${status ? `?status=${status}` : ''}`),
  getDueReminders: () => 
    fetchWithAuth('/api/reminders/due'),
  createReminder: (data: { title: string; notes?: string; dueAt: string; relatedProjectId?: string }) =>
    fetchWithAuth('/api/reminders', { method: 'POST', body: JSON.stringify(data) }),
  dismissReminder: (id: string) =>
    fetchWithAuth(`/api/reminders/${id}/dismiss`, { method: 'PATCH' }),
};
