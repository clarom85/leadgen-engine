-- ============================================================
-- Seed extra verticals — 5 nicchie del content network
-- 1) solar              → solarinstallguide.com
-- 2) medicare-advantage → medicarepriceguide.com
-- 3) auto-insurance     → coveragepriceguide.com
-- 4) home-services      → repairrateguide.com
-- 5) mass-tort          → legalfeesguide.com
-- Buyer mock per ognuno (gated da LEADGEN_MOCK_BUYERS=true)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- VERTICAL: solar
-- ─────────────────────────────────────────────────────────────
INSERT INTO verticals (id, name, active, schema, tcpa_template, funnel_config) VALUES (
  'solar',
  'Solar Installation Quote',
  true,
  '{
    "type": "object",
    "required": ["phone", "first_name", "zip", "state", "homeowner", "monthly_bill"],
    "properties": {
      "first_name":    {"type": "string", "minLength": 1, "maxLength": 50},
      "last_name":     {"type": "string", "maxLength": 50},
      "email":         {"type": "string", "format": "email"},
      "phone":         {"type": "string", "minLength": 10, "maxLength": 16},
      "zip":           {"type": "string", "minLength": 5, "maxLength": 10},
      "state":         {"type": "string", "minLength": 2, "maxLength": 2},
      "monthly_bill":  {"enum": ["under-100", "100-200", "200-300", "300-plus"]},
      "homeowner":     {"type": "boolean"},
      "roof_shading":  {"enum": ["full-sun", "partial-shade", "heavy-shade"]},
      "credit_range":  {"enum": ["excellent", "good", "fair", "poor"]}
    }
  }'::jsonb,
  'By clicking GET QUOTE, you authorize the company and {{buyers}} to contact you at the phone and email provided regarding solar installation, solar financing, and energy efficiency offers. You consent to receive marketing calls and SMS, including via automated technology, even if your number is on a Do Not Call list. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to opt out.',
  '{
    "headline": "Get matched with vetted solar installers in your area",
    "subheadline": "See your potential savings in 60 seconds",
    "cta_label": "GET MY QUOTE",
    "success_title": "You’re matched!",
    "success_message": "A vetted solar installer in your area will be in touch within 24 hours.",
    "steps": [
      {"id": "monthly_bill", "type": "single-choice", "title": "What is your average monthly electric bill?", "field": "monthly_bill", "options": [
        {"value": "under-100", "label": "Under $100"},
        {"value": "100-200", "label": "$100 – $200"},
        {"value": "200-300", "label": "$200 – $300"},
        {"value": "300-plus", "label": "Over $300"}
      ]},
      {"id": "homeowner", "type": "single-choice", "title": "Do you own your home?", "field": "homeowner", "options": [
        {"value": "true", "label": "Yes"},
        {"value": "false", "label": "No (renting / other)"}
      ]},
      {"id": "roof_shading", "type": "single-choice", "title": "How much sun does your roof get?", "field": "roof_shading", "options": [
        {"value": "full-sun", "label": "Full sun most of the day"},
        {"value": "partial-shade", "label": "Some shading"},
        {"value": "heavy-shade", "label": "Heavy shade / very little sun"}
      ]},
      {"id": "credit_range", "type": "single-choice", "title": "What is your credit range?", "field": "credit_range", "options": [
        {"value": "excellent", "label": "Excellent (740+)"},
        {"value": "good", "label": "Good (670 – 739)"},
        {"value": "fair", "label": "Fair (580 – 669)"},
        {"value": "poor", "label": "Below 580"}
      ]},
      {"id": "contact", "type": "form", "title": "Where should installers send your quote?", "subtitle": "Used only by vetted installers matching your profile.", "fields": ["first_name", "last_name", "email", "phone", "zip", "state"]}
    ]
  }'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  schema = EXCLUDED.schema,
  tcpa_template = EXCLUDED.tcpa_template,
  funnel_config = EXCLUDED.funnel_config;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_SunrunStyle',
  true,
  ARRAY['solar'],
  'http://127.0.0.1:3010/api/mock/buyer/sunrun-style/ping',
  'http://127.0.0.1:3010/api/mock/buyer/sunrun-style/post',
  'bearer',
  '{"token": "MOCK_TOKEN_SUNRUN"}'::jsonb,
  '{"first_name": "firstName", "last_name": "lastName", "email": "email", "phone": "phone", "zip": "zip", "state": "state", "monthly_bill": "billRange"}'::jsonb,
  '{"homeowner": true, "monthly_bill": ["100-200","200-300","300-plus"], "roof_shading": ["full-sun","partial-shade"]}'::jsonb,
  false,
  85.00,
  'Mock buyer simulating Sunrun-style installer — homeowner + bill $100+ + sun.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters, max_bid = EXCLUDED.max_bid;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_ModernizeSolar',
  true,
  ARRAY['solar'],
  'http://127.0.0.1:3010/api/mock/buyer/modernize-solar/ping',
  'http://127.0.0.1:3010/api/mock/buyer/modernize-solar/post',
  'apikey',
  '{"key": "MOCK_KEY_MODERNIZE", "header": "X-API-Key"}'::jsonb,
  '{"first_name": "fname", "last_name": "lname", "email": "email", "phone": "phone", "zip": "zip", "state": "state"}'::jsonb,
  '{"homeowner": true}'::jsonb,
  false,
  45.00,
  'Mock buyer aggregator (Modernize-style) — wide acceptance, lower payout.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;


