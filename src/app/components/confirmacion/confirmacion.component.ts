import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';
import { environment } from "../../../environments/environment";

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmacion.component.html',
  styleUrls: ['./confirmacion.component.scss']
})
export class ConfirmacionComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  private readonly API_BASE = environment.apiUrl;
  private readonly API_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra`;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;

  listaAutorizadas: any[] = [];
  ocSeleccionada: any = null;
  loading: boolean = false;

  public esSupervisorGlobal: boolean = false;
  private usuarioInfo: any = null;

  ngOnInit(): void {
    this.verificarPermisos();
    this.cargarOrdenesAutorizadas();
  }

  verificarPermisos() {
    const user = this.authService.user();
    if (user) {
      this.usuarioInfo = user;
    } else {
      const savedUser = localStorage.getItem('usuario');
      this.usuarioInfo = savedUser ? JSON.parse(savedUser) : null;
    }

    if (this.usuarioInfo) {
      const rol = (this.usuarioInfo.role.nombre || '').toUpperCase();
      // Supervisor o Admin pueden confirmar
      this.esSupervisorGlobal = rol === 'SUPERVISOR' || rol === 'ADMIN';
    }
  }

  esSupervisor(): boolean {
    return this.esSupervisorGlobal;
  }

  cargarOrdenesAutorizadas() {
    const unidadRaw = localStorage.getItem('unidadNegocio');
    let codigoUnidad = '';

    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codigoUnidad = unidadObj.codigoUnidad;
      } catch (e) {
        codigoUnidad = unidadRaw;
      }
    }

    if (!codigoUnidad) return;

    this.loading = true;
    const params: any = {
      codEstadoOc: 'autorizado', // Buscamos las que están listas para confirmarse
      unidad: codigoUnidad,
      page: 0,
      size: 20,
      sort: 'idOrdenCompra,desc'
    };
    
    this.http.get<any>(`${this.API_BUSQUEDA_AVANZADA}`, { params })
      .subscribe({
        next: (res) => {
          this.listaAutorizadas = res.content || [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          Swal.fire('Error', 'No se pudo cargar la lista de órdenes', 'error');
        }
      });
  }

  verDetalle(oc: any) {
    this.ocSeleccionada = { ...oc };
  }

  abrirConfirmar(oc: any) {
    if (!this.esSupervisor()) {
      Swal.fire('No autorizado', 'Acceso restringido a Supervisores', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Confirmar Recepción de OC?',
      text: 'Al confirmar, la orden pasará al estado final de gestión.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#26c2d1', // Color cyan institucional
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'SÍ, CONFIRMAR',
      cancelButtonText: 'CANCELAR'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ejecutarConfirmacion(oc);
      }
    });
  }

  ejecutarConfirmacion(oc: any) {
    const body = {
      codOc: oc.codOrdenCompra,
      plantillaDTO: { codOrdenCompra: oc.codOrdenCompra },
      usuarioSup: this.usuarioInfo.sub
    };

    this.http.post(`${this.API_OC}/confirmar`, body).subscribe({
      next: () => {
        Swal.fire('Confirmada', 'La orden ha sido confirmada con éxito.', 'success');
        this.ocSeleccionada = null;
        this.cargarOrdenesAutorizadas();
      },
      error: (err) => {
        Swal.fire('Error', 'No se pudo procesar la confirmación.', 'error');
      }
    });
  }

  parsearProductos(jsonString: any): any[] {
    if (!jsonString) return [];
    if (Array.isArray(jsonString)) return jsonString;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return [];
    }
  }
}