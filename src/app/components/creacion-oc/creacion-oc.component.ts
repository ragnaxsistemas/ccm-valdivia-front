import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from "../../../environments/environment";
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';

@Component({
  selector: 'app-creacion-oc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './creacion-oc.component.html',
  styleUrls: ['./creacion-oc.component.scss']
})
export class CreacionOcComponent implements OnInit {
  private http = inject(HttpClient);
  
  // Endpoints centralizados
  private readonly API_BASE = environment.apiUrl;
  private readonly API_OC_NEW = `${this.API_BASE}/api/v1/oc/ordenes-compra/new`;
  private readonly API_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra`;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
  private readonly API_PROV = `${this.API_BASE}/api/v1/oc/proveedor`;
  private readonly API_DTE = `${this.API_BASE}/api/v1/oc/dte`;
  private readonly API_PRODUCTO = `${this.API_BASE}/api/v1/oc/producto/all`;
  private readonly API_COMUNA = `${this.API_BASE}/api/v1/comuna`;
  private readonly API_UNIDADES = `${this.API_BASE}/api/v1/unidad-compradora/vld_ccm`;

  // Estado Principal de la OC
  ocData: any = null;
  loading: boolean = false;
  ocCreada: boolean = false; 
  ocFinalizada: boolean = false;
  codOrdenCompra: string = '';

  alertaUI: { mensaje: string; tipo: 'error' | 'success' } | null = null;
  private alertaTimeout: any = null;

  // Buscador de Borradores
  filtroBorrador: string = '';
  borradoresFiltrados: any[] = [];
  private buscadorSubject = new Subject<string>();

  // Datos Maestros (Combos globales)
  proveedores: any[] = [];
  unidades: any[] = [];
  listaDte: any[] = [];
  productos: any[] = [];

  // Estado de Selección de la OC actual
  proveedorSeleccionado: any = null;
  modoEdicionProveedor: boolean = true;
  filtroProveedor: string = '';
  userRole: string = '';
  
  dteSeleccionado: any = null;
  dteIdSeleccionado: any = null;

  idUnidadCompradoraSeleccionada: number | null = null;
  codUnidadCompradoraSeleccionada: string = '';

  nombreOrdenCompra: string = '';
  observaciones: string = '';
  codGiroSeleccionado: string = '';

  // Tabla Dinámica de Ítems
  items: any[] = []; 
  filaActiva: number | null = null; 

  // Adjuntos (Drag & Drop)
  listaAdjuntos: any[] = [];
  isDragging: boolean = false;
  adjuntosEliminadosIds: number[] = [];

  ngOnInit() {
    this.cargarProveedores();
    this.cargarDte();
    this.cargarProductos();
    this.cargarUnidades();
    this.obtenerRolDesdeStorage();
    this.inicializarTabla();
    this.inicializarBuscadorReactivo();
  }

  // ==========================================
  // INICIALIZADORES Y BAJADA DE MAESTROS
  // ==========================================
  
  obtenerRolDesdeStorage(): void {
  const userJson = localStorage.getItem('usuario');
  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      this.userRole = user.role?.nombre?.toUpperCase() || 'SIN ROL';
    } catch (e) {
      console.error("Error al parsear el usuario en localStorage", e);
      this.userRole = 'SIN ROL';
    }
  } else {
    this.userRole = 'SIN ROL';
  }
}

  private inicializarBuscadorReactivo() {
    console.log('[Buscador] Inicializando flujo reactivo...');

    this.buscadorSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        console.log(`[Buscador] Capturado término: "${term}"`);

        if (!term || !term.trim()) {
          console.log('[Buscador] Término vacío. Limpiando lista.');
          this.borradoresFiltrados = [];
          return of(null);
        }

        this.loading = true;

        const params: any = {
          codOrdenCompra: term.trim(),
          codEstadoOc: 'borrador',
          page: 0,
          size: 10,
          sort: 'idOrdenCompra,desc'
        };

        console.log('[Buscador] Ejecutando HTTP GET en backend con params:', params);

        return this.http.get<any>(`${this.API_BUSQUEDA_AVANZADA}`, { params }).pipe(
          switchMap(res => {
            console.log('[Buscador] Respuesta HTTP exitosa recibida:', res);
            return of(res);
          }),
          catchError(err => {
            console.error('[Buscador] Error controlado en la petición HTTP:', err);
            this.loading = false;
            return of({ content: [] });
          })
        );
      })
    ).subscribe({
      next: (res: any) => {
        if (res) {
          this.borradoresFiltrados = res.content || [];
          console.log(`[Buscador] Renderizando ${this.borradoresFiltrados.length} borradores en UI.`);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('[Buscador] Error crítico. El Subject principal se ha cerrado:', err);
        this.loading = false;
      }
    });
  }

  buscarBorradores() {
    console.log(`[Buscador] Input disparado. Filtro actual texto: "${this.filtroBorrador}"`);
    this.buscadorSubject.next(this.filtroBorrador);
  }

  cargarProveedores() {
    this.http.get<any[]>(`${this.API_PROV}/all`)
      .subscribe((res) => this.proveedores = res || []);
  }

  cargarDte() {
    this.http.get<any[]>(`${this.API_DTE}/all`).subscribe({
      next: (res) => this.listaDte = res?.filter((d: any) => d.active) || [],
      error: (err) => console.error('Error al cargar DTEs:', err)
    });
  }

  cargarUnidades() {
    this.http.get<any[]>(this.API_UNIDADES).subscribe({
      next: (res) => this.unidades = res || [],
      error: (err) => console.error('Error al cargar unidades:', err)
    });
  }

  cargarProductos() {
    this.http.get<any[]>(`${this.API_PRODUCTO}`).subscribe({
      next: (res) => this.productos = res || [],
      error: (err) => console.error('Error al cargar productos:', err)
    });
  }

  inicializarTabla() {
    this.items = Array.from({ length: 5 }, () => ({
      codigoProducto: '', descripcionProducto: '', valorProducto: 0, cantidad: 1, total: 0
    }));
  }

  // ==========================================
  // CICLO DE VIDA DE LA ORDEN DE COMPRA
  // ==========================================

  iniciarNuevaOC() {
    this.loading = true;
    const userSub = localStorage.getItem('sub') || '';
    const unidadRaw = localStorage.getItem('unidadNegocio');
    let codUnidad = '';
    let nombreUnidadCalculado = '';

    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codUnidad = unidadObj.codigoUnidad || '';
        nombreUnidadCalculado = unidadObj.nombreUnidad || unidadObj.showNombreUnidad || ''; 
      } catch (e) {
        codUnidad = unidadRaw;
        nombreUnidadCalculado = unidadRaw;
      }
    }

    // Nuevo formato OrdenCompraRequest mapeado para endpoint /new
    const payloadInit = {
      codOc: null,
      usuarioExec: userSub,
      unidadExec: codUnidad,
      plantillaDTO: {
        codUnidad: codUnidad
      }
    };
    
    this.http.post<any>(`${this.API_OC_NEW}`, payloadInit)
      .subscribe({
        next: (res) => {
          this.ocData = {
            ...res,
            fechaOrdenCompra: this.obtenerFechaActual(),
            usuario: userSub,              
            nombreusuarioCreador: localStorage.getItem('nombre'),              
            apellidousuarioCreador: localStorage.getItem('apellidoPaterno'),
            nombreusuarioSolicitante: "-",              
            apellidousuarioSolicitante: "-",              
            unidad: null,            
            unidadCompradora: nombreUnidadCalculado, 
            idUnidadCompradora: null 
          };

          this.idUnidadCompradoraSeleccionada = null;
          this.codUnidadCompradoraSeleccionada = '';
          this.ocCreada = true;
          this.loading = false;
          this.proveedorSeleccionado = null;
          this.modoEdicionProveedor = true;
          this.inicializarTabla();
        },
        error: (err) => {
          console.error('Error al iniciar OC:', err);
          this.loading = false;
        }
      });
  }
  
  cargarBorrador(borrador: any) {
    console.log('[Adjuntos] Cargando borrador seleccionado:', borrador.codOrdenCompra);
    this.loading = true;
    const unidadExec = JSON.parse(localStorage.getItem('unidadNegocio') || '{}');

    // 1. Resolver el Documento Tributario (DTE)
    if (borrador.codDocumentoTributario) {
      const codBuscado = String(borrador.codDocumentoTributario).trim();
      const dteEncontrado = this.listaDte.find((d: any) => 
        String(d.codigoDocumentoTributario || d.codDocumentoTributario).trim() === codBuscado
      );
      if (dteEncontrado) {
        this.dteSeleccionado = dteEncontrado;
        this.dteIdSeleccionado = codBuscado;
      }
    }

    // 2. Resolver Unidad de Negocio / Unidad Compradora
    const codUnidadBD = borrador.codUnidad || borrador.unidad || unidadExec.codigoUnidad || null;
    const idUnidadBD = borrador.idUnidadCompradora || borrador.idUnidad || borrador.unidadId || unidadExec.idUnidad || null;
    const fecha =  this.obtenerFechaActual();
    const uCreadorNombre = borrador.nombreUsuarioCreador || borrador.nombreusuarioCreador;
    const nombreusuarioCreador = (uCreadorNombre && uCreadorNombre.trim() !== '') ? uCreadorNombre.trim() : "-";

    const uCreadorApellido = borrador.apellidoUsuarioCreador || borrador.apellidousuarioCreador;
    const apellidousuarioCreador = (uCreadorApellido && uCreadorApellido.trim() !== '') ? uCreadorApellido.trim() : "-";

    const uSolicitanteNombre = borrador.nombreUsuarioSolicitante || borrador.nombreusuarioSolicitante;
    const nombreusuarioSolicitante = (uSolicitanteNombre && uSolicitanteNombre.trim() !== '') ? uSolicitanteNombre.trim() : "-";

    const uSolicitanteApellido = borrador.apellidoUsuarioSolicitante || borrador.apellidousuarioSolicitante;
    const apellidousuarioSolicitante = (uSolicitanteApellido && uSolicitanteApellido.trim() !== '') ? uSolicitanteApellido.trim() : "-";

    this.ocData = { 
      ...borrador,
      unidad: codUnidadBD,
      unidadCompradora: borrador.nombreUnidad || borrador.unidadCompradora || unidadExec.showNombreUnidad || unidadExec.nombreUnidad,
      usuario: borrador.usernameUsuario || borrador.usuario || localStorage.getItem('sub'),
      fechaOrdenCompra: fecha,
      
      // Inyección de los nuevos campos sanitizados para renderizar en el HTML
      nombreusuarioCreador: nombreusuarioCreador,
      apellidousuarioCreador: apellidousuarioCreador,
      nombreusuarioSolicitante: nombreusuarioSolicitante,
      apellidousuarioSolicitante: apellidousuarioSolicitante,

    };

    setTimeout(() => {
      this.codUnidadCompradoraSeleccionada = codUnidadBD ? codUnidadBD.toString().trim() : '';
      this.idUnidadCompradoraSeleccionada = idUnidadBD;
      if (this.ocData) this.ocData.unidad = this.codUnidadCompradoraSeleccionada;
    }, 150);

    this.nombreOrdenCompra = borrador.nombreOrdenCompra || '';
    this.observaciones = borrador.observaciones || '';

    // 3. Resolver Datos del Proveedor (Local o API Externa)
    if (borrador.rutProveedor || borrador.proveedor) {
      const rutABuscar = borrador.rutProveedor || borrador.proveedor;
      this.proveedorSeleccionado = this.proveedores.find((p: any) => p.rutProveedor === rutABuscar);
      
      if (this.proveedorSeleccionado) {
        this.completarCargaProveedor();
      } else {
        this.http.get<any>(`${this.API_PROV}/${rutABuscar}`).subscribe({
          next: (res) => {
            this.proveedorSeleccionado = res;
            this.completarCargaProveedor();
          },
          error: (err) => console.error('Error al cargar proveedor desde API:', err)
        });
      }
    }

    // 4. Resolver Grilla de Productos de la Orden
    if (borrador.listProductosOrden) {
      try {
        const productosGuardados = JSON.parse(borrador.listProductosOrden);
        this.items = productosGuardados.map((p: any) => ({
          ...p,
          total: (p.valorProducto || 0) * (p.cantidad || 0)
        }));
        while (this.items.length < 5) {
          this.items.push({ codigoProducto: '', descripcionProducto: '', valorProducto: 0, cantidad: 1, total: 0 });
        }
      } catch (e) {
        this.inicializarTabla();
      }
      if (borrador.codGiroSeleccionado) {
        setTimeout(() => this.codGiroSeleccionado = borrador.codGiroSeleccionado, 100);
      }
    } else {
      this.inicializarTabla();
    }

    // 5. NUEVO: Recuperar archivos adjuntos guardados en el Servidor para este Borrador
    this.listaAdjuntos = [];
    this.adjuntosEliminadosIds = [];
    const codigoOC = borrador.codigoOrdenCompra || borrador.codOrdenCompra;

    if (codigoOC) {
      this.http.get<any[]>(`${this.API_OC}/${codigoOC}/archivos`).subscribe({
        next: (archivosServidor) => {
          if (archivosServidor && archivosServidor.length > 0) {
            console.log(`[Adjuntos] Se encontraron ${archivosServidor.length} archivos para la orden: ${codigoOC}`);
            
            this.listaAdjuntos = archivosServidor.map(adj => {
              // 1. EXTRAER EL ID DESDE LA URL (Ej: "/api/v1/oc/ordenes-compra/download/14")
              let idExtraido: number | undefined = undefined;
              if (adj.urlDescarga) {
                const partes = adj.urlDescarga.split('/');
                const ultimoSegmento = partes[partes.length - 1];
                // Convertimos el último fragmento de la URL a número entero
                if (ultimoSegmento && !isNaN(ultimoSegmento)) {
                  idExtraido = parseInt(ultimoSegmento, 10);
                }
              }

              return {
                // Conservamos el ID extraído para que la "X" sepa exactamente qué borrar
                idAdjunto: idExtraido, 
                nombreArchivo: adj.nombreArchivo,
                // Guardamos la urlDescarga completa para usarla directamente en el enlace del HTML
                urlDescargaCompleta: adj.urlDescarga, 
                isServerFile: true
              };
            });
            
            console.log('[Adjuntos] Lista de adjuntos procesada con IDs extraídos:', this.listaAdjuntos);
          }
        },
        error: (err) => {
          if (err.status === 204) {
            console.log(`[Adjuntos] La orden ${codigoOC} no registra archivos adjuntos (204 No Content).`);
          } else {
            console.error('[Adjuntos] Error al obtener adjuntos desde el backend:', err);
          }
        }
      });
    }

    // 6. Cierre del proceso de carga y reestructuración de la interfaz
    this.loading = false;
    this.filtroBorrador = '';
    this.borradoresFiltrados = [];
    this.calcularTotales();
  }
         

  completarCargaProveedor() {
    this.modoEdicionProveedor = false;
    if (this.proveedorSeleccionado.codComuna) {
      this.obtenerDetallesGeograficos(this.proveedorSeleccionado.codComuna);
    }
    if (this.ocData?.codGiroSeleccionado) {
        this.codGiroSeleccionado = this.ocData.codGiroSeleccionado;
    }
  }

  // ==========================================
  // MANEJO DE EVENTOS Y SELECCIONES
  // ==========================================

  onSeleccionarDte(event: any) {
    const val = event.target.value;
    if (!val) return;

    this.dteSeleccionado = this.listaDte.find(d => 
      String(d.codigoDocumentoTributario) === String(val) || String(d.idDocumentoTributario) === String(val)
    );
    this.dteIdSeleccionado = val;
    this.calcularTotales();
  }

  onSeleccionarUnidad(event: any) {
  // 1. Obtenemos el código directamente desde la variable vinculada al ngModel
  const codigoSelected = this.codUnidadCompradoraSeleccionada;

  if (!codigoSelected) {
    this.idUnidadCompradoraSeleccionada = null;
    this.codUnidadCompradoraSeleccionada = '';
    if (this.ocData) this.ocData.unidad = null;
    return;
  }

  // 2. Buscamos la entidad completa en la lista maestra de unidades
  const unidadEncontrada = this.unidades.find(
    (u: any) => u.codigoUnidad?.toString().trim().toUpperCase() === codigoSelected.toString().trim().toUpperCase()
  );

  if (unidadEncontrada) {
    this.idUnidadCompradoraSeleccionada = unidadEncontrada.idUnidad || null; 
    this.codUnidadCompradoraSeleccionada = unidadEncontrada.codigoUnidad || '';
    
    // 3. Sincronizamos con ocData para que no pierda consistencia en otras vistas/plantillas
    if (this.ocData) {
      this.ocData.unidad = unidadEncontrada.codigoUnidad || '';
      this.ocData.idUnidadCompradora = unidadEncontrada.idUnidad || null;
    }
  }

  console.log('Unidad seleccionada correctamente:', {
    codigoSelected,
    unidadEncontrada,
    idUnidadCompradoraSeleccionada: this.idUnidadCompradoraSeleccionada,
    codUnidadCompradoraSeleccionada: this.codUnidadCompradoraSeleccionada
  });
}

  onSeleccionarProveedorManual(p: any) {
    if (!p) return;
    this.codGiroSeleccionado = ""; 
    this.proveedorSeleccionado = {
      ...p,
      emailProveedor: p.emailProveedor || p.email || 'No registrado',
      telefonoContactoProveedor: p.telefonoContactoProveedor || p.telefono || 'Sin teléfono',
      nombreComuna: '',
      nombreRegion: '',
      listaGiros: p.listaGiros ? [...p.listaGiros] : []
    };

    this.modoEdicionProveedor = false;
    this.filtroProveedor = '';
    if (p.codComuna) this.obtenerDetallesGeograficos(p.codComuna);
  }

  obtenerDetallesGeograficos(codComuna: string | number) {
    this.http.get<any>(`${this.API_COMUNA}/${codComuna}`).subscribe({
      next: (comunaRes) => {
        this.proveedorSeleccionado.nombreComuna = comunaRes.nombreComuna;
        this.proveedorSeleccionado.nombreRegion = comunaRes.nombreRegion || '';
      },
      error: (err) => console.error('Error al obtener Comuna:', err)
    });
  }

  get proveedoresFiltrados() {
    if (!this.proveedores || this.proveedores.length === 0) return [];
    if (!this.filtroProveedor.trim()) return this.proveedores.slice(0, 10);
    const busqueda = this.filtroProveedor.toLowerCase();
    return this.proveedores.filter(p => {
      const nombre = (p?.nombreProveedor || '').toLowerCase();
      const rut = (p?.rutProveedor || p?.rut || '').toLowerCase();
      return nombre.includes(busqueda) || rut.includes(busqueda);
    });
  }

  // ==========================================
  // LÓGICA DE LA TABLA DE PRODUCTOS
  // ==========================================

  get puedeEditarItems(): boolean {
    return !!this.dteSeleccionado;
  }

  getProductosFiltrados(termino: string) {
    if (!termino || termino.length < 1) return [];
    const busqueda = termino.toLowerCase();
    return this.productos.filter(p =>
      (p.nombreProducto || '').toLowerCase().includes(busqueda) ||
      (p.codigoProducto || '').toLowerCase().includes(busqueda)
    );
  }

  seleccionarProducto(p: any, item: any) {
    if (!item) return;
    item.codigoProducto = p.codigoProducto;
    item.descripcionProducto = p.nombreProducto;
    item.valorProducto = Number(p.valorProducto) || 0;
    item.cantidad = 1;
    item.total = item.cantidad * item.valorProducto;
    setTimeout(() => { this.filaActiva = null; }, 100);
    this.calcularTotales();
  }

  agregarFila() {
    this.items.push({ codigoProducto: '', descripcionProducto: '', valorProducto: 0, cantidad: 1, total: 0 });
  }

  actualizarLinea(index: number) {
    const item = this.items[index];
    item.total = +(item.valorProducto || 0) * +(item.cantidad || 0);
    this.calcularTotales();
  }

  get puedeAgregarFila(): boolean {
    const todasConDescripcion = this.items.every(item => item.descripcionProducto && item.descripcionProducto.trim() !== '');
    return this.items.length >= 5 && todasConDescripcion;
  }

  eliminarFila(index: number) {
    this.items.splice(index, 1);
    if (this.items.length < 5) {
      this.items.push({ codigoProducto: '', descripcionProducto: '', valorProducto: 0, cantidad: 0, total: 0 });
    }
    this.calcularTotales();
  }

  calcularTotales() {
    if (!this.ocData) return;
    const sumaItems = this.items.reduce((acc, item) => acc + (item.total || 0), 0);
    const porcentajeRetencion = this.dteSeleccionado?.impuesto || 0;
    const valorRetencion = Math.round(sumaItems * (porcentajeRetencion / 100));

    this.ocData.neto = sumaItems;
    this.ocData.impuestoCalculado = valorRetencion;

    if (this.dteSeleccionado?.codigoDocumentoTributario === '38' || this.dteSeleccionado?.codigoDocumentoTributario === '38-c') {
      this.ocData.totalFinal = sumaItems - valorRetencion;
    } else {
      this.ocData.totalFinal = sumaItems + valorRetencion;
    }
  }

  get labelNeto(): string { 
    return ['38', '38-c'].includes(this.dteSeleccionado?.codigoDocumentoTributario) ? 'MONTO TOTAL' : 'TOTAL NETO'; 
  }
  get labelImpuesto(): string { 
    return ['38', '38-c'].includes(this.dteSeleccionado?.codigoDocumentoTributario) ? 'RETENCIÓN' : 'IMPUESTO'; 
  }
  get labelTotal(): string { 
    return ['38', '38-c'].includes(this.dteSeleccionado?.codigoDocumentoTributario) ? 'VALOR LÍQUIDO' : 'TOTAL'; 
  }

  get isFormularioCompleto(): boolean {

    const tieneRolValido = this.userRole.includes('SUPERVISOR') || this.userRole.includes('ADMINISTRACION');

    return !!(tieneRolValido &&
      this.ocData?.codOrdenCompra &&
      this.dteSeleccionado &&
      this.proveedorSeleccionado &&
      this.codGiroSeleccionado &&
      this.proveedorSeleccionado?.nombreComuna &&
      this.nombreOrdenCompra?.trim().length > 0 &&
      this.items.some(item => item.descripcionProducto?.trim() && item.valorProducto > 0)
    );
  }

  // ==========================================
  // MANEJO DE ADJUNTOS (DRAG & DROP)
  // ==========================================

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.procesarArchivos(Array.from(input.files));
    input.value = ''; 
  }

  eliminarAdjunto(index: number): void {
    const adjunto = this.listaAdjuntos[index];
    console.log('[UI - Click Eliminar] Index seleccionado:', index, 'Datos del objeto:', adjunto);

    if (adjunto && adjunto.isServerFile) {
      // Extraemos el identificador que procesamos en el paso anterior
      const idParaEliminar = adjunto.idAdjunto;

      if (idParaEliminar !== undefined && idParaEliminar !== null) {
        this.adjuntosEliminadosIds.push(idParaEliminar);
        console.log('[Adjuntos] Éxito: ID insertado firmemente en cola de borrado:', idParaEliminar);
        console.log('[Adjuntos] Estado actual de la cola en memoria:', this.adjuntosEliminadosIds);
      } else {
        console.error('[Adjuntos] Error Crítico: El archivo está marcado como de servidor, pero el idAdjunto sigue llegando undefined.', adjunto);
      }
    }

    // Remueve el elemento de la grilla visual de inmediato
    this.listaAdjuntos.splice(index, 1);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.puedeEditarItems && this.listaAdjuntos.length < 5) this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (!this.puedeEditarItems || !event.dataTransfer?.files) return;
    this.procesarArchivos(Array.from(event.dataTransfer.files));
  }

  public obtenerUrlDescarga(rutaArchivo: string | undefined): string {
  if (!rutaArchivo) return '#';
  return `${this.API_BASE}/api/v1/oc/ordenes-compra/download/${rutaArchivo}`;
}

  private procesarArchivos(archivos: File[]) {
    for (const archivo of archivos) {
      if (this.listaAdjuntos.length >= 5) {
        this.mostrarNotificacion('Solo se permite un máximo de 5 archivos adjuntos por orden de compra.', 'error');
        break;
      }
      
      // Estructura unificada: envolvemos el File nativo en nuestro formato común
      this.listaAdjuntos.push({
        nombreArchivo: archivo.name,
        isServerFile: false, // Indica que está local en la PC
        fileReal: archivo    // Mantiene los bytes intactos para el FormData
      });
    }
    console.log('[Adjuntos] Estado actual de la lista de adjuntos:', this.listaAdjuntos);
  }

  // ==========================================
  // PERSISTENCIA Y ENVÍOS AL SERVIDOR (DTI RAÍZ)
  // ==========================================

  prepararPayload(): any { 
    // Retorna la estructura raíz OrdenCompraRequest esperada por Spring Boot
    const productosMap = this.items
      .filter(item => item.descripcionProducto?.trim() && item.cantidad > 0 && item.valorProducto > 0)
      .map(item => ({
        codigoProducto: item.codigoProducto ? item.codigoProducto.trim() : '',
        descripcionProducto: item.descripcionProducto.trim(),
        cantidad: item.cantidad,
        valorProducto: item.valorProducto
      }));
     
    return {
      plantillaDTO: {
        usernameUsuario: localStorage.getItem('sub'),
        rutProveedor: this.proveedorSeleccionado?.rutProveedor,
        codOrdenCompra: this.ocData?.codOrdenCompra,
        codGiroSeleccionado: this.codGiroSeleccionado,
        codDocumentoTributario: this.dteSeleccionado?.codigoDocumentoTributario,
        estadoOc: this.ocData?.codEstadoActualOc,
        nombreOrdenCompra: this.nombreOrdenCompra,
        observaciones: this.observaciones,
        listProductosOrden: JSON.stringify(productosMap),
        totalNeto: this.ocData?.neto,
        impuesto: this.ocData?.impuestoCalculado,
        total: this.ocData?.totalFinal,
        idUnidadCompradora: this.idUnidadCompradoraSeleccionada,
        codUnidad: this.codUnidadCompradoraSeleccionada,
      }
    };
  }

  async guardarOrden() {
    const codigoFinal = await this.guardarDatos();
    if (codigoFinal) {
      this.mostrarNotificacion('Borrador guardado correctamente junto con los cambios en sus archivos.', 'success');
    }
  }

  private async guardarDatos(): Promise<string | null> {
    if (!this.ocData) return null;

    if (!this.dteSeleccionado || !this.codUnidadCompradoraSeleccionada || !this.proveedorSeleccionado) {
      let camposFaltantes: string[] = [];
      
      if (!this.dteSeleccionado) camposFaltantes.push('Documento Tributario (DTE)');
      if (!this.codUnidadCompradoraSeleccionada) camposFaltantes.push('Unidad Compradora');
      if (!this.proveedorSeleccionado) camposFaltantes.push('Proveedor');

      this.mostrarNotificacion(`Para guardar el borrador debe seleccionar los siguientes campos obligatorios: ${camposFaltantes.join(', ')}.`, 'error');
      return null;
    }
    // Si cumple con las validaciones, continúa con el proceso original de guardado
    this.loading = true;

    const payload = this.prepararPayload();
    const codigoOC = this.ocData.codOrdenCompra;

    console.log('[guardarDatos] Iniciando persistencia asíncrona en el servidor...');

    try {
      // 1. Enviamos el POST y obtenemos el DTO rico real del servidor
      const res: any = await this.http.post(`${this.API_OC}`, payload).toPromise();
      
      const codigoFinal = res?.codOrdenCompra || codigoOC;
      console.log('[guardarDatos] Respuesta exitosa del servidor. Código final:', codigoFinal);

      // 2. Ejecutar la conciliación asíncrona de archivos adjuntos
      await this.procesarSincronizacionAdjuntos(codigoFinal);
      
      // 3. RE-INICIALIZACIÓN ULTRA LIMPIA DEL FORMULARIO
      const dtoRespuestaTemporal = {
        ...res,
        codOrdenCompra: codigoFinal
      };

      this.ocData = null;
      this.items = [];
      this.listaAdjuntos = [];
      this.adjuntosEliminadosIds = [];
      this.nombreOrdenCompra = '';
      this.observaciones = '';
      this.proveedorSeleccionado = null;
      this.dteSeleccionado = null;

      // 4. Cargamos el formulario desde cero y limpio con el DTO temporal
      this.cargarBorrador(dtoRespuestaTemporal);

      return codigoFinal; // Retornamos el código para que lo use solicitarAutorizacion si es necesario

    } catch (err) {
      console.error('[guardarDatos] Error crítico detectado en la operación:', err);
      this.mostrarNotificacion('Ocurrió un error al procesar el guardado de la orden o sus adjuntos.', 'error');
      return null;
    } finally {
      this.loading = false;
    }
  }

  private async procesarSincronizacionAdjuntos(codigoOrdenCompra: string): Promise<void> {
    console.log('==================================================================');
    console.log(`[CONCILIACIÓN] Iniciando contraste para OC: ${codigoOrdenCompra}`);
    console.log(`[CONCILIACIÓN] IDs en cola para eliminación física:`, this.adjuntosEliminadosIds);
    console.log(`[CONCILIACIÓN] Total archivos actuales en la grilla UI: ${this.listaAdjuntos.length}`);
    console.log('==================================================================');

    // A. Procesar eliminaciones pendientes en el servidor
    if (this.adjuntosEliminadosIds && this.adjuntosEliminadosIds.length > 0) {
      console.log(`[CONCILIACIÓN - ELIMINAR] Detectados ${this.adjuntosEliminadosIds.length} elementos pendientes de borrado.`);
      
      for (const idAdjunto of this.adjuntosEliminadosIds) {
        if (!idAdjunto) {
          console.warn('[CONCILIACIÓN - ELIMINAR] Alerta: Se detectó un ID nulo o inválido en la cola. Saltando...');
          continue;
        }

        const urlDelete = `${this.API_BASE}/api/v1/oc/ordenes-compra/adjuntos/${idAdjunto}`;
        console.log(`[CONCILIACIÓN - HTTP DELETE] Disparando solicitud hacia: ${urlDelete}`);

        try {
          await this.http.delete(urlDelete).toPromise();
          console.log(`[CONCILIACIÓN - ÉXITO] Archivo ID: ${idAdjunto} borrado correctamente en Base de Datos y Servidor.`);
        } catch (err) {
          console.error(`[CONCILIACIÓN - ERROR] Falló la eliminación del ID ${idAdjunto}:`, err);
        }
      }
      
      console.log('[CONCILIACIÓN - ELIMINAR] Limpiando cola temporal de eliminados.');
      this.adjuntosEliminadosIds = []; 
    } else {
      console.log('[CONCILIACIÓN - ELIMINAR] Cero (0) eliminaciones detectadas en este guardado.');
    }

    // B. Procesar subida de nuevos archivos adjuntos locales
    const archivosPorSubir = this.listaAdjuntos.filter(adj => !adj.isServerFile && adj.fileReal);
    console.log(`[CONCILIACIÓN - SUBIDAS] Evaluando nuevos archivos locales. Encontrados por subir: ${archivosPorSubir.length}`);

    if (archivosPorSubir.length === 0) {
      console.log('[CONCILIACIÓN] No se registran archivos locales nuevos. Finalizando sincronización.');
      return;
    }

    const username = localStorage.getItem('sub') || 'SISTEMA';
    const reqPayload = { usuarioExec: username };

    for (const adj of archivosPorSubir) {
      if (!adj.fileReal) continue;

      const formData = new FormData();
      formData.append('file', adj.fileReal);
      formData.append('req', new Blob([JSON.stringify(reqPayload)], { type: 'application/json' }));

      console.log(`[CONCILIACIÓN - HTTP POST] Subiendo archivo: ${adj.nombreArchivo} (${adj.fileReal.size} bytes)`);
      try {
        await this.http.post(`${this.API_OC}/${codigoOrdenCompra}/adjuntos`, formData).toPromise();
        console.log(`[CONCILIACIÓN - ÉXITO] Archivo subido e indexado con éxito: ${adj.nombreArchivo}`);
      } catch (postErr) {
        console.error(`[CONCILIACIÓN - ERROR] No se pudo subir el archivo ${adj.nombreArchivo}:`, postErr);
      }
    }
    
    console.log('[CONCILIACIÓN] Sincronización e inspección finalizada exitosamente.');
    console.log('==================================================================');
  }

  async solicitarAutorizacion() {
    if (!this.ocData) return;

    // 1. Forzamos el guardado de consistencia llamando al método centralizado
    console.log('[Autorizar] Ejecutando guardado previo de consistencia a través de guardarDatos...');
    const codigoFinal = await this.guardarDatos();

    // Si el guardado falló, detenemos el flujo de inmediato sin pasar a la solicitud
    if (!codigoFinal) {
      console.warn('[Autorizar] Solicitud cancelada debido a un fallo en el guardado previo.');
      return;
    }

    this.loading = true;
    const usernameLogueado = localStorage.getItem('sub') || 'SISTEMA';
    
    // 2. EXTRACTOR DEL CÓDIGO DE UNIDAD DEL EJECUTOR (Desde localStorage de la sesión)
    const unidadRaw = localStorage.getItem('unidadNegocio');
    let codUnidadEjecutor = '';
    if (unidadRaw) {
      try {
        const unidadObj = JSON.parse(unidadRaw);
        codUnidadEjecutor = unidadObj.codigoUnidad || '';
      } catch (e) {
        console.error('[Autorizar] Error al parsear unidadNegocio:', e);
      }
    }

    // 3. CONSTRUIR PAYLOAD DE OrdenCompraRequest utilizando el estado actual hidratado
    const payloadOrden = {
      codOc: codigoFinal,
      usuarioExec: usernameLogueado, 
      unidadExec: codUnidadEjecutor,  
      plantillaDTO: this.prepararPayload().plantillaDTO 
    };

    console.log('[Autorizar] Despachando cambio de estado final a revisión (/solicitar):', payloadOrden);

    try {
      // 4. LLAMADA AL ENDPOINT: Cambia el estado a revisión en el servidor
      const res: any = await this.http.post(`${this.API_OC}/solicitar`, payloadOrden).toPromise();
      console.log('[Autorizar - ÉXITO] El estado ha sido congelado por el backend.', res);

      // 5. CAMBIO VISUAL A LA PANTALLA DE ÉXITO DE ANGULAR
      this.codOrdenCompra = res?.codOrdenCompra || codigoFinal;
      this.ocFinalizada = true; // Oculta el formulario y muestra el banner verde
      
      this.listaAdjuntos = []; 
      this.adjuntosEliminadosIds = [];
      
      //this.mostrarNotificacion('Solicitud de autorización enviada con éxito.', 'success');

    } catch (error) {
      console.error('[Autorizar - ERROR CRÍTICO] Falló el cambio de estado a revisión:', error);
      this.mostrarNotificacion('La orden se guardó con éxito, pero ocurrió un problema al pasarla al estado de revisión en el servidor.', 'error');
    } finally {
      this.loading = false;
    }
  }

  nuevaOrdenDesdeExito() {
    this.ocFinalizada = false;
    this.ocData = null; 
    this.nombreOrdenCompra = '';  
    this.observaciones = ''; 
    this.filtroProveedor = '';
    this.dteIdSeleccionado = null;
    this.dteSeleccionado = null;
    this.idUnidadCompradoraSeleccionada = null;
    this.codUnidadCompradoraSeleccionada = '';
    this.proveedorSeleccionado = null;
    this.modoEdicionProveedor = true;
    this.items = [];
    this.adjuntosEliminadosIds = [];
    this.listaAdjuntos = [];
    this.iniciarNuevaOC();
  }

  resetProveedor() { 
    this.proveedorSeleccionado = null; 
    this.modoEdicionProveedor = true; 
  }
  
  previsualizar() { 
    window.print(); 
  }

  obtenerFechaActual(): string {
    const hoy = new Date();
    return `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
  }

  mostrarNotificacion(mensaje: string, tipo: 'error' | 'success' = 'error') {
    // Limpiamos cualquier temporizador previo activo
    if (this.alertaTimeout) clearTimeout(this.alertaTimeout);
    
    this.alertaUI = { mensaje, tipo };
    
    // Auto-scroll suave al inicio del contenedor principal para visibilidad
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Si es un mensaje de éxito, se cerrará solo tras 6 segundos
    if (tipo === 'success') {
      this.alertaTimeout = setTimeout(() => {
        this.alertaUI = null;
      }, 6000);
    }
  }
}
