import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';
import { environment } from "../../../environments/environment";

@Component({
  selector: 'app-autorizacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './autorizacion.component.html',
  styleUrls: ['./autorizacion.component.scss']
})
export class AutorizacionComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly API_BASE = environment.apiUrl;
    private readonly API_OC_NEW = `${this.API_BASE}/api/v1/oc/ordenes-compra/new`;
    private readonly API_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra`;
    private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
    private readonly API_PROV = `${this.API_BASE}/api/v1/oc/proveedor`;
    private readonly API_DTE = `${this.API_BASE}/api/v1/oc/dte`;
    private readonly API_PRODUCTO = `${this.API_BASE}/api/v1/oc/producto/all`;

  listaPendientes: any[] = [];
  ocSeleccionada: any = null;
  
  // Usamos el Signal del servicio si está disponible, sino fallback a localStorage
  public esSupervisorGlobal: boolean = false;
  private usuarioInfo: any = null;

  ngOnInit() {
    this.verificarPermisos();
    this.cargarPendientes();
  }

  verificarPermisos() {
    // Intentamos obtener del Signal del servicio primero
    const user = this.authService.user();
    console.log("Usuario obtenido del AuthService:", user);
    if (user) {
      this.usuarioInfo = user;
    } else {
      // Fallback por si refresca la pantalla y el signal no ha cargado
      const savedUser = localStorage.getItem('usuario');
      this.usuarioInfo = savedUser ? JSON.parse(savedUser) : null;
    }

    if (this.usuarioInfo) {
      const rol = (this.usuarioInfo.role.nombre || '').toUpperCase();
      this.esSupervisorGlobal = rol === 'SUPERVISOR' || rol === 'ADMIN';
      console.log("Modo Supervisor activo:", this.esSupervisorGlobal);
    }
  }

  esSupervisor(): boolean {
    return this.esSupervisorGlobal;
  }

  cargarPendientes() {
    
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
        console.warn('No se encontró código de unidad para listar borradores.');
        return;
    }

    const params: any = {
        codEstadoOc: 'pendiente_autorizacion', // Estado fijo según tu requerimiento
        unidad: codigoUnidad,    // Filtramos por la unidad del usuario
        page: 0,                 // Pageable empieza en 0 en Spring Data
        size: 10,
        sort: 'idOrdenCompra,desc'
    };

    return this.http.get<any>(`${this.API_BUSQUEDA_AVANZADA}`, { params })
      .subscribe({
        next: (res) => {
          this.listaPendientes = res.content || [];
          console.log('Pendientes cargados:', this.listaPendientes);
        },
      error: () => Swal.fire('Error', 'No se pudo cargar la lista de pendientes', 'error')
      });
  }

  verDetalle(oc: any) {
    this.ocSeleccionada = oc;
  }

  abrirConfirmar(oc: any, accion: string) {
    if (!this.esSupervisor()) {
      Swal.fire('No autorizado', 'Acceso restringido a Supervisores', 'warning');
      return;
    }

    this.ocSeleccionada = oc;
    const esAutorizar = accion === 'autorizar';

    Swal.fire({
      title: esAutorizar ? '¿Autorizar Orden de Compra?' : '¿Devolver para corrección?',
      text: esAutorizar ? 'Esta acción cambiará el estado.' : 'La orden regresará al operador.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#e2007a',
      cancelButtonColor: '#6c757d',
      confirmButtonText: esAutorizar ? 'SÍ, AUTORIZAR' : 'SÍ, DEVOLVER',
      cancelButtonText: 'CANCELAR'
    }).then((result) => {
      if (result.isConfirmed) {
        if (esAutorizar) this.confirmarAutorizacion();
        else this.devolver();
      }
    });
  }

  confirmarAutorizacion() {
    // 1. Validar que exista una OC seleccionada y que el usuario sea Supervisor
    if (!this.ocSeleccionada || !this.esSupervisor()) {
      Swal.fire('Acceso Denegado', 'No tienes permisos de supervisor para autorizar.', 'error');
      return;
    }
    console.log("Usuario en sesión para autorización:", this.usuarioInfo);
    // 2. Construir el body asegurando que usuarioSup sea el de la sesión
    const body = {
      codOc: this.ocSeleccionada.codOrdenCompra,
      plantillaDTO: this.mapearAPlantilla(this.ocSeleccionada),
      usuarioSup: this.usuarioInfo.sub // Usuario de la sesión actual
    };

    this.http.post(`${this.API_OC}/autorizar`, body)
      .subscribe({
        next: () => {
          Swal.fire('Éxito', 'La orden ha sido autorizada.', 'success');
          this.ocSeleccionada = null;
          this.cargarPendientes();
        },
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'Hubo un problema al autorizar en el servidor.', 'error');
        }
      });
  }

  devolver() {
    // 1. Validar que exista una OC seleccionada y que el usuario sea Supervisor
    if (!this.ocSeleccionada || !this.esSupervisor()) {
      Swal.fire('Acceso Denegado', 'No tienes permisos de supervisor para devolver órdenes.', 'error');
      return;
    }
    console.log("Usuario en sesión para autorización:", this.usuarioInfo);
    // 2. Construir el body asegurando que usuarioSup sea el de la sesión
    const body = {
      codOc: this.ocSeleccionada.codOrdenCompra,
      plantillaDTO: this.mapearAPlantilla(this.ocSeleccionada),
      usuarioSup: this.usuarioInfo.sub // Usuario de la sesión actual
    };
    console.log("Payload para devolución:", body);
    this.http.post(`${this.API_OC}/devolver`, body)
      .subscribe({
        next: () => {
          Swal.fire('Devuelta', 'La orden fue enviada a revisión.', 'info');
          this.ocSeleccionada = null;
          this.cargarPendientes();
        },
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'No se pudo procesar la devolución.', 'error');
        }
      });
  }

  private mapearAPlantilla(oc: any) {
    console.log("Mapeando OC a plantilla:", oc);
    return {
      codOrdenCompra: oc.codOrdenCompra,
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