import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http'; 
import { FormsModule } from '@angular/forms'; 
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';
import { environment } from "../../../environments/environment";

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirmacion.component.html',
  styleUrls: ['./confirmacion.component.scss']
})
export class ConfirmacionComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  // Infraestructura de Endpoints unificada
  readonly API_BASE = environment.apiUrl;
  private readonly API_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra`;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
  private readonly API_UNIDADES = `${this.API_BASE}/api/v1/unidad-compradora/vld_ccm`;

  listaAutorizadas: any[] = [];
  unidades: any[] = []; 
  unidadSeleccionada: string = ''; 
  ocSeleccionada: any = null;
  loading: boolean = false;

  // Listado asíncrono de adjuntos asociados a la OC cargada en el modal
  listaAdjuntosOC: any[] = [];

  // Variables unificadas de sesión y rol
  usuarioInfo: any = null;
  userRole: string = '';

  ngOnInit(): void {
    this.usuarioInfo = this.authService.user();
    this.obtenerRolDesdeStorage(); 
    this.cargarUnidades();
    this.cargarOrdenesAutorizadas();
  }

  /**
   * Captura infalible del Rol de Sesión desde localStorage homologado con el Layout principal
   */
  obtenerRolDesdeStorage(): void {
    const userJson = localStorage.getItem('usuario');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        this.userRole = user.role?.nombre?.toUpperCase() || 'SIN ROL';
        console.log("Rol unificado detectado en Confirmación:", this.userRole);
      } catch (e) {
        console.error("Error al parsear el usuario en localStorage desde Confirmación", e);
        this.userRole = 'SIN ROL';
      }
    } else {
      this.userRole = 'SIN ROL';
    }
  }

  /**
   * Evalúa si el usuario logueado cuenta con permisos elevados de gestión
   */
  esSupervisor(): boolean {
    return this.userRole.includes('SUPERVISOR') || 
           this.userRole.includes('ADMINISTRACION') || 
           this.userRole.includes('ADMIN');
  }

  cargarUnidades() {
    this.http.get<any[]>(this.API_UNIDADES).subscribe({
      next: (res) => this.unidades = res || [],
      error: (err) => console.error('❌ Error al cargar unidades en confirmación:', err)
    });
  }

  cargarOrdenesAutorizadas() {
    this.loading = true;

    let params = new HttpParams()
      .set('codEstadoOc', 'autorizado') 
      .set('page', '0')                             
      .set('size', '10')
      .set('sort', 'idOrdenCompra,desc');

    if (this.unidadSeleccionada) {
      params = params.set('unidad', this.unidadSeleccionada);
    }

    console.log('🔍 [Confirmación] Buscando Autorizadas con parámetros:', params.toString());

    this.http.get<any>(this.API_BUSQUEDA_AVANZADA, { params }).subscribe({
      next: (res) => {
        this.listaAutorizadas = res.content || res || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Error al obtener órdenes autorizadas:', err);
        this.listaAutorizadas = [];
        this.loading = false;
      }
    });
  }

  /**
   * Abre la vista detallada de la OC e hidrata sus adjuntos reales desde el servidor
   */
  verDetalle(oc: any) {
    this.ocSeleccionada = { ...oc };
    this.listaAdjuntosOC = []; // Limpieza preventiva de la bandeja de adjuntos
    
    const codigoOC = oc.codOrdenCompra || oc.codigoOrdenCompra;
    if (!codigoOC) return;

    console.log(`[Adjuntos Confirmación] Buscando archivos en servidor para la OC: ${codigoOC}`);
    
    this.http.get<any[]>(`${this.API_OC}/${codigoOC}/archivos`).subscribe({
      next: (archivosServidor) => {
        if (archivosServidor && archivosServidor.length > 0) {
          this.listaAdjuntosOC = archivosServidor.map(adj => {
            
            // Extractor dinámico del ID único numérico desde la URL de descarga
            let idExtraido: number | undefined = undefined;
            if (adj.urlDescarga) {
              const partes = adj.urlDescarga.split('/');
              const ultimoSegmento = partes[partes.length - 1];
              if (ultimoSegmento && !isNaN(ultimoSegmento)) {
                idExtraido = parseInt(ultimoSegmento, 10);
              }
            }

            return {
              idAdjunto: idExtraido, 
              nombreArchivo: adj.nombreArchivo,
              urlDescargaCompleta: adj.urlDescarga,
              isServerFile: true
            };
          });
          console.log('[Adjuntos Confirmación] Archivos cargados con éxito:', this.listaAdjuntosOC);
        }
      },
      error: (err) => {
        if (err.status === 204) {
          console.log(`[Adjuntos Confirmación] La orden ${codigoOC} no registra adjuntos de respaldo.`);
        } else {
          console.error('[Adjuntos Confirmación] Error al consultar adjuntos:', err);
        }
      }
    });
  }

  /**
   * Descarga binaria física del archivo desde el entorno modal
   */
  descargarAdjunto(arch: any) {
    if (!arch || !arch.urlDescargaCompleta) {
      Swal.fire('Error', 'No se localizó la ruta de descarga del archivo.', 'error');
      return;
    }

    let urlCompleta = arch.urlDescargaCompleta;
    if (!urlCompleta.startsWith('http')) {
      const base = this.API_BASE.endsWith('/') ? this.API_BASE.slice(0, -1) : this.API_BASE;
      const ruta = arch.urlDescargaCompleta.startsWith('/') ? arch.urlDescargaCompleta : '/' + arch.urlDescargaCompleta;
      urlCompleta = `${base}${ruta}`;
    }

    console.log(`[Descarga Confirmación] Solicitando archivo binario a: ${urlCompleta}`);

    this.http.get(urlCompleta, { responseType: 'blob' }).subscribe({
      next: (blobData: Blob) => {
        const urlBlob = window.URL.createObjectURL(blobData);
        const link = document.createElement('a');
        link.href = urlBlob;
        link.download = arch.nombreArchivo || 'archivo_adjunto';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(urlBlob);
      },
      error: (err) => {
        console.error('[Descarga Confirmación] Error al descargar binario:', err);
        Swal.fire('Error de descarga', 'El archivo no está disponible en el servidor.', 'error');
      }
    });
  }

  abrirConfirmar(oc: any, accion?: string) {
    if (!this.esSupervisor()) {
      Swal.fire('No autorizado', 'Acceso restringido a Supervisores', 'warning');
      return;
    }

    if (accion === 'devolver') {
      this.devolverOrden(oc);
      return;
    }

    Swal.fire({
      title: '¿Confirmar Orden de Compra?',
      text: 'Al confirmar, la orden de compra  será emitida y enviada directamente al proveedor.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#26c2d1', // Color cyan corporativo
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'SÍ, CONFIRMAR Y ENVIAR',
      cancelButtonText: 'CANCELAR'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ejecutarConfirmacion(oc);
      }
    });
  }

  ejecutarConfirmacion(oc: any) {
    const usernameLogueado = localStorage.getItem('sub') || this.usuarioInfo?.sub || 'SISTEMA';

    // EXTRACTOR DEL CÓDIGO DE UNIDAD DEL EJECUTOR (Desde la sesión en localStorage)
    const unidadRaw = localStorage.getItem('unidadNegocio');
    let codUnidadEjecutor = '';
    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codUnidadEjecutor = unidadObj.codigoUnidad || '';
      } catch (e) {
        console.error('[Confirmación] Error al parsear unidadNegocio:', e);
      }
    }

    // Construcción del Payload unificado con auditoría completa
    const body = {
      codOc: oc.codOrdenCompra,
      usuarioExec: usernameLogueado,       // 🌟 Añadido para auditoría
      unidadExec: codUnidadEjecutor,       // 🌟 Añadido para auditoría
      usuarioSup: usernameLogueado,        // Mantiene el supervisor original esperado por el endpoint
      plantillaDTO: { 
        codOrdenCompra: oc.codOrdenCompra,
        usernameUsuario: oc.usernameUsuario || oc.usernameUsuarioCreador || oc.usernameUsuarioCreador
      }
    };

    console.log('[Confirmación] Despachando payload al servidor:', body);

    this.http.post(`${this.API_OC}/confirmar`, body).subscribe({
      next: () => {
        Swal.fire('Confirmada', 'La orden de compra ha sido emitida y enviada al proveedor exitosamente.', 'success');
        this.ocSeleccionada = null;
        this.cargarOrdenesAutorizadas(); // Refresca la grilla reactivamente
      },
      error: (err) => {
        console.error('❌ Error al confirmar OC:', err);
        Swal.fire('Error', 'No se pudo procesar la confirmación en el servidor.', 'error');
      }
    });
  }

  /**
   * Envía la orden de vuelta a revisión desde la bandeja de confirmación
   */
  devolverOrden(oc: any) {
    const usernameLogueado = localStorage.getItem('sub') || this.usuarioInfo?.sub || 'SISTEMA';

    // Extractor dinámico de la unidad ejecutora en sesión
    const unidadRaw = localStorage.getItem('unidadNegocio');
    let codUnidadEjecutor = '';
    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codUnidadEjecutor = unidadObj.codigoUnidad || '';
      } catch (e) {
        console.error('[Devolver Confirmación] Error parsing unidadNegocio:', e);
      }
    }

    const body = {
      codOc: oc.codOrdenCompra,
      usuarioExec: usernameLogueado,
      unidadExec: codUnidadEjecutor,
      plantillaDTO: {
        codOrdenCompra: oc.codOrdenCompra,
        usernameUsuario: oc.usernameUsuario || oc.usernameUsuarioCreador
      }
    };

    console.log('[Devolver desde Confirmación] Enviando payload:', body);

    this.http.post(`${this.API_OC}/devolver`, body).subscribe({
      next: () => {
        Swal.fire('Devuelta', 'La orden fue regresada a revisión con éxito.', 'info');
        this.ocSeleccionada = null;
        this.cargarOrdenesAutorizadas();
      },
      error: (err) => {
        console.error('❌ Error al devolver OC:', err);
        Swal.fire('Error', 'No se pudo procesar la devolución de la orden.', 'error');
      }
    });
  }

  parsearProductos(jsonString: any): any[] {
    if (!jsonString) return [];
    if (Array.isArray(jsonString)) return jsonString;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error("Error parseando listProductosOrden:", e);
      return [];
    }
  }
}