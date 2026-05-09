'use client';

import { useState } from 'react';

const STEPS = [
  {
    id: 'planning_focus',
    title: 'What are you focusing on?',
    field: 'planning_focus',
    options: [
      { value: 'estate-trust', label: 'Estate planning / trust' },
      { value: 'financial-advisor', label: 'Finding a financial advisor' },
      { value: 'ltc-insurance', label: 'Long-term care insurance' },
      { value: 'reverse-mortgage', label: 'Reverse mortgage' },
      { value: 'multiple', label: 'Multiple of the above' }
    ]
  },
  {
    id: 'age_range',
    title: 'What is your age range?',
    field: 'age_range',
    options: [
      { value: 'under-40', label: 'Under 40' },
      { value: '40-49', label: '40 – 49' },
      { value: '50-59', label: '50 – 59' },
      { value: '60-69', label: '60 – 69' },
      { value: '70+', label: '70 or older' }
    ]
  },
  {
    id: 'assets_range',
    title: 'What are your investable assets?',
    field: 'assets_range',
    options: [
      { value: 'under-100k', label: 'Under $100K' },
      { value: '100-250k', label: '$100K – $250K' },
      { value: '250-500k', label: '$250K – $500K' },
      { value: '500k-1m', label: '$500K – $1M' },
      { value: '1m-plus', label: 'Over $1M' }
    ]
  },
  {
    id: 'has_advisor',
    title: 'Do you currently work with a financial advisor?',
    field: 'has_advisor',
    options: [
      { value: 'false', label: 'No' },
      { value: 'true', label: 'Yes' }
    ]
  },
  {
    id: 'homeowner',
    title: 'Do you own your home?',
    field: 'homeowner',
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' }
    ]
  }
] as const;

const TCPA_TEXT =
  'By clicking SUBMIT, you agree that the company and its marketing partners may contact you at the phone number and email provided regarding senior wealth protection, estate planning, financial advisor matching, long-term care insurance, and reverse mortgage information. You consent to receive marketing calls and SMS messages, including those made via automated technology, even if your number is on a Do Not Call list. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to opt out.';

export default function ElderWealthFunnel() {
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const isContactStep = stepIdx >= STEPS.length;

  const onChoice = (field: string, value: string) => {
    setData((d) => ({ ...d, [field]: value }));
    setStepIdx((i) => i + 1);
  };

  const onContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const contactFields = ['first_name', 'last_name', 'email', 'phone', 'zip', 'state'];
    const updated = { ...data };
    for (const f of contactFields) {
      const v = fd.get(f);
      if (typeof v === 'string') updated[f] = v;
    }
    setData(updated);
    submitLead(updated);
  };

  const submitLead = async (finalData: Record<string, string>) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/leads/elder-wealth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: finalData,
          consent_text: TCPA_TEXT,
          source: 'organic'
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
    return (
      <main className="mx-auto max-w-2xl p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-green-700 mb-4">Thank you!</h1>
          <p className="text-slate-700 mb-6">
            Your information has been received. A specialist will be in touch shortly.
          </p>

          <div className="mt-8 p-4 bg-slate-50 rounded text-sm font-mono">
            <div className="font-semibold mb-2">Debug — ping-tree result:</div>
            <div>lead_id: {r.lead_id}</div>
            <div>status: <span className="font-semibold">{r.status}</span></div>
            <div>winners: {r.winners_count}</div>
            <div>total_revenue: <span className="text-green-700 font-semibold">${r.total_revenue.toFixed(2)}</span></div>
            <div>duration: {r.duration_ms}ms</div>
          </div>
        </div>
      </main>
    );
  }

  // ─── Contact form (last step) ───
  if (isContactStep) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <ProgressBar current={STEPS.length} total={STEPS.length + 1} />
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-1">Almost done — where should advisors reach you?</h2>
          <p className="text-slate-500 text-sm mb-6">Your info is shared only with verified advisors matching your profile.</p>

          <form onSubmit={onContact} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input name="first_name" label="First name" required />
              <Input name="last_name" label="Last name" />
            </div>
            <Input name="email" label="Email" type="email" required />
            <Input name="phone" label="Phone" type="tel" required pattern="[0-9+\-() ]{10,}" />
            <div className="grid grid-cols-2 gap-3">
              <Input name="zip" label="ZIP" required pattern="[0-9]{5}" />
              <Input name="state" label="State" required maxLength={2} placeholder="CA" />
            </div>

            <p className="text-xs text-slate-500 leading-snug pt-2">{TCPA_TEXT}</p>

            {error && <div className="text-red-600 text-sm">Error: {error}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'SUBMIT'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ─── Choice steps ───
  const step = STEPS[stepIdx];
  return (
    <main className="mx-auto max-w-xl p-8">
      <ProgressBar current={stepIdx} total={STEPS.length + 1} />
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-6">{step.title}</h2>
        <div className="space-y-2">
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
        {stepIdx > 0 && (
          <button onClick={() => setStepIdx((i) => i - 1)} className="mt-6 text-sm text-slate-500 hover:underline">
            ← Back
          </button>
        )}
      </div>
    </main>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div className="mb-4">
      <div className="text-xs text-slate-500 mb-1">Step {current + 1} of {total}</div>
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
