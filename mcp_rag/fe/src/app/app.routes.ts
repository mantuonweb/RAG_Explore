import { Routes } from '@angular/router';
import { UploadComponent } from './components/upload/upload.component';
import { DocumentListComponent } from './components/document-list/document-list.component';
import { SearchComponent } from './components/search/search.component';

export const routes: Routes = [
  { path: '', redirectTo: 'upload', pathMatch: 'full' },
  { path: 'upload', component: UploadComponent },
  { path: 'documents', component: DocumentListComponent },
  { path: 'search', component: SearchComponent },
];