-- ─────────────────────────────────────────────────────────────
-- VERTICAL: medicare-advantage
-- ─────────────────────────────────────────────────────────────
INSERT INTO verticals (id, name, active, schema, tcpa_template, funnel_config) VALUES (
  'medicare-advantage',
  'Medicare Advantage Plan Comparison',
  true,
  '{
    "type": "object",
    "required": ["phone", "first_name", "zip", "state", "age_range", "interest"],
    "properties": {
      "first_name":      {"type": "string", "minLength": 1, "maxLength": 50},
      "last_name":       {"type": "string", "maxLength": 50},
      "email":           {"type": "string", "format": "email"},
      "phone":           {"type": "string", "minLength": 10, "maxLength": 16},
      "zip":             {"type": "string", "minLength": 5, "maxLength": 10},
      "state":           {"type": "string", "minLength": 2, "maxLength": 2},
      "age_range":       {"enum": ["under-64", "64-65", "66-70", "71-75", "76-plus"]},
      "interest":        {"enum": ["advantage", "supplement", "part-d", "not-sure"]},
      "currently_enrolled": {"type": "boolean"},
      "tobacco":         {"type": "boolean"}
    }
  }'::jsonb,
  'By clicking SUBMIT, you authorize the company and {{buyers}} to contact you regarding Medicare Advantage, Medicare Supplement, and Part D prescription drug plans. You consent to receive marketing calls and SMS, including via automated technology, even if your number is on a Do Not Call list. Consent is not a condition of enrollment. We are not connected with or endorsed by the U.S. government or the federal Medicare program. Message and data rates may apply. Reply STOP to opt out.',
  '{
    "headline": "Compare Medicare plans in your area",
    "subheadline": "Free comparison — licensed agents only",
    "cta_label": "COMPARE PLANS",
    "success_title": "Thanks!",
    "success_message": "A licensed Medicare agent will reach out shortly to walk you through your options.",
    "steps": [
      {"id": "age_range", "type": "single-choice", "title": "What is your age?", "field": "age_range", "options": [
        {"value": "under-64", "label": "Under 64"},
        {"value": "64-65", "label": "64 – 65"},
        {"value": "66-70", "label": "66 – 70"},
        {"value": "71-75", "label": "71 – 75"},
        {"value": "76-plus", "label": "76 or older"}
      ]},
      {"id": "interest", "type": "single-choice", "title": "What kind of plan are you looking for?", "field": "interest", "options": [
        {"value": "advantage", "label": "Medicare Advantage (Part C)"},
        {"value": "supplement", "label": "Medicare Supplement (Medigap)"},
        {"value": "part-d", "label": "Part D prescription drug plan"},
        {"value": "not-sure", "label": "Not sure — help me compare"}
      ]},
      {"id": "currently_enrolled", "type": "single-choice", "title": "Are you currently enrolled in Medicare Parts A & B?", "field": "currently_enrolled", "options": [
        {"value": "true", "label": "Yes"},
        {"value": "false", "label": "Not yet"}
      ]},
      {"id": "tobacco", "type": "single-choice", "title": "Do you use tobacco products?", "field": "tobacco", "options": [
        {"value": "false", "label": "No"},
        {"value": "true", "label": "Yes"}
      ]},
      {"id": "contact", "type": "form", "title": "Where should the agent reach you?", "fields": ["first_name", "last_name", "email", "phone", "zip", "state"]}
    ]
  }'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  schema = EXCLUDED.schema,
  tcpa_template = EXCLUDED.tcpa_template,
  funnel_config = EXCLUDED.funnel_config;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_SelectQuoteSenior',
  true,
  ARRAY['medicare-advantage'],
  'http://127.0.0.1:3010/api/mock/buyer/selectquote-senior/ping',
  'http://127.0.0.1:3010/api/mock/buyer/selectquote-senior/post',
  'bearer',
  '{"token": "MOCK_TOKEN_SELECTQUOTE"}'::jsonb,
  '{"first_name": "firstName", "last_name": "lastName", "email": "email", "phone": "phone", "zip": "zip", "state": "state"}'::jsonb,
  '{"age_range": ["64-65","66-70","71-75","76-plus"], "interest": ["advantage","supplement","not-sure"]}'::jsonb,
  false,
  55.00,
  'Mock SelectQuote-style senior insurance broker — needs age 64+.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_HealthMarkets',
  true,
  ARRAY['medicare-advantage'],
  'http://127.0.0.1:3010/api/mock/buyer/healthmarkets/ping',
  'http://127.0.0.1:3010/api/mock/buyer/healthmarkets/post',
  'apikey',
  '{"key": "MOCK_KEY_HEALTHMARKETS", "header": "X-API-Key"}'::jsonb,
  '{"first_name": "fname", "last_name": "lname", "email": "email", "phone": "phone", "state": "state"}'::jsonb,
  '{"age_range": ["66-70","71-75","76-plus"]}'::jsonb,
  false,
  35.00,
  'Mock HealthMarkets-style aggregator — wider acceptance, lower payout.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;


