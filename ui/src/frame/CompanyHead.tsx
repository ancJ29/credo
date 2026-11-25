import { barColour } from '../design-system/barColour';
import { BEFORE_CONFIG } from '../brand';

/**
 * What a company's page puts in the head, which React hoists from wherever it is drawn: the link to
 * the company's phone-app description where the address or the device names one, and, once the
 * settings are known, the tab icon, the icon an iPhone's home screen takes and the bar's colour in
 * the header's; before them, the bar in credo's own colour and no icon. A screen of no company draws
 * none of the company's (`manifest` null, no `company`).
 */
export function CompanyHead({
  manifest,
  company,
}: {
  manifest: string | null;
  company?: { tabIcon: string; appIcon: string; colour: string; whiteHeader: boolean };
}) {
  return (
    <>
      {manifest !== null && <link rel="manifest" href={manifest} />}
      {company && <link rel="icon" type="image/png" href={company.tabIcon} />}
      {company && <link rel="apple-touch-icon" href={company.appIcon} />}
      <meta
        name="theme-color"
        content={company ? barColour(company.colour, company.whiteHeader) : BEFORE_CONFIG.colour}
      />
    </>
  );
}
