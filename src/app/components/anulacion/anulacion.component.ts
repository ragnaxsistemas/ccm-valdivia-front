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
  private readonly API_GET_PENDIENTE_ANULACION = `${this.API_BASE}/api/v1/oc/ordenes-compra/pendiente-anulacion`;

  listaAutorizadas: any[] = [];
  ocSeleccionada: any = null;
  loading: boolean = false;
  solicitudAnulacionActiva: boolean = false;

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
    this.cargarOrdenesConfirmadas();
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

  cargarOrdenesConfirmadas() {
    this.loading = true;

    let params = new HttpParams()
      .set('codEstadoOc', 'confirmada') 
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
    this.solicitudAnulacionActiva = false; // Reset de la alerta de anulación

    const codigoOC = oc.codOrdenCompra || oc.codigoOrdenCompra;
    if (!codigoOC) return;

     // ===================================================================
    // 🔍 NUEVA VALIDACIÓN: BUSCAR SOLICITUD DE ANULACIÓN ACTIVA
    // ===================================================================
    console.log(`🔍 [Ver Detalle] Verificando si la OC ${codigoOC} posee solicitudes de anulación activas...`);
    
    // Configuramos los parámetros. Enviamos el estado correspondiente si tu regla de negocio lo exige.
    let paramsAnulacion = new HttpParams().set('codOrdenCompra', codigoOC);

    this.http.get<any>(this.API_GET_PENDIENTE_ANULACION, { params: paramsAnulacion }).subscribe({
      next: (res) => {
        console.log('📦 [Ver Detalle - Anulación] Respuesta cruda del servidor:', res);

        // Evaluamos según la estructura de PendienteAnulacionDTO recibida
        // Si el endpoint retorna un listado (Page/Array), buscamos el elemento. Si retorna un objeto directo:
        if (res) {
          // Si el backend te devuelve un objeto directo mapeado al DTO enviado:
          const cumpleCondicion = (res.codOrdenCompra === codigoOC || res.codOc === codigoOC) && res.active === true;
          
          // Por si el backend responde con una estructura paginada o lista (.content o Array) debido al volumen:
          const listaDTOs = res.content || (Array.isArray(res) ? res : [res]);
          const existeMatchActivo = listaDTOs.some((dto: any) => 
            dto && (dto.codOrdenCompra === codigoOC) && dto.active === true
          );

          if (cumpleCondicion || existeMatchActivo) {
            this.solicitudAnulacionActiva = true;
            this.ocSeleccionada.observacionAnulacion = res.observacionAnulacion || 'Existe una solicitud de anulación activa para esta orden.';
            console.log(`⚠️ [Ver Detalle - MATCH] La OC ${codigoOC} TIENE una solicitud de anulación activa.`);
          }
        }
      },
      error: (err) => {
        console.error('❌ [Ver Detalle - Anulación] Error al consultar estado de anulación:', err);
      }
    });

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
  solicitarAnulacion(oc: any): void {
      if (!oc) return;
  
      // Validación de seguridad inversa por si acaso
      if (this.esSupervisor()) {
        Swal.fire('Operación no permitida', 'Los supervisores deben gestionar la orden mediante los flujos de autorización o devolución.', 'warning');
        return;
      }
  
      Swal.fire({
        title: '¿Solicitar Anulación de la Orden?',
        text: `Esta acción enviará la OC ${oc.codOrdenCompra} a estado pendiente de anulación.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'SÍ, SOLICITAR',
        cancelButtonText: 'CANCELAR'
      }).then((result) => {
        if (result.isConfirmed) {
          
          // Extraemos los datos de la sesión activa de manera idéntica al flujo de supervisores
          const usernameLogueado = localStorage.getItem('sub') || this.usuarioInfo?.sub || 'SISTEMA';
          
          const unidadRaw = localStorage.getItem('unidadNegocio');
          let codUnidadEjecutor = '';
          if (unidadRaw) {
            try {
              const unidadObj = JSON.parse(unidadRaw);
              codUnidadEjecutor = unidadObj.codigoUnidad || '';
            } catch (e) {
              console.error('[Solicitar Anulación] Error al parsear unidadNegocio desde localStorage:', e);
            }
          }
  
          // Construcción del payload estructurado según PendienteAnulacionOrdenCompraRequest del Backend
          const payload = {
            codOc: oc.codOrdenCompra,
            usuarioPendienteAnulacion: usernameLogueado,
            unidadPendienteAnulacion: codUnidadEjecutor
          };
  
          // --- ESCRITURA DE LOGS SOLICITADA ---
          console.log('🚀 [Solicitar Anulación] Iniciando petición HTTP POST hacia el backend.');
          console.log(`📌 [Solicitar Anulación] Endpoint destino: ${this.API_GET_PENDIENTE_ANULACION}`);
          console.log('📦 [Solicitar Anulación] Cuerpo de la solicitud (PendienteAnulacionOrdenCompraRequest):', JSON.stringify(payload, null, 2));
  
          this.http.post<any>(this.API_GET_PENDIENTE_ANULACION, payload)
            .subscribe({
              next: (response) => {
                // Log de éxito con la respuesta del DTO del backend
                console.log('✅ [Solicitar Anulación - SUCCESS] Transacción exitosa procesada en el servidor. Respuesta:', response);
                
                Swal.fire('Solicitud Enviada', 'La solicitud de anulación ha sido registrada correctamente.', 'success');
                this.ocSeleccionada = null; // Cierra el modal de manera limpia
                this.cargarOrdenesConfirmadas();      // Refresca la grilla principal
              },
              error: (err) => {
                // Log de falla detallado
                console.error('❌ [Solicitar Anulación - ERROR] Error crítico al intentar cambiar el estado en el backend:', err);
                
                Swal.fire('Error', 'No se pudo procesar la solicitud de anulación en el servidor.', 'error');
              }
            });
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
        this.cargarOrdenesConfirmadas();
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

    /***if (accion === 'devolver') {
      this.devolver();
      return;
    }***/

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