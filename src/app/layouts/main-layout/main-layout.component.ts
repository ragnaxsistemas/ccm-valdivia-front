import { Component, OnInit, inject, OnDestroy } from '@angular/core'; 
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthStateService } from '../../services/auth-state.service'; // Ajusta la ruta
import { Subscription } from 'rxjs';
import { UserToken, Role, UnidadNegocio, Menu } from '../../models/user.model'; // Ajusta la ruta
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { AuthService } from '../../services/auth.service';

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
  private authService = inject(AuthService);
  private authSub?: Subscription;
  
  userName: string = '';
  userRole: string = '';
  userUnidad: string = '';

  //menuItems: MenuItem[] = [];

  ngOnInit() {
    let inicializado = false;

    // 1. Nos suscribimos a la escucha reactiva
    this.authSub = this.authState.userSession$.subscribe(() => {
      console.log('🔄 [MAIN LAYOUT] Detectado cambio de sesión, recargando datos...');
      this.loadUserData();
      inicializado = true; // Marcamos que la suscripción ya emitió y cargó los datos
    });

    // 2. RESPALDO SEGURIDAD: Si la suscripción no emitió inmediatamente, forzamos la carga
    if (!inicializado) {
      console.log('🛡️ [MAIN LAYOUT] Respaldo: userSession$ no emitió en el arranque. Forzando carga manual...');
      this.loadUserData();
    }
  }

  loadUserData() {
    const userJson = localStorage.getItem('usuario');
    if (!userJson) {
      console.warn('⚠️ [MAIN LAYOUT] No se encontró el objeto "usuario" en localStorage.');
      this.userName = 'Usuario Desconocido';
      this.userRole = 'SIN ROL';
      this.userUnidad = 'General';
      return;
    }

    try {
      const user: UserToken = JSON.parse(userJson);
      
      // 📝 Asignación segura y limpia basada en el token estructurado
      this.userName = `${user.nombre || ''} ${user.apellidoPaterno || ''}`.trim() || 'Usuario Sin Nombre';
      this.userRole = user.role?.nombre?.toUpperCase() || 'SIN ROL';
      
      // Mapeo flexible de la unidad de negocio
      this.userUnidad = user.unidadNegocio?.showNombreUnidad || user.unidadNegocio?.nombreUnidad || 'General';
      
      console.log('👤 [MAIN LAYOUT] Datos cargados con éxito en la interfaz:', {
        usuario: this.userName,
        rol: this.userRole,
        unidad: this.userUnidad
      });
    } catch (e) {
      console.error('❌ [MAIN LAYOUT] Error al parsear el JSON de usuario:', e);
    }
  }

  logout() {
    console.log('🚪 [MAIN LAYOUT] Cerrando sesión de forma segura...');
    // Llamamos al logout centralizado del servicio para no romper el storage global
    this.authService.logout(); 
  }

  ngOnDestroy() {
    // Limpieza de suscripción para evitar fugas de memoria
    this.authSub?.unsubscribe();
  }
}