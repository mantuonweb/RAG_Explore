import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:9000';

interface LocalResult  { skill: string; score: number; source: string; }
interface LinkedInResult { title: string; url: string; snippet: string; }

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  query = '';
  loading = signal(false);
  source = signal<'local' | 'linkedin' | ''>('');
  localResults  = signal<LocalResult[]>([]);
  linkedinResults = signal<LinkedInResult[]>([]);
  error = signal('');

  constructor(private http: HttpClient) {}

  search() {
    if (!this.query.trim()) return;
    this.loading.set(true);
    this.source.set('');
    this.localResults.set([]);
    this.linkedinResults.set([]);
    this.error.set('');

    this.http.post<any>(`${API}/search`, { skill: this.query.trim() }).subscribe({
      next: r => {
        this.source.set(r.source);
        if (r.source === 'local')    this.localResults.set(r.results);
        if (r.source === 'linkedin') this.linkedinResults.set(r.results);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Search failed. Is the backend running?');
        this.loading.set(false);
      },
    });
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') this.search();
  }
}
