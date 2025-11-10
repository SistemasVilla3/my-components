import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(fs.readFileSync('prisma/data/seed.json', 'utf8'));

  // básicos
  for (const s of data.sucursales) {
    await prisma.sucursal.upsert({
      where: { id_sucursal: 1 },
      update: {},
      create: { nombre: s.nombre, ciudad: s.ciudad ?? null, activo: !!s.activo }
    });
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
    const subc  = await prisma.subCategoria.findFirst({ where: { nombre: a.subcategoria } });

    if (!marca || !depto) continue;

    await prisma.articulo.upsert({
      where: { sku: a.sku },
      update: {},
      create: {
        sku: a.sku,
        descripcion: a.descripcion ?? null,
        id_marca: marca.id_marca,
        id_departamento: depto.id_departamento,
        id_subcategoria: subc?.id_subcategoria
      }
    });
  }

  console.log('Seed listo ✅');
}

main().finally(async () => await prisma.$disconnect());