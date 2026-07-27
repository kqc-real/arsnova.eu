/**
 * Rechtliche Angaben für Impressum & Datenschutz.
 */
export const legal = {
  provider: {
    /** Anbieter / verantwortliche Person */
    name: 'Prof. Dr.-Ing. habil. Klaus Quibeldey-Cirkel',
    /** Institution / Zugehörigkeit (optional) */
    institution: 'IU Internationale Hochschule · Duales Studium',
    address: {
      /** Straße und Hausnummer */
      street: 'Juri-Gagarin-Ring 152',
      /** PLZ und Ort */
      city: '99084 Erfurt',
      /** Land */
      country: 'Deutschland',
    },
    contact: {
      /** E-Mail für Kontakt */
      email: 'klaus.quibeldey-cirkel@iu.org',
      /** Website (optional) */
      website: 'https://www.iu-dualesstudium.de',
      /** Telefon (optional, leer lassen wenn nicht gewünscht) */
      phone: '',
    },
    /** Verantwortlich für journalistisch-redaktionelle Inhalte */
    editorialResponsible:
      'Prof. Dr.-Ing. habil. Klaus Quibeldey-Cirkel, Juri-Gagarin-Ring 152, 99084 Erfurt',
    /** Umsatzsteuer-ID (optional, leer wenn nicht vorhanden) */
    vatId: '',
    /** Aufsichtsbehörde (optional) */
    supervisoryAuthority: '',
  },
  privacy: {
    /** E-Mail für Datenschutzanfragen */
    email: 'klaus.quibeldey-cirkel@iu.org',
  },
  hosting: {
    /** Hosting der Landing-Seite */
    provider: 'GitHub, Inc. (GitHub Pages)',
    /** Land bzw. Drittlandbezug des Hosting-Anbieters */
    location: 'USA',
    /** Datenschutzhinweise des Hosting-Anbieters */
    privacyUrl: 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement',
  },
} as const;

export const site = {
  name: 'arsnova.eu',
  landingUrl: 'https://info.arsnova.eu',
  appUrl: 'https://arsnova.eu',
  landingLabel: 'Landing- und Informationsseite',
  appLabel: 'Live-Anwendung für Quiz, Abstimmungen und Q&A',
} as const;
