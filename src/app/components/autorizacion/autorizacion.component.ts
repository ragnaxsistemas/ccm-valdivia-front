import { Component, OnInit, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';
import { environment } from "../../../environments/environment";

@Component({
  selector: 'app-autorizacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
    private readonly API_UNIDADES = `${this.API_BASE}/api/v1/unidad-compradora/vld_ccm`;

    loading: boolean = false;

  listaPendientes: any[] = [];
  ocSeleccionada: any = null;
  listaAdjuntosOC: any[] = [];

  // 🔄 NUEVAS VARIABLES PARA UNIDADES COMPRADORAS
  unidades: any[] = [];
  unidadSeleccionada: string = '';

  // Usamos el Signal del servicio si está disponible, sino fallback a localStorage
  public esSupervisorGlobal: boolean = false;
  private usuarioInfo: any = null;
  userRole: string = '';

  ngOnInit() {
    this.obtenerRolDesdeStorage();
    this.cargarUnidades();
    this.verificarPermisos();
    this.cargarPendientes();
  }

  obtenerRolDesdeStorage(): void {
    const userJson = localStorage.getItem('usuario');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        // Extraemos el nombre del rol en mayúsculas idéntico al Layout
        this.userRole = user.role?.nombre?.toUpperCase() || 'SIN ROL';
        console.log("Rol detectado en Autorización:", this.userRole);
      } catch (e) {
        console.error("Error al parsear el usuario desde localStorage", e);
        this.userRole = 'SIN ROL';
      }
    } else {
      this.userRole = 'SIN ROL';
    }
  }

  esSupervisor(): boolean {
    // Validamos directamente contra la cadena unificada extraída del Storage
    return this.userRole.includes('SUPERVISOR') || 
           this.userRole.includes('ADMINISTRACION') || 
           this.userRole.includes('ADMIN');
  }

  cargarUnidades() {
    
    this.http.get<any[]>(`${this.API_UNIDADES}`).subscribe({
      next: (res) => {
        this.unidades = res || [];
      },
      error: (err) => console.error('Error al cargar unidades:', err)
    });
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

  cargarPendientes() {
    this.loading = true;

    // 1. Inicializamos los HttpParams con los campos obligatorios de paginación y estado fijo
    let params = new HttpParams()
      .set('codEstadoOc', 'pendiente_autorizacion') // Requerido por tu lógica de negocio
      .set('page', '0')                             // Spring Data es base 0
      .set('size', '10')
      .set('sort', 'idOrdenCompra,desc');

    // 2. Evaluamos la unidad seleccionada en el combo
    if (this.unidadSeleccionada && this.unidadSeleccionada.trim() !== '') {
      // Si seleccionó una unidad específica, usamos el parámetro 'unidad' (en singular)
      params = params.set('unidad', this.unidadSeleccionada);
    } else {
      // Si NO se selecciona unidad en el combo, extraemos todos los códigos del array
      const todosLosCodigos = this.unidades
        .map((u: any) => u.codigoUnidad)
        .filter((cod: string) => !!cod);

      if (todosLosCodigos.length > 0) {
        // Mandamos la lista concatenada por comas en el parámetro 'unidad'
        params = params.set('unidad', todosLosCodigos.join(','));
      }
    }

    console.log('🔍 [Cargar Pendientes] Parámetros exactos enviados:', params.toString());

    // 3. Realizamos la llamada apuntando a la API_BUSQUEDA_AVANZADA
    this.http.get<any>(`${this.API_BUSQUEDA_AVANZADA}`, { params })
      .subscribe({
        next: (res) => {
          // ✨ CORRECCIÓN CRÍTICA: Extraemos '.content' porque el backend responde con paginación
          this.listaPendientes = res?.content || [];
          console.log('✅ Pendientes cargados exitosamente:', this.listaPendientes);
          this.loading = false;
        },
        error: (err) => {
          console.error('❌ Error al cargar pendientes en el backend:', err);
          this.loading = false;
          Swal.fire('Error', 'No se pudo cargar la lista de pendientes', 'error');
        }
      });
  }

  verDetalle(oc: any) {
  this.ocSeleccionada = oc;
  this.listaAdjuntosOC = []; // Limpiamos la lista anterior

  if (oc && oc.codOrdenCompra) {
    const urlAdjuntos = `${this.API_BASE}/api/v1/oc/ordenes-compra/${oc.codOrdenCompra}/archivos`;
    
    this.http.get<any[]>(urlAdjuntos).subscribe({
      next: (res) => {
        // Tu backend responde 204 (No Content) o devuelve vacío si no hay archivos
        this.listaAdjuntosOC = res || [];
        console.log('📎 Adjuntos cargados para la OC:', this.listaAdjuntosOC);
      },
      error: (err) => {
        console.error('Error al cargar adjuntos:', err);
        this.listaAdjuntosOC = [];
      }
    });
  }
}

  descargarAdjunto(arch: any) {
      if (!arch || !arch.idAdjunto) {
        Swal.fire('Error', 'Información de archivo adjunto no válida.', 'error');
        return;
      }

      console.log("Iniciando descarga del adjunto ID:", arch.idAdjunto);
      
      // Ajusta esta URL si tu endpoint de descarga de archivos adjuntos es diferente
      const urlDescarga = `${this.API_OC}/adjunto/${arch.idAdjunto}`;

      this.http.get(urlDescarga, { responseType: 'blob' }).subscribe({
        next: (blob: Blob) => {
          // Crear un link temporal en el DOM para forzar la descarga nativa
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = arch.nombreArchivo || 'archivo_adjunto';
          document.body.appendChild(a);
          a.click();
          
          // Limpieza del DOM
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          console.error('❌ Error al descargar el archivo:', err);
          Swal.fire('Error', 'No se pudo descargar el archivo adjunto desde el servidor.', 'error');
        }
      });
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
      usernameUsuario: oc.usernameUsuario,
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