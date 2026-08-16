import { Component, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DocumentService } from '../../services/document.service';
import { UploadResult } from '../../models/document.model';

type Status = 'idle' | 'uploading' | 'success' | 'error';

@Component({
  selector: 'app-upload',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent {
  selectedFile = signal<File | null>(null);
  status = signal<Status>('idle');
  result = signal<UploadResult | null>(null);
  errorMsg = signal('');

  constructor(private docs: DocumentService) {}

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.selectedFile.set(file);
      this.status.set('idle');
      this.result.set(null);
      this.errorMsg.set('');
    }
  }

  upload() {
    const file = this.selectedFile();
    if (!file) return;
    this.status.set('uploading');
    this.docs.upload(file).subscribe({
      next: (res) => { this.result.set(res); this.status.set('success'); },
      error: (err) => { this.errorMsg.set(err?.error?.error ?? 'Upload failed'); this.status.set('error'); },
    });
  }

  reset() {
    this.selectedFile.set(null);
    this.status.set('idle');
    this.result.set(null);
    this.errorMsg.set('');
  }

  formatSize(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
