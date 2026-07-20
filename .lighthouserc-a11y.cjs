module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:4173/de/',
        'http://localhost:4173/en/',
        'http://localhost:4173/de/quiz',
        'http://localhost:4173/de/help',
        'http://localhost:4173/de/legal/privacy',
        'http://localhost:4173/de/legal/accessibility',
      ],
      numberOfRuns: 1,
      settings: {
        onlyCategories: ['accessibility'],
        chromeFlags: '--headless=new --no-sandbox --disable-gpu',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci-a11y',
    },
  },
};
