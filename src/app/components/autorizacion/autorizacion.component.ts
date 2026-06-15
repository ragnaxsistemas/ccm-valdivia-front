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
  private readonly API_PENDIENTE_ANULACION = `${this.API_BASE}/api/v1/oc/ordenes-compra/pendiente-anulacion`;
  private readonly API_GET_PENDIENTE_ANULACION = `${this.API_BASE}/api/v1/oc/ordenes-compra/pendiente-anulacion`;

  loading: boolean = false;
  solicitudAnulacionActiva: boolean = false;

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
    this.listaAdjuntosOC = []; // Limpiamos la lista local del modal
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
    // ===================================================================

    console.log(`[Adjuntos Auth] Buscando archivos en servidor para la OC: ${codigoOC}`);
    
    // Llamada al servicio para traer los archivos reales guardados
    this.http.get<any[]>(`${this.API_OC}/${codigoOC}/archivos`).subscribe({
      next: (archivosServidor) => {
        if (archivosServidor && archivosServidor.length > 0) {
          this.listaAdjuntosOC = archivosServidor.map(adj => {
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
        }
      },
      error: (err) => {
        if (err.status === 204) {
          console.log(`[Adjuntos Auth] La orden ${codigoOC} no registra archivos adjuntos (204).`);
        } else {
          console.error('[Adjuntos Auth] Error al obtener adjuntos:', err);
        }
      }
    });
  }

  descargarAdjunto(arch: any) {
    if (!arch || !arch.urlDescargaCompleta) {
      Swal.fire('Error', 'No se pudo determinar la ruta de descarga del archivo.', 'error');
      return;
    }

    // Si la URL viene relativa (ej: /api/v1/...) le anteponemos la API_BASE si no la trae ya
    let urlCompleta = arch.urlDescargaCompleta;
    if (!urlCompleta.startsWith('http')) {
      // Nos aseguramos de no duplicar barras diagonales
      const base = this.API_BASE.endsWith('/') ? this.API_BASE.slice(0, -1) : this.API_BASE;
      const ruta = arch.urlDescargaCompleta.startsWith('/') ? arch.urlDescargaCompleta : '/' + arch.urlDescargaCompleta;
      urlCompleta = `${base}${ruta}`;
    }

    console.log(`[Descarga] Solicitando archivo binario a: ${urlCompleta}`);

    // Solicitamos el archivo como un BLOB (Binary Large Object) para forzar la descarga nativa
    this.http.get(urlCompleta, { responseType: 'blob' }).subscribe({
      next: (blobData: Blob) => {
        const urlBlob = window.URL.createObjectURL(blobData);
        const link = document.createElement('a');
        link.href = urlBlob;
        link.download = arch.nombreArchivo || 'archivo_adjunto';
        document.body.appendChild(link);
        link.click();
        
        // Limpieza de memoria
        document.body.removeChild(link);
        window.URL.revokeObjectURL(urlBlob);
      },
      error: (err) => {
        console.error('[Descarga - ERROR] No se pudo obtener el archivo binario:', err);
        Swal.fire('Error de descarga', 'El archivo no se encuentra disponible o no tienes permisos para descargarlo.', 'error');
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

    // Recuperamos el usuario logueado (Supervisor)
    const usernameLogueado = localStorage.getItem('sub') || this.usuarioInfo?.sub || 'SISTEMA';

    // ===================================================================
    // EXTRACTOR DEL CÓDIGO DE UNIDAD DEL EJECUTOR (Desde localStorage)
    // ===================================================================
    const unidadRaw = localStorage.getItem('unidadNegocio');
    let codUnidadEjecutor = '';

    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codUnidadEjecutor = unidadObj.codigoUnidad || '';
      } catch (e) {
        console.error('[Confirmar Autorización] Error al parsear unidadNegocio:', e);
      }
    }
    // ===================================================================

    // 2. Construir el body estructurado con los parámetros de ejecución requeridos
    const body = {
      codOc: this.ocSeleccionada.codOrdenCompra,
      usuarioExec: usernameLogueado,       // Reemplaza o complementa usuarioSup
      unidadExec: codUnidadEjecutor,       // Código de unidad de negocio de la sesión activa
      plantillaDTO: this.mapearAPlantilla(this.ocSeleccionada)
    };

    console.log('[Confirmar Autorización] Despachando payload al servidor:', body);

    // 3. Consumir el endpoint '/autorizar'
    this.http.post(`${this.API_OC}/autorizar`, body)
      .subscribe({
        next: () => {
          Swal.fire('AUTORIZADA', 'La orden de compra ha sido autorizada correctamente.', 'success');
          this.ocSeleccionada = null;
          this.cargarPendientes(); // Recarga la grilla de pendientes en la bandeja
        },
        error: (err) => {
          console.error('[Confirmar Autorización - ERROR]', err);
          Swal.fire('Error', 'Hubo un problema al autorizar la orden en el servidor.', 'error');
        }
      });
  }

  devolver() {
    // 1. Validar que exista una OC seleccionada y que el usuario sea Supervisor
    if (!this.ocSeleccionada || !this.esSupervisor()) {
      Swal.fire('Acceso Denegado', 'No tienes permisos de supervisor para devolver órdenes.', 'error');
      return;
    }

    console.log("Usuario en sesión para devolución:", this.usuarioInfo);

    // Recuperamos el usuario logueado (Supervisor)
    const usernameLogueado = localStorage.getItem('sub') || this.usuarioInfo?.sub || 'SISTEMA';

    // ===================================================================
    // EXTRACTOR DEL CÓDIGO DE UNIDAD DEL EJECUTOR (Desde localStorage)
    // ===================================================================
    const unidadRaw = localStorage.getItem('unidadNegocio');
    let codUnidadEjecutor = '';

    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codUnidadEjecutor = unidadObj.codigoUnidad || '';
      } catch (e) {
        console.error('[Devolver] Error al parsear unidadNegocio desde localStorage:', e);
      }
    }
    // ===================================================================

    // 2. Construir el body estructurado según OrdenCompraRequest esperado por el Backend
    const body = {
      codOc: this.ocSeleccionada.codOrdenCompra,
      usuarioExec: usernameLogueado,       // Reemplaza usuarioSup para auditoría uniforme
      unidadExec: codUnidadEjecutor,       // Código de unidad de negocio de quien ejecuta la acción
      plantillaDTO: this.mapearAPlantilla(this.ocSeleccionada)
    };

    console.log("Payload para devolución despachado al servidor:", body);

    // 3. Consumir el endpoint '/devolver'
    this.http.post(`${this.API_OC}/devolver`, body)
      .subscribe({
        next: () => {
          Swal.fire('Devuelta', 'La orden fue enviada a revisión con éxito.', 'info');
          this.ocSeleccionada = null;
          this.cargarPendientes(); // Recarga la grilla para limpiar la bandeja
        },
        error: (err) => {
          console.error('[Devolver - ERROR]', err);
          Swal.fire('Error', 'No se pudo procesar la devolución en el servidor.', 'error');
        }
      });
  }
  
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
        console.log(`📌 [Solicitar Anulación] Endpoint destino: ${this.API_PENDIENTE_ANULACION}`);
        console.log('📦 [Solicitar Anulación] Cuerpo de la solicitud (PendienteAnulacionOrdenCompraRequest):', JSON.stringify(payload, null, 2));

        this.http.post<any>(this.API_PENDIENTE_ANULACION, payload)
          .subscribe({
            next: (response) => {
              // Log de éxito con la respuesta del DTO del backend
              console.log('✅ [Solicitar Anulación - SUCCESS] Transacción exitosa procesada en el servidor. Respuesta:', response);
              
              Swal.fire('Solicitud Enviada', 'La solicitud de anulación ha sido registrada correctamente.', 'success');
              this.ocSeleccionada = null; // Cierra el modal de manera limpia
              this.cargarPendientes();      // Refresca la grilla principal
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

  private mapearAPlantilla(oc: any) {
    console.log("Mapeando OC a plantilla:", oc);
    return {
      codOrdenCompra: oc.codOrdenCompra,
      usernameUsuario: oc.usernameUsuario,
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