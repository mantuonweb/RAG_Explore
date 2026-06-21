import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IngestResponse, RagApiService } from '../services/rag-api.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent {
  @Output() uploaded = new EventEmitter<IngestResponse>();

  selectedFile: File | null = null;
  docName = '';
  docDescription = '';
  uploading = false;
  result: IngestResponse | null = null;
  error = '';

  constructor(private api: RagApiService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    if (this.selectedFile && !this.docName) {
      this.docName = this.selectedFile.name.replace(/\.[^.]+$/, '');
    }
    this.result = null;
    this.error = '';
  }

  upload(): void {
    if (!this.selectedFile) return;
    this.uploading = true;
    this.result = null;
    this.error = '';

    this.api.ingestFile(this.selectedFile, this.docName, this.docDescription).subscribe({
      next: (res) => {
        this.result = res;
        this.uploading = false;
        this.selectedFile = null;
        this.docName = '';
        this.docDescription = '';
        this.uploaded.emit(res);
      },
      error: (err) => {
        this.error = err?.error?.detail ?? 'Upload failed. Please try again.';
        this.uploading = false;
      },
    });
  }
}
