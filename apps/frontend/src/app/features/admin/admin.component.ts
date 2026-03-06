import { Component } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';

/**
 * Admin-Dashboard (Epic 9). Ohne gültige Admin-Auth nur Login/Platzhalter.
 * Story 9.1, 9.2, 9.3.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [MatCard, MatCardContent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {}
