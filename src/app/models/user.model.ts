export interface Menu {
  id: number;
  value1: string; // Nombre del menú
  value2: string; // Ruta/Path
  orden: number;  // Campo para ordenar los menús
}

export interface Role {
  nombre: string;
}

export interface Empresa {
  nombreEmpresaCliente: string;
  rutEmpresaCliente: string;
  codigoEmpresaCliente: string;
  razonSocialEmpresaCliente: string;
}

export interface UnidadNegocio {
  showNombreUnidad: string;
  nombreUnidad: string;
  codigoUnidad: string;
}

export interface Adjunto {
  idAdjunto?: number;
  nombreArchivo: string;
  rutaArchivo?: string;    // Esta ruta se pasará al download universal
  contentType?: string;
  // Propiedades auxiliares para el control del Frontend:
  isServerFile?: boolean;  // Nos dice si ya existe en el servidor
  fileReal?: File;         // Si es nuevo, aquí guardamos los bytes temporales
}

export interface UserToken {
  sub: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string; // Veo que aquí llega el RUT en tu ejemplo
  email: string;
  telefono: string;
  role: Role;                  // Objeto anidado
  empresa: Empresa;            // Objeto anidado
  unidadNegocio: UnidadNegocio; // Objeto anidado
  menus: Menu[];               // Array de objetos
  iat: number;
  exp: number;
}

