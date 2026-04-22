import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos.component.html',
  styleUrls: ['./productos.component.scss']
})
export class ProductosComponent implements OnInit {
  private http = inject(HttpClient);
  
  // Endpoints según tu especificación
  private readonly API_ALL = 'http://localhost:8888/api/v1/oc/producto/all';
  private readonly API_SAVE = 'http://localhost:8888/api/v1/oc/producto'; // Asumido para POST/PUT

  productos: any[] = [];
  filtroBusqueda: string = '';
  editMode: boolean = false;
  loading: boolean = false;

  // Modelo del formulario
  productoForm: any = {
    id: null,
    nombreProducto: '',
    codigoProducto: '', 
    descripcionProducto: '',
    valorProducto: 0
  };

  ngOnInit() {
    this.cargarProductos();
  }

  cargarProductos() {
    this.loading = true;
    this.http.get<any[]>(this.API_ALL).subscribe({
      next: (res) => {
        this.productos = res;
        this.loading = false;
        
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
        this.loading = false;
      }
    });
    console.log('Productos cargados:', this);
    
  }

  // Se activa al presionar el botón de la tabla
  seleccionarParaModificar(prod: any) {
    this.editMode = true;
    this.productoForm = { ...prod }; // Ahora las llaves coinciden: nombreProducto -> nombreProducto
    
    // Scroll al formulario para ver los datos cargados
    const topElement = document.getElementById('admin-top');
  if (topElement) {
    topElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    // Fallback por si el ID no se encuentra
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  }

  // Asegúrate de que submitForm llame a los métodos correctos
  submitForm() {
    if (this.editMode) {
      this.actualizar();
    } else {
      this.guardar();
    }
  }

  guardar() {
  this.loading = true; // Feedback visual
  this.http.post(this.API_SAVE, this.productoForm).subscribe({
    next: () => {
      console.log('Producto guardado con éxito');
      this.resetForm();
      this.cargarProductos(); // Esto llama al endpoint /all
    },
    error: (err) => {
      console.error('Error al guardar:', err);
      this.loading = false;
      alert('Error al guardar el producto');
    }
  });
}

  actualizar() {
    // Según tu curl: http://localhost:8888/api/v1/producto/PROD-001
    const urlUpdate = `${this.API_SAVE}/${this.productoForm.codigoProducto}`;
    
    // Preparamos el body asegurando que lleve el campo 'activo' si el backend lo requiere
    const body = {
      ...this.productoForm,
      activo: this.productoForm.activo !== undefined ? this.productoForm.activo : true
    };

    console.log('Enviando actualización a:', urlUpdate);
    console.log('Cuerpo del mensaje:', body);

    this.http.put(urlUpdate, body).subscribe({
      next: (res) => {
        console.log('Producto actualizado con éxito');
        this.resetForm();
        this.cargarProductos(); // Recargamos la tabla para ver los cambios
      },
      error: (err) => {
        console.error('Error al actualizar producto:', err);
        alert('No se pudo actualizar el producto. Revisa la consola.');
      }
    });
  }

  cancelarEdicion() {
    this.resetForm();
  }

  resetForm() {
    this.editMode = false;
    this.productoForm = { 
      id: null, 
      nombreProducto: '', 
      codigoProducto: '', 
      descripcionProducto: '', 
      valorProducto: 0 
    };
  }

  // Función para filtrar en la vista (opcional si no se hace por backend)
  get productosFiltrados() {
  if (!this.filtroBusqueda) return this.productos;
  
  const f = this.filtroBusqueda.toLowerCase().trim();
  
  return this.productos.filter(p => 
    // Usamos los nombres exactos: nombreProducto y codigoProducto
    (p.nombreProducto && p.nombreProducto.toLowerCase().includes(f)) || 
    (p.codigoProducto && p.codigoProducto.toLowerCase().includes(f)) ||
    (p.descripcionProducto && p.descripcionProducto.toLowerCase().includes(f))
  );
}
}