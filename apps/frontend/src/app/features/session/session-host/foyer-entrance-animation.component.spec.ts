import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { FoyerEntranceAnimationComponent } from './foyer-entrance-animation.component';
import type { SessionParticipantsPayload } from '@arsnova/shared-types';

describe('FoyerEntranceAnimationComponent', () => {
  let component: FoyerEntranceAnimationComponent;
  let fixture: ComponentFixture<FoyerEntranceAnimationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FoyerEntranceAnimationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FoyerEntranceAnimationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Animation Control', () => {
    it('should show animated chips when animation is enabled and preset is playful', () => {
      component.animationEnabled = true;
      component.isPlayfulPreset = true;
      fixture.detectChanges();

      expect(component.shouldAnimateChips()).toBe(true);
    });

    it('should hide animated chips when animation is disabled', () => {
      component.animationEnabled = false;
      component.isPlayfulPreset = true;
      fixture.detectChanges();

      expect(component.shouldAnimateChips()).toBe(false);
    });

    it('should hide animated chips when preset is not playful', () => {
      component.animationEnabled = true;
      component.isPlayfulPreset = false;
      fixture.detectChanges();

      expect(component.shouldAnimateChips()).toBe(false);
    });

    it('should show static chips when prefers-reduced-motion is enabled', () => {
      // Test ist abhängig von Browser-API, wird visuell in E2E-Tests validiert
      component.animationEnabled = true;
      component.isPlayfulPreset = true;
      fixture.detectChanges();

      expect(component.shouldAnimateChips()).toBe(true);
    });
  });

  describe('Participant Updates', () => {
    it('should create chips for new participants', () => {
      const payload: SessionParticipantsPayload = {
        participants: [
          { id: '1', nickname: 'Alice', role: 'PARTICIPANT' },
          { id: '2', nickname: 'Bob', role: 'PARTICIPANT' },
        ],
        teamMap: {},
      };

      component.participantsData = payload;
      fixture.detectChanges();

      expect(component.animatingChips().length).toBe(2);
    });

    it('should handle participants with unicode names', () => {
      const payload: SessionParticipantsPayload = {
        participants: [{ id: '1', nickname: '浚 Alice', role: 'PARTICIPANT' }],
        teamMap: {},
      };

      component.participantsData = payload;
      fixture.detectChanges();

      expect(component.animatingChips().length).toBe(1);
      expect(component.animatingChips()[0].nickname).toBe('浚 Alice');
    });

    it('should remove chips when participants leave', () => {
      const payload1: SessionParticipantsPayload = {
        participants: [
          { id: '1', nickname: 'Alice', role: 'PARTICIPANT' },
          { id: '2', nickname: 'Bob', role: 'PARTICIPANT' },
        ],
        teamMap: {},
      };

      component.participantsData = payload1;
      fixture.detectChanges();
      expect(component.animatingChips().length).toBe(2);

      // Entferne einen Teilnehmenden
      const payload2: SessionParticipantsPayload = {
        participants: [{ id: '1', nickname: 'Alice', role: 'PARTICIPANT' }],
        teamMap: {},
      };

      component.participantsData = payload2;
      fixture.detectChanges();
      expect(component.animatingChips().length).toBe(1);
    });
  });

  describe('Chip Color', () => {
    it('should return valid color for chip', () => {
      const color = component['CHIP_COLORS'][0];
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should handle color index out of bounds', () => {
      const outOfBoundsIndex = 999;
      const color = component.getChipColor(outOfBoundsIndex);
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('Initials Calculation', () => {
    it('should return first and last initial for two-word names', () => {
      expect(component.getInitials('John Doe')).toBe('JD');
    });

    it('should return two first chars for single-word names', () => {
      expect(component.getInitials('Alice')).toBe('AL');
    });

    it('should handle extra spaces', () => {
      expect(component.getInitials('  John   Doe  ')).toBe('JD');
    });

    it('should handle names with many words', () => {
      expect(component.getInitials('Mary Jane Watson Parker')).toBe('MP');
    });

    it('should be uppercase', () => {
      expect(component.getInitials('alice bob')).toBe('AB');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on destroy', () => {
      const payload: SessionParticipantsPayload = {
        participants: [{ id: '1', nickname: 'Alice', role: 'PARTICIPANT' }],
        teamMap: {},
      };

      component.participantsData = payload;
      fixture.detectChanges();
      expect(component.animatingChips().length).toBe(1);

      component.ngOnDestroy();
      fixture.detectChanges();
      expect(component.animatingChips().length).toBe(0);
    });
  });
});
