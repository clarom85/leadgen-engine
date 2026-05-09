'use client';

import { useMemo, useState } from 'react';
import type { FunnelConfig, FunnelStep, ChoiceStep, FormStep } from './types';
import { TrustedFormScript, JornayaScript, ComplianceHiddenInputs } from './compliance-scripts';

const FIELD_DEFS: Record<string, { label: string; type?: string; required?: boolean; pattern?: string; maxLength?: number; placeholder?: string }> = {
  first_name: { label: 'First name', required: true },
  last_name:  { label: 'Last name' },
  email:      { label: 'Email', type: 'email', required: true },
  phone:      { label: 'Phone', type: 'tel', required: true, pattern: '[0-9+\\-() ]{10,}' },
  zip:        { label: 'ZIP', required: true, pattern: '[0-9]{5}' },
  state:      { label: 'State', required: true, maxLength: 2, placeholder: 'CA' }
};

declare global {
  interface Window {
    trustedForm?: { certUrl?: string };
    LeadiD?: { token?: string };
    xxTrustedFormCertUrl_0?: string;
  }
}

function readTrustedFormCert(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.trustedForm?.certUrl) return window.trustedForm.certUrl;
  if (window.xxTrustedFormCertUrl_0) return window.xxTrustedFormCertUrl_0;
  const input = document.querySelector('input[name="xxTrustedFormCertUrl"]') as HTMLInputElement | null;
  return input?.value || undefined;
}

function readJornayaToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.LeadiD?.token) return window.LeadiD.token;
  const input = document.querySelector('input[name="leadid_token"]') as HTMLInputElement | null;
  return input?.value || undefined;
}

