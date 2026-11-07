import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { QuizComponent } from './quiz.component';

@Component({ template: '' })
class QuizChildStubComponent {}

describe('QuizComponent collection layout', () => {
  it('beschränkt die breite Sammlung auf die Listenroute, auch bei Navigation zwischen Kindrouten', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'quiz',
            component: QuizComponent,
            children: [
              { path: '', component: QuizChildStubComponent },
              { path: 'new', component: QuizChildStubComponent },
              { path: 'sync/:docId', component: QuizChildStubComponent },
              { path: ':id/preview', component: QuizChildStubComponent },
              { path: ':id', component: QuizChildStubComponent },
            ],
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    for (const [url, collection, compact] of [
      ['/quiz', true, false],
      ['/quiz/new', false, false],
      ['/quiz/example', false, false],
      ['/quiz/example/preview', false, false],
      ['/quiz/sync/room', false, true],
      ['/quiz?start=live', true, false],
    ] as const) {
      await harness.navigateByUrl(url);
      const page = harness.routeNativeElement!.querySelector('.l-page')!;
      expect(page.classList.contains('quiz-page--collection'), url).toBe(collection);
      expect(page.classList.contains('l-section'), url).toBe(compact);
    }
  });
});
