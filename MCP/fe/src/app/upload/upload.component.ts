import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:9000';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent {
  file = signal<File | null>(null);
  loading = signal(false);
  skills = signal<string[]>([]);
  filename = signal('');
  error = signal('');

  constructor(private http: HttpClient) {}

  onFilePick(event: Event) {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0] ?? null;
    this.file.set(picked);
    this.skills.set([]);
    this.error.set('');
    this.filename.set('');
  }

  upload() {
    const f = this.file();
    if (!f) return;

    const form = new FormData();
    form.append('file', f);

    this.loading.set(true);
    this.skills.set([]);
    this.error.set('');

    this.http.post<any>(`${API}/upload`, form).subscribe({
      next: r => {
        this.skills.set(r.skills);
        this.filename.set(r.filename);
        this.loading.set(false);
      },
      error: e => {
        this.error.set(e.error?.detail ?? 'Upload failed. Is the backend running?');
        this.loading.set(false);
      },
    });
  }
}
