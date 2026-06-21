import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DocumentChunk, RagApiService } from '../services/rag-api.service';

@Component({
  selector: 'app-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class ViewComponent implements OnInit {
  chunk: DocumentChunk | null = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: RagApiService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getDocument(id).subscribe({
      next: (doc) => { this.chunk = doc; this.loading = false; },
      error: () => { this.error = 'Chunk not found.'; this.loading = false; },
    });
  }

  back(): void {
    this.router.navigate(['/']);
  }
}
