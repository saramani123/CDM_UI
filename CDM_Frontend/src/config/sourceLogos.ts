import quickbooksLogo from '../LOGOS_Sources/quickbooks.svg';
import netsuiteLogo from '../LOGOS_Sources/Oracle-NetSuite.png';
import squareLogo from '../LOGOS_Sources/square.png';
import stripeLogo from '../LOGOS_Sources/stripe.png';
import xeroLogo from '../LOGOS_Sources/xero.svg';
import evernestLogo from '../LOGOS_Sources/evernest.png';
import northpointLogo from '../LOGOS_Sources/northpoint.webp';
import darwinLogo from '../LOGOS_Sources/darwin.png';
import hrgLogo from '../LOGOS_Sources/hrg.png';
import myndLogo from '../LOGOS_Sources/mynd.png';
import sapS4hanaLogo from '../LOGOS_Sources/sap-s4hana.png';
import dynamics365FinanceLogo from '../LOGOS_Sources/dynamics-365-finance.svg';
import sageIntacctLogo from '../LOGOS_Sources/sage-intacct.png';
import sapEccLogo from '../LOGOS_Sources/sap-ecc.webp';
import salesforceLogo from '../LOGOS_Sources/salesforce.png';
import hubspotLogo from '../LOGOS_Sources/hubspot.png';
import adyenLogo from '../LOGOS_Sources/adyen.png';
import paypalLogo from '../LOGOS_Sources/paypal.webp';
import workivaLogo from '../LOGOS_Sources/workiva.png';
import activeDisclosureLogo from '../LOGOS_Sources/active-disclosure.webp';
import blacklineLogo from '../LOGOS_Sources/blackline.png';
import coupaLogo from '../LOGOS_Sources/coupa.webp';
import billComLogo from '../LOGOS_Sources/bill-com.avif';
import bloombergLogo from '../LOGOS_Sources/bloomberg.png';
import blackrockAladdinLogo from '../LOGOS_Sources/blackrock-aladdin.png';
import morningstarDirectLogo from '../LOGOS_Sources/morningstar-direct.png';
import factsetLogo from '../LOGOS_Sources/factset.png';
import guidewireLogo from '../LOGOS_Sources/guidewire.png';
import duckCreekLogo from '../LOGOS_Sources/duck-creek.png';
import corityLogo from '../LOGOS_Sources/cority.png';
import metricstreamLogo from '../LOGOS_Sources/metricstream.avif';
import energysysLogo from '../LOGOS_Sources/energysys.webp';
import energyComponentsLogo from '../LOGOS_Sources/energy-components.png';
import synergiLogo from '../LOGOS_Sources/synergi.png';
import prometheusLogo from '../LOGOS_Sources/prometheus.png';
import docuflowLogo from '../LOGOS_Sources/docuflow.png';

/**
 * Local brand art under `src/LOGOS_Sources` (keys match `source_key` from API).
 * Intentionally local-only so logos are fully controlled by files you add.
 */
const LOCAL_LOGO_BY_KEY: Record<string, string> = {
  quickbooks: quickbooksLogo,
  netsuite: netsuiteLogo,
  square: squareLogo,
  stripe: stripeLogo,
  xero: xeroLogo,
  evernest: evernestLogo,
  northpoint: northpointLogo,
  darwin: darwinLogo,
  hrg: hrgLogo,
  mynd: myndLogo,
  sap_s4hana: sapS4hanaLogo,
  dynamics_365_finance: dynamics365FinanceLogo,
  sage_intacct: sageIntacctLogo,
  sap_ecc: sapEccLogo,
  salesforce: salesforceLogo,
  hubspot: hubspotLogo,
  adyen: adyenLogo,
  paypal: paypalLogo,
  workiva: workivaLogo,
  active_disclosure: activeDisclosureLogo,
  blackline: blacklineLogo,
  coupa: coupaLogo,
  bill_com: billComLogo,
  bloomberg: bloombergLogo,
  blackrock_aladdin: blackrockAladdinLogo,
  morningstar_direct: morningstarDirectLogo,
  factset: factsetLogo,
  guidewire: guidewireLogo,
  duck_creek: duckCreekLogo,
  cority: corityLogo,
  cority_iir: corityLogo,
  metricstream: metricstreamLogo,
  energysys: energysysLogo,
  energy_components: energyComponentsLogo,
  synergi: synergiLogo,
  prometheus_suite: prometheusLogo,
  prometheus_pm: prometheusLogo,
  prometheus_scheduler: prometheusLogo,
  docuflow: docuflowLogo,
};

export function logoUrlForSourceKey(sourceKey: string): string | undefined {
  const k = (sourceKey ?? '').trim().toLowerCase();
  return LOCAL_LOGO_BY_KEY[k];
}
