-- CreateTable
CREATE TABLE "Sucursal" (
    "id_sucursal" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "ciudad" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Almacen" (
    "id_almacen" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "id_sucursal" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Almacen_id_sucursal_fkey" FOREIGN KEY ("id_sucursal") REFERENCES "Sucursal" ("id_sucursal") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Departamento" (
    "id_departamento" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Almacen_Departamento" (
    "id_almacen" INTEGER NOT NULL,
    "id_departamento" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY ("id_almacen", "id_departamento"),
    CONSTRAINT "Almacen_Departamento_id_almacen_fkey" FOREIGN KEY ("id_almacen") REFERENCES "Almacen" ("id_almacen") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Almacen_Departamento_id_departamento_fkey" FOREIGN KEY ("id_departamento") REFERENCES "Departamento" ("id_departamento") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Marca" (
    "id_marca" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "codigo" INTEGER
);

-- CreateTable
CREATE TABLE "Departamento_Marca" (
    "IdMarcaDepartamento" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_departamento" INTEGER NOT NULL,
    "id_marca" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Departamento_Marca_id_departamento_fkey" FOREIGN KEY ("id_departamento") REFERENCES "Departamento" ("id_departamento") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Departamento_Marca_id_marca_fkey" FOREIGN KEY ("id_marca") REFERENCES "Marca" ("id_marca") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubCategoria" (
    "id_subcategoria" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "id_marca" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SubCategoria_id_marca_fkey" FOREIGN KEY ("id_marca") REFERENCES "Marca" ("id_marca") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Articulo" (
    "id_articulo" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "descripcion" TEXT,
    "id_marca" INTEGER NOT NULL,
    "id_departamento" INTEGER NOT NULL,
    "id_subcategoria" INTEGER NOT NULL,
    "fecha_creacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Articulo_id_departamento_fkey" FOREIGN KEY ("id_departamento") REFERENCES "Departamento" ("id_departamento") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Articulo_id_marca_fkey" FOREIGN KEY ("id_marca") REFERENCES "Marca" ("id_marca") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Articulo_id_subcategoria_fkey" FOREIGN KEY ("id_subcategoria") REFERENCES "SubCategoria" ("id_subcategoria") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Programacion_Conteo" (
    "id_programacion" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha_programada" DATETIME NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Programado',
    "fecha_creacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_finalizacion" DATETIME
);

-- CreateTable
CREATE TABLE "Detalle_Conteo" (
    "id_detalle" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_programacion" INTEGER NOT NULL,
    "id_articulo" INTEGER NOT NULL,
    "id_ubicacion" INTEGER NOT NULL,
    "cantidad_sistema" INTEGER NOT NULL,
    "cantidad_contada" INTEGER NOT NULL,
    "diferencia" INTEGER,
    "id_usuario_conteo" INTEGER,
    "fecha_conteo" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    CONSTRAINT "Detalle_Conteo_id_articulo_fkey" FOREIGN KEY ("id_articulo") REFERENCES "Articulo" ("id_articulo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Detalle_Conteo_id_programacion_fkey" FOREIGN KEY ("id_programacion") REFERENCES "Programacion_Conteo" ("id_programacion") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Detalle_Conteo_id_ubicacion_fkey" FOREIGN KEY ("id_ubicacion") REFERENCES "Ubicacion" ("id_ubicacion") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ubicacion" (
    "id_ubicacion" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_articulo" INTEGER NOT NULL,
    "zona" TEXT NOT NULL,
    "pasillo" TEXT NOT NULL,
    "columna" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "posicion" TEXT NOT NULL,
    "cantidad_stock" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "predeterminado" BOOLEAN NOT NULL DEFAULT false,
    "sucursal" INTEGER,
    CONSTRAINT "Ubicacion_id_articulo_fkey" FOREIGN KEY ("id_articulo") REFERENCES "Articulo" ("id_articulo") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Almacen_id_sucursal_idx" ON "Almacen"("id_sucursal");

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_nombre_key" ON "Departamento"("nombre");

-- CreateIndex
CREATE INDEX "Almacen_Departamento_id_departamento_idx" ON "Almacen_Departamento"("id_departamento");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_nombre_key" ON "Marca"("nombre");

-- CreateIndex
CREATE INDEX "Departamento_Marca_id_marca_idx" ON "Departamento_Marca"("id_marca");

-- CreateIndex
CREATE INDEX "SubCategoria_id_marca_idx" ON "SubCategoria"("id_marca");

-- CreateIndex
CREATE UNIQUE INDEX "SubCategoria_nombre_id_marca_key" ON "SubCategoria"("nombre", "id_marca");

-- CreateIndex
CREATE UNIQUE INDEX "Articulo_sku_key" ON "Articulo"("sku");

-- CreateIndex
CREATE INDEX "Articulo_id_departamento_idx" ON "Articulo"("id_departamento");

-- CreateIndex
CREATE INDEX "Articulo_id_marca_idx" ON "Articulo"("id_marca");

-- CreateIndex
CREATE INDEX "Articulo_id_subcategoria_idx" ON "Articulo"("id_subcategoria");

-- CreateIndex
CREATE INDEX "Detalle_Conteo_id_articulo_idx" ON "Detalle_Conteo"("id_articulo");

-- CreateIndex
CREATE INDEX "Detalle_Conteo_id_programacion_idx" ON "Detalle_Conteo"("id_programacion");

-- CreateIndex
CREATE INDEX "Detalle_Conteo_id_ubicacion_idx" ON "Detalle_Conteo"("id_ubicacion");
