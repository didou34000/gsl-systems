/** Shared artwork for the website, account screens, browser icons and emails. */
export const brandAssets = {
  name: 'GSL systems',
  logo: '/brand/gsl-systems-logo.png',
  width: 620,
  height: 302,
  icon: '/favicon.svg?v=gsl-20261013',
  iconPng: '/favicon-32.png?v=gsl-20261013',
  shortcut: '/favicon.ico?v=gsl-20261013',
  apple: '/apple-touch-icon.png?v=gsl-20261013',
  social: '/brand/gsl-systems-social.png',
} as const;

/** Public social profiles shown at the top of the footer. An empty value hides the icon. */
export const socialLinks = {
  linkedin: '',
  instagram: '',
} as const;
