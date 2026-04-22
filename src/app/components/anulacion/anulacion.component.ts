import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2'; // Añadido para consistencia visual con autorización
import { AuthService } from '../../services/auth.service';
import { environment } from "../../../environments/environment";

@Component({
  selector: 'app-anulacion',
  standalone: true,
  imports: [CommonModule], // HttpClient se provee usualmente en app.config.ts
  templateUrl: './anulacion.component.html',
  styleUrls: ['./anulacion.component.scss']
})
export class AnulacionComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  private readonly API_BASE = environment.apiUrl;
  private readonly API_OC_NEW = `${this.API_BASE}/api/v1/oc/ordenes-compra/new`;
  private readonly API_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra`;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
  private readonly API_PROV = `${this.API_BASE}/api/v1/oc/proveedor`;
  private readonly API_DTE = `${this.API_BASE}/api/v1/oc/dte`;
  private readonly API_PRODUCTO = `${this.API_BASE}/api/v1/oc/producto/all`;

  listaAutorizadas: any[] = [];
  ocSeleccionada: any = null;
  loading: boolean = false;

  // --- Lógica de Permisos Traspasada ---
  public esSupervisorGlobal: boolean = false;
  private usuarioInfo: any = null;

  ngOnInit(): void {
    this.verificarPermisos();
    this.cargarOrdenesAutorizadas();
  }

  verificarPermisos() {
    // 1. Intentar obtener del Signal del servicio (igual que en autorización)
    const user = this.authService.user();
    
    if (user) {
      this.usuarioInfo = user;
    } else {
      // Fallback por si refresca la pantalla
      const savedUser = localStorage.getItem('usuario');
      this.usuarioInfo = savedUser ? JSON.parse(savedUser) : null;
    }

    if (this.usuarioInfo) {
      // Normalizamos el rol a mayúsculas para evitar errores de tipeo
      const rol = (this.usuarioInfo.role.nombre || '').toUpperCase();
      // Unificamos criterios: SUPERVISOR o ADMIN
      this.esSupervisorGlobal = rol === 'SUPERVISOR' || rol === 'ADMIN';
      console.log("Modo Supervisor activo:", this.esSupervisorGlobal);
    }
  }

  // Método usado por el HTML y botones
  esSupervisor(): boolean {
    return this.esSupervisorGlobal;
  }

  getUsuarioLogueado(): string {
    // Usamos el 'sub' del token/usuarioInfo que es lo que espera el backend
    return this.usuarioInfo?.sub || 'usuario_anonimo';
  }

  // --- Lógica de Carga ---
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

      if (!codigoUnidad) {
          console.warn('No se encontró código de unidad para listar autorizadas.');
          return;
      }

      this.loading = true;
      const params: any = {
          codEstadoOc: 'autorizado', // Estado fijo según tu requerimiento
          unidad: codigoUnidad,    // Filtramos por la unidad del usuario
          page: 0,                 // Pageable empieza en 0 en Spring Data
          size: 10,
          sort: 'idOrdenCompra,desc'
      };
      
      return this.http.get<any>(`${this.API_BUSQUEDA_AVANZADA}`, { params })
            .subscribe({
              next: (res) => {
                this.listaAutorizadas = res.content || [];
                console.log('Autorizadas cargadas:', this.listaAutorizadas);
              },
            error: () => Swal.fire('Error', 'No se pudo cargar la lista de autorizadas', 'error')
            });
  }

  // --- Acciones e Interfaz ---
  verDetalle(oc: any) {
    this.ocSeleccionada = { ...oc };
  }

  abrirConfirmar(oc: any, accion: string) {
    if (!this.esSupervisor()) {
      Swal.fire('No autorizado', 'Acceso restringido a Supervisores o Administradores', 'warning');
      return;
    }

    if (accion === 'anular') {
      Swal.fire({
        title: '¿Anular Orden de Compra?',
        text: 'Esta acción es irreversible y la orden quedará anulada permanentemente.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'SÍ, ANULAR',
        cancelButtonText: 'CANCELAR'
      }).then((result) => {
        if (result.isConfirmed) {
          this.ejecutarAnulacion(oc);
        }
      });
    }
  }

  ejecutarAnulacion(oc: any) {
    // Usamos el id de la orden (id o idOc según tu objeto)
    console.log("Ejecutando anulación para OC:", oc);
    //const codParaUrl = oc.codOrdenCompra || oc.codOrdenCompra;
   // const url = `http://localhost:8888/api/v1/ordenes-compra/${codParaUrl}/anular`;
    
    const body = {
      codOc:  oc.codOrdenCompra,
      plantillaDTO: this.mapearAPlantilla(oc),
      usuarioSup: this.usuarioInfo.sub // Usuario de la sesión actual
    };


    this.http.post(`${this.API_OC}/anular`, body).subscribe({
      next: () => {
        Swal.fire('Anulada', 'La orden ha sido anulada con éxito.', 'success');
        this.ocSeleccionada = null;
        this.cargarOrdenesAutorizadas();
      },
      error: (err) => {
        console.error('Error al anular', err);
        Swal.fire('Error', 'No se pudo procesar la anulación en el servidor.', 'error');
      }
    });
  }

  // Mantenemos consistencia con el mapeo de autorización
  private mapearAPlantilla(oc: any) {
    console.log("Mapeando OC a plantilla:", oc);
    return {
      codOrdenCompra: oc.codOrdenCompra
      //fechaOrdenCompra: oc.fechaOrdenCompra,
      //usernameUsuario: oc.usernameUsuario,
      //codUnidad: oc.codUnidad,
      //rutProveedor: oc.rutProveedor,
      //codDocumentoTributario: oc.codDocumentoTributario,
      //codEstadoActualOc: oc.codEstadoActualOc,
      //nombreOrdenCompra: oc.nombreOrdenCompra,
      //observaciones: oc.observaciones,
      //listProductosOrden: oc.listProductosOrden || JSON.stringify(oc.items),
      //totalNeto: oc.totalNeto,
      //impuesto: oc.impuesto,
      //total: oc.total
    };
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