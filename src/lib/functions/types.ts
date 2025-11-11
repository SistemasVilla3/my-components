export type EstadoConteo = 'Programado' | 'Completado' | 'Cancelado';

export type PaginationInput = {
  limit?: string | number;
  page?: string | number;
};

export type MarcaSearchQuery = PaginationInput & {
  q?: string;
};

export type Sucursal = {
  id_sucursal: number;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
  activo: boolean;
};

export type Almacen = {
  id_almacen: number;
  nombre: string;
  id_sucursal: number;
  activo: boolean;
  Sucursal?: Sucursal;
};

export type Departamento = {
  id_departamento: number;
  nombre: string;
  activo: boolean;
};

export type Marca = {
  id_marca: number;
  nombre: string;
  activo: boolean;
  codigo?: number | null;
};

export type SubCategoria = {
  id_subcategoria: number;
  nombre: string;
  id_marca: number;
  activo: boolean;
  Marca?: Marca;
};

export type Articulo = {
  id_articulo: number;
  sku: string;
  descripcion?: string | null;
  id_marca: number;
  id_departamento: number;
  id_subcategoria?: number | null;
  fecha_creacion: string;
  activo: boolean;
  Marca?: Marca;
  Departamento?: Departamento;
  SubCategoria?: SubCategoria;
};

export type Ubicacion = {
  id_ubicacion: number;
  id_articulo: number;
  zona: string;
  pasillo: string;
  columna: string;
  nivel: string;
  posicion: string;
  cantidad_stock: number;
  activo: boolean;
  predeterminado: boolean;
  sucursal?: number | null;
  Articulo?: Articulo;
};

export type DetalleConteo = {
  id_detalle: number;
  id_programacion: number;
  id_articulo: number;
  id_ubicacion: number;
  cantidad_sistema: number;
  cantidad_contada: number;
  diferencia?: number | null;
  id_usuario_conteo?: number | null;
  fecha_conteo: string;
  observaciones?: string | null;
  Articulo?: Articulo;
  Ubicacion?: Ubicacion;
};

export type ProgramacionConteo = {
  id_programacion: number;
  fecha_programada: string;
  descripcion?: string | null;
  estado: EstadoConteo;
  fecha_creacion: string;
  fecha_finalizacion?: string | null;
  Detalle_Conteo?: DetalleConteo[];
};

export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  message?: string;
};

export type PaginatedResponse<T> = ApiResponse<T> & {
  totalPaginas: number;
  paginaActual: number;
  totalDocumentos: number;
};

export type ConteoEvent = {
  id: number | string;
  date: string | Date;   // ideal: 'YYYY-MM-DD' (sin hora)
  almacen?: string | number;
  estado?: EstadoConteo;
  descripcion?: string;
  hora?: string;
};
