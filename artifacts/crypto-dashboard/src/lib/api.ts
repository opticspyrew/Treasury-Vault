const API_BASE = "/api";
const PUBLIC_BASE = `${API_BASE}/public`;
const AUTH_BASE = `${API_BASE}/auth`;

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

export const publicApi = {
  getExchangeRates: async (): Promise<Record<string, number>> => {
    const res = await fetch(`${PUBLIC_BASE}/exchange-rates`);
    if (!res.ok) throw new Error("Failed to fetch exchange rates");
    const data = (await res.json()) as { rates: Record<string, number> };
    return data.rates;
  },

  registerClient: (data: { name: string; email: string }) =>
    post<{ client?: { id: number }; alreadyExists: boolean; emailSent: boolean }>(
      `${PUBLIC_BASE}/register`,
      data,
    ),

  submitRequest: (
    data: {
      name: string;
      email: string;
      type: string;
      amount: string;
      currency: string;
      notes?: string;
      txnId?: string;
    },
    authToken?: string,
  ) => post<{ request: { id: number; publicToken: string }; emailSent: boolean }>(
    `${PUBLIC_BASE}/request`,
    data,
    authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  ),

  checkTxApprovals: async (txnIds: string[]): Promise<{ approvals: { txnId: string; status: string }[] }> => {
    if (txnIds.length === 0) return { approvals: [] };
    const res = await fetch(`${PUBLIC_BASE}/tx-approvals?txnIds=${encodeURIComponent(txnIds.join(","))}`);
    if (!res.ok) return { approvals: [] };
    return res.json();
  },

  submitPaymentConfirmation: (data: {
    name: string;
    email: string;
    amount: string;
    currency: string;
    notes?: string;
  }) => post<{ request: { id: number; publicToken: string }; emailSent: boolean }>(
    `${PUBLIC_BASE}/payment-confirmation`,
    data,
  ),

  getRequestStatus: async (token: string): Promise<{ id: number; status: string; type: string }> => {
    const res = await fetch(`${PUBLIC_BASE}/request-status/${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error("Failed to fetch request status");
    return res.json();
  },

  getWalletConfigs: async (): Promise<{ configs: WalletConfig[]; coinOrder: string[] }> => {
    const res = await fetch(`${PUBLIC_BASE}/wallet-configs`);
    if (!res.ok) return { configs: [], coinOrder: [] };
    const data = (await res.json()) as { configs: WalletConfig[]; coinOrder?: string[] };
    return { configs: data.configs, coinOrder: data.coinOrder ?? [] };
  },
};

export interface WalletConfig {
  id: number;
  symbol: string;
  network: string;
  address: string;
  label: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  /** True when the user's admin_clients record has status approved or active. */
  portalAccess?: boolean;
  /** True when the user hasn't documented their loss details yet (e.g. Google signup). */
  needsIntake?: boolean;
}

export interface RecoveryMetrics {
  reportedLossUsd: number;
  recoveredUsd: number;
  atRiskUsd: number;
  recoveryRatePct: number;
  riskScore: number;
  documented: boolean;
}

export interface AuthSessionResponse {
  user: AuthUser;
  token: string;
  expiresAt: string;
}

export interface AuthSessionRecord {
  id: number;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  countryCode: string | null;
  current: boolean;
}

export type KycStatus = "none" | "pending" | "approved" | "rejected";

export interface KycStatusResponse {
  status: KycStatus;
  submission: {
    id: number;
    status: KycStatus;
    createdAt: string;
    reviewedAt: string | null;
    reviewerNotes: string | null;
    // Form fields are only returned by the API when the latest submission was
    // rejected, so the resubmit form can prefill what the user entered before.
    fullName?: string;
    dateOfBirth?: string;
    address?: string;
    city?: string;
    country?: string;
    idType?: string;
    idNumber?: string;
  } | null;
}

export interface KycSubmitInput {
  fullName: string;
  dateOfBirth: string;
  address: string;
  city: string;
  country: string;
  idType: string;
  idNumber: string;
  photoUploadURL: string;
  photoMimeType: string;
}

export const kycApi = {
  status: async (token: string): Promise<KycStatusResponse> => {
    const res = await fetch(`${PUBLIC_BASE}/kyc/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to load verification status");
    }
    return res.json();
  },
  submit: (token: string, data: KycSubmitInput) =>
    post<{ ok: boolean; submissionId: number; status: KycStatus; emailSent: boolean }>(
      `${PUBLIC_BASE}/kyc/submit`,
      data,
      { Authorization: `Bearer ${token}` },
    ),
  requestUploadUrl: (token: string) =>
    post<{ uploadURL: string }>(
      `${PUBLIC_BASE}/kyc/upload-url`,
      {},
      { Authorization: `Bearer ${token}` },
    ),
};

