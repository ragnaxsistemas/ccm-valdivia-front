import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { environment } from "../../../environments/environment";
import { DataService } from "../../services/data.service";
import { HttpClient, HttpParams } from "@angular/common/http";

@Component({
  selector: "app-gestion-oc",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./registros.component.html",
  styleUrls: ["./registros.component.scss"],
})
export class GestionOcComponent implements OnInit {
  // <-- Revisa este nombre para las rutas
  private http = inject(HttpClient);

  private readonly API_BASE = environment.apiUrl;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
  private readonly API_EXCEL_DESCARGA = `${this.API_BASE}/api/v1/oc/ordenes-compra/exportar-excel`;
  private readonly API_UNIDADES = `${this.API_BASE}/api/v1/unidad-compradora/vld_ccm`;
  private readonly API_ESTADOS = `${this.API_BASE}/api/v1/oc/status-oc/all`;
  private readonly API_GENERAR_DOC_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra/generar-documento-oc`;
  private readonly API_GET_PENDIENTE_ANULACION = `${this.API_BASE}/api/v1/oc/ordenes-compra/pendiente-anulacion`;
  /***unidades = [
    { id: 1, codigo: 'prochelle', nombre: 'Casa Prochelle' },
    { id: 2, codigo: 'biblioteca', nombre: 'Biblioteca Municipal' },
    { id: 3, codigo: 'escuela_danza', nombre: 'Escuela de Danza' },
    { id: 4, codigo: 'submarino', nombre: 'Submarino' }
  ];***/
  // Variables de datos

  solicitudAnulacionActiva: boolean = false;

  unidades: any[] = [];
  estados: any[] = [];
  ordenes: any[] = [];
  loading: boolean = false;

  paginaActual: number = 0;
  totalPaginas: number = 0;
  totalElementos: number = 0;
  tamanoPagina: number = 10;

  exportandoExcel: boolean = false;

  ocSeleccionada: any = null;
  listaAdjuntosOC: any[] = [];

  filtros = {
    rutProveedor: "",
    unidad: "",
    folioDesde: "",
    folioHasta: "",
    estado: "",
    fechaInicio: "",
    fechaFin: "",
  };

  ngOnInit() {
    this.cargarUnidades();
    this.cargarEstados(); // <-- Faltaba llamar a los estados
    this.buscar(0);
  }

  // Método para obtener el código de empresa de forma segura
  private getCodigoEmpresa(): string {
    const empresaData = localStorage.getItem("empresa");
    if (empresaData) {
      try {
        const empresa = JSON.parse(empresaData);
        return empresa.codigoEmpresaCliente || "";
      } catch (e) {
        console.error("Error al parsear empresa del localStorage", e);
      }
    }
    return "";
  }

  cargarUnidades() {
    const codigoEmpresa = this.getCodigoEmpresa();

    if (!codigoEmpresa) {
      console.warn("No se encontró código de empresa para cargar unidades");
      return;
    }

    this.http.get<any[]>(`${this.API_UNIDADES}`).subscribe({
      next: (res) => {
        this.unidades = res || [];
      },
      error: (err) => console.error("Error al cargar unidades:", err),
    });
  }

  cargarEstados() {
    this.http.get<any[]>(this.API_ESTADOS).subscribe({
      next: (res) => {
        this.estados = res || [];
      },
      error: (err) => console.error("Error al cargar estados:", err),
    });
  }

  buscar(page: number = 0) {
  this.paginaActual = page;
  console.log(`Iniciando búsqueda con filtros en la página ${this.paginaActual}:`, this.filtros);
  this.loading = true;
  let params = new HttpParams();

  // 1. Parámetros de paginación obligatorios para Spring Data
  params = params.set('page', this.paginaActual.toString());
  params = params.set('size', this.tamanoPagina.toString());

  // 2. Filtros básicos de texto, selección y fechas
  if (this.filtros.rutProveedor) params = params.set('rut', this.filtros.rutProveedor);
  if (this.filtros.unidad) params = params.set('unidad', this.filtros.unidad);
  if (this.filtros.estado) params = params.set('codEstadoOc', this.filtros.estado);
  if (this.filtros.fechaInicio) params = params.set('fechaInicioStr', this.filtros.fechaInicio);
  if (this.filtros.fechaFin) params = params.set('fechaFinStr', this.filtros.fechaFin);

  // ===================================================================
  // 🧼 LIMPIEZA DE FOLIOS ANTES DE ENVIAR (Ej: "OC-000016" -> "16")
  // ===================================================================
  if (this.filtros.folioDesde) {
    const folioDesdeLimpio = this.filtros.folioDesde.replace(/\D/g, '').replace(/^0+/, '');
    if (folioDesdeLimpio) {
      params = params.set('desde', folioDesdeLimpio);
    }
  }

  if (this.filtros.folioHasta) {
    const folioHastaLimpio = this.filtros.folioHasta.replace(/\D/g, '').replace(/^0+/, '');
    if (folioHastaLimpio) {
      params = params.set('hasta', folioHastaLimpio);
    }
  }

  console.log('Busqueda Avanzada Endpoint completo con paginación:', `${this.API_BUSQUEDA_AVANZADA}?${params.toString()}`);

  // 3. Petición HTTP única al Backend
  this.http.get<any>(`${this.API_BUSQUEDA_AVANZADA}`, { params }).subscribe({
    next: (res) => {
      // Extraemos la lista de las 10 OCs correspondientes a la página actual
      this.ordenes = res.content || res || [];
      
      // Mapeamos los metadatos de paginación devueltos por el backend (gracias al countQuery)
      this.totalPaginas = res.totalPages || 0;
      this.totalElementos = res.totalElements || 0;

      // Imprime en consola las Órdenes de Compra que se están mostrando en este instante
      console.log(`📦 Mostrando ${this.ordenes.length} registros en la página actual (Total en BD: ${this.totalElementos})`);
      this.ordenes.forEach((oc) => {
        console.log(`-> Mostrando OC: ${oc.codOrdenCompra} | EstadoID: ${oc.codEstadoActualOc} | Texto: ${oc.estadoActualOc}`);
      });

      this.loading = false;
    },
    error: () => (this.loading = false)
  });
}

  paginaAnterior() {
    if (this.paginaActual > 0) {
      this.buscar(this.paginaActual - 1);
    }
  }

  paginaSiguiente() {
    if (this.paginaActual < this.totalPaginas - 1) {
      this.buscar(this.paginaActual + 1);
    }
  }

  exportarAExcel() {
  console.log('Iniciando exportación a Excel con filtros actuales:', this.filtros);
  this.exportandoExcel = true;
  
  let params = new HttpParams();

  // Mapeamos los mismos filtros que el método buscar()
  if (this.filtros.rutProveedor) params = params.set('rut', this.filtros.rutProveedor);
  if (this.filtros.unidad) params = params.set('unidad', this.filtros.unidad);
  if (this.filtros.estado) params = params.set('codEstadoOc', this.filtros.estado);
  if (this.filtros.fechaInicio) params = params.set('fechaInicioStr', this.filtros.fechaInicio);
  if (this.filtros.fechaFin) params = params.set('fechaFinStr', this.filtros.fechaFin);

  // Limpieza de folios (idéntico a buscar)
  if (this.filtros.folioDesde) {
    const desdeLimpio = this.filtros.folioDesde.replace(/\D/g, '').replace(/^0+/, '');
    if (desdeLimpio) params = params.set('desde', desdeLimpio);
  }
  if (this.filtros.folioHasta) {
    const folioHastaLimpio = this.filtros.folioHasta.replace(/\D/g, '').replace(/^0+/, '');
    if (folioHastaLimpio) params = params.set('hasta', folioHastaLimpio);
  }

  // Realizamos la petición HTTP indicando que esperamos un archivo binario (responseType: 'blob')
  this.http.get(`${this.API_EXCEL_DESCARGA}`, { params, responseType: 'blob' }).subscribe({
    next: (blob: Blob) => {
      // Creamos un link oculto en el navegador para forzar la descarga del archivo generado
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_Ordenes_Compra_CCM_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      // Limpieza del DOM
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      this.exportandoExcel = false;
    },
    error: (err) => {
      console.error('Error al exportar el archivo Excel:', err);
      this.exportandoExcel = false;
      alert('Ocurrió un error al intentar generar el archivo de reporte.');
    }
  });
}

  getEstadoClass(estado: string): string {
    const st = estado?.toLowerCase();
    switch (st) {
      case "borrador":
        return "bg-borrador";
      case "pendiente_autorizacion":
        return "bg-pendiente-auth";
      case "autorizado":
        return "bg-autorizado";
      case "anulado":
        return "bg-anulado";
      case "confirmada":
        return "bg-confirmada";
      case "pendiente_anulacion":
        return "bg-pendiente-anul";
      default:
        return "status-text text-muted";
    }
  }

  verDetalle(oc: any) {
    this.ocSeleccionada = oc;
    this.listaAdjuntosOC = []; // Limpiamos la lista local del modal
    this.solicitudAnulacionActiva = false;

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

    console.log(
      `[Adjuntos Registros] Buscando archivos en servidor para la OC: ${codigoOC}`
    );

    // Consumimos el endpoint de archivos asociados
    this.http
      .get<any[]>(
        `${this.API_BASE}/api/v1/oc/ordenes-compra/${codigoOC}/archivos`
      )
      .subscribe({
        next: (archivosServidor) => {
          if (archivosServidor && archivosServidor.length > 0) {
            this.listaAdjuntosOC = archivosServidor.map((adj) => {
              // Extraer el ID desde la URL (Ej: "/api/v1/oc/ordenes-compra/download/14")
              let idExtraido: number | undefined = undefined;
              if (adj.urlDescarga) {
                const partes = adj.urlDescarga.split("/");
                const ultimoSegmento = partes[partes.length - 1];
                if (ultimoSegmento && !isNaN(ultimoSegmento)) {
                  idExtraido = parseInt(ultimoSegmento, 10);
                }
              }

              return {
                idAdjunto: idExtraido,
                nombreArchivo: adj.nombreArchivo,
                urlDescargaCompleta: adj.urlDescarga,
                isServerFile: true,
              };
            });
            console.log(
              "[Adjuntos Registros] Archivos cargados en el modal:",
              this.listaAdjuntosOC
            );
          }
        },
        error: (err) => {
          if (err.status === 204) {
            console.log(
              `[Adjuntos Registros] La orden ${codigoOC} no registra archivos adjuntos (204).`
            );
          } else {
            console.error(
              "[Adjuntos Registros] Error al obtener adjuntos:",
              err
            );
          }
        },
      });
  }

  descargarAdjunto(arch: any) {
    if (!arch || !arch.urlDescargaCompleta) {
      alert("No se pudo determinar la ruta de descarga del archivo.");
      return;
    }

    let urlCompleta = arch.urlDescargaCompleta;
    if (!urlCompleta.startsWith("http")) {
      const base = this.API_BASE.endsWith("/")
        ? this.API_BASE.slice(0, -1)
        : this.API_BASE;
      const ruta = arch.urlDescargaCompleta.startsWith("/")
        ? arch.urlDescargaCompleta
        : "/" + arch.urlDescargaCompleta;
      urlCompleta = `${base}${ruta}`;
    }

    console.log(
      `[Descarga Registros] Solicitando archivo binario a: ${urlCompleta}`
    );

    this.http.get(urlCompleta, { responseType: "blob" }).subscribe({
      next: (blobData: Blob) => {
        const urlBlob = window.URL.createObjectURL(blobData);
        const link = document.createElement("a");
        link.href = urlBlob;
        link.download = arch.nombreArchivo || "archivo_adjunto";
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(urlBlob);
      },
      error: (err) => {
        console.error("[Descarga - ERROR]", err);
        alert(
          "El archivo no se encuentra disponible o no tienes permisos suficientes."
        );
      },
    });
  }

  // 4. Asegúrate de tener expuesta la función parsearProductos si el backend envía el listado de productos serializado
  parsearProductos(jsonString: any): any[] {
    if (!jsonString) return [];
    if (Array.isArray(jsonString)) return jsonString;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return [];
    }
  }

  descargarDocumento(oc: any) {
    if (this.loading) return; // Evita múltiples clics si ya está cargando

    this.loading = true;
    const userSub = localStorage.getItem("sub");
    const unidadRaw = localStorage.getItem("unidadNegocio");

    let codUnidad = "";
    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codUnidad = unidadObj.codigoUnidad;
      } catch (e) {
        codUnidad = unidadRaw;
      }
    }

    const payload = {
      codOc: oc.codOrdenCompra,
      plantillaDTO: {
        usernameUsuario: userSub,
        codUnidad: codUnidad,
        codOrdenCompra: oc.codOrdenCompra,
      },
    };

    // AGREGAMOS { responseType: 'blob' } para recibir el archivo correctamente
    // AGREGAMOS { responseType: 'blob', observe: 'response' } si quieres leer los headers del backend
    this.http
      .post(`${this.API_GENERAR_DOC_OC}`, payload, {
        responseType: "blob",
        observe: "response", // Esto nos permite acceder a los Headers (como Content-Disposition)
      })
      .subscribe({
        next: (response) => {
          const res = response.body;
          if (!res) {
            this.handleError("El servidor no devolvió contenido.");
            return;
          }

          // 1. Crear el Blob y su URL
          const blob = new Blob([res], { type: "application/pdf" });
          const url = window.URL.createObjectURL(blob);

          // 2. Intentar obtener el nombre del archivo desde el header del backend
          const contentDisposition = response.headers.get(
            "content-disposition"
          );
          let fileName = `documento_oc_${oc.codOrdenCompra}.pdf`; // Nombre por defecto razonable

          if (contentDisposition) {
            // Busca específicamente el valor después de 'filename='
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
              contentDisposition
            );
            if (matches != null && matches[1]) {
              fileName = matches[1].replace(/['"]/g, "");
            }
          }

          // 3. Crear link y disparar descarga
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();

          // 4. Limpieza con un pequeño delay para asegurar la ejecución del navegador
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            this.loading = false; // Liberamos la interfaz
          }, 100);
        },
        error: (err) => {
          console.error("Error al generar documento", err);
          this.handleError(
            "No se pudo generar el PDF. Verifique su conexión o el estado de la OC."
          );
        },
      });
  }
  // Método auxiliar para limpiar el estado en caso de error
  private handleError(message: string) {
    this.loading = false;
    alert(message);
  }

  //  verDetalle(oc: any) {
  //    console.log('Detalle:', oc);
  //  }

  formatFecha(fechaStr: string): string {
    if (!fechaStr) return "";
    const date = new Date(fechaStr);
    return date.toLocaleDateString("es-CL");
  }

  limpiarFiltros() {
    this.filtros = {
      rutProveedor: "",
      unidad: "",
      folioDesde: "",
      folioHasta: "",
      estado: "",
      fechaInicio: "",
      fechaFin: "",
    };
    this.buscar(0);
  }
}
