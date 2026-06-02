import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from "../../../environments/environment";
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

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

  ngOnInit() {
    this.cargarProveedores();
    this.cargarDte();
    this.cargarProductos();
    this.cargarUnidades();
    this.inicializarTabla();
    this.inicializarBuscadorReactivo();
  }

  // ==========================================
  // INICIALIZADORES Y BAJADA DE MAESTROS
  // ==========================================
  
  private inicializarBuscadorReactivo() {
    this.buscadorSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term.trim()) {
          this.borradoresFiltrados = [];
          return of(null);
        }
        this.loading = true;
        const params: any = {
          codOrdenCompra: term,
          codEstadoOc: 'borrador',
          unidad: null, // Forzado nulo para búsqueda global
          page: 0,
          size: 10,
          sort: 'idOrdenCompra,desc'
        };
        return this.http.get<any>(`${this.API_BUSQUEDA_AVANZADA}`, { params });
      })
    ).subscribe({
      next: (res: any) => {
        if (res) this.borradoresFiltrados = res.content || [];
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  buscarBorradores() {
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
    const userSub = localStorage.getItem('sub');
    
    this.http.post<any>(`${this.API_OC_NEW}`, { plantillaDTO: { usernameUsuario: userSub, codUnidad: '' } })
      .subscribe({
        next: (res) => {
          const unidadRaw = localStorage.getItem('unidadNegocio');
          let nombreUnidadCalculado = '';
          let codUnidad = '';
          
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

          this.ocData = {
            ...res,
            fechaOrdenCompra: this.obtenerFechaActual(),
            usuario: userSub,              
            nombreusuario: localStorage.getItem('nombre'),              
            apellidousuario: localStorage.getItem('apellidoPaterno'),
            unidad: null, // Forzar selección manual inicial            
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
    this.loading = true;
    const unidadData = JSON.parse(localStorage.getItem('unidadNegocio') || '{}');

    // 1. Vincular DTE
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

    // 2. Asignación Unidad Compradora
    const codUnidadBD = borrador.codUnidad || borrador.unidad || unidadData.codigoUnidad || null;
    const idUnidadBD = borrador.idUnidadCompradora || borrador.idUnidad || borrador.unidadId || unidadData.idUnidad || null;

    this.ocData = { 
      ...borrador,
      unidad: codUnidadBD,
      unidadCompradora: borrador.nombreUnidad || borrador.unidadCompradora || unidadData.showNombreUnidad || unidadData.nombreUnidad,
      usuario: borrador.usernameUsuario || borrador.usuario || localStorage.getItem('sub'),
      idUnidadCompradora: idUnidadBD
    };

    setTimeout(() => {
      this.codUnidadCompradoraSeleccionada = codUnidadBD ? codUnidadBD.toString().trim() : '';
      this.idUnidadCompradoraSeleccionada = idUnidadBD;
      if (this.ocData) this.ocData.unidad = this.codUnidadCompradoraSeleccionada;
    }, 150);

    this.nombreOrdenCompra = borrador.nombreOrdenCompra || '';
    this.observaciones = borrador.observaciones || '';

    // 3. Vincular Proveedor
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

    // 4. Cargar Items
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
    const codigoSelected = this.ocData?.unidad;
    if (!codigoSelected) {
      this.idUnidadCompradoraSeleccionada = null;
      this.codUnidadCompradoraSeleccionada = '';
      return;
    }

    const unidadEncontrada = this.unidades.find(
      (u: any) => u.codigoUnidad?.toString().trim().toUpperCase() === codigoSelected.toString().trim().toUpperCase()
    );

    if (unidadEncontrada) {
      this.idUnidadCompradoraSeleccionada = unidadEncontrada.idUnidad || null; 
      this.codUnidadCompradoraSeleccionada = unidadEncontrada.codigoUnidad || '';
    }
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

  // Getters para etiquetas dinámicas en vista
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
    return !!(
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

  private procesarArchivos(archivos: File[]) {
    for (const archivo of archivos) {
      if (this.listaAdjuntos.length >= 5) {
        alert('Solo se permite un máximo de 5 archivos adjuntos por orden de compra.');
        break;
      }
      this.listaAdjuntos.push(archivo);
    }
  }

  // ==========================================
  // PERSISTENCIA Y ENVÍOS AL SERVIDOR
  // ==========================================

  prepararPayload() {
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
        rutProveedor: this.proveedorSeleccionado.rutProveedor,
        codOrdenCompra: this.ocData.codOrdenCompra,
        codGiroSeleccionado: this.codGiroSeleccionado,
        codDocumentoTributario: this.dteSeleccionado.codigoDocumentoTributario,
        estadoOc: this.ocData.codEstadoActualOc,
        nombreOrdenCompra: this.nombreOrdenCompra,
        observaciones: this.observaciones,
        listProductosOrden: JSON.stringify(productosMap),
        totalNeto: this.ocData.neto,
        impuesto: this.ocData.impuestoCalculado,
        total: this.ocData.totalFinal,
        idUnidadCompradora: this.idUnidadCompradoraSeleccionada,
        codUnidad: this.codUnidadCompradoraSeleccionada,
      }
    };
  }

  guardarOrden() {
    const payload = this.prepararPayload();
    this.http.post(`${this.API_OC}`, payload).subscribe({
      next: () => alert('Orden guardada correctamente'),
      error: (err) => console.error('Error al guardar:', err)
    });
  }

  async solicitarAutorizacion() {
    if (!this.puedeEditarItems) return;
    this.loading = true;

    try {
      const codigoOC = this.ocData?.codOrdenCompra;
      const payloadOrden = this.prepararPayload();

      // 1. Procesamiento síncrono secuencial de Adjuntos
      if (this.listaAdjuntos?.length > 0) {
        let index = 1;
        for (const archivo of this.listaAdjuntos) {
          const formData = new FormData();
          formData.append('file', archivo);
          formData.append('req', new Blob([JSON.stringify(payloadOrden)], { type: 'application/json' }));

          await this.http.post(`${this.API_OC}/${codigoOC}/adjuntos`, formData).toPromise();
          index++;
        }
      }

      // 2. Ejecutar Solicitud Final de Autorización
      this.http.post(`${this.API_OC}/solicitar`, payloadOrden).subscribe({
        next: (res: any) => {
          this.codOrdenCompra = res.codOrdenCompra || this.ocData.codOrdenCompra;
          this.ocFinalizada = true;
          this.loading = false;
          this.listaAdjuntos = []; 
        },
        error: (err) => {
          console.error('Error en la autorización final:', err);
          alert('Se procesaron los adjuntos pero falló la autorización final.');
          this.loading = false;
        }
      });

    } catch (error) {
      console.error('Error grave en adjuntos:', error);
      alert('Ocurrió un error al registrar los adjuntos. El proceso se detuvo.');
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
}