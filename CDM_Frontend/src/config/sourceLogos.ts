import quickbooksLogo from '../LOGOS_Sources/Quickbooks Logo.svg';
import netsuiteLogo from '../LOGOS_Sources/NetSuite-Logo.png';
import squareLogo from '../LOGOS_Sources/Square Logo.png';
import stripeLogo from '../LOGOS_Sources/stripe logo.png';
import xeroLogo from '../LOGOS_Sources/Xero Logo.svg';
import evernestLogo from '../LOGOS_Sources/evernest.png';
import northpointLogo from '../LOGOS_Sources/northpoint logo.webp';
import darwinLogo from '../LOGOS_Sources/darwin logo.png';
import hrgLogo from '../LOGOS_Sources/homeriver logo.png';
import myndLogo from '../LOGOS_Sources/mynd.png';

/** Local brand art under `src/LOGOS_Sources` (keys match `source_key` from API). */
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
};

export function logoUrlForSourceKey(sourceKey: string): string | undefined {
  const k = (sourceKey ?? '').trim().toLowerCase();
  return LOCAL_LOGO_BY_KEY[k];
}
