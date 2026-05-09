'use client';

// ============================================================
// TrustedForm + Jornaya capture scripts (client-side only)
//
// Iniettano gli script ufficiali se le env client sono settate.
// Il cert URL viene scritto in <input name="xxTrustedFormCertUrl"/>
// (TrustedForm) e <input name="leadid_token"/> (Jornaya), che il
// FunnelClient legge al submit.
//
// Env client (devono essere prefissate NEXT_PUBLIC_ in Next.js):
//   NEXT_PUBLIC_TRUSTEDFORM_ENABLED=1
//   NEXT_PUBLIC_JORNAYA_ACCOUNT_ID=<your account id>
// ============================================================

import Script from 'next/script';

export function TrustedFormScript() {
  if (process.env.NEXT_PUBLIC_TRUSTEDFORM_ENABLED !== '1') return null;

  // Lo script ufficiale di ActiveProspect — inietta input hidden
  // xxTrustedFormCertUrl, xxTrustedFormPingUrl, xxTrustedFormCertToken nei form.
  // Vedi: https://activeprospect.com/products/trustedform/
  return (
    <>
      <Script
        id="trustedform-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var tf = document.createElement('script');
              tf.type = 'text/javascript';
              tf.async = true;
              tf.src = ('https:' === document.location.protocol ? 'https' : 'http')
                + '://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&ping_field=xxTrustedFormPingUrl&l='
                + new Date().getTime() + Math.random()
                + '&use_tagged_consent=true';
              var s = document.getElementsByTagName('script')[0];
              s.parentNode.insertBefore(tf, s);
            })();
          `
        }}
      />
      <noscript>
        <img src="https://api.trustedform.com/ns.gif" alt="" />
      </noscript>
    </>
  );
}

export function JornayaScript() {
  const accountId = process.env.NEXT_PUBLIC_JORNAYA_ACCOUNT_ID;
  if (!accountId) return null;

  // Jornaya / LeadiD — inietta input hidden leadid_token nei form.
  return (
    <Script
      id="jornaya-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var s = document.createElement('script');
            s.id = 'LeadiDscript_campaign';
            s.type = 'text/javascript';
            s.async = true;
            s.src = '//create.lidstatic.com/campaign/${accountId}.js?snippet_version=2';
            var x = document.getElementsByTagName('script')[0];
            x.parentNode.insertBefore(s, x);
          })();
        `
      }}
    />
  );
}

// Hidden inputs che gli script TF/Jornaya popoleranno se renderizzati dentro
// un <form>. Per il nostro funnel multi-step usiamo lookup via querySelector,
// ma includere questi nei form/contact step migliora l'attribuzione.
export function ComplianceHiddenInputs() {
  return (
    <>
      <input type="hidden" name="xxTrustedFormCertUrl" id="xxTrustedFormCertUrl_0" />
      <input type="hidden" name="xxTrustedFormPingUrl" id="xxTrustedFormPingUrl_0" />
      <input type="hidden" name="xxTrustedFormCertToken" id="xxTrustedFormCertToken_0" />
      <input type="hidden" name="leadid_token" id="leadid_token" />
    </>
  );
}
