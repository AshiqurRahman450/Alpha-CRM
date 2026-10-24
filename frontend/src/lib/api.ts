const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://crmapi.alphaelevators.io';

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
  getDashboardCardItems: async (params: { type: string; stage?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.type) q.append('type', params.type);
    if (params?.stage) q.append('stage', params.stage);
    if (params?.search) q.append('search', params.search);

    try {
      // 1. Try dedicated endpoint first (if available on local or upgraded backend)
      const res = await fetchWithAuth(`/api/dashboard/card-items?${q.toString()}`);
      if (res && res.success) {
        return res;
      }
    } catch (err: any) {
      // If 404 Route not found, proceed to fallback using standard endpoints
      console.warn('[DashboardCardItems] Dedicated route unavailable, resolving via standard endpoints:', err.message);
    }

    // 2. Resilient Fallback using existing production endpoints
    const { type, stage } = params;
    const formatProj = (p: any) => ({
      _id: p._id,
      projectId: p.projectId || p.projectCode,
      projectName: p.projectName,
      projectStatus: p.projectStatus || p.stage,
      paymentStatus: p.paymentStatus,
      orderValue: p.orderValue || 0,
      advanceAmount: p.advanceAmount || 0,
      totalPaid: p.totalPaid || 0,
      balanceAmount: p.balanceAmount || 0,
      liftModel: p.liftModel,
      siteAddress: p.siteAddress,
      customerName: (p.customerId as any)?.fullName || p.customerName || 'Customer',
      customerPhone: (p.customerId as any)?.phoneNumber || p.customerPhone,
      customerWhatsapp: (p.customerId as any)?.whatsappNumber || p.customerWhatsapp,
      customerEmail: (p.customerId as any)?.email || p.customerEmail,
      whatsappGroupId: p.whatsappGroupId,
      whatsappOptIn: (p.customerId as any)?.whatsappOptIn ?? p.whatsappOptIn,
      nextUpdateAt: p.nextUpdateAt || p.date,
      paymentRequest: p.paymentRequest,
      advancePercentage: p.advancePercentage,
      createdAt: p.createdAt,
    });

    if (type === 'totalCustomers') {
      const custRes = await api.getCustomers();
      const customers = (custRes.data || []).map((c: any) => ({
        _id: c._id,
        fullName: c.fullName,
        phoneNumber: c.phoneNumber,
        whatsappNumber: c.whatsappNumber,
        email: c.email,
        city: c.city,
        state: c.state,
        address: c.address,
        customerType: c.customerType,
        whatsappOptIn: c.whatsappOptIn,
        leadSource: c.leadSource,
        bdmPhone: c.bdmPhone,
        projectCount: c.projects?.length || 0,
        createdAt: c.createdAt,
      }));
      return {
        success: true,
        cardType: type,
        title: 'Total Customers',
        subtitle: 'All registered and verified elevator customers',
        count: customers.length,
        itemType: 'customer',
        data: customers,
      };
    }

    if (type === 'whatsappMessagesSent' || type === 'whatsappMessagesFailed') {
      const isFailed = type === 'whatsappMessagesFailed';
      const msgRes = await api.getWhatsAppMessages({ limit: 100 });
      const allMsgs = msgRes.data || [];
      const filtered = isFailed
        ? allMsgs.filter((m: any) => m.status === 'FAILED')
        : allMsgs.filter((m: any) => ['SENT', 'DELIVERED', 'READ'].includes(m.status));

      return {
        success: true,
        cardType: type,
        title: isFailed ? 'WhatsApp Failed Messages' : 'WhatsApp Messages Sent',
        subtitle: isFailed
          ? 'Failed dispatches due to Meta API issues, expired tokens or invalid groups'
          : 'Successfully delivered automated & manual WhatsApp updates to client groups',
        count: filtered.length,
        itemType: 'message',
        data: filtered,
      };
    }

    if (type === 'crmPaymentRequests' || type === 'crmPaymentRequestsCount') {
      const dashRes = await api.getDashboard().catch(() => null);
      if (dashRes?.data?.crmPaymentRequests?.length) {
        return {
          success: true,
          cardType: type,
          title: 'CRM Payment Requests',
          subtitle: 'Milestone collection requests initiated by CRM awaiting accountant recording',
          count: dashRes.data.crmPaymentRequests.length,
          itemType: 'project',
          data: dashRes.data.crmPaymentRequests.map(formatProj),
        };
      }
    }

    if (type === 'whatsappUpdatesDueToday' || type === 'updatesDueToday' || type === 'upcoming_today') {
      const dashRes = await api.getDashboard().catch(() => null);
      if (dashRes?.data?.todayActions) {
        return {
          success: true,
          cardType: type,
          title: 'WhatsApp Updates Due Today',
          subtitle: 'Active projects scheduled for automated or manual WhatsApp group dispatch today',
          count: dashRes.data.todayActions.length,
          itemType: 'project',
          data: dashRes.data.todayActions.map(formatProj),
        };
      }
    }

    // Projects based cards
    const projRes = await api.getProjects();
    const projects: any[] = projRes.data || [];
    let title = 'Projects List';
    let subtitle = 'All elevator installation projects';
    let filtered: any[] = projects;

    switch (type) {
      case 'activeProjects':
        title = 'Active Projects';
        subtitle = 'Orders confirmed & active in the 4-month elevator manufacturing and installation cycle';
        filtered = projects.filter((p) => p.projectStatus !== 'COMPLETED' && p.projectStatus !== 'CANCELLED');
        break;
      case 'projectsAwaitingPayment':
      case 'awaitingPayment':
        title = 'Projects Awaiting Payment';
        subtitle = 'Projects with pending advance or partial milestone payment';
        filtered = projects.filter(
          (p) => p.paymentStatus === 'PENDING' || p.paymentStatus === 'PARTIAL_PAID'
        );
        break;
      case 'projectsInManufacturing':
      case 'manufacturing':
        title = 'Projects in Manufacturing';
        subtitle = 'Factory fabrication stage: shaft fabrication, motor assembly & panel wiring';
        filtered = projects.filter((p) => p.projectStatus === 'MANUFACTURING');
        break;
      case 'projectsReadyForDelivery':
      case 'readyForDelivery':
        title = 'Projects Ready for Delivery';
        subtitle = 'QC passed, dispatched, or in transit to customer site';
        filtered = projects.filter((p) =>
          ['QUALITY_CHECK', 'DISPATCH', 'DELIVERY'].includes(p.projectStatus)
        );
        break;
      case 'installationOngoing':
      case 'installation':
        title = 'Installation Ongoing Projects';
        subtitle = 'On-site shaft rigging, guide rail alignment, cabin erection & electrical wiring';
        filtered = projects.filter((p) => p.projectStatus === 'INSTALLATION');
        break;
      case 'handoverCount':
      case 'handover':
        title = 'Handover & Testing Projects';
        subtitle = 'Safety inspection, load testing, commissioning & final handover to client';
        filtered = projects.filter((p) => p.projectStatus === 'TESTING');
        break;
      case 'pendingApprovals':
      case 'pendingApprovalCount':
        title = 'Pending Approvals (Drawing & Cabin)';
        subtitle = 'Elevator projects waiting for design or customer approval confirmation';
        filtered = projects.filter((p) =>
          ['DESIGN', 'CUSTOMER_APPROVAL'].includes(p.projectStatus)
        );
        break;
      case 'crmPaymentRequests':
      case 'crmPaymentRequestsCount':
        title = 'CRM Payment Requests';
        subtitle = 'Milestone collection requests initiated by CRM awaiting accountant recording';
        filtered = projects.filter((p) => p.paymentRequest?.status === 'REQUESTED');
        break;
      case 'upcoming_tomorrow':
        title = 'WhatsApp Updates Due Tomorrow';
        subtitle = 'Projects scheduled for customer WhatsApp group dispatch in next 24 hours';
        filtered = projects.filter((p) => {
          if (!p.nextUpdateAt) return false;
          const d = new Date(p.nextUpdateAt);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return d.toDateString() === tomorrow.toDateString();
        });
        break;
      case 'upcoming_next_7_days':
        title = 'WhatsApp Updates Due Next 7 Days';
        subtitle = 'Projects scheduled for customer WhatsApp group dispatch over the upcoming week';
        filtered = projects.filter((p) => {
          if (!p.nextUpdateAt) return false;
          const d = new Date(p.nextUpdateAt);
          const now = new Date();
          const in7 = new Date();
          in7.setDate(in7.getDate() + 7);
          return d > now && d <= in7;
        });
        break;
      case 'stage':
        title = `${(stage || '').replace(/_/g, ' ')} Projects`;
        subtitle = `Elevator projects currently situated in ${(stage || '').replace(/_/g, ' ')} stage`;
        filtered = projects.filter((p) => p.projectStatus === stage);
        break;
      default:
        title = 'Total Projects';
        subtitle = 'All elevator installation projects';
        filtered = projects;
        break;
    }

    return {
      success: true,
      cardType: type,
      title,
      subtitle,
      count: filtered.length,
      itemType: 'project',
      data: filtered.map(formatProj),
    };
  },

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
  getQCReports: (params?: { search?: string; approvalStatus?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.approvalStatus) q.append('approvalStatus', params.approvalStatus);
    return fetchWithAuth(`/api/qc/reports?${q.toString()}`);
  },
  getQCReport: (id: string) => fetchWithAuth(`/api/qc/reports/${id}`),
  approveQCReport: (id: string, notes?: string) =>
    fetchWithAuth(`/api/qc/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  rejectQCReport: (id: string, reason: string) =>
    fetchWithAuth(`/api/qc/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

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