-- ─────────────────────────────────────────────────────────────
-- VERTICAL: auto-insurance
-- ─────────────────────────────────────────────────────────────
INSERT INTO verticals (id, name, active, schema, tcpa_template, funnel_config) VALUES (
  'auto-insurance',
  'Auto Insurance Quote',
  true,
  '{
    "type": "object",
    "required": ["phone", "first_name", "zip", "state", "vehicles_count", "currently_insured"],
    "properties": {
      "first_name":         {"type": "string", "minLength": 1, "maxLength": 50},
      "last_name":          {"type": "string", "maxLength": 50},
      "email":              {"type": "string", "format": "email"},
      "phone":              {"type": "string", "minLength": 10, "maxLength": 16},
      "zip":                {"type": "string", "minLength": 5, "maxLength": 10},
      "state":              {"type": "string", "minLength": 2, "maxLength": 2},
      "vehicles_count":     {"enum": ["1", "2", "3-plus"]},
      "currently_insured":  {"type": "boolean"},
      "homeowner":          {"type": "boolean"},
      "dui_history":        {"type": "boolean"},
      "credit_range":       {"enum": ["excellent","good","fair","poor"]}
    }
  }'::jsonb,
  'By clicking GET QUOTES, you authorize the company and {{buyers}} to contact you at the phone and email provided regarding auto insurance offers. You consent to receive marketing calls and SMS, including via automated technology, even if your number is on a Do Not Call list. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to opt out.',
  '{
    "headline": "Compare auto insurance quotes — 60 seconds",
    "subheadline": "Drivers in your ZIP can save up to $987/yr",
    "cta_label": "GET MY QUOTES",
    "success_title": "Quotes on the way",
    "success_message": "Top-rated insurers will be in touch shortly with your personalized quote.",
    "steps": [
      {"id": "vehicles_count", "type": "single-choice", "title": "How many vehicles do you need to insure?", "field": "vehicles_count", "options": [
        {"value": "1", "label": "1 vehicle"},
        {"value": "2", "label": "2 vehicles"},
        {"value": "3-plus", "label": "3 or more"}
      ]},
      {"id": "currently_insured", "type": "single-choice", "title": "Are you currently insured?", "field": "currently_insured", "options": [
        {"value": "true", "label": "Yes"},
        {"value": "false", "label": "No"}
      ]},
      {"id": "homeowner", "type": "single-choice", "title": "Do you own your home?", "field": "homeowner", "options": [
        {"value": "true", "label": "Yes"},
        {"value": "false", "label": "No"}
      ]},
      {"id": "dui_history", "type": "single-choice", "title": "Any DUI in the last 5 years?", "field": "dui_history", "options": [
        {"value": "false", "label": "No"},
        {"value": "true", "label": "Yes"}
      ]},
      {"id": "credit_range", "type": "single-choice", "title": "How would you rate your credit?", "field": "credit_range", "options": [
        {"value": "excellent", "label": "Excellent"},
        {"value": "good", "label": "Good"},
        {"value": "fair", "label": "Fair"},
        {"value": "poor", "label": "Poor"}
      ]},
      {"id": "contact", "type": "form", "title": "Where should we send your quotes?", "fields": ["first_name", "last_name", "email", "phone", "zip", "state"]}
    ]
  }'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  schema = EXCLUDED.schema,
  tcpa_template = EXCLUDED.tcpa_template,
  funnel_config = EXCLUDED.funnel_config;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_QuoteWizardAuto',
  true,
  ARRAY['auto-insurance'],
  'http://127.0.0.1:3010/api/mock/buyer/quotewizard-auto/ping',
  'http://127.0.0.1:3010/api/mock/buyer/quotewizard-auto/post',
  'bearer',
  '{"token": "MOCK_TOKEN_QW"}'::jsonb,
  '{"first_name": "firstName", "last_name": "lastName", "email": "email", "phone": "phone", "zip": "zip", "state": "state"}'::jsonb,
  '{"dui_history": false, "credit_range": ["excellent","good","fair"]}'::jsonb,
  false,
  22.00,
  'Mock QuoteWizard-style aggregator — excludes DUI + poor credit.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_TheZebraAuto',
  true,
  ARRAY['auto-insurance'],
  'http://127.0.0.1:3010/api/mock/buyer/thezebra-auto/ping',
  'http://127.0.0.1:3010/api/mock/buyer/thezebra-auto/post',
  'apikey',
  '{"key": "MOCK_KEY_THEZEBRA", "header": "X-API-Key"}'::jsonb,
  '{"first_name": "fname", "last_name": "lname", "email": "email", "phone": "phone", "state": "state"}'::jsonb,
  '{"currently_insured": true, "homeowner": true}'::jsonb,
  false,
  18.00,
  'Mock The Zebra-style aggregator — premium segment (currently insured + homeowner).'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;