export const authApi = {
  signup: (data: {
    name: string;
    email: string;
    password: string;
    initialBalanceUsd?: number;
    scammedVia?: string;
  }) => post<AuthSessionResponse>(`${AUTH_BASE}/signup`, data),

  login: (data: { email: string; password: string }) =>
    post<AuthSessionResponse>(`${AUTH_BASE}/login`, data),

  logout: (token: string) =>
    post<{ ok: boolean }>(`${AUTH_BASE}/logout`, {}, { Authorization: `Bearer ${token}` }),

  me: async (token: string): Promise<AuthUser | null> => {
    const res = await fetch(`${AUTH_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error("Failed to load session");
    const data = (await res.json()) as { user: AuthUser };
    return data.user;
  },

  sessions: async (
    token: string,
  ): Promise<{ sessions: AuthSessionRecord[]; pendingWithdrawalCount: number }> => {
    const res = await fetch(`${AUTH_BASE}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to load recent activity");
    }
    const data = (await res.json()) as {
      sessions: AuthSessionRecord[];
      pendingWithdrawalCount?: number;
    };
    return {
      sessions: data.sessions,
      pendingWithdrawalCount: data.pendingWithdrawalCount ?? 0,
    };
  },

  revokeAllOtherSessions: (token: string) =>
    post<{ revoked: number }>(
      `${AUTH_BASE}/sessions/revoke-all-others`,
      {},
      { Authorization: `Bearer ${token}` },
    ),

  revokeSession: async (token: string, id: number): Promise<void> => {
    const res = await fetch(`${AUTH_BASE}/sessions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to sign out that device");
    }
  },

  recoveryMetrics: async (token: string): Promise<{ metrics: RecoveryMetrics; scammedVia: string | null }> => {
    const res = await fetch(`${AUTH_BASE}/recovery-metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to load recovery metrics");
    }
    return res.json();
  },

  submitIntake: (token: string, data: { assetsTotalUsd?: number; scammedVia: string }) =>
    post<{ ok: boolean; metrics: RecoveryMetrics; needsIntake: boolean }>(
      `${AUTH_BASE}/intake`,
      data,
      { Authorization: `Bearer ${token}` },
    ),

  exists: (email: string) =>
    post<{ exists: boolean }>(`${AUTH_BASE}/exists`, { email }),

  changePassword: (token: string, data: { currentPassword: string; newPassword: string }) =>
    post<{ ok: boolean }>(`${AUTH_BASE}/change-password`, data, {
      Authorization: `Bearer ${token}`,
    }),

  setPassword: (token: string, data: { newPassword: string }) =>
    post<{ ok: boolean }>(`${AUTH_BASE}/set-password`, data, {
      Authorization: `Bearer ${token}`,
    }),

  forgotPassword: (email: string) =>
    post<{ ok: boolean }>(`${AUTH_BASE}/forgot-password`, { email }),

  balanceDirective: async (token: string): Promise<{ debitAll: boolean; requestedAt: string | null }> => {
    const res = await fetch(`${AUTH_BASE}/balance-directive`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { debitAll: false, requestedAt: null };
    return res.json();
  },

  getBalance: async (token: string): Promise<number | null> => {
    const res = await fetch(`${AUTH_BASE}/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { balanceBtc: number };
    return data.balanceBtc;
  },

  validateResetToken: async (
    token: string,
  ): Promise<{ valid: boolean; email?: string; expiresAt?: string; error?: string }> => {
    const res = await fetch(
      `${AUTH_BASE}/reset-password?token=${encodeURIComponent(token)}`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        valid: false,
        error:
          (data as { error?: string }).error ||
          "This password reset link is invalid or has expired.",
      };
    }
    return data as { valid: boolean; email?: string; expiresAt?: string };
  },

  resetPassword: (data: { token: string; newPassword: string }) =>
    post<AuthSessionResponse>(`${AUTH_BASE}/reset-password`, data),

  getNotificationPreferences: async (token: string): Promise<NotificationPreferencesResponse> => {
    const res = await fetch(`${AUTH_BASE}/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to load notification preferences");
    }
    return res.json();
  },

  updateNotificationPreferences: (
    token: string,
    data: Partial<NotificationPreferences>,
  ) =>
    request<NotificationPreferencesResponse>(`${AUTH_BASE}/preferences`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export interface NotificationPreferences {
  kycDecisions: boolean;
  newSignIn: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferences;
  mandatory: string[];
}

// Social sign-in (Google) ---------------------------------------------------

export type SocialProvider = "google";

export interface ProvidersConfig {
  google: boolean;
}

export interface LinkedProvider {
  provider: SocialProvider;
  email: string | null;
  linkedAt: string;
}

export interface ProvidersLinkedResponse {
  providers: ProvidersConfig;
  linked: LinkedProvider[];
  hasPassword: boolean;
}

export const socialAuthApi = {
  publicConfig: async (): Promise<ProvidersConfig> => {
    const res = await fetch(`${AUTH_BASE}/providers/config`);
    if (!res.ok) return { google: false };
    const data = (await res.json()) as { providers: ProvidersConfig };
    return data.providers;
  },
  linked: async (token: string): Promise<ProvidersLinkedResponse> => {
    const res = await fetch(`${AUTH_BASE}/providers/linked`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to load connected accounts");
    }
    return res.json();
  },
  disconnect: (token: string, provider: SocialProvider) =>
    post<{ ok: boolean }>(
      `${AUTH_BASE}/providers/${provider}/disconnect`,
      {},
      { Authorization: `Bearer ${token}` },
    ),
  connectUrl: (provider: SocialProvider, token: string): string =>
    `${AUTH_BASE}/${provider}/connect?token=${encodeURIComponent(token)}`,
  loginUrl: (provider: SocialProvider): string => `${AUTH_BASE}/${provider}/login`,
};
