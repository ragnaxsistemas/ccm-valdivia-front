import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http'; 
import { FormsModule } from '@angular/forms'; 
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth.service';
import { environment } from "../../../environments/environment";
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-anulacion',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule], 
  templateUrl: './anulacion.component.html',
  styleUrls: ['./anulacion.component.scss']
})
export class AnulacionComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  // Endpoints e infraestructura base
  readonly API_BASE = environment.apiUrl;
  private readonly API_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra`;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
  private readonly API_UNIDADES = `${this.API_BASE}/api/v1/unidad-compradora/vld_ccm`;

  listaAutorizadas: any[] = [];
  ocSeleccionada: any = null;
  loading: boolean = false;

  unidades: any[] = [];
  unidadSeleccionada: string = '';
  usuarioInfo: any = null;
  
  // Listado asíncrono de adjuntos cargados en el modal
  listaAdjuntosOC: any[] = [];

  // Variable unificada para match de rol con el Layout
  userRole: string = '';

  ngOnInit(): void {
    this.usuarioInfo = this.authService.user();
    this.obtenerRolDesdeStorage(); // <-- Captura infalible del Rol de Sesión
    this.cargarUnidades();
    this.cargarOrdenesAutorizadas();
  }

  /**
   * Obtiene el rol del usuario desde el localStorage tal como lo hace MainLayout
   */
  obtenerRolDesdeStorage(): void {
    const userJson = localStorage.getItem('usuario');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        this.userRole = user.role?.nombre?.toUpperCase() || 'SIN ROL';
        console.log("Rol unificado detectado en Anulación:", this.userRole);
      } catch (e) {
        console.error("Error al parsear el usuario en localStorage desde Anulación", e);
        this.userRole = 'SIN ROL';
      }
    } else {
      this.userRole = 'SIN ROL';
    }
  }

  /**
   * Evalúa si el usuario logueado tiene los permisos requeridos
   */
  esSupervisor(): boolean {
    return this.userRole.includes('SUPERVISOR') || 
           this.userRole.includes('ADMINISTRACION') || 
           this.userRole.includes('ADMIN');
  }

  cargarUnidades() {
    this.http.get<any[]>(this.API_UNIDADES).subscribe({
      next: (res) => this.unidades = res,
      error: (err) => console.error('Error unidades:', err)
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

    console.log('🔍 [Anulación] Buscando Autorizadas con parámetros:', params.toString());

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
   * Abre la visualización detallada en el papel digital e hidrata los adjuntos del servidor
   */
  verDetalle(oc: any) {
    this.ocSeleccionada = oc;
    this.listaAdjuntosOC = []; // Limpiamos la bandeja del modal
    
    const codigoOC = oc.codOrdenCompra || oc.codigoOrdenCompra;
    if (!codigoOC) return;

    console.log(`[Adjuntos Anulación] Buscando archivos en servidor para la OC: ${codigoOC}`);
    
    this.http.get<any[]>(`${this.API_OC}/${codigoOC}/archivos`).subscribe({
      next: (archivosServidor) => {
        if (archivosServidor && archivosServidor.length > 0) {
          this.listaAdjuntosOC = archivosServidor.map(adj => {
            
            // Extraer el ID único desde la URL de descarga
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
          console.log('[Adjuntos Anulación] Archivos inyectados con éxito:', this.listaAdjuntosOC);
        }
      },
      error: (err) => {
        if (err.status === 204) {
          console.log(`[Adjuntos Anulación] La orden ${codigoOC} no registra archivos adjuntos (204).`);
        } else {
          console.error('[Adjuntos Anulación] Error al obtener adjuntos:', err);
        }
      }
    });
  }

  /**
   * Modificado: Cambia de estado a revisión despachando usuarioExec y unidadExec
   */
  devolver() {
    if (!this.ocSeleccionada || !this.esSupervisor()) {
      Swal.fire('Acceso Denegado', 'No tienes permisos de supervisor para devolver órdenes.', 'error');
      return;
    }

    const usernameLogueado = localStorage.getItem('sub') || this.usuarioInfo?.sub || 'SISTEMA';

    // EXTRACTOR DEL CÓDIGO DE UNIDAD DEL EJECUTOR (Desde localStorage)
    const unidadRaw = localStorage.getItem('unidadNegocio');
    let codUnidadEjecutor = '';
    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codUnidadEjecutor = unidadObj.codigoUnidad || '';
      } catch (e) {
        console.error('[Devolver Anulación] Error al parsear unidadNegocio:', e);
      }
    }

    const body = {
      codOc: this.ocSeleccionada.codOrdenCompra,
      usuarioExec: usernameLogueado,
      unidadExec: codUnidadEjecutor,
      plantillaDTO: this.mapearAPlantilla(this.ocSeleccionada)
    };

    console.log("Payload para devolución (Bandeja Anulación):", body);

    this.http.post(`${this.API_OC}/devolver`, body).subscribe({
      next: () => {
        Swal.fire('Devuelta', 'La orden fue devuelta a revisión con éxito.', 'info');
        this.ocSeleccionada = null;
        this.cargarOrdenesAutorizadas();
      },
      error: (err) => {
        console.error('[Devolver Anulación - ERROR]', err);
        Swal.fire('Error', 'No se pudo procesar la devolución en el servidor.', 'error');
      }
    });
  }

  /**
   * Modificado: Ejecuta la anulación definitiva enviando usuarioExec y unidadExec en la raíz
   */
  ejecutarAnulacion(oc: any) {
    if (!oc || !this.esSupervisor()) {
      Swal.fire('Acceso Denegado', 'No tienes permisos de supervisor para anular.', 'error');
      return;
    }

    const usernameLogueado = localStorage.getItem('sub') || this.usuarioInfo?.sub || 'SISTEMA';

    // EXTRACTOR DEL CÓDIGO DE UNIDAD DEL EJECUTOR (Desde localStorage)
    const unidadRaw = localStorage.getItem('unidadNegocio');
    let codUnidadEjecutor = '';
    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codUnidadEjecutor = unidadObj.codigoUnidad || '';
      } catch (e) {
        console.error('[Anulación] Error al parsear unidadNegocio:', e);
      }
    }

    const body = {
      codOc: oc.codOrdenCompra,
      usuarioExec: usernameLogueado,
      unidadExec: codUnidadEjecutor,
      plantillaDTO: this.mapearAPlantilla(oc)
    };

    console.log("Payload para anulación enviado al servidor:", body);

    this.http.post(`${this.API_OC}/anular`, body).subscribe({
      next: () => {
        Swal.fire('Anulada', 'La orden ha sido anulada con éxito.', 'success');
        this.ocSeleccionada = null;
        this.cargarOrdenesAutorizadas();
      },
      error: (err) => {
        console.error('[Anular - ERROR]', err);
        Swal.fire('Error', 'No se pudo procesar la anulación en el servidor.', 'error');
      }
    });
  }

  /**
   * Descarga física del archivo binario como un Blob nativo
   */
  descargarAdjunto(arch: any) {
    if (!arch || !arch.urlDescargaCompleta) {
      Swal.fire('Error', 'No se pudo determinar la ruta de descarga del archivo.', 'error');
      return;
    }

    let urlCompleta = arch.urlDescargaCompleta;
    if (!urlCompleta.startsWith('http')) {
      const base = this.API_BASE.endsWith('/') ? this.API_BASE.slice(0, -1) : this.API_BASE;
      const ruta = arch.urlDescargaCompleta.startsWith('/') ? arch.urlDescargaCompleta : '/' + arch.urlDescargaCompleta;
      urlCompleta = `${base}${ruta}`;
    }

    console.log(`[Descarga Anulación] Solicitando binario a: ${urlCompleta}`);

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
        console.error('[Descarga Anulación] Error al descargar binario:', err);
        Swal.fire('Error de descarga', 'El archivo no se encuentra disponible.', 'error');
      }
    });
  }

  abrirConfirmar(oc: any, accion: string) {
    if (!this.esSupervisor()) {
      Swal.fire('No autorizado', 'Acceso restringido a Supervisores o Administración', 'warning');
      return;
    }

    if (accion === 'devolver') {
      this.devolver();
      return;
    }

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

  private mapearAPlantilla(oc: any) {
    console.log("Mapeando OC a plantilla:", oc);
    return {
      codOrdenCompra: oc.codOrdenCompra,
      usernameUsuario: oc.usernameUsuario || oc.usernameUsuarioCreador
    };
  }

  parsearProductos(listProductosStr: any): any[] {
    if (!listProductosStr) return [];
    if (typeof listProductosStr === 'object') return listProductosStr;
    try {
      return JSON.parse(listProductosStr);
    } catch (e) {
      console.error("Error parseando productos:", e);
      return [];
    }
  }
}