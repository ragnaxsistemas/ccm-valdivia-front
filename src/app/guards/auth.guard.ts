import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role'); // Asumiendo que guardas el rol al loguear

  // 1. Si no hay token, al login
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  // 2. Control de acceso por Rol para la ruta de supervisión
  if (state.url.startsWith('/supervision') && userRole !== 'ADMIN') {
    console.warn('Acceso denegado: Se requiere rol de supervisión');
    router.navigate(['/ccm/registros']); 
    return false;
  }

  return true;
};