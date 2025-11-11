// netlify_functions/api.ts
import type { Handler } from '@netlify/functions';
import prisma from '../../prisma/prismaClient';

const json = (statusCode: number, data: unknown) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data)
});

export const handler: Handler = async (event) => {
  const path = (event.path ?? '').replace(/^\/.netlify\/functions\/api/, '') || '/';

  try {
    if (path === '/health') {
      return json(200, { ok: true });
    }

    if (path === '/articulos') {
      const rows = await prisma.articulos.findMany({
        include: {
          marcas: true,
          departamentos: true,
          subcategorias: true
        },
        take: 50
      });
      return json(200, rows);
    }

    return { statusCode: 404, body: 'Not Found' };
  } catch (error) {
    console.error(error);
    return json(500, { error: 'Internal Server Error' });
  }
};
