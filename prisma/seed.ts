import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type SeedSucursal = {
  nombre: string;
  ciudad?: string;
  direccion?: string;
  telefono?: string;
  activo?: boolean;
};

type SeedMarca = { nombre: string };
type SeedDepartamento = { nombre: string };
type SeedSubCategoria = { nombre: string; marca: string };
type SeedArticulo = {
  sku: string;
  descripcion?: string;
  marca: string;
  departamento: string;
  subcategoria: string;
  activo?: boolean;
};

type SeedData = {
  sucursales: SeedSucursal[];
  marcas: SeedMarca[];
  departamentos: SeedDepartamento[];
  subcategorias: SeedSubCategoria[];
  articulos: SeedArticulo[];
};

const prisma = new PrismaClient();
const seedFile = path.join(__dirname, 'data', 'seed.json');

const toNullable = (value?: string | null) => value ?? null;
const toBoolean = (value: unknown, fallback = true) =>
  typeof value === 'boolean' ? value : fallback;

async function main() {
  const contents = fs.readFileSync(seedFile, 'utf8');
  const data: SeedData = JSON.parse(contents);

  // sucursales
  for (const s of data.sucursales) {
    const payload = {
      nombre: s.nombre,
      ciudad: toNullable(s.ciudad),
      direccion: toNullable(s.direccion),
      telefono: toNullable(s.telefono),
      activo: toBoolean(s.activo)
    };

    const existing = await prisma.sucursal.findFirst({ where: { nombre: s.nombre } });

    if (existing) {
      await prisma.sucursal.update({
        where: { id_sucursal: existing.id_sucursal },
        data: payload
      });
    } else {
      await prisma.sucursal.create({ data: payload });
    }
  }

  for (const m of data.marcas) {
    await prisma.marca.upsert({
      where: { nombre: m.nombre },
      update: {},
      create: { nombre: m.nombre }
    });
  }

  for (const d of data.departamentos) {
    await prisma.departamento.upsert({
      where: { nombre: d.nombre },
      update: {},
      create: { nombre: d.nombre }
    });
  }

  // subcategorías (necesitan marca)
  for (const sc of data.subcategorias) {
    const marca = await prisma.marca.findUnique({ where: { nombre: sc.marca } });
    if (!marca) continue;
    await prisma.subCategoria.upsert({
      where: { nombre_id_marca: { nombre: sc.nombre, id_marca: marca.id_marca } },
      update: {},
      create: { nombre: sc.nombre, id_marca: marca.id_marca }
    });
  }

  // artículos
  for (const a of data.articulos) {
    const marca = await prisma.marca.findUnique({ where: { nombre: a.marca } });
    const depto = await prisma.departamento.findUnique({ where: { nombre: a.departamento } });
    const subc = marca
      ? await prisma.subCategoria.findFirst({
          where: { nombre: a.subcategoria, id_marca: marca.id_marca }
        })
      : null;

    if (!marca || !depto || !subc) continue;

    const articuloData = {
      descripcion: toNullable(a.descripcion),
      id_marca: marca.id_marca,
      id_departamento: depto.id_departamento,
      id_subcategoria: subc.id_subcategoria,
      activo: toBoolean(a.activo)
    };

    await prisma.articulo.upsert({
      where: { sku: a.sku },
      update: articuloData,
      create: { sku: a.sku, ...articuloData }
    });
  }

  console.log('Seed listo');
}

main()
  .catch((error) => {
    console.error('Error ejecutando el seed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
