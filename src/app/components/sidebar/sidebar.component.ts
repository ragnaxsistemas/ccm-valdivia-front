import { Component, inject, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  private authService = inject(AuthService);

  // Computed: Obtiene, clona y ordena los menús por el campo 'orden'
  menuItems = computed(() => {
    // 1. Intentamos obtener del Signal del servicio
    let menus = this.authService.user()?.menus || [];

    // 2. Si el servicio está vacío (por F5), leemos el localStorage directamente
    if (menus.length === 0) {
      const savedMenus = localStorage.getItem('menus');
      if (savedMenus) {
        try {
          menus = JSON.parse(savedMenus);
        } catch (e) {
          console.error("Error al parsear menus del localStorage", e);
        }
      }
    }

    // 3. Ordenamos por el campo 'orden' que nos mostraste en el JSON
    return [...menus].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  });

  // Mapeo dinámico de iconos basado en el ID del JWT
  getIcon(id: any): string {
    const searchId = String(id); 
    
    const icons: { [key: string]: string } = {
      'vld_ccm_1': 'bi bi-search',
      'vld_ccm_2': 'bi bi-plus-circle',
      'vld_ccm_3': 'bi bi-check-circle',
      'vld_ccm_4': 'bi bi-x-octagon',
      'vld_ccm_5': 'bi bi-people',
      'vld_ccm_6': 'bi bi-box-seam',
      'vld_ccm_7': 'bi bi-file-earmark-bar-graph',
      'vld_ccm_9': 'bi bi-mortarboard',
      'vld_ccm_10': 'bi bi-check2-all' // ID para tu nueva opción de Confirmación
    };

    return icons[searchId] || 'bi bi-circle';
  }
}