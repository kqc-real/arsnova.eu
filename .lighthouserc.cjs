module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/de/', 'http://localhost:4173/en/'],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--headless=new --no-sandbox --disable-gpu',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.6 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        // Median statt Einzellauf: GitHub-Runner schwanken stärker als lokaler Prod-Serve
        // (QA-Nachlauf 2026-07-11: TBT 138–199 ms lokal; CI-Median ~700 ms).
        'total-blocking-time': [
          'error',
          { maxNumericValue: 750, aggregationMethod: 'median' },
        ],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
