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
        // CI-Runner liegen oft ~4,0–4,1 s LCP (Bestwert), lokal eher ~3,7–3,8 s.
        // 5 s lässt bewusst Luft; 4,0 s war dauerhaft auf der Kippe (PR #330).
        'largest-contentful-paint': ['error', { maxNumericValue: 5000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        // Median statt Einzellauf: GitHub-Runner schwanken stärker als lokaler Prod-Serve
        // (QA-Nachlauf 2026-07-11: TBT 138–199 ms lokal; CI-Median oft 700–850 ms).
        'total-blocking-time': ['error', { maxNumericValue: 850, aggregationMethod: 'median' }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
