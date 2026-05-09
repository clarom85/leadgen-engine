// ============================================================
// Funnel config types (mirror di JSONB funnel_config in DB)
// ============================================================

export type StepOption = { value: string; label: string };

export type ChoiceStep = {
  id: string;
  type: 'single-choice';
  title: string;
  field: string;
  subtitle?: string;
  options: StepOption[];
};

export type FormStep = {
  id: string;
  type: 'form';
  title: string;
  subtitle?: string;
  fields: string[];
};

export type FunnelStep = ChoiceStep | FormStep;

export type FunnelConfig = {
  steps: FunnelStep[];
  headline?: string;
  subheadline?: string;
  cta_label?: string;
  success_title?: string;
  success_message?: string;
};
