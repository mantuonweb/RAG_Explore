import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  GridReadyEvent,
  ICellRendererParams,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community';

import { DocumentChunk, RagApiService } from '../services/rag-api.service';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-document-detail',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './document-detail.component.html',
  styleUrl: './document-detail.component.scss',
})
export class DocumentDetailComponent implements OnInit {
  source = '';
  filename = '';
  chunks: DocumentChunk[] = [];
  loading = true;
  theme = themeQuartz;

  colDefs: ColDef[] = [
    { field: 'page', headerName: 'Page', width: 80, type: 'numericColumn' },
    {
      field: 'content',
      headerName: 'Content',
      flex: 1,
      minWidth: 300,
      valueFormatter: (p) =>
        p.value?.length > 160 ? p.value.slice(0, 160) + '…' : p.value,
      tooltipField: 'content',
    },
    {
      headerName: 'Actions',
      width: 160,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams) => {
        const wrap = document.createElement('div');
        wrap.className = 'row-actions';

        const mkBtn = (label: string, cls: string, cb: () => void) => {
          const b = document.createElement('button');
          b.textContent = label;
          b.className = cls;
          b.addEventListener('click', cb);
          return b;
        };

        const chunk: DocumentChunk = params.data;

        wrap.appendChild(mkBtn('View', 'btn-view', () =>
          this.router.navigate(['/view', chunk.id])));
        wrap.appendChild(mkBtn('Update', 'btn-update', () =>
          this.router.navigate(['/update', chunk.id])));

        return wrap;
      },
    },
  ];

  defaultColDef: ColDef = { sortable: true, filter: true, resizable: true };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: RagApiService,
  ) {}

  ngOnInit(): void {
    this.source = this.route.snapshot.queryParamMap.get('source') ?? '';
    this.filename = this.source.split('/').pop() ?? this.source;
    this.api.getChunks(this.source).subscribe({
      next: (chunks) => { this.chunks = chunks; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  onGridReady(params: GridReadyEvent): void {
    params.api.sizeColumnsToFit();
  }

  back(): void {
    this.router.navigate(['/']);
  }
}
