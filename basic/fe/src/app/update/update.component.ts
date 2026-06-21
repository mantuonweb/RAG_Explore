import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DocumentChunk, RagApiService } from '../services/rag-api.service';

@Component({
  selector: 'app-update',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './update.component.html',
  styleUrl: './update.component.scss',
})
export class UpdateComponent implements OnInit {
  chunk: DocumentChunk | null = null;
  editedContent = '';
  loading = true;
  saving = false;
  error = '';
  saved = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: RagApiService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getDocument(id).subscribe({
      next: (doc) => {
        this.chunk = doc;
        this.editedContent = doc.content;
        this.loading = false;
      },
      error: () => { this.error = 'Chunk not found.'; this.loading = false; },
    });
  }

  save(): void {
    if (!this.chunk || !this.editedContent.trim()) return;
    this.saving = true;
    this.saved = false;

    this.api.updateDocument(this.chunk.id, this.editedContent).subscribe({
      next: () => { this.saving = false; this.saved = true; },
      error: () => { this.error = 'Save failed.'; this.saving = false; },
    });
  }

  back(): void {
    this.router.navigate(['/']);
  }
}
