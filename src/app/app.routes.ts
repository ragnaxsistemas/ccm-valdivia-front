import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { 
    path: 'login', 
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) 
  },
  {
    path: 'ccm',
    loadComponent: () => import('./layouts/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard], 
    children: [
      { 
        path: 'registros', 
        loadComponent: () => import('./components/registros/registros.component').then(m => m.GestionOcComponent) 
      },
      { 
        path: 'creacion-oc', 
        loadComponent: () => import('./components/creacion-oc/creacion-oc.component').then(m => m.CreacionOcComponent) 
      },
      // Gestión de Productos
      { 
        path: 'productos', 
        loadComponent: () => import('./components/productos/productos.component').then(m => m.ProductosComponent) 
      },
      // Gestión de Proveedores
      { 
        path: 'proveedores', 
        loadComponent: () => import('./components/proveedores/proveedores.component').then(m => m.ProveedoresComponent) 
      },
      { 
        path: 'autorizacion', 
        loadComponent: () => import('./components/autorizacion/autorizacion.component').then(m => m.AutorizacionComponent) 
      },
      { 
        path: 'anulacion', 
        loadComponent: () => import('./components/anulacion/anulacion.component').then(m => m.AnulacionComponent) 
      },
      { 
        path: 'reportes', 
        loadComponent: () => import('./components/reportes/reportes.component').then(m => m.ReportesComponent) 
      },
      { 
        path: 'capacitacion', 
        loadComponent: () => import('./components/capacitacion/capacitacion.component').then(m => m.CapacitacionComponent) 
      },


      { 
        path: 'confirmacion', 
        loadComponent: () => import('./components/confirmacion/confirmacion.component').then(m => m.ConfirmacionComponent) 
      },

      // Redirección interna por defecto si entran a /ccm sin ruta específica
      { path: '', redirectTo: 'creacion-oc', pathMatch: 'full' }
    ]
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];