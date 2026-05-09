// ============================================================
// Schema validation — runtime check di lead data contro
// JSON Schema definito nel vertical config
// ============================================================

import type { JsonSchema, JsonSchemaProperty } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLeadData(data: Record<string, unknown>, schema: JsonSchema): ValidationResult {
  const errors: string[] = [];

  // 1. Required fields check
  for (const required of schema.required ?? []) {
    if (data[required] === undefined || data[required] === null || data[required] === '') {
      errors.push(`Missing required field: ${required}`);
    }
  }

  // 2. Per-field validation
  for (const [field, value] of Object.entries(data)) {
    const propSchema = schema.properties?.[field];
    if (!propSchema) continue; // skip unknown fields silently
    if (value === undefined || value === null || value === '') continue;

    const fieldErrors = validateField(field, value, propSchema);
    errors.push(...fieldErrors);
  }

  return { valid: errors.length === 0, errors };
}

function validateField(field: string, value: unknown, schema: JsonSchemaProperty): string[] {
  const errors: string[] = [];

  // Enum check (più comune)
  if (schema.enum) {
    const normalized = typeof value === 'string' ? value : String(value);
    const enumStrings = schema.enum.map((e) => String(e));
    if (!enumStrings.includes(normalized)) {
      errors.push(`${field}: value "${normalized}" not in allowed enum`);
    }
    return errors; // se enum, salta altri check
  }

  // Type check
  if (schema.type === 'string' && typeof value !== 'string') {
    errors.push(`${field}: expected string, got ${typeof value}`);
    return errors;
  }
  if (schema.type === 'number' && typeof value !== 'number') {
    errors.push(`${field}: expected number, got ${typeof value}`);
    return errors;
  }
  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    // Accept "true"/"false" strings too (form submissions)
    if (!(typeof value === 'string' && (value === 'true' || value === 'false'))) {
      errors.push(`${field}: expected boolean, got ${typeof value}`);
      return errors;
    }
  }

  // String constraints
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${field}: too short (min ${schema.minLength})`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${field}: too long (max ${schema.maxLength})`);
    }
    if (schema.pattern) {
      try {
        const re = new RegExp(schema.pattern);
        if (!re.test(value)) errors.push(`${field}: pattern mismatch`);
      } catch {
        errors.push(`${field}: invalid pattern in schema`);
      }
    }
    if (schema.format === 'email') {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(value)) errors.push(`${field}: invalid email format`);
    }
  }

  // Number constraints
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${field}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${field}: above maximum ${schema.maximum}`);
    }
  }

  return errors;
}

// Normalizza dato lead: trim string, lowercase email, strip non-digit da phone, ecc.
export function normalizeLeadData(data: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      let v = value.trim();
      if (key === 'email') v = v.toLowerCase();
      if (key === 'phone') v = v.replace(/[^\d+]/g, '');
      if (key === 'state') v = v.toUpperCase();
      if (key === 'zip') v = v.split('-')[0]; // 5-digit ZIP only
      // Convert "true"/"false" strings to boolean for known boolean fields
      if (v === 'true') normalized[key] = true;
      else if (v === 'false') normalized[key] = false;
      else normalized[key] = v;
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}
