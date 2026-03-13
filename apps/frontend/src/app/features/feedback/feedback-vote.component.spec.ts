import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackVoteComponent } from './feedback-vote.component';

const {
  quickFeedbackResultsQueryMock,
  quickFeedbackVoteMutateMock,
} = vi.hoisted(() => ({
  quickFeedbackResultsQueryMock: vi.fn(),
  quickFeedbackVoteMutateMock: vi.fn(),
}));

vi.mock('../../core/trpc.client', () => ({
  trpc: {
    quickFeedback: {
      results: { query: quickFeedbackResultsQueryMock },
      vote: { mutate: quickFeedbackVoteMutateMock },
    },
  },
}));

describe('FeedbackVoteComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quickFeedbackResultsQueryMock.mockResolvedValue({
      type: 'YESNO',
      theme: 'system',
      preset: 'serious',
      locked: false,
      discussion: false,
      totalVotes: 0,
      distribution: { YES: 0, NO: 0, MAYBE: 0 },
      currentRound: 1,
    });
    quickFeedbackVoteMutateMock.mockResolvedValue({});

    TestBed.configureTestingModule({
      imports: [FeedbackVoteComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
      ],
    });
  });

  it('lädt eingebettetes Blitz-Feedback nach gesetztem Session-Code-Input', async () => {
    const fixture = TestBed.createComponent(FeedbackVoteComponent);
    fixture.componentRef.setInput('sessionCode', 'ABC123');
    fixture.componentRef.setInput('participantId', 'participant-1');
    fixture.componentRef.setInput('embeddedInSession', true);
    fixture.componentRef.setInput('showSessionCode', false);

    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(quickFeedbackResultsQueryMock).toHaveBeenCalledWith({ sessionCode: 'ABC123' });
    expect(text).toContain('ja · nein · vielleicht');
    fixture.destroy();
  });
});
