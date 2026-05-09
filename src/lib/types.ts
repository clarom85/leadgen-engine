// ============================================================
// Shared TypeScript types — Leadgen Engine
// ============================================================

export type VerticalId = 'elder-wealth' | 'solar' | 'medicare-advantage' | 'auto-insurance' | 'home-services' | 'mass-tort';

export interface Vertical {
  id: string;
  name: string;
  active: boolean;
  schema: JsonSchema;
  tcpa_template: string;
  funnel_config: FunnelConfig | null;
}

export interface JsonSchema {
  type: 'object';
  required: string[];
  properties: Record<string, JsonSchemaProperty>;
}

export interface JsonSchemaProperty {
  type?: 'string' | 'number' | 'boolean';
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: (string | number | boolean)[];
}

export interface FunnelConfig {
  steps: FunnelStep[];
}

export interface FunnelStep {
  id: string;
  type: 'single-choice' | 'multi-choice' | 'form' | 'text';
  title: string;
  field?: string;
  fields?: string[];
  options?: { value: string; label: string }[];
}

export type AuthType = 'bearer' | 'basic' | 'apikey' | 'hmac' | 'none';

export interface BuyerAuthConfig {
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  header?: string;
  secret?: string;
}

export interface Buyer {
  id: string;
  name: string;
  display_name: string | null;
  active: boolean;
  active_in_verticals: string[];
  ping_url: string;
  post_url: string;
  auth_type: AuthType;
  auth_config: BuyerAuthConfig | null;
  field_mapping: Record<string, string>;
  filters: BuyerFilters;
  exclusive: boolean;
  max_bid: number | null;
  ping_timeout_ms: number;
  notes: string | null;
}

// Filtri eligibility — chiavi possono essere:
// - Esatto match: { state: ['CA','NY'] }       → campo deve essere uno dei valori
// - Boolean: { homeowner: true }               → campo deve essere true
// - Range numerico: { age_min: 50, age_max: 80 } → suffisso _min/_max
export type BuyerFilters = Record<string, string | number | boolean | (string | number | boolean)[]>;

export interface LeadInput {
  vertical_id: string;
  data: Record<string, unknown>;
  consent_text: string;
  trustedform_cert_url?: string;
  jornaya_lead_id?: string;
  ip_address?: string;
  user_agent?: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface Lead {
  id: string;
  vertical_id: string;
  status: LeadStatus;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  zip: string | null;
  state: string | null;
  raw_data: Record<string, unknown>;
  consent_text: string;
  trustedform_cert_url: string | null;
  jornaya_lead_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  source: string | null;
  total_revenue: number;
  created_at: Date;
}

export type LeadStatus = 'new' | 'pinging' | 'sold' | 'no_eligible_buyers' | 'rejected_all' | 'duplicate';

export interface PingResponse {
  accepted: boolean;
  bid: number;
  reject_reason?: string;
  buyer_lead_id?: string;
  raw_response?: unknown;
}

export interface AuctionResult {
  buyer: Buyer;
  response: PingResponse;
  duration_ms: number;
}

export interface ProcessLeadResult {
  lead_id: string;
  status: LeadStatus;
  total_revenue: number;
  winners: Array<{
    buyer_name: string;
    payout: number;
    success: boolean;
  }>;
  rejected_by: Array<{
    buyer_name: string;
    reason: string;
  }>;
  no_eligible_buyers?: boolean;
  duplicate?: boolean;
}
