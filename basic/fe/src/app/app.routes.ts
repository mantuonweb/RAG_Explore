import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ChatComponent } from './chat/chat.component';
import { ViewComponent } from './view/view.component';
import { UpdateComponent } from './update/update.component';
import { DocumentDetailComponent } from './document-detail/document-detail.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'query', component: ChatComponent },
  { path: 'document', component: DocumentDetailComponent },
  { path: 'view/:id', component: ViewComponent },
  { path: 'update/:id', component: UpdateComponent },
  { path: '**', redirectTo: '' },
];
