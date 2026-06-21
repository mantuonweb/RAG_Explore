import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  CellValueChangedEvent,
  ColDef,
  GridReadyEvent,
  ICellRendererParams,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community';

import { DocumentChunk, RagApiService } from '../services/rag-api.service';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
})
export class DocumentsComponent implements OnInit {
  rowData: DocumentChunk[] = [];
  loading = false;
  theme = themeQuartz;

  colDefs: ColDef[] = [
    {
      field: 'source',
      headerName: 'Source File',
      flex: 1,
      minWidth: 160,
      cellStyle: { fontWeight: '500' },
    },
    {
      field: 'page',
      headerName: 'Page',
      width: 80,
      type: 'numericColumn',
    },
    {
      field: 'content',
      headerName: 'Content',
      flex: 3,
      minWidth: 300,
      editable: true,
      cellEditor: 'agLargeTextCellEditor',
      cellEditorPopup: true,
      cellEditorParams: { maxLength: 5000, rows: 6 },
      tooltipField: 'content',
    },
    {
      headerName: 'Actions',
      width: 100,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams) => {
        const btn = document.createElement('button');
        btn.textContent = 'Delete';
        btn.className = 'ag-delete-btn';
        btn.addEventListener('click', () => this.deleteRow(params.data));
        return btn;
      },
    },
  ];

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  constructor(private api: RagApiService) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.loading = true;
    this.api.getDocuments().subscribe({
      next: (docs) => {
        this.rowData = docs;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  onGridReady(params: GridReadyEvent): void {
    params.api.sizeColumnsToFit();
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    const chunk = event.data as DocumentChunk;
    this.api.updateDocument(chunk.id, event.newValue).subscribe();
  }

  deleteRow(chunk: DocumentChunk): void {
    this.api.deleteDocument(chunk.id).subscribe({
      next: () => {
        this.rowData = this.rowData.filter((r) => r.id !== chunk.id);
      },
    });
  }
}