-- ─────────────────────────────────────────────────────────────
-- VERTICAL: home-services
-- ─────────────────────────────────────────────────────────────
INSERT INTO verticals (id, name, active, schema, tcpa_template, funnel_config) VALUES (
  'home-services',
  'Home Improvement Quote',
  true,
  '{
    "type": "object",
    "required": ["phone", "first_name", "zip", "state", "project_type", "timeline", "homeowner"],
    "properties": {
      "first_name":     {"type": "string", "minLength": 1, "maxLength": 50},
      "last_name":      {"type": "string", "maxLength": 50},
      "email":          {"type": "string", "format": "email"},
      "phone":          {"type": "string", "minLength": 10, "maxLength": 16},
      "zip":            {"type": "string", "minLength": 5, "maxLength": 10},
      "state":          {"type": "string", "minLength": 2, "maxLength": 2},
      "project_type":   {"enum": ["roofing","windows","siding","kitchen","bathroom","hvac","gutters","other"]},
      "timeline":       {"enum": ["immediately","1-3-months","3-6-months","just-researching"]},
      "homeowner":      {"type": "boolean"},
      "budget_range":   {"enum": ["under-5k","5-15k","15-30k","30k-plus"]}
    }
  }'::jsonb,
  'By clicking GET QUOTES, you authorize the company and {{buyers}} to contact you at the phone and email provided regarding home improvement projects. You consent to receive marketing calls and SMS, including via automated technology, even if your number is on a Do Not Call list. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to opt out.',
  '{
    "headline": "Get matched with vetted local contractors",
    "subheadline": "Free quotes — no obligation",
    "cta_label": "GET MY QUOTES",
    "success_title": "Match in progress",
    "success_message": "Top-rated contractors in your ZIP will reach out within 24 hours.",
    "steps": [
      {"id": "project_type", "type": "single-choice", "title": "What kind of project?", "field": "project_type", "options": [
        {"value": "roofing", "label": "Roofing"},
        {"value": "windows", "label": "Windows"},
        {"value": "siding", "label": "Siding"},
        {"value": "kitchen", "label": "Kitchen remodel"},
        {"value": "bathroom", "label": "Bathroom remodel"},
        {"value": "hvac", "label": "HVAC / heating / cooling"},
        {"value": "gutters", "label": "Gutters"},
        {"value": "other", "label": "Something else"}
      ]},
      {"id": "timeline", "type": "single-choice", "title": "When would you like to start?", "field": "timeline", "options": [
        {"value": "immediately", "label": "As soon as possible"},
        {"value": "1-3-months", "label": "Within 1–3 months"},
        {"value": "3-6-months", "label": "3–6 months"},
        {"value": "just-researching", "label": "Just researching for now"}
      ]},
      {"id": "homeowner", "type": "single-choice", "title": "Do you own the home?", "field": "homeowner", "options": [
        {"value": "true", "label": "Yes"},
        {"value": "false", "label": "No"}
      ]},
      {"id": "budget_range", "type": "single-choice", "title": "What is your approximate budget?", "field": "budget_range", "options": [
        {"value": "under-5k", "label": "Under $5K"},
        {"value": "5-15k", "label": "$5K – $15K"},
        {"value": "15-30k", "label": "$15K – $30K"},
        {"value": "30k-plus", "label": "$30K+"}
      ]},
      {"id": "contact", "type": "form", "title": "Who should the contractors contact?", "fields": ["first_name", "last_name", "email", "phone", "zip", "state"]}
    ]
  }'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  schema = EXCLUDED.schema,
  tcpa_template = EXCLUDED.tcpa_template,
  funnel_config = EXCLUDED.funnel_config;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_HomeAdvisorStyle',
  true,
  ARRAY['home-services'],
  'http://127.0.0.1:3010/api/mock/buyer/homeadvisor-style/ping',
  'http://127.0.0.1:3010/api/mock/buyer/homeadvisor-style/post',
  'bearer',
  '{"token": "MOCK_TOKEN_HA"}'::jsonb,
  '{"first_name": "firstName", "last_name": "lastName", "email": "email", "phone": "phone", "zip": "zip", "state": "state", "project_type": "projectCategory"}'::jsonb,
  '{"homeowner": true, "timeline": ["immediately","1-3-months","3-6-months"]}'::jsonb,
  false,
  35.00,
  'Mock HomeAdvisor/Angi-style — homeowner + ready-to-buy timeline.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_ModernizeHome',
  true,
  ARRAY['home-services'],
  'http://127.0.0.1:3010/api/mock/buyer/modernize-home/ping',
  'http://127.0.0.1:3010/api/mock/buyer/modernize-home/post',
  'apikey',
  '{"key": "MOCK_KEY_MODERNIZE_HOME", "header": "X-API-Key"}'::jsonb,
  '{"first_name": "fname", "last_name": "lname", "email": "email", "phone": "phone", "state": "state", "project_type": "category"}'::jsonb,
  '{"homeowner": true, "project_type": ["roofing","windows","siding","hvac"]}'::jsonb,
  false,
  28.00,
  'Mock Modernize-style — specialized in exterior/HVAC verticals.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;


