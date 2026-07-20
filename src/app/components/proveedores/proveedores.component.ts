import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";

@Component({
  selector: "app-proveedores",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./proveedores.component.html",
  styleUrls: ["./proveedores.component.scss"],
})
export class ProveedoresComponent implements OnInit {
  private http = inject(HttpClient);

  private readonly API_BASE = environment.apiUrl;
  private readonly API_REGIONES = `${this.API_BASE}/api/v1/regiones`;
  private readonly API_COMUNAS_BY_REG = `${this.API_BASE}/api/v1/comuna/region`;
  private readonly API_GIROS = `${this.API_BASE}/api/v1/giro/all`;
  private readonly API_PROV_ALL = `${this.API_BASE}/api/v1/oc/proveedor/all`;
  private readonly API_OC_PROV = `${this.API_BASE}/api/v1/oc/proveedor`;

  proveedores: any[] = [];
  giros: any[] = [];
  regiones: any[] = [];
  comunas: any[] = [];
  loadingComunas: boolean = false;
  idsGirosSeleccionados: string[] = [];

  filtroBusqueda: string = "";
  editMode: boolean = false;
  loading: boolean = false;

  proveedorForm: any = {
    rutProveedor: "",
    nombreProveedor: "",
    razonSocialProveedor: "",
    direccion: "",
    telefonoContactoProveedor: "",
    emailProveedor: "",
    codigoRegion: null,
    codComuna: null,
    activo: true,
    listaGiros: [],
  };

  ngOnInit() {
    this.listarProveedores();
    this.cargarGiros();
    this.cargarRegiones();
  }

