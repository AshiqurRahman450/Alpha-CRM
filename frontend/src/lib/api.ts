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
  updateProjectStatus: (
    id: string,
    status: string,
    notes?: string,
    trackingData?: { vrlLrNumber?: string; trackingNumber?: string } | string,
    productionTimelineDays?: number
  ) => {
    const payload: any = { status, notes };
    if (typeof trackingData === 'string') {
      payload.vrlLrNumber = trackingData;
      payload.trackingNumber = trackingData;
    } else if (trackingData) {
      if (trackingData.vrlLrNumber) payload.vrlLrNumber = trackingData.vrlLrNumber;
      if (trackingData.trackingNumber) payload.trackingNumber = trackingData.trackingNumber;
    }
    if (productionTimelineDays !== undefined) {
      payload.productionTimelineDays = productionTimelineDays;
    }
    return fetchWithAuth(`/api/projects/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  triggerDrawingAndCabinApproved: (id: string, productionTimelineDays?: number, notes?: string) =>
    fetchWithAuth(`/api/projects/${id}/drawing-approved`, {
      method: 'POST',
      body: JSON.stringify({ productionTimelineDays, notes }),
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
  notifyBdmApproval: (id: string, note?: string) =>
    fetchWithAuth(`/api/projects/${id}/notify-bdm`, {
      method: 'POST',
      body: JSON.stringify({ note }),
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
  requestProjectPayment: (
    id: string,
    data: {
      requestedAmount?: number;
      paymentType?: string;
      notes?: string;
      accountantPhone?: string;
      accountantName?: string;
    }
  ) =>
    fetchWithAuth(`/api/projects/${id}/request-payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelProjectPaymentRequest: (id: string) =>
    fetchWithAuth(`/api/projects/${id}/request-payment`, {
      method: 'DELETE',
    }),

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
  sendPaymentReceiptToGroup: (id: string) =>
    fetchWithAuth(`/api/payments/${id}/send-receipt`, { method: 'POST' }),

  // WhatsApp Controls & WATI Group Automation
  getChannels: () => fetchWithAuth('/api/whatsapp/channels'),
  linkWhatsAppGroup: (data: { projectId: string; whatsappGroupId: string; groupName?: string }) =>
    fetchWithAuth('/api/whatsapp/link', { method: 'POST', body: JSON.stringify(data) }),
  createWhatsAppGroup: (
    projectId: string,
    data: {
      groupNameOverride?: string;
      intervalDays?: number;
      dryRun?: boolean;
      existingGroupId?: string;
      inviteLink?: string;
      forceRelink?: boolean;
    }
  ) => fetchWithAuth(`/api/whatsapp/projects/${projectId}/group`, { method: 'POST', body: JSON.stringify(data) }),
  unlinkWhatsAppGroup: (projectId: string) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/group`, { method: 'DELETE' }),
  getWhatsAppGroup: (projectId: string) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/group`),
  inviteWhatsAppContacts: (projectId: string) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/group/invite`, { method: 'POST' }),
  updateWhatsAppConfig: (projectId: string, data: { intervalDays?: number; updatesEnabled?: boolean }) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/config`, { method: 'PATCH', body: JSON.stringify(data) }),
  previewWhatsAppUpdate: (projectId: string, customNote?: string) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/preview${customNote ? `?customNote=${encodeURIComponent(customNote)}` : ''}`),
  sendTestWhatsAppMessage: (projectId: string, data: { customNote?: string; dryRun?: boolean; targetType?: 'GROUP' | 'DIRECT' }) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/send-test`, { method: 'POST', body: JSON.stringify(data) }),
  getWhatsAppProjectMessages: (projectId: string) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/messages`),
  getProjectParticipants: (projectId: string) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/participants`),
  addProjectParticipant: (projectId: string, data: { phoneNumber: string; name?: string; role?: string }) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/participants`, { method: 'POST', body: JSON.stringify(data) }),
  removeProjectParticipant: (projectId: string, phone: string) =>
    fetchWithAuth(`/api/whatsapp/projects/${projectId}/participants/${encodeURIComponent(phone)}`, { method: 'DELETE' }),
  retryWhatsAppMessage: (messageId: string) =>
    fetchWithAuth(`/api/whatsapp/messages/${messageId}/retry`, { method: 'POST' }),
  validateWatiConfig: () =>
    fetchWithAuth('/api/whatsapp/config/validate'),

  sendWhatsAppUpdate: (data: { projectId: string; templateNameOverride?: string; customNote?: string; variables?: Record<string, string> }) =>
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

  // WhatsApp Web Bot
  getWhatsAppBotStatus: () => fetchWithAuth('/api/whatsapp/bot/status'),
  initWhatsAppBot: () => fetchWithAuth('/api/whatsapp/bot/initialize', { method: 'POST' }),
  logoutWhatsAppBot: () => fetchWithAuth('/api/whatsapp/bot/logout', { method: 'POST' }),

  // Templates
  getTemplates: () => fetchWithAuth('/api/templates'),
  createTemplate: (data: any) =>
    fetchWithAuth('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: any) =>
    fetchWithAuth(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateTemplateStatus: (id: string, status: string) =>
    fetchWithAuth(`/api/templates/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  syncTemplateStages: () =>
    fetchWithAuth('/api/templates/sync-timeline-stages', { method: 'POST' }),

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

  // QC Pre-Production Site Inspection
  generateQCPdf: async (data: any): Promise<Blob> => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/qc/generate-pdf?download=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/pdf',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to generate PDF');
    }
    return res.blob();
  },
  saveQCReport: (data: any) =>
    fetchWithAuth('/api/qc/reports', { method: 'POST', body: JSON.stringify(data) }),
  getQCReports: (params?: { search?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    return fetchWithAuth(`/api/qc/reports?${q.toString()}`);
  },
  getQCReport: (id: string) => fetchWithAuth(`/api/qc/reports/${id}`),

  // Installation Programme Stages
  getInstallationStages: (projectId: string) =>
    fetchWithAuth(`/api/projects/${projectId}/installation-stages`),
  updateInstallationStage: (
    projectId: string,
    data: {
      stageKey: string;
      startDate?: string;
      completeDate?: string;
      status?: string;
      reason?: 'HOLIDAY' | 'TECHNICAL_ISSUE' | 'COMPLETED' | null;
      notes?: string;
      sendWhatsApp?: boolean;
    }
  ) =>
    fetchWithAuth(`/api/projects/${projectId}/installation-stages/update-stage`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  initializeInstallationStages: (
    projectId: string,
    data?: string | { installationStartDate?: string; stage1CompleteDate?: string; customStages?: any[] }
  ) => {
    const payload = typeof data === 'string' ? { installationStartDate: data } : data || {};
    return fetchWithAuth(`/api/projects/${projectId}/installation-stages/initialize`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
