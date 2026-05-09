import { Routes } from '@angular/router';
import { QrConnectionComponent } from './components/qr-connection/qr-connection';
import { CategoriesComponent } from './components/categories/categories';
import { ContactsComponent } from './components/contacts/contacts';
import { BulkSenderComponent } from './components/bulk-sender/bulk-sender';
import { DashboardComponent } from './components/dashboard/dashboard';

export const routes: Routes = [
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: DashboardComponent },
    { path: 'connection', component: QrConnectionComponent },
    { path: 'categories', component: CategoriesComponent },
    { path: 'contacts/:categoryId', component: ContactsComponent },
    { path: 'send', component: BulkSenderComponent },
    { path: 'send/:categoryId', component: BulkSenderComponent },
    { 
        path: 'campaign-details/:id', 
        loadComponent: () => import('./components/campaign-details/campaign-details').then(m => m.CampaignDetailsComponent) 
    },
    { path: '**', redirectTo: '/dashboard' }
];
