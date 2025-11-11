import type { Handler } from '@netlify/functions';
import type { Prisma } from '@prisma/client';
import prisma from '../../prisma/prismaClient';

type EstadoConteo = 'Programado' | 'Completado' | 'Cancelado';

type ApiResponse<T> = {
  ok: boolean;
  data: T;
  message?: string;
};

type PaginatedResponse<T> = ApiResponse<T> & {
  totalPaginas: number;
  paginaActual: number;
  totalDocumentos: number;
};

type MarcaDTO = {
  id_marca: number;
  nombre: string;
  activo: boolean;
  codigo?: number | null;
};

type SubCategoriaDTO = {
  id_subcategoria: number;
  nombre: string;
  id_marca: number | null;
  activo: boolean;
  Marca?: MarcaDTO;
};

type DepartamentoDTO = {
  id_departamento: number;
  nombre: string;
  activo: boolean;
};

type ArticuloDTO = {
  id_articulo: number;
  sku: string;
  descripcion?: string | null;
  id_marca: number | null;
  id_departamento: number | null;
  id_subcategoria?: number | null;
  fecha_creacion: string;
  activo: boolean;
  Marca?: MarcaDTO;
  Departamento?: DepartamentoDTO;
  SubCategoria?: SubCategoriaDTO;
};

type SucursalDTO = {
  id_sucursal: number;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
  activo: boolean;
};

type AlmacenDTO = {
  id_almacen: number;
  nombre: string;
  id_sucursal: number;
  activo: boolean;
  Sucursal?: SucursalDTO;
};

type UbicacionDTO = {
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
  Articulo?: ArticuloDTO;
};

type DetalleConteoDTO = {
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
  Articulo?: ArticuloDTO;
  Ubicacion?: UbicacionDTO;
};

type ProgramacionConteoDTO = {
  id_programacion: number;
  fecha_programada: string;
  descripcion?: string | null;
  estado: EstadoConteo;
  fecha_creacion: string;
  fecha_finalizacion?: string | null;
  Detalle_Conteo?: DetalleConteoDTO[];
};

type QueryParams = Record<string, string | undefined>;

const JSON_HEADERS = { 'content-type': 'application/json' };
const ARTICULO_INCLUDE = {
  marcas: true,
  departamentos: true,
  subcategorias: { include: { marcas: true } }
} as const;
const CONTEO_CACHE_TTL = 5 * 60 * 1000;
const CONTEO_STATES: EstadoConteo[] = ['Programado', 'Completado', 'Cancelado'];

let conteosCache: ProgramacionConteoDTO[] | null = null;
let conteosCacheTimestamp = 0;

const json = (statusCode: number, data: unknown) => ({
  statusCode,
  headers: JSON_HEADERS,
  body: JSON.stringify(data)
});

const normalizePath = (rawPath?: string) => {
  if (!rawPath) return '/';
  let path = rawPath.replace(/^\/?\.netlify\/functions\/api/i, '');
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/+/g, '/');
  path = path.replace(/\/index(\.html?|\.htm)?$/i, '');
  path = path.replace(/\.(html?|htm)$/i, '');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
};

