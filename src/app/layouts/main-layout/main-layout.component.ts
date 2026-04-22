import { Component, OnInit, inject, OnDestroy } from '@angular/core'; 
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStateService } from '../../services/auth-state.service'; // Ajusta la ruta
import { Subscription } from 'rxjs';
import { UserToken, Role, UnidadNegocio, Menu } from '../../models/user.model'; // Ajusta la ruta
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

/***interface MenuItem {
  id: number;
  icono: string;
  nombre: string;
  url: string;
}***/

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private authSub?: Subscription;
  
  userName: string = '';
  userRole: string = '';
  userUnidad: string = '';

  //menuItems: MenuItem[] = [];

  ngOnInit() {
    this.loadUserData();
    this.authSub = this.authState.userSession$.subscribe(() => this.loadUserData());
  }

  loadUserData() {
  const userJson = localStorage.getItem('usuario');
  if (!userJson) return;

  const user: UserToken = JSON.parse(userJson);

  this.userName = `${user.nombre} ${user.apellidoPaterno}`;
  this.userRole = user.role?.nombre.toUpperCase() || 'SIN ROL';
  this.userUnidad = user.unidadNegocio?.showNombreUnidad || 'General';
}

/***getIconForMenu(nombre: string): string {
  if (!nombre) return 'circle';

  // Normalizamos: quitamos espacios extras y convertimos a minúsculas para comparar mejor
  const nombreLimpio = nombre.trim();

  const icons: { [key: string]: string } = {
    'Registros': 'search', 
    'Creacion OC': 'file-earmark-plus',
    'Autorizacion': 'check-all',
    'Anulacion': 'x-circle',
    'Gestion Proveedores': 'people',
    'Administracion de Items': 'box-seam',
    'Reportes': 'file-earmark-bar-graph',
    'Capacitacion': 'mortarboard'
  };

  // Si no encuentra el nombre exacto, devolvemos un icono por defecto que sepamos que existe
  return icons[nombreLimpio] || 'list-ul'; 
}***/

  logout() {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    // Limpieza de suscripción para evitar fugas de memoria
    this.authSub?.unsubscribe();
  }
}