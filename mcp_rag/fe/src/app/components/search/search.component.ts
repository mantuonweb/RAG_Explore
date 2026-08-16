import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { DocumentService } from '../../services/document.service';
import { SearchResult } from '../../models/document.model';

const SYNOPSIS_LENGTH = 220;

@Component({
  selector: 'app-search',
  imports: [
    FormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatChipsModule, MatDividerModule,
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  query = signal('');
  k = signal(5);
  answer = signal<string | null>(null);
  sources = signal<SearchResult[]>([]);
  noMatch = signal(false);
  fromWeb = signal(false);
  loading = signal(false);
  errorMsg = signal('');
  asked = signal(false);
  expandedSources = signal<Set<number>>(new Set());

  constructor(private docs: DocumentService) {}

  ask() {
    if (!this.query().trim()) return;
    this.loading.set(true);
    this.errorMsg.set('');
    this.asked.set(true);
    this.answer.set(null);
    this.sources.set([]);
    this.noMatch.set(false);
    this.fromWeb.set(false);
    this.expandedSources.set(new Set());

    this.docs.ask(this.query(), this.k()).subscribe({
      next: (res) => {
        this.answer.set(res.answer);
        this.sources.set(res.sources);
        this.noMatch.set(res.noMatch ?? false);
        this.fromWeb.set(res.webSearch ?? false);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error ?? 'Request failed');
        this.loading.set(false);
      },
    });
  }

  synopsis(content: string): string {
    return content.length <= SYNOPSIS_LENGTH
      ? content
      : content.slice(0, SYNOPSIS_LENGTH).trimEnd() + '…';
  }

  isLong(content: string): boolean {
    return content.length > SYNOPSIS_LENGTH;
  }

  isExpanded(index: number): boolean {
    return this.expandedSources().has(index);
  }

  toggleSource(index: number) {
    const next = new Set(this.expandedSources());
    if (next.has(index)) next.delete(index); else next.add(index);
    this.expandedSources.set(next);
  }

  scoreLabel(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  scoreClass(score: number): string {
    if (score >= 0.8) return 'score-high';
    if (score >= 0.5) return 'score-mid';
    return 'score-low';
  }
}
