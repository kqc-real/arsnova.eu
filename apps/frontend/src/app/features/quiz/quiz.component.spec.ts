import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { QuizComponent } from './quiz.component';

@Component({ template: '' })
class QuizChildStubComponent {}

describe('QuizComponent collection layout', () => {
  it('beschränkt die breite Sammlung mit und ohne Locale-Elternroute auf die Listenroute', async () => {
    const quizRoute = {
      path: 'quiz',
      component: QuizComponent,
      children: [
        { path: '', component: QuizChildStubComponent },
        { path: 'new', component: QuizChildStubComponent },
        { path: 'sync/:docId', component: QuizChildStubComponent },
        {
          path: ':id',
          component: QuizChildStubComponent,
          children: [{ path: 'preview', component: QuizChildStubComponent }],
        },
      ],
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([quizRoute, { path: ':locale', children: [quizRoute] }])],
    });
    const harness = await RouterTestingHarness.create();
    for (const [url, collection, compact, header] of [
      ['/quiz', true, false, true],
      ['/quiz/new', false, false, true],
      ['/quiz/example', false, false, true],
      ['/quiz/example/preview', false, false, false],
      ['/quiz/sync/room', false, true, true],
      ['/quiz?start=live', true, false, true],
      ['/de/quiz', true, false, true],
      ['/de/quiz/new', false, false, true],
      ['/de/quiz/example', false, false, true],
      ['/de/quiz/example/preview', false, false, false],
      ['/de/quiz/sync/room', false, true, true],
    ] as const) {
      await harness.navigateByUrl(url);
      const page = harness.routeNativeElement!.querySelector('.l-page')!;
      expect(page.classList.contains('quiz-page--collection'), url).toBe(collection);
      expect(page.classList.contains('l-section'), url).toBe(compact);
      expect(!!page.querySelector('.quiz-page__header'), url).toBe(header);
    }
  });
});