-- ─────────────────────────────────────────────────────────────
-- VERTICAL: mass-tort
-- ─────────────────────────────────────────────────────────────
INSERT INTO verticals (id, name, active, schema, tcpa_template, funnel_config) VALUES (
  'mass-tort',
  'Legal Claim Evaluation',
  true,
  '{
    "type": "object",
    "required": ["phone", "first_name", "state", "case_type", "diagnosis_year"],
    "properties": {
      "first_name":      {"type": "string", "minLength": 1, "maxLength": 50},
      "last_name":       {"type": "string", "maxLength": 50},
      "email":           {"type": "string", "format": "email"},
      "phone":           {"type": "string", "minLength": 10, "maxLength": 16},
      "zip":             {"type": "string", "minLength": 5, "maxLength": 10},
      "state":           {"type": "string", "minLength": 2, "maxLength": 2},
      "case_type":       {"enum": ["camp-lejeune","paraquat","hair-relaxer","talc-ovarian","roundup","social-media-harm","other"]},
      "diagnosis_year":  {"enum": ["before-2000","2000-2010","2011-2020","2021-plus","not-sure"]},
      "represented":     {"type": "boolean"}
    }
  }'::jsonb,
  'By clicking SUBMIT, you authorize the company and {{buyers}} to contact you at the phone and email provided regarding your potential legal claim. You consent to receive marketing calls and SMS, including via automated technology, even if your number is on a Do Not Call list. This is not legal advice; no attorney-client relationship is formed by submitting this form. Consent is not a condition of any service. Message and data rates may apply. Reply STOP to opt out.',
  '{
    "headline": "Find out if you qualify for compensation",
    "subheadline": "Free claim evaluation — no fee unless you win",
    "cta_label": "EVALUATE MY CLAIM",
    "success_title": "Submitted",
    "success_message": "A claim intake specialist will contact you shortly to review your case at no cost.",
    "steps": [
      {"id": "case_type", "type": "single-choice", "title": "What is your claim about?", "field": "case_type", "options": [
        {"value": "camp-lejeune", "label": "Camp Lejeune water contamination"},
        {"value": "paraquat", "label": "Paraquat / Parkinson’s"},
        {"value": "hair-relaxer", "label": "Hair relaxer / cancer"},
        {"value": "talc-ovarian", "label": "Talc / ovarian cancer"},
        {"value": "roundup", "label": "Roundup / non-Hodgkin lymphoma"},
        {"value": "social-media-harm", "label": "Social media youth harm"},
        {"value": "other", "label": "Something else"}
      ]},
      {"id": "diagnosis_year", "type": "single-choice", "title": "When were you diagnosed or exposed?", "field": "diagnosis_year", "options": [
        {"value": "before-2000", "label": "Before 2000"},
        {"value": "2000-2010", "label": "2000 – 2010"},
        {"value": "2011-2020", "label": "2011 – 2020"},
        {"value": "2021-plus", "label": "2021 or later"},
        {"value": "not-sure", "label": "Not sure"}
      ]},
      {"id": "represented", "type": "single-choice", "title": "Are you already represented by an attorney?", "field": "represented", "options": [
        {"value": "false", "label": "No"},
        {"value": "true", "label": "Yes"}
      ]},
      {"id": "contact", "type": "form", "title": "Where can the intake specialist reach you?", "fields": ["first_name", "last_name", "email", "phone", "state"]}
    ]
  }'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  schema = EXCLUDED.schema,
  tcpa_template = EXCLUDED.tcpa_template,
  funnel_config = EXCLUDED.funnel_config;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_VerusIntake',
  true,
  ARRAY['mass-tort'],
  'http://127.0.0.1:3010/api/mock/buyer/verus-intake/ping',
  'http://127.0.0.1:3010/api/mock/buyer/verus-intake/post',
  'bearer',
  '{"token": "MOCK_TOKEN_VERUS"}'::jsonb,
  '{"first_name": "firstName", "last_name": "lastName", "email": "email", "phone": "phone", "state": "state", "case_type": "claimType"}'::jsonb,
  '{"represented": false, "case_type": ["camp-lejeune","paraquat","roundup","talc-ovarian"]}'::jsonb,
  true,
  220.00,
  'Mock Verus-style intake — high-payout exclusive, only headline torts.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters, max_bid = EXCLUDED.max_bid;

INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_LegalIntakeAggregator',
  true,
  ARRAY['mass-tort'],
  'http://127.0.0.1:3010/api/mock/buyer/legal-intake-agg/ping',
  'http://127.0.0.1:3010/api/mock/buyer/legal-intake-agg/post',
  'apikey',
  '{"key": "MOCK_KEY_LEGAL_AGG", "header": "X-API-Key"}'::jsonb,
  '{"first_name": "fname", "last_name": "lname", "email": "email", "phone": "phone", "state": "state"}'::jsonb,
  '{"represented": false}'::jsonb,
  false,
  60.00,
  'Mock legal-intake aggregator — wider acceptance, mid payout.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;

-- ============================================================
-- DISPLAY NAMES — One-to-One Consent FCC (Jan 2025)
-- Popolare display_name leggibile per ciascun buyer (anche mock).
-- ============================================================
UPDATE buyers SET display_name = 'SmartAsset (mock)'        WHERE name = 'Mock_SmartAsset';
UPDATE buyers SET display_name = 'Trust & Will (mock)'      WHERE name = 'Mock_TrustWill';
UPDATE buyers SET display_name = 'AAG Reverse (mock)'       WHERE name = 'Mock_AAGReverse';
UPDATE buyers SET display_name = 'Mutual of Omaha (mock)'   WHERE name = 'Mock_MutualLTC';
UPDATE buyers SET display_name = 'Sunrun-style (mock)'      WHERE name = 'Mock_SunrunStyle';
UPDATE buyers SET display_name = 'Modernize Solar (mock)'   WHERE name = 'Mock_ModernizeSolar';
UPDATE buyers SET display_name = 'SelectQuote Senior (mock)' WHERE name = 'Mock_SelectQuoteSenior';
UPDATE buyers SET display_name = 'HealthMarkets (mock)'     WHERE name = 'Mock_HealthMarkets';
UPDATE buyers SET display_name = 'QuoteWizard Auto (mock)'  WHERE name = 'Mock_QuoteWizardAuto';
UPDATE buyers SET display_name = 'The Zebra Auto (mock)'    WHERE name = 'Mock_TheZebraAuto';
UPDATE buyers SET display_name = 'HomeAdvisor-style (mock)' WHERE name = 'Mock_HomeAdvisorStyle';
UPDATE buyers SET display_name = 'Modernize Home (mock)'    WHERE name = 'Mock_ModernizeHome';
UPDATE buyers SET display_name = 'Verus Intake (mock)'      WHERE name = 'Mock_VerusIntake';
UPDATE buyers SET display_name = 'Legal Intake Aggregator (mock)' WHERE name = 'Mock_LegalIntakeAggregator';
