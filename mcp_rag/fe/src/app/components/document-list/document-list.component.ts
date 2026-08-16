import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DocumentService } from '../../services/document.service';
import { DocumentInfo } from '../../models/document.model';

@Component({
  selector: 'app-document-list',
  imports: [DatePipe, MatCardModule, MatTableModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './document-list.component.html',
  styleUrl: './document-list.component.scss',
})
export class DocumentListComponent implements OnInit {
  documents = signal<DocumentInfo[]>([]);
  loading = signal(false);
  errorMsg = signal('');
  columns = ['sourceFile', 'chunkCount', 'uploadedAt'];

  constructor(private docs: DocumentService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.errorMsg.set('');
    this.docs.list().subscribe({
      next: (res) => { this.documents.set(res.documents); this.loading.set(false); },
      error: (err) => { this.errorMsg.set(err?.error?.error ?? 'Failed to load documents'); this.loading.set(false); },
    });
  }
}