const toNumber = (
  value: string | undefined,
  fallback: number,
  options: { min?: number; max?: number } = {}
) => {
  if (!value?.length) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const min = options.min ?? Number.MIN_SAFE_INTEGER;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

const getPagination = (
  params: QueryParams,
  defaults: { limit: number; page: number; maxLimit: number }
) => {
  const limit = toNumber(params.limit, defaults.limit, { min: 1, max: defaults.maxLimit });
  const page = toNumber(params.page, defaults.page, { min: 1, max: 500 });
  const skip = (page - 1) * limit;
  return { limit, page, skip };
};

const asPaginated = <T>(
  data: T[],
  totalDocumentos: number,
  page: number,
  limit: number
): PaginatedResponse<T[]> => ({
  ok: true,
  data,
  totalDocumentos,
  totalPaginas: totalDocumentos ? Math.ceil(totalDocumentos / limit) : 0,
  paginaActual: page
});

const mapMarca = (marca: Prisma.marcasGetPayload<{}>): MarcaDTO => ({
  id_marca: marca.id,
  nombre: marca.nombre,
  activo: true,
  codigo: null
});

const adaptMarca = (marca?: Prisma.marcasGetPayload<{}> | null) =>
  marca ? mapMarca(marca) : undefined;

const adaptDepartamento = (departamento?: Prisma.departamentosGetPayload<{}> | null) =>
  departamento
    ? {
        id_departamento: departamento.id,
        nombre: departamento.nombre,
        activo: true
      }
    : undefined;

type SubcategoriaWithMarca = Prisma.subcategoriasGetPayload<{ include: { marcas: true } }>;
const mapSubcategoria = (sub: SubcategoriaWithMarca): SubCategoriaDTO => ({
  id_subcategoria: sub.id,
  nombre: sub.nombre,
  id_marca: sub.marca_id ?? null,
  activo: true,
  Marca: adaptMarca(sub.marcas)
});

const adaptSubcategoria = (sub?: SubcategoriaWithMarca | null) =>
  sub ? mapSubcategoria(sub) : undefined;

type ArticuloWithRelations = Prisma.articulosGetPayload<{ include: typeof ARTICULO_INCLUDE }>;
const adaptArticulo = (art: ArticuloWithRelations): ArticuloDTO => {
  const pseudoDate = new Date(Date.now() - art.id * 86_400_000).toISOString();
  return {
    id_articulo: art.id,
    sku: art.sku,
    descripcion: art.descripcion,
    id_marca: art.marca_id ?? null,
    id_departamento: art.departamento_id ?? null,
    id_subcategoria: art.subcategoria_id ?? null,
    fecha_creacion: pseudoDate,
    activo: art.activo ?? true,
    Marca: adaptMarca(art.marcas),
    Departamento: adaptDepartamento(art.departamentos),
    SubCategoria: adaptSubcategoria(art.subcategorias as SubcategoriaWithMarca | null)
  };
};

type SucursalRecord = Prisma.sucursalesGetPayload<{}>;

const adaptSucursal = (sucursal: SucursalRecord): SucursalDTO => ({
  id_sucursal: sucursal.id,
  nombre: sucursal.nombre,
  direccion: sucursal.direccion,
  telefono: sucursal.telefono ?? null,
  ciudad: sucursal.ciudad,
  activo: sucursal.activo ?? true
});

const adaptAlmacen = (sucursal: SucursalRecord): AlmacenDTO => ({
  id_almacen: sucursal.id,
  nombre: sucursal.nombre,
  id_sucursal: sucursal.id,
  activo: sucursal.activo ?? true,
  Sucursal: adaptSucursal(sucursal)
});

const buildConteosFromArticulos = (articulos: ArticuloWithRelations[]): ProgramacionConteoDTO[] => {
  const now = Date.now();
  return articulos.map((art, idx) => {
    const estado = CONTEO_STATES[idx % CONTEO_STATES.length];
    const fechaProgramada = new Date(now + idx * 86_400_000).toISOString();
    const fechaCreacion = new Date(now - idx * 43_200_000).toISOString();
    const fechaFinal = estado === 'Completado' ? new Date(now + idx * 3_600_000).toISOString() : null;
    const articuloDTO = adaptArticulo(art);
    const ubicacion: UbicacionDTO = {
      id_ubicacion: idx + 1,
      id_articulo: art.id,
      zona: `Z${(idx % 6) + 1}`,
      pasillo: `P${(idx % 10) + 1}`,
      columna: `C${(idx % 4) + 1}`,
      nivel: `N${(idx % 3) + 1}`,
      posicion: `POS-${idx + 1}`,
      cantidad_stock: 25 + idx,
      activo: true,
      predeterminado: idx % 2 === 0,
      sucursal: art.departamento_id ?? null,
      Articulo: articuloDTO
    };
    const detalle: DetalleConteoDTO = {
      id_detalle: idx + 1,
      id_programacion: idx + 1,
      id_articulo: art.id,
      id_ubicacion: ubicacion.id_ubicacion,
      cantidad_sistema: 100 + idx,
      cantidad_contada: estado === 'Completado' ? 100 + idx : 0,
      diferencia: estado === 'Completado' ? 0 : null,
      id_usuario_conteo: estado === 'Completado' ? 1 : null,
      fecha_conteo: estado === 'Completado' ? fechaFinal ?? fechaProgramada : fechaProgramada,
      observaciones: estado === 'Cancelado' ? 'Conteo cancelado' : undefined,
      Articulo: articuloDTO,
      Ubicacion: ubicacion
    };

    return {
      id_programacion: idx + 1,
      fecha_programada: fechaProgramada,
      descripcion: `Conteo para ${art.descripcion}`,
      estado,
      fecha_creacion: fechaCreacion,
      fecha_finalizacion: fechaFinal,
      Detalle_Conteo: [detalle]
    };
  });
};

const ensureConteos = async () => {
  const isValid = conteosCache && Date.now() - conteosCacheTimestamp < CONTEO_CACHE_TTL;
  if (isValid && conteosCache) {
    return conteosCache;
  }
  const articulos = await prisma.articulos.findMany({
    include: ARTICULO_INCLUDE,
    take: 45,
    orderBy: { id: 'asc' }
  });
  conteosCache = buildConteosFromArticulos(articulos);
  conteosCacheTimestamp = Date.now();
  return conteosCache;
};

const handleAlmacenes = async () => {
  const sucursales = await prisma.sucursales.findMany({ orderBy: { nombre: 'asc' } });
  const data = sucursales.map(adaptAlmacen);
  return json(200, { ok: true, data } satisfies ApiResponse<AlmacenDTO[]>);
};

const handleMarcaSearch = async (query: QueryParams) => {
  const { limit, page, skip } = getPagination(query, { limit: 10, page: 1, maxLimit: 50 });
  const term = query.q?.trim();
  const where = term?.length
    ? { nombre: { contains: term, mode: 'insensitive' as const } }
    : undefined;
  const [rows, total] = await Promise.all([
    prisma.marcas.findMany({
      where,
      orderBy: { nombre: 'asc' },
      skip,
      take: limit
    }),
    prisma.marcas.count({ where })
  ]);
  const data = rows.map(mapMarca);
  return json(200, asPaginated(data, total, page, limit) satisfies PaginatedResponse<MarcaDTO[]>);
};

const handleSubcategorias = async (marcaId: number, query: QueryParams) => {
  const { limit, page, skip } = getPagination(query, { limit: 10, page: 1, maxLimit: 50 });
  const where = { marca_id: marcaId };
  const [rows, total] = await Promise.all([
    prisma.subcategorias.findMany({
      where,
      include: { marcas: true },
      orderBy: { nombre: 'asc' },
      skip,
      take: limit
    }),
    prisma.subcategorias.count({ where })
  ]);
  const data = rows.map(mapSubcategoria);
  return json(
    200,
    asPaginated(data, total, page, limit) satisfies PaginatedResponse<SubCategoriaDTO[]>
  );
};

const handleArticuloBySku = async (sku: string) => {
  const articulo = await prisma.articulos.findUnique({
    where: { sku },
    include: ARTICULO_INCLUDE
  });
  if (!articulo) {
    return json(404, { ok: false, data: null, message: 'Articulo no encontrado' });
  }
  return json(200, { ok: true, data: adaptArticulo(articulo) } satisfies ApiResponse<ArticuloDTO>);
};

const handleArticulosList = async () => {
  const articulos = await prisma.articulos.findMany({
    include: ARTICULO_INCLUDE,
    orderBy: { id: 'asc' },
    take: 50
  });
  const data = articulos.map(adaptArticulo);
  return json(200, { ok: true, data } satisfies ApiResponse<ArticuloDTO[]>);
};

const handleConteos = async (
  filter: EstadoConteo | 'ALL',
  query: QueryParams
) => {
  const all = await ensureConteos();
  const filtered =
    filter === 'ALL' ? all : all.filter((conteo) => conteo.estado === filter);
  const { limit, page, skip } = getPagination(query, { limit: 5, page: 1, maxLimit: 25 });
  const slice = filtered.slice(skip, skip + limit);
  return json(
    200,
    asPaginated(slice, filtered.length, page, limit) satisfies PaginatedResponse<
      ProgramacionConteoDTO[]
    >
  );
};

export const handler: Handler = async (event) => {
  const method = (event.httpMethod ?? 'GET').toUpperCase();
  if (method !== 'GET') {
    return json(405, { ok: false, message: 'Method Not Allowed' });
  }

  const path = normalizePath(event.path);
  const query = event.queryStringParameters ?? {};

  try {
    if (path === '/health') {
      return json(200, { ok: true });
    }

    if (path === '/almacenes') {
      return handleAlmacenes();
    }

    if (path === '/catalogos/marcas/buscar') {
      return handleMarcaSearch(query);
    }

    const subMatch = path.match(/^\/catalogos\/marcas\/(\d+)\/subcategorias$/);
    if (subMatch) {
      const marcaId = Number(subMatch[1]);
      if (!Number.isFinite(marcaId)) {
        return json(400, { ok: false, message: 'Marca invalida' });
      }
      return handleSubcategorias(marcaId, query);
    }

    if (path === '/articulos') {
      return handleArticulosList();
    }

    const articuloMatch = path.match(/^\/articulos\/([^/]+)$/);
    if (articuloMatch) {
      const sku = decodeURIComponent(articuloMatch[1]);
      return handleArticuloBySku(sku);
    }

    if (path === '/inventario/conteos-pendientes') {
      return handleConteos('Programado', query);
    }

    if (path === '/inventario/conteos-finalizados') {
      return handleConteos('Completado', query);
    }

    if (path === '/inventario/conteos-todos') {
      return handleConteos('ALL', query);
    }

    return json(404, { ok: false, message: 'Not Found' });
  } catch (error) {
    console.error('API handler error', error);
    return json(500, { ok: false, message: 'Internal Server Error' });
  }
};