  listarProveedores() {
    this.loading = true;
    this.http.get<any[]>(this.API_PROV_ALL).subscribe({
      next: (res) => {
        this.proveedores = res || [];
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  cargarRegiones() {
    this.http.get<any[]>(this.API_REGIONES).subscribe({
      next: (res) => (this.regiones = res || []),
      error: (err) => console.error("Error regiones:", err),
    });
  }

  onRegionChange() {
    const codRegion = this.proveedorForm.codigoRegion;
    if (!codRegion || codRegion === "null") {
      this.comunas = [];
      return;
    }
    this.loadingComunas = true;
    this.proveedorForm.codComuna = null; 
    this.http.get<any[]>(`${this.API_COMUNAS_BY_REG}/${codRegion}`).subscribe({
      next: (res) => {
        this.comunas = res || [];
        this.loadingComunas = false;
      },
      error: () => {
        this.comunas = [];
        this.loadingComunas = false;
      },
    });
  }

  cargarGiros() {
    this.http.get<any[]>(this.API_GIROS).subscribe((res) => (this.giros = res || []));
  }

  quitarGiro(codigoParaEliminar: string) {
    this.idsGirosSeleccionados = this.idsGirosSeleccionados.filter(c => c !== codigoParaEliminar);
    this.onGiroChange();
  }

  onGiroChange() {
    this.proveedorForm.listaGiros = this.giros
      .filter((g) => this.idsGirosSeleccionados.includes(g.codigoGiroSii))
      .map((g) => ({
        codigoGiroSii: g.codigoGiroSii, 
        nombreGiroSii: g.nombreGiroSii
      }));
  }

  // --- NUEVOS MÉTODOS PARA RUT (FORMATEO Y VALIDACIÓN) ---
  
  onRutInput(event: any) {
    let valor = event.target.value.replace(/[^0-9kK]/g, '').toUpperCase();
    
    if (valor.length === 0) {
      this.proveedorForm.rutProveedor = '';
      return;
    }

    let cuerpo = valor.slice(0, -1);
    let dv = valor.slice(-1);

    // Formatear con puntos y guion a medida que escribe
    let cuerpoFormateado = '';
    while (cuerpo.length > 3) {
      cuerpoFormateado = '.' + cuerpo.slice(-3) + cuerpoFormateado;
      cuerpo = cuerpo.slice(0, -3);
    }
    cuerpoFormateado = cuerpo + cuerpoFormateado;

    this.proveedorForm.rutProveedor = cuerpoFormateado + '-' + dv;
  }

  validarRutChileno(rut: string): boolean {
    if (!rut) return false;
    // Limpiar el rut para dejar sólo números y K
    const rutLimpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (rutLimpio.length < 8) return false;

    const cuerpo = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);

    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += multiplo * parseInt(cuerpo.charAt(i), 10);
      multiplo = multiplo < 7 ? multiplo + 1 : 2;
    }

    const dvEsperado = 11 - (suma % 11);
    let dvCalc = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : String(dvEsperado);

    return dv === dvCalc;
  }

  // Intercepta y prepara el objeto JSON antes de ser enviado al backend
  prepararDatosEnvio() {
    // 1. Asegurar que el RUT vaya con puntos y guion por si acaso
    if (this.proveedorForm.rutProveedor) {
      this.proveedorForm.rutProveedor = this.proveedorForm.rutProveedor.trim().toUpperCase();
    }

    // 2. Transformar a MAYÚSCULAS todos los campos de texto String
    if (this.proveedorForm.nombreProveedor) this.proveedorForm.nombreProveedor = this.proveedorForm.nombreProveedor.trim().toUpperCase();
    if (this.proveedorForm.razonSocialProveedor) this.proveedorForm.razonSocialProveedor = this.proveedorForm.razonSocialProveedor.trim().toUpperCase();
    if (this.proveedorForm.direccion) this.proveedorForm.direccion = this.proveedorForm.direccion.trim().toUpperCase();
    if (this.proveedorForm.emailProveedor) this.proveedorForm.emailProveedor = this.proveedorForm.emailProveedor.trim().toUpperCase();
    if (this.proveedorForm.telefonoContactoProveedor) this.proveedorForm.telefonoContactoProveedor = this.proveedorForm.telefonoContactoProveedor.trim().toUpperCase();
  }

  submitForm() {
    // Validar el RUT antes de procesar cualquier acción
    if (!this.validarRutChileno(this.proveedorForm.rutProveedor)) {
      alert("El RUT ingresado no es válido. Por favor, verifíquelo.");
      return;
    }

    this.prepararDatosEnvio();
    this.editMode ? this.actualizar() : this.guardar();
  }

  guardar() {
    this.http.post(this.API_OC_PROV, this.proveedorForm).subscribe({
      next: () => {
        this.resetForm();
        this.listarProveedores();
      },
    });
  }

  actualizar() {
    // Nota: Dejamos el endpoint con el rut limpio tal como lo tenías originalmente 
    // o puedes cambiar `${rutLimpio}` por `${this.proveedorForm.rutProveedor}` si tu Backend ahora espera puntos y guion en la URL.
    const rutLimpio = this.proveedorForm.rutProveedor.replace(/[.-]/g, "");
    this.http.put(`${this.API_OC_PROV}/${rutLimpio}`, this.proveedorForm).subscribe({
      next: () => {
        this.resetForm();
        this.listarProveedores();
      },
    });
  }

  seleccionarParaModificar(prov: any) {
    this.editMode = true;
    this.loadingComunas = true;
    this.proveedorForm = { ...prov };

    if (prov.listaGiros) {
      this.idsGirosSeleccionados = prov.listaGiros.map((lg: any) => lg.codigoGiroSii);
      this.onGiroChange();
    }

    if (prov.codComuna) {
      const codComunaFormateado = String(prov.codComuna).padStart(5, '0');
      this.http.get<any>(`${this.API_BASE}/api/v1/comuna/${codComunaFormateado}`).subscribe({
        next: (comunaDetalle) => {
          this.proveedorForm.codigoRegion = comunaDetalle.codigoRegion || comunaDetalle.codRegion;
          this.http.get<any[]>(`${this.API_COMUNAS_BY_REG}/${this.proveedorForm.codigoRegion}`).subscribe({
            next: (listado) => {
              this.comunas = listado;
              this.proveedorForm.codComuna = codComunaFormateado;
              this.loadingComunas = false;
            },
            error: () => (this.loadingComunas = false)
          });
        },
        error: () => (this.loadingComunas = false)
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get proveedoresFiltrados() {
    const f = this.filtroBusqueda.toLowerCase().trim();
    if (!f) return this.proveedores;

    return this.proveedores.filter(p => 
        p.nombreProveedor?.toLowerCase().includes(f) ||
        p.rutProveedor?.includes(f) ||
        p.razonSocialProveedor?.toLowerCase().includes(f)
    );
  }

  cancelarEdicion() { this.resetForm(); }

  resetForm() {
    this.editMode = false;
    this.idsGirosSeleccionados = [];
    this.comunas = [];
    this.proveedorForm = {
      rutProveedor: "", nombreProveedor: "", razonSocialProveedor: "",
      direccion: "", telefonoContactoProveedor: "", emailProveedor: "",
      codigoRegion: null, codComuna: null, activo: true, listaGiros: [],
    };
  }
}