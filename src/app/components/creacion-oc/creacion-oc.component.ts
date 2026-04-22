import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from "../../../environments/environment";
import { DataService } from '../../services/data.service'; // Asegúrate de que la ruta sea correcta

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
  private dataService = inject(DataService); // Inyectamos tu DataService genérico
  
  private readonly API_BASE = environment.apiUrl;
  private readonly API_OC_NEW = `${this.API_BASE}/api/v1/oc/ordenes-compra/new`;
  private readonly API_OC = `${this.API_BASE}/api/v1/oc/ordenes-compra`;
  private readonly API_BUSQUEDA_AVANZADA = `${this.API_BASE}/api/v1/oc/ordenes-compra/busqueda-avanzada`;
  private readonly API_PROV = `${this.API_BASE}/api/v1/oc/proveedor`;
  private readonly API_DTE = `${this.API_BASE}/api/v1/oc/dte`;
  private readonly API_PRODUCTO = `${this.API_BASE}/api/v1/oc/producto/all`;
 

  private readonly API_COMUNA = `${this.API_BASE}/api/v1/comuna`;

  ocData: any = null;
  loading: boolean = false;
  ocCreada: boolean = false; 
  
  // Variables para Borradores
  filtroBorrador: string = '';
  borradoresFiltrados: any[] = [];
  listaCompletaBorradores: any[] = []; 

  // Datos maestros
  proveedores: any[] = [];
  proveedorSeleccionado: any = null;
  modoEdicionProveedor: boolean = true;
  filtroProveedor: string = '';
  listaDte: any[] = [];
  dteSeleccionado: any = null;
  dteIdSeleccionado: any = null;

  productos: any[] = [];
  items: any[] = []; 
  filtroProducto: string = '';
  filaActiva: number | null = null; 

  nombreOrdenCompra: string = '';
  observaciones: string = '';
  codGiroSeleccionado: string = '';

  // Variables de estado
  ocFinalizada: boolean = false;
  codOrdenCompra: string = '';

  private buscadorSubject = new Subject<string>();

  ngOnInit() {
    this.cargarProveedores();
    this.cargarDte();
    this.cargarProductos();
    this.inicializarTabla();

    // Buscador reactivo de borradores
    this.buscadorSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term.trim()) {
          this.borradoresFiltrados = [];
          return of(null);
        }
        this.loading = true;
        // Aplicamos API_OC dinámica
        /******Obtenemos la Unidad de Negocio */
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
          
          const params: any = {
          codOrdenCompra: term,
          codEstadoOc: 'borrador', // Estado fijo según tu requerimiento
          unidad: codigoUnidad,    // Filtramos por la unidad del usuario
          page: 0,                 // Pageable empieza en 0 en Spring Data
          size: 10,
          sort: 'idOrdenCompra,desc'
      };


          console.log('ngOnInit borrador búsqueda:', term, codigoUnidad);
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
  // --- LÓGICA DE BORRADORES ---

  listarBorradores() {
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

    // Definimos los parámetros de búsqueda según tu Backend
    // Los nombres deben coincidir exactamente con los @RequestParam de Java
    const params: any = {
        codEstadoOc: 'borrador', // Estado fijo según tu requerimiento
        unidad: codigoUnidad,    // Filtramos por la unidad del usuario
        page: 0,                 // Pageable empieza en 0 en Spring Data
        size: 10,
        sort: 'idOrdenCompra,desc'
    };
    console.log('Parámetros para --listar borradores--:', params);
    // Si quieres filtrar por un código de OC específico que tengas en el front:
    if (this.filtroBorrador) {
        params.codOrdenCompra = this.filtroBorrador;
    }
    
    // Usamos el servicio para hacer la petición
    return this.http.get<any>(`${this.API_BUSQUEDA_AVANZADA}`, { params })
      .subscribe({
        next: (res) => {
          this.listaCompletaBorradores = res.content || [];
          console.log('Borradores cargados:', this.listaCompletaBorradores);
        },
        error: () => this.loading = false
      });
}

 cargarBorrador(borrador: any) {
    this.loading = true;
    
    const unidadData = JSON.parse(localStorage.getItem('unidadNegocio') || '{}');

    this.ocData = { ...borrador,
      unidad: borrador.unidad || borrador.codUnidad || unidadData.codigoUnidad,
      
      // Mantenemos el NOMBRE para el layout
      unidadCompradora: borrador.nombreUnidad || unidadData.showNombreUnidad || unidadData.nombreUnidad,
      
      // Mantenemos el USUARIO
      usuario: borrador.usernameUsuario || borrador.usuario || localStorage.getItem('sub')
     };
    this.nombreOrdenCompra = borrador.nombreOrdenCompra || '';
    this.observaciones = borrador.observaciones || '';
    

    // 1. Vincular DTE usando comparación de STRING
    if (borrador.codDocumentoTributario) {
      // Convertimos el código buscado a string y limpiamos espacios
      const codBuscado = String(borrador.codDocumentoTributario).trim();

      const dteEncontrado = this.listaDte.find((d: any) => 
        // Comparamos ambos como String para asegurar el match
        String(d.codigoDocumentoTributario || d.codDocumentoTributario).trim() === codBuscado
      );

      if (dteEncontrado) {
        this.dteSeleccionado = dteEncontrado;
        // Asignamos el valor exacto para que el ngModel del select lo reconozca
        this.dteIdSeleccionado = codBuscado; 
        console.log('✅ DTE vinculado con éxito:', this.dteIdSeleccionado);
      } else {
        console.warn('❌ No se encontró el DTE:', codBuscado, 'en la lista:', this.listaDte);
      }
    }

    // 2. Vincular Proveedor
    if (borrador.rutProveedor || borrador.proveedor) {
      const rutABuscar = borrador.rutProveedor || borrador.proveedor;
      
      this.proveedorSeleccionado = this.proveedores.find((p: any) => p.rutProveedor === rutABuscar);
      
      if (this.proveedorSeleccionado) {
        this.completarCargaProveedor();
      } else {
        // Si no está en la lista de los 'top' proveedores, lo buscamos directo al API
        this.http.get<any>(`${this.API_PROV}/${rutABuscar}`).subscribe(res => {
          this.proveedorSeleccionado = res;
          this.completarCargaProveedor();
        });
      }
    }

    // 3. Cargar Items (Parsear el LONGTEXT de la base de datos)
    if (borrador.listProductosOrden) {
      try {
        const productosGuardados = JSON.parse(borrador.listProductosOrden);
        this.items = productosGuardados.map((p: any) => ({
          ...p,
          total: (p.valorProducto || 0) * (p.cantidad || 0)
        }));
        
        // Rellenar hasta 5 filas si es necesario
        while (this.items.length < 5) {
          this.items.push({ codigoProducto: '', descripcionProducto: '', valorProducto: 0, cantidad: 1, total: 0 });
        }
      } catch (e) {
        console.error("Error parseando productos:", e);
        this.inicializarTabla();
      }

      if (borrador.codGiroSeleccionado) {
        setTimeout(() => {
          this.codGiroSeleccionado = borrador.codGiroSeleccionado;
        }, 100);
      }
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
    // Forzamos la asignación del giro si viene en el borrador
    if (this.ocData.codGiroSeleccionado) {
        this.codGiroSeleccionado = this.ocData.codGiroSeleccionado;
    }
  }

  // --- MÉTODOS DE APOYO Y CARGA ---

    onSeleccionarDte(event: any) {
      const val = event.target.value;
      if (!val) return;

      // Buscamos comparando como string para evitar errores de tipo
      this.dteSeleccionado = this.listaDte.find(d => 
        String(d.codigoDocumentoTributario) === String(val) || 
        String(d.idDocumentoTributario) === String(val)
      );

      this.dteIdSeleccionado = val;

      if (this.puedeEditarItems && this.items.length === 0) {
        this.agregarFila();
      }
      this.calcularTotales();
  }

  cargarProveedores() {
    this.http.get<any[]>(`${this.API_PROV}/all`)
      .subscribe((res: any) => this.proveedores = res || []);
  }

  cargarDte() {
    this.http.get<any[]>(`${this.API_DTE}/all`).subscribe({
      next: (res: any) => {
        this.listaDte = res.filter((d: any) => d.active);
      },
      error: (err) => console.error('Error al cargar DTEs:', err)
    });
  }

  obtenerFechaActual(): string {
    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2, '0');
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const yyyy = hoy.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  iniciarNuevaOC() {
    this.loading = true;
    const userSub = localStorage.getItem('sub');
    const unidadRaw = localStorage.getItem('unidadNegocio');
    
    const nombreUserLog = localStorage.getItem('nombre');
    const apellidoUserLog = localStorage.getItem('apellidoPaterno');

    let codUnidad = '';
    let nombreUnidadCompradora = '';
    
    if (unidadRaw) {
        try {
            // Parseamos porque en el login viene como objeto
            const unidadObj = JSON.parse(unidadRaw);
            codUnidad = unidadObj.codigoUnidad;
            nombreUnidadCompradora = unidadObj.nombreUnidad || unidadObj.showNombreUnidad || ''; 
        } catch (e) {
            // Si por alguna razón se guardó como string plano, lo usamos directamente
            codUnidad = unidadRaw;
            nombreUnidadCompradora = unidadRaw;
        }
    }
    const payload = { 
    plantillaDTO: { usernameUsuario: userSub, codUnidad: codUnidad } 
    };
    
    this.http.post<any>(`${this.API_OC_NEW}`, payload)
      .subscribe({
        next: (res) => {
          this.ocData = {
            ...res,
            fechaOrdenCompra: this.obtenerFechaActual(),
            // Aseguramos que el nombre de la propiedad coincida con el HTML
            usuario: userSub,              // <--- Desde localStorage
            nombreusuario: nombreUserLog,              // <--- Desde localStora
            apellidousuario: apellidoUserLog,
            unidad: codUnidad,             // <--- Desde localStorage
            unidadCompradora: nombreUnidadCompradora // <--- Para mostrar en el HTML
          };
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
      console.log('OC creada con éxito:', this.ocData);
}

  get proveedoresFiltrados() {
    if (!this.proveedores || this.proveedores.length === 0) return [];
    if (!this.filtroProveedor.trim()) return this.proveedores.slice(0, 10);
    const busqueda = this.filtroProveedor.toLowerCase();
    return this.proveedores.filter(p => {
      const nombre = (p?.nombreProveedor || '').toLowerCase();
      const rut = (p?.rut || '').toLowerCase();
      return nombre.includes(busqueda) || rut.includes(busqueda);
    });
  }

  onSeleccionarProveedorManual(p: any) {
    if (!p) return;

    // 1. Limpiamos selección previa
    this.codGiroSeleccionado = ""; 

    this.proveedorSeleccionado = {
      ...p,
      emailProveedor: p.emailProveedor || p.email || 'No registrado',
      telefonoContactoProveedor: p.telefonoContactoProveedor || p.telefono || 'Sin teléfono',
      nombreComuna: '',
      nombreRegion: '',
      // Forzamos la creación de un nuevo array para que Angular detecte el cambio
      listaGiros: p.listaGiros ? [...p.listaGiros] : []
    };

    this.modoEdicionProveedor = false;
    this.filtroProveedor = '';
    
    if (p.codComuna) this.obtenerDetallesGeograficos(p.codComuna);

    // LOG DE CONTROL: Verifica que esto imprima el array en la consola
    console.log('Giros Habilitado dte prov', this.dteSeleccionado, this.proveedorSeleccionado)
    console.log('Giros disponibles para el combo:', this.proveedorSeleccionado.listaGiros);
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

  onSeleccionarProveedor(event: any) {
    const id = event.target.value;
    this.proveedorSeleccionado = this.proveedores.find(p => p.rutProveedor === id);
    if (this.proveedorSeleccionado) this.modoEdicionProveedor = false;
  }

  cargarProductos() {
    this.http.get<any[]>(`${this.API_PRODUCTO}`).subscribe((res: any) => {
      this.productos = res || [];
    });
  }

  inicializarTabla() {
    this.items = Array.from({ length: 5 }, () => ({
      codigoProducto: '', descripcionProducto: '', valorProducto: 0, cantidad: 1, total: 0
    }));
  }

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

    if (this.dteSeleccionado?.codigoDocumentoTributario === '38') {
      this.ocData.totalFinal = sumaItems - valorRetencion;
    } else {
      this.ocData.totalFinal = sumaItems + valorRetencion;
    }
  }

  get labelNeto(): string { return this.dteSeleccionado?.codigoDocumentoTributario === '38' ? 'MONTO TOTAL' : 'TOTAL NETO'; }
  get labelImpuesto(): string { return this.dteSeleccionado?.codigoDocumentoTributario === '38' ? 'RETENCIÓN' : 'IMPUESTO'; }
  get labelTotal(): string { return this.dteSeleccionado?.codigoDocumentoTributario === '38' ? 'VALOR LÍQUIDO' : 'TOTAL'; }

  get isFormularioCompleto(): boolean {
    const validaciones = {
      codigoOC: !!(this.ocData?.codOrdenCompra),
      dteSeleccionado: !!(this.dteSeleccionado),
      proveedor: !!(this.proveedorSeleccionado),
      giroSeleccionado: !!(this.codGiroSeleccionado), // Nueva validación
      comuna: !!(this.proveedorSeleccionado?.nombreComuna),
      nombreOC: !!(this.nombreOrdenCompra && this.nombreOrdenCompra.trim().length > 0),
      alMenosUnItem: this.items.some(item => 
        item.descripcionProducto && 
        item.descripcionProducto.trim() !== '' && 
        item.valorProducto > 0
      )
    };
    return Object.values(validaciones).every(valor => valor === true);
  }

  prepararPayload() {
    const productosMap = this.items
      .filter(item => item.descripcionProducto && item.descripcionProducto.trim() !== '' && item.cantidad > 0 && item.valorProducto > 0)
      .map(item => ({
        codigoProducto: item.codigoProducto ? item.codigoProducto.trim() : '',
        descripcionProducto: item.descripcionProducto.trim(),
        cantidad: item.cantidad,
        valorProducto: item.valorProducto,
       // idProducto: item.idProducto || null
      }));
     
      // Recuperamos datos de respaldo del storage
    const unidadSesion = JSON.parse(localStorage.getItem('unidadNegocio') || '{}').codigoUnidad;
    const usuarioSesion = localStorage.getItem('sub');

    return {
      plantillaDTO: {
        usernameUsuario: usuarioSesion,
        codUnidad: unidadSesion,
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
        total: this.ocData.totalFinal
      }
    };
  }

  guardarOrden() {
    const payload = this.prepararPayload();
    console.log('payload:', payload);

    this.http.post(`${this.API_OC}`, payload).subscribe({
      next: () => alert('Orden guardada correctamente'),
      error: (err) => console.error('Error al guardar:', err)
    });
  }

  solicitarAutorizacion() {
    if (!this.puedeEditarItems) return;
    this.loading = true;
    const payload = this.prepararPayload();
    const idOc = this.ocData.idOrdenCompra || 1;
    this.http.post(`${this.API_OC}/solicitar`, payload)
      .subscribe({
        next: (res: any) => {
          this.codOrdenCompra = res.codOrdenCompra || this.ocData.codOrdenCompra;
          this.ocFinalizada = true;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al solicitar:', err);
          this.loading = false;
        }
      });
  }

  nuevaOrdenDesdeExito() {
    // 1. Volvemos al formulario
  this.ocFinalizada = false;
  
  // 2. Reseteamos el objeto principal
  this.ocData = {}; 
  
  // 3. ¡IMPORTANTE! Limpiar variables de control manual
  this.nombreOrdenCompra = '';  // <--- Añade esta línea
  this.observaciones = ''; // Aprovecha de limpiar también las observaciones
  this.filtroProveedor = '';
  
  // 4. Resetear selección de objetos
  this.proveedorSeleccionado = null;
  this.modoEdicionProveedor = true;
  
  // 5. Si tienes un array de items, vacíalo también
  this.items = [];
    this.iniciarNuevaOC();
  }

  resetProveedor() { this.proveedorSeleccionado = null; this.modoEdicionProveedor = true; }
  previsualizar() { window.print(); }
}