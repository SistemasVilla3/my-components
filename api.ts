// apps/api/api.ts
import { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions';
import serverless from 'serverless-http';

// Reutiliza un unico cliente de Prisma entre invocaciones
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

const app = Fastify();

type PaginationInput = {
  limit?: string | number;
  page?: string | number;
};

type SearchQuery = PaginationInput & { q?: string };

type EstadoConteo = 'Programado' | 'Completado' | 'Cancelado';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const parsePagination = (input: PaginationInput = {}) => {
  const rawLimit = typeof input.limit === 'string' ? Number(input.limit) : input.limit;
  const rawPage = typeof input.page === 'string' ? Number(input.page) : input.page;
  const limit = Number.isFinite(rawLimit) && rawLimit ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;
  const page = Number.isFinite(rawPage) && rawPage ? Math.max(rawPage, 1) : 1;
  const skip = (page - 1) * limit;
  return { limit, page, skip };
};

const buildConteoResponse = async (query: PaginationInput, estado?: EstadoConteo) => {
  const pagination = parsePagination(query);
  const where = estado ? { estado } : {};

  const [rows, total] = await Promise.all([
    prisma.programacion_Conteo.findMany({
      where,
      include: {
        Detalle_Conteo: {
          include: {
            Articulo: {
              include: {
                Marca: true,
                Departamento: true,
                SubCategoria: true
              }
            },
            Ubicacion: true
          }
        }
      },
      orderBy: { fecha_programada: 'desc' },
      skip: pagination.skip,
      take: pagination.limit
    }),
    prisma.programacion_Conteo.count({ where })
  ]);

  return {
    ok: true,
    data: rows.length ? rows : null,
    totalPaginas: total ? Math.ceil(total / pagination.limit) : 0,
    paginaActual: pagination.page,
    totalDocumentos: total
  };
};

app.get('/health', async () => ({ ok: true }));

app.get('/almacenes', async () => {
  const data = await prisma.almacen.findMany({
    where: { activo: true },
    include: { Sucursal: true },
    orderBy: { nombre: 'asc' }
  });
  return { ok: true, data };
});

app.get('/articulos', async () => {
  const data = await prisma.articulo.findMany({
    include: {
      Marca: true,
      Departamento: true,
      SubCategoria: true
    },
    orderBy: { fecha_creacion: 'desc' },
    take: 50
  });
  return { ok: true, data };
});

app.get('/articulos/:sku', async (request: FastifyRequest<{ Params: { sku: string } }>, reply: FastifyReply) => {
  const { sku } = request.params;
  const record = await prisma.articulo.findUnique({
    where: { sku },
    include: {
      Marca: true,
      Departamento: true,
      SubCategoria: true
    }
  });

  if (!record) {
    reply.code(404);
    return { ok: false, data: null, message: `No se encontró el artículo ${sku}` };
  }

  return { ok: true, data: record };
});

app.get('/subcategorias', async () => {
  const data = await prisma.subCategoria.findMany({
    include: { Marca: true },
    orderBy: { nombre: 'asc' },
    take: 50
  });
  return { ok: true, data };
});

app.post('/articulos', async (req, reply) => {
  const body = req.body as {
    sku: string;
    descripcion?: string;
    id_marca: number;
    id_departamento: number;
    id_subcategoria?: number | null;
  };

  const created = await prisma.articulo.create({
    data: {
      sku: body.sku,
      descripcion: body.descripcion ?? null,
      id_marca: body.id_marca,
      id_departamento: body.id_departamento,
      id_subcategoria: body.id_subcategoria ?? null
    }
  });

  reply.code(201).send({ ok: true, data: created });
});

app.get('/catalogos/marcas/buscar', async (request: FastifyRequest<{ Querystring: SearchQuery }>) => {
  const { q = '', limit, page } = request.query ?? {};
  const pagination = parsePagination({ limit, page });
  const where = q
    ? {
        nombre: {
          contains: q,
          mode: 'insensitive'
        }
      }
    : undefined;

  const data = await prisma.marca.findMany({
    where,
    orderBy: { nombre: 'asc' },
    skip: pagination.skip,
    take: pagination.limit
  });

  return { ok: true, data };
});

app.get('/catalogos/marcas/:marcaId/subcategorias', async (request: FastifyRequest<{ Params: { marcaId: string } }>, reply: FastifyReply) => {
  const marcaId = Number(request.params.marcaId);
  if (Number.isNaN(marcaId)) {
    reply.code(400);
    return { ok: false, data: [], message: 'marcaId debe ser numérico' };
  }

  const data = await prisma.subCategoria.findMany({
    where: { id_marca: marcaId, activo: true },
    orderBy: { nombre: 'asc' }
  });

  return { ok: true, data };
});

app.get('/inventario/conteos-pendientes', async (request: FastifyRequest<{ Querystring: PaginationInput }>) => {
  return buildConteoResponse(request.query ?? {}, 'Programado');
});

app.get('/inventario/conteos-finalizados', async (request: FastifyRequest<{ Querystring: PaginationInput }>) => {
  return buildConteoResponse(request.query ?? {}, 'Completado');
});

app.get('/inventario/conteos-todos', async (request: FastifyRequest<{ Querystring: PaginationInput }>) => {
  return buildConteoResponse(request.query ?? {});
});

// --- Adaptador Netlify ---
type NetlifyServerlessHandler = (event: HandlerEvent, context: HandlerContext) => Promise<HandlerResponse>;

const handlerFastify = serverless(app as never) as unknown as NetlifyServerlessHandler;

export const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await app.ready(); // asegura que Fastify cargue rutas y plugins antes de delegar
  const normalizedEvent = normalizeNetlifyPath(event);
  return handlerFastify(normalizedEvent, context);
};

// Netlify antepone '/.netlify/functions/<fn>' a las rutas invocadas
const NETLIFY_FUNCTION_PREFIX = /^\/\.netlify\/functions\/[^/]+/;

const normalizeNetlifyPath = (event: HandlerEvent): HandlerEvent => {
  if (!event.path || !NETLIFY_FUNCTION_PREFIX.test(event.path)) {
    return event;
  }

  const strippedPath = event.path.replace(NETLIFY_FUNCTION_PREFIX, '') || '/';

  const rawUrl = normalizeRawUrl(event.rawUrl, strippedPath);

  return {
    ...event,
    path: strippedPath,
    rawUrl
  };
};

const normalizeRawUrl = (rawUrl: string | undefined, pathname: string): string => {
  if (!rawUrl) {
    const url = new URL('https://placeholder.local');
    url.pathname = pathname;
    return url.toString();
  }
  try {
    const url = new URL(rawUrl);
    url.pathname = pathname;
    return url.toString();
  } catch {
    return rawUrl;
  }
};
