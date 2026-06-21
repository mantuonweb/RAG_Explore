import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community';

import { DocumentSource, RagApiService } from '../services/rag-api.service';
import { UploadComponent } from '../upload/upload.component';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, AgGridAngular, UploadComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private gridApi!: GridApi;
  rowData: DocumentSource[] = [];
  loading = false;
  showModal = false;
  theme = themeQuartz;

  colDefs: ColDef[] = [
    {
      field: 'doc_name',
      headerName: 'Name',
      flex: 2,
      minWidth: 160,
      cellStyle: { fontWeight: '500' },
    },
    {
      field: 'doc_description',
      headerName: 'Description',
      flex: 3,
      minWidth: 180,
      valueFormatter: (p) =>
        p.value?.length > 80 ? p.value.slice(0, 80) + '…' : (p.value || '—'),
      tooltipField: 'doc_description',
    },
    {
      field: 'filename',
      headerName: 'File',
      flex: 1,
      minWidth: 130,
    },
    {
      field: 'chunk_count',
      headerName: 'Chunks',
      width: 90,
      type: 'numericColumn',
    },
    {
      headerName: 'Actions',
      width: 220,
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

        const doc: DocumentSource = params.data;

        wrap.appendChild(mkBtn('View', 'btn-view', () =>
          this.router.navigate(['/document'], { queryParams: { source: doc.source } })));
        wrap.appendChild(mkBtn('Query', 'btn-query', () =>
          this.router.navigate(['/query'], { queryParams: { docId: doc.doc_id } })));
        wrap.appendChild(mkBtn('Delete', 'btn-delete', () =>
          this.deleteDocument(doc)));

        return wrap;
      },
    },
  ];

  defaultColDef: ColDef = { sortable: true, filter: true, resizable: true };

  constructor(private api: RagApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  loadDocuments(): void {
    this.loading = true;
    this.api.getSources().subscribe({
      next: (docs) => {
        this.rowData = docs;
        this.gridApi?.setGridOption('rowData', docs);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onUploaded(): void {
    this.showModal = false;
    this.loadDocuments();
  }

  deleteDocument(doc: DocumentSource): void {
    if (!confirm(`Delete "${doc.doc_name}"?`)) return;
    this.api.deleteByDocId(doc.doc_id).subscribe({
      next: () => this.loadDocuments(),
    });
  }
}
