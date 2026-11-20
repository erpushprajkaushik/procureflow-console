import { Routes } from '@angular/router';
import { Workspace } from './workspace/workspace';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...['overview', 'requests', 'suppliers', 'activity'].map((view) => ({
    path: view,
    component: Workspace,
    data: { view },
  })),
  { path: '**', redirectTo: 'overview' },
];