export default function FunnelClient({
  verticalId,
  verticalName,
  tcpaText,
  config
}: {
  verticalId: string;
  verticalName: string;
  tcpaText: string;
  config: FunnelConfig;
}) {
  const steps = config.steps ?? [];
  const lastIdx = steps.length - 1;
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const utm = useMemo(() => {
    if (typeof window === 'undefined') return {};
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get('utm_source') ?? undefined,
      utm_medium: p.get('utm_medium') ?? undefined,
      utm_campaign: p.get('utm_campaign') ?? undefined,
      source: p.get('source') ?? 'organic'
    };
  }, []);

  const onChoice = (field: string, value: string) => {
    setData((d) => ({ ...d, [field]: value }));
    setStepIdx((i) => i + 1);
  };

  const onForm = (e: React.FormEvent<HTMLFormElement>, formStep: FormStep) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updated = { ...data };
    for (const f of formStep.fields) {
      const v = fd.get(f);
      if (typeof v === 'string') updated[f] = v;
    }
    setData(updated);
    submitLead(updated);
  };

  const submitLead = async (finalData: Record<string, string>) => {
    setSubmitting(true);
    setError(null);
    const trustedformCert = readTrustedFormCert();
    const jornayaLeadId = readJornayaToken();

    try {
      const res = await fetch(`/api/leads/${verticalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: finalData,
          consent_text: tcpaText,
          trustedform_cert_url: trustedformCert,
          jornaya_lead_id: jornayaLeadId,
          ...utm
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'submit_failed');
      setResult(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Result screen ───
  if (result) {
    const r = result as { status: string; total_revenue: number; winners_count: number; lead_id: string; duration_ms: number };
    const successTitle = config.success_title ?? 'Thank you!';
    const successMessage = config.success_message ?? 'Your information has been received. A specialist will be in touch shortly.';
    const showDebug = process.env.NEXT_PUBLIC_LEADGEN_DEBUG === '1';
    return (
      <main className="mx-auto max-w-2xl p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-green-700 mb-4">{successTitle}</h1>
          <p className="text-slate-700 mb-6">{successMessage}</p>
          {showDebug && (
            <div className="mt-8 p-4 bg-slate-50 rounded text-sm font-mono">
              <div className="font-semibold mb-2">Debug — ping-tree result:</div>
              <div>lead_id: {r.lead_id}</div>
              <div>status: <span className="font-semibold">{r.status}</span></div>
              <div>winners: {r.winners_count}</div>
              <div>total_revenue: <span className="text-green-700 font-semibold">${r.total_revenue.toFixed(2)}</span></div>
              <div>duration: {r.duration_ms}ms</div>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (steps.length === 0) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <p className="text-red-600">Funnel not configured for &quot;{verticalName}&quot;.</p>
      </main>
    );
  }

  const step: FunnelStep = steps[Math.min(stepIdx, lastIdx)] as FunnelStep;
  const totalSteps = steps.length;

  return (
    <main className="mx-auto max-w-xl p-8">
      <TrustedFormScript />
      <JornayaScript />
      {(stepIdx === 0 && config.headline) && (
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">{config.headline}</h1>
          {config.subheadline && <p className="text-slate-600 mt-1">{config.subheadline}</p>}
        </div>
      )}
      <ProgressBar current={stepIdx} total={totalSteps} />
      <div className="bg-white rounded-lg shadow p-6">
        {step.type === 'single-choice' ? (
          <ChoiceStepView step={step as ChoiceStep} onChoice={onChoice} />
        ) : (
          <FormStepView
            step={step as FormStep}
            tcpaText={tcpaText}
            error={error}
            submitting={submitting}
            ctaLabel={config.cta_label}
            onSubmit={(e) => onForm(e, step as FormStep)}
          />
        )}
        {stepIdx > 0 && (
          <button onClick={() => setStepIdx((i) => i - 1)} className="mt-6 text-sm text-slate-500 hover:underline">
            ← Back
          </button>
        )}
      </div>
    </main>
  );
}

function ChoiceStepView({ step, onChoice }: { step: ChoiceStep; onChoice: (field: string, value: string) => void }) {
  return (
    <>
      <h2 className="text-xl font-bold mb-1">{step.title}</h2>
      {step.subtitle && <p className="text-slate-500 text-sm mb-4">{step.subtitle}</p>}
      <div className="space-y-2 mt-4">
        {step.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChoice(step.field, opt.value)}
            className="w-full text-left px-4 py-3 border-2 border-slate-200 rounded hover:border-brand-500 hover:bg-brand-50 transition"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}

function FormStepView({
  step,
  tcpaText,
  error,
  submitting,
  ctaLabel,
  onSubmit
}: {
  step: FormStep;
  tcpaText: string;
  error: string | null;
  submitting: boolean;
  ctaLabel?: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  // Group first_name+last_name and zip+state into 2-col rows when both are present
  const fields = step.fields;
  const has = (f: string) => fields.includes(f);
  const groupedFNLN = has('first_name') && has('last_name');
  const groupedZipState = has('zip') && has('state');
  const renderedSet = new Set<string>();

  return (
    <>
      <h2 className="text-xl font-bold mb-1">{step.title}</h2>
      {step.subtitle && <p className="text-slate-500 text-sm mb-4">{step.subtitle}</p>}
      <form onSubmit={onSubmit} className="space-y-4 mt-4">
        <ComplianceHiddenInputs />
        {groupedFNLN && (
          <div className="grid grid-cols-2 gap-3">
            <Input name="first_name" {...FIELD_DEFS.first_name} />
            <Input name="last_name" {...FIELD_DEFS.last_name} />
          </div>
        )}
        {fields.map((f) => {
          if (groupedFNLN && (f === 'first_name' || f === 'last_name')) { renderedSet.add(f); return null; }
          if (groupedZipState && (f === 'zip' || f === 'state')) return null;
          if (renderedSet.has(f)) return null;
          const def = FIELD_DEFS[f] ?? { label: f };
          return <Input key={f} name={f} {...def} />;
        })}
        {groupedZipState && (
          <div className="grid grid-cols-2 gap-3">
            <Input name="zip" {...FIELD_DEFS.zip} />
            <Input name="state" {...FIELD_DEFS.state} />
          </div>
        )}

        <p className="text-xs text-slate-500 leading-snug pt-2">{tcpaText}</p>

        {error && <div className="text-red-600 text-sm">Error: {error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : (ctaLabel ?? 'SUBMIT')}
        </button>
      </form>
    </>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round(((current + 1) / total) * 100));
  return (
    <div className="mb-4">
      <div className="text-xs text-slate-500 mb-1">Step {Math.min(current + 1, total)} of {total}</div>
      <div className="h-2 bg-slate-200 rounded overflow-hidden">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Input({
  name,
  label,
  type = 'text',
  required,
  pattern,
  maxLength,
  placeholder
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  pattern?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        pattern={pattern}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}

