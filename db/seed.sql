-- ============================================================
-- Seed iniziale — Vertical 1: elder-wealth + buyer mock
-- ============================================================

-- VERTICAL: elder-wealth (Senior Wealth Protection)
INSERT INTO verticals (id, name, active, schema, tcpa_template, funnel_config) VALUES (
  'elder-wealth',
  'Senior Wealth Protection',
  true,
  '{
    "type": "object",
    "required": ["phone", "first_name", "zip", "state", "age_range", "assets_range", "planning_focus"],
    "properties": {
      "first_name":     {"type": "string", "minLength": 1, "maxLength": 50},
      "last_name":      {"type": "string", "maxLength": 50},
      "email":          {"type": "string", "format": "email"},
      "phone":          {"type": "string", "minLength": 10, "maxLength": 16},
      "zip":            {"type": "string", "minLength": 5, "maxLength": 10},
      "state":          {"type": "string", "minLength": 2, "maxLength": 2},
      "age_range":      {"enum": ["under-40", "40-49", "50-59", "60-69", "70+"]},
      "assets_range":   {"enum": ["under-100k", "100-250k", "250-500k", "500k-1m", "1m-plus"]},
      "planning_focus": {"enum": ["estate-trust", "financial-advisor", "ltc-insurance", "reverse-mortgage", "multiple"]},
      "has_advisor":    {"type": "boolean"},
      "homeowner":      {"type": "boolean"}
    }
  }'::jsonb,
  'By clicking SUBMIT, you agree that the company and its marketing partners may contact you at the phone number and email provided regarding senior wealth protection, estate planning, financial advisor matching, long-term care insurance, and reverse mortgage information. You consent to receive marketing calls and SMS messages, including those made via automated technology, even if your number is on a Do Not Call list. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to opt out.',
  '{
    "steps": [
      {"id": "planning_focus", "type": "single-choice", "title": "What are you focusing on?", "field": "planning_focus", "options": [
        {"value": "estate-trust", "label": "Estate planning / trust"},
        {"value": "financial-advisor", "label": "Finding a financial advisor"},
        {"value": "ltc-insurance", "label": "Long-term care insurance"},
        {"value": "reverse-mortgage", "label": "Reverse mortgage"},
        {"value": "multiple", "label": "Multiple of the above"}
      ]},
      {"id": "age_range", "type": "single-choice", "title": "What is your age range?", "field": "age_range", "options": [
        {"value": "under-40", "label": "Under 40"},
        {"value": "40-49", "label": "40-49"},
        {"value": "50-59", "label": "50-59"},
        {"value": "60-69", "label": "60-69"},
        {"value": "70+", "label": "70+"}
      ]},
      {"id": "assets_range", "type": "single-choice", "title": "What are your investable assets?", "field": "assets_range", "options": [
        {"value": "under-100k", "label": "Under $100K"},
        {"value": "100-250k", "label": "$100K – $250K"},
        {"value": "250-500k", "label": "$250K – $500K"},
        {"value": "500k-1m", "label": "$500K – $1M"},
        {"value": "1m-plus", "label": "Over $1M"}
      ]},
      {"id": "has_advisor", "type": "single-choice", "title": "Do you currently work with a financial advisor?", "field": "has_advisor", "options": [
        {"value": "false", "label": "No"},
        {"value": "true", "label": "Yes"}
      ]},
      {"id": "homeowner", "type": "single-choice", "title": "Do you own your home?", "field": "homeowner", "options": [
        {"value": "true", "label": "Yes"},
        {"value": "false", "label": "No"}
      ]},
      {"id": "contact", "type": "form", "title": "Almost done — where should advisors reach you?", "fields": ["first_name", "last_name", "email", "phone", "zip", "state"]}
    ]
  }'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  schema = EXCLUDED.schema,
  tcpa_template = EXCLUDED.tcpa_template,
  funnel_config = EXCLUDED.funnel_config;

