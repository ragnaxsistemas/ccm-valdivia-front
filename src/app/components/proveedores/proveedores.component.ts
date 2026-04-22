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

  submitForm() {
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
    if (!f) return this.proveedores; // Si no hay filtro, muestra todo lo que llegó del API

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