-- ============================================================
-- BUYERS mock per testing locale
-- In produzione: sostituire ping_url/post_url con endpoint reali
-- ============================================================

-- Buyer 1: SmartAsset-style (financial advisor matching, premium)
INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_SmartAsset',
  true,
  ARRAY['elder-wealth'],
  'http://127.0.0.1:3010/api/mock/buyer/smartasset/ping',
  'http://127.0.0.1:3010/api/mock/buyer/smartasset/post',
  'bearer',
  '{"token": "MOCK_TOKEN_SMARTASSET"}'::jsonb,
  '{"first_name": "firstName", "last_name": "lastName", "phone": "primaryPhone", "email": "emailAddress", "zip": "zipCode", "state": "stateCode", "assets_range": "assetsRange", "age_range": "ageRange"}'::jsonb,
  '{"age_range": ["50-59","60-69","70+"], "assets_range": ["250-500k","500k-1m","1m-plus"], "has_advisor": false, "planning_focus": ["financial-advisor","multiple"]}'::jsonb,
  false,
  300.00,
  'Mock buyer simulating SmartAsset acceptance criteria — high payout for HNW pre-retirement leads with no current advisor.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters, max_bid = EXCLUDED.max_bid;

-- Buyer 2: Trust & Will-style (online estate planning, CPA mid-tier)
INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_TrustWill',
  true,
  ARRAY['elder-wealth'],
  'http://127.0.0.1:3010/api/mock/buyer/trustwill/ping',
  'http://127.0.0.1:3010/api/mock/buyer/trustwill/post',
  'apikey',
  '{"key": "MOCK_KEY_TRUSTWILL", "header": "X-API-Key"}'::jsonb,
  '{"first_name": "fname", "last_name": "lname", "email": "email", "phone": "phone", "state": "state"}'::jsonb,
  '{"planning_focus": ["estate-trust","multiple"]}'::jsonb,
  false,
  60.00,
  'Mock buyer simulating Trust & Will affiliate — accepts wide age/asset range, lower payout.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;

-- Buyer 3: AAG Reverse Mortgage-style (62+ with home equity)
INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_AAGReverse',
  true,
  ARRAY['elder-wealth'],
  'http://127.0.0.1:3010/api/mock/buyer/aag/ping',
  'http://127.0.0.1:3010/api/mock/buyer/aag/post',
  'bearer',
  '{"token": "MOCK_TOKEN_AAG"}'::jsonb,
  '{"first_name": "first_name", "last_name": "last_name", "phone": "phone_number", "email": "email", "zip": "zip_code"}'::jsonb,
  '{"age_range": ["60-69","70+"], "homeowner": true, "planning_focus": ["reverse-mortgage","multiple"]}'::jsonb,
  false,
  150.00,
  'Mock buyer simulating AAG/Mutual of Omaha Reverse — strict age 62+ + homeowner.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;

-- Buyer 4: Mutual of Omaha LTC-style
INSERT INTO buyers (name, active, active_in_verticals, ping_url, post_url, auth_type, auth_config, field_mapping, filters, exclusive, max_bid, notes) VALUES (
  'Mock_MutualLTC',
  true,
  ARRAY['elder-wealth'],
  'http://127.0.0.1:3010/api/mock/buyer/mutual-ltc/ping',
  'http://127.0.0.1:3010/api/mock/buyer/mutual-ltc/post',
  'basic',
  '{"username": "MOCK_USER", "password": "MOCK_PASS"}'::jsonb,
  '{"first_name": "fname", "last_name": "lname", "phone": "tel", "email": "email", "state": "state"}'::jsonb,
  '{"age_range": ["50-59","60-69","70+"], "assets_range": ["100-250k","250-500k","500k-1m","1m-plus"], "planning_focus": ["ltc-insurance","multiple"]}'::jsonb,
  false,
  120.00,
  'Mock buyer simulating Mutual of Omaha LTC — targeting 50+ with $100K+ assets.'
) ON CONFLICT (name) DO UPDATE SET filters = EXCLUDED.filters;
