# Product Microservice (`product-ms`)

Microservicio de productos construido con **NestJS**, **Prisma ORM** (SQLite via Better-SQLite3) y comunicación por **NATS** como capa de transporte. Forma parte de una arquitectura de microservicios junto con `orders-ms` y `client-gateway`.

---

## Tabla de Contenidos

1. [Tecnologías y Librerías](#tecnologías-y-librerías)
2. [Variables de Entorno](#variables-de-entorno)
3. [Configuración de Prisma](#configuración-de-prisma)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Carpeta `src/config`](#carpeta-srcconfig)
6. [Carpeta `src/common`](#carpeta-srccommon)
7. [Carpeta `src/products`](#carpeta-srcproducts)
8. [Punto de Entrada (`main.ts`)](#punto-de-entrada-maints)
9. [Docker](#docker)
10. [Instalación y Ejecución](#instalación-y-ejecución)
11. [Patrones de Mensajes (NATS)](#patrones-de-mensajes-nats)

---

## Tecnologías y Librerías

### Dependencias de Producción

| Paquete | Versión | Descripción |
|---------|---------|-------------|
| `@nestjs/common` | ^11.0.1 | Módulo común de NestJS (decoradores, pipes, guards, etc.) |
| `@nestjs/core` | ^11.0.1 | Núcleo del framework NestJS |
| `@nestjs/mapped-types` | * | Utilidades para crear DTOs derivados (`PartialType`, `OmitType`, etc.) |
| `@nestjs/microservices` | ^11.1.14 | Soporte de microservicios en NestJS (transporte NATS, TCP, etc.) |
| `@nestjs/platform-express` | ^11.0.1 | Adaptador HTTP Express para NestJS |
| `@prisma/adapter-better-sqlite3` | ^7.4.1 | Adaptador de Prisma para usar Better-SQLite3 como driver |
| `@prisma/client` | ^7.4.1 | Cliente auto-generado de Prisma para interactuar con la base de datos |
| `class-transformer` | ^0.5.1 | Transformación de objetos planos a instancias de clases (usado con `@Type()`) |
| `class-validator` | ^0.14.3 | Validación de DTOs mediante decoradores (`@IsString()`, `@IsNumber()`, `@Min()`, etc.) |
| `dotenv` | ^17.3.1 | Carga variables de entorno desde el archivo `.env` a `process.env` |
| `joi` | ^18.0.2 | Validación de esquemas para las variables de entorno |
| `nats` | ^2.29.3 | Cliente NATS para la comunicación entre microservicios |
| `reflect-metadata` | ^0.2.2 | Polyfill de metadata requerido por NestJS y class-transformer |
| `rxjs` | ^7.8.1 | Librería de programación reactiva, usada internamente por NestJS |

### Dependencias de Desarrollo

| Paquete | Descripción |
|---------|-------------|
| `prisma` (^7.4.1) | CLI de Prisma para migraciones y generación del cliente |
| `typescript` (^5.7.3) | Compilador TypeScript |
| `@nestjs/cli` | CLI de NestJS para generar recursos y compilar |
| `jest` / `ts-jest` | Framework de testing |
| `eslint` / `prettier` | Linting y formateo de código |
| `ts-node` | Ejecución directa de TypeScript en Node.js |

---

## Variables de Entorno

El microservicio requiere un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Puerto del microservicio (requerido)
PORT=3001

# URL de conexión a la base de datos SQLite (requerido)
DATABASE_URL="file:./dev.db"

# Servidores NATS separados por coma (requerido)
NATS_SERVERS="nats://localhost:4222,nats://localhost:4223"
```

### Validación de Variables

Las variables se validan al iniciar la aplicación usando **Joi** en `src/config/envs.ts`. Si alguna variable requerida falta o es inválida, el microservicio lanza un error y no arranca:

```typescript
const envsSchema = joi.object({
    PORT: joi.number().required(),
    DATABASE_URL: joi.string().required(),
    NATS_SERVERS: joi.array().items(joi.string()).required(),
}).unknown();
```

La variable `NATS_SERVERS` se parsea como array dividiendo por comas.

---

## Configuración de Prisma

### Archivo `prisma/schema.prisma`

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "sqlite"
}

model Product {
  id        Int      @id @default(autoincrement())
  name      String
  price     Float
  available Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([available])
}
```

- **Base de datos**: SQLite (archivo local `dev.db`).
- **Modelo `Product`**: Campos `id`, `name`, `price`, `available` (soft delete), `createdAt`, `updatedAt`.
- **Índice**: Sobre el campo `available` para optimizar consultas de productos activos.
- **Output**: El cliente generado se ubica en `generated/prisma/`.

### Archivo `prisma.config.ts`

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

Este archivo configura Prisma con `dotenv` para que las migraciones usen la variable `DATABASE_URL` del `.env`.

### Servicio Prisma (`src/Prisma.service.ts`)

```typescript
@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
    super({ adapter });
  }
}
```

Extiende `PrismaClient` usando el adaptador `@prisma/adapter-better-sqlite3` para conectar con SQLite. Se inyecta como servicio en los módulos que lo necesiten.

### Migraciones

Las migraciones se encuentran en `prisma/migrations/`:

- `20260220195253_init` — Creación inicial de la tabla `Product`.
- `20260223180712_available` — Agregado del campo `available`.
- `20260223181717_availableclear` — Ajustes al campo `available`.

---

## Estructura del Proyecto

```
product-ms/
├── .env                        # Variables de entorno
├── dockerfile                  # Imagen Docker del microservicio
├── package.json                # Dependencias y scripts
├── prisma.config.ts            # Configuración de Prisma (datasource, migraciones)
├── prisma/
│   ├── schema.prisma           # Esquema de la base de datos
│   └── migrations/             # Migraciones de Prisma
├── generated/
│   └── prisma/                 # Cliente Prisma auto-generado
└── src/
    ├── main.ts                 # Punto de entrada del microservicio
    ├── app.module.ts           # Módulo raíz
    ├── Prisma.service.ts       # Servicio de conexión a Prisma
    ├── config/
    │   ├── envs.ts             # Validación y exportación de variables de entorno
    │   └── index.ts            # Barrel file de configuración
    ├── common/
    │   ├── dto/
    │   │   └── pagination.dto.ts  # DTO reutilizable de paginación
    │   └── index.ts            # Barrel file de common
    └── products/
        ├── products.module.ts  # Módulo de productos
        ├── products.controller.ts  # Controlador con @MessagePattern
        ├── products.service.ts # Lógica de negocio (CRUD)
        ├── dto/
        │   ├── create-product.dto.ts  # DTO para crear producto
        │   └── update-product.dto.ts  # DTO para actualizar producto
        └── entities/
            └── product.entity.ts      # Entidad Product
```

---

## Carpeta `src/config`

### `envs.ts`

Responsable de cargar y validar las variables de entorno al arrancar el microservicio.

- Importa `dotenv/config` para cargar el archivo `.env`.
- Define una interfaz `EnvVars` con los tipos esperados (`PORT: number`, `DATABASE_URL: string`, `NATS_SERVERS: string[]`).
- Usa **Joi** para crear un esquema de validación (`envsSchema`) que verifica que todas las variables requeridas existan y sean del tipo correcto.
- `NATS_SERVERS` se transforma de string separado por comas a un array antes de la validación.
- Exporta el objeto `envs` con las propiedades: `port`, `databaseUrl`, `natsServers`.

### `index.ts`

Barrel file que re-exporta `envs` desde `./envs` para facilitar las importaciones.

---

## Carpeta `src/common`

### `dto/pagination.dto.ts`

DTO reutilizable para paginación en cualquier endpoint que lo necesite:

```typescript
export class PaginationDto {
    @IsPositive()
    @IsOptional()
    @Type(() => Number)
    page: number = 1;

    @IsPositive()
    @IsOptional()
    @Type(() => Number)
    limit: number = 10;
}
```

- `page` (por defecto `1`): Número de página.
- `limit` (por defecto `10`): Cantidad de registros por página.
- Usa `class-validator` (`@IsPositive`, `@IsOptional`) y `class-transformer` (`@Type`) para validar y transformar los datos entrantes.

### `index.ts`

Barrel file que exporta `PaginationDto` para que otros módulos lo importen desde `src/common`.

---

## Carpeta `src/products`

### `products.module.ts`

Módulo que registra el controlador (`ProductsController`), el servicio de negocio (`ProductsService`) y el servicio de base de datos (`PrismaService`).

### `products.controller.ts`

Controlador que expone las operaciones CRUD mediante **`@MessagePattern`** de NATS (no usa rutas HTTP directas):

| Patrón de Mensaje | Método | Descripción |
|-------------------|--------|-------------|
| `{ cmd: 'create_product' }` | `create()` | Crea un nuevo producto |
| `{ cmd: 'find_all_products' }` | `findAll()` | Lista productos con paginación |
| `{ cmd: 'find_one_product' }` | `findOne()` | Busca un producto por ID |
| `{ cmd: 'update_product' }` | `update()` | Actualiza un producto existente |
| `{ cmd: 'delete_product' }` | `remove()` | Soft delete (marca `available: false`) |
| `{ cmd: 'validate_products' }` | `validateProduct()` | Valida que un array de IDs existan |

Usa `@Payload()` para extraer los datos del mensaje NATS y `ParseIntPipe` para convertir IDs a enteros.

### `products.service.ts`

Servicio con la lógica de negocio:

- **`onModuleInit()`**: Conecta a la base de datos al inicializar el módulo.
- **`create()`**: Inserta un nuevo producto con `prisma.product.create()`.
- **`findAll()`**: Consulta paginada de productos activos (`available: true`). Retorna `data` + `meta` (total, page, lastPage).
- **`findOne()`**: Busca por ID entre productos activos. Lanza `RpcException` si no existe.
- **`update()`**: Verifica existencia con `findOne()` y luego actualiza con `prisma.product.update()`.
- **`remove()`**: **Soft delete** — marca el producto como `available: false` en lugar de eliminarlo físicamente.
- **`validateProducts()`**: Recibe un array de IDs, elimina duplicados, consulta la base de datos y verifica que todos existan. Usado por `orders-ms` para validar productos antes de crear una orden.

### `dto/create-product.dto.ts`

```typescript
export class CreateProductDto {
    @IsString()
    public name: string;

    @Min(0)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Type(() => Number)
    public price: number;
}
```

Valida que `name` sea un string y `price` sea un número >= 0 con hasta 4 decimales.

### `dto/update-product.dto.ts`

```typescript
export class UpdateProductDto extends PartialType(CreateProductDto) {
    @IsNumber()
    @IsPositive()
    id: number;
}
```

Extiende `CreateProductDto` con `PartialType` (de `@nestjs/mapped-types`), haciendo que `name` y `price` sean opcionales, y agrega `id` como campo obligatorio.

### `entities/product.entity.ts`

Clase simple que define la forma del producto (`id`, `name`, `price`).

---

## Punto de Entrada (`main.ts`)

```typescript
const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: envs.natsServers,
      },
    }
);

app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
);
```

- Se crea como **microservicio** (no como app HTTP) con transporte **NATS**.
- Se conecta a los servidores NATS definidos en las variables de entorno.
- Se configura un `ValidationPipe` global:
  - `whitelist: true` — Remueve propiedades no definidas en el DTO.
  - `forbidNonWhitelisted: true` — Lanza error si se envían propiedades no permitidas.
  - `transform: true` — Transforma automáticamente los tipos de datos.

---

## Docker

### `dockerfile`

```dockerfile
FROM node:22-alpine3.19
WORKDIR /usr/src/app
COPY package.json ./
COPY package-lock.json ./
RUN npm install
COPY . .
EXPOSE 3001
```

Imagen basada en **Node.js 22 Alpine**. Expone el puerto `3001`.

---

## Instalación y Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env   # (o crear el .env manualmente)

# 3. Ejecutar migraciones y generar cliente Prisma
npx prisma migrate dev
npx prisma generate

# 4. Iniciar en modo desarrollo (ejecuta migraciones + watch mode)
npm run start:dev

# 5. Iniciar en producción
npm run build
npm run start:prod
```

### Scripts Disponibles

| Script | Comando | Descripción |
|--------|---------|-------------|
| `start` | `nest start` | Inicia el microservicio |
| `start:dev` | `prisma migrate dev && prisma generate && nest start --watch` | Migra BD + genera cliente + modo watch |
| `start:prod` | `node dist/main` | Ejecuta la versión compilada |
| `build` | `nest build` | Compila el proyecto |
| `docker:start` | `prisma migrate dev && prisma generate` | Prepara la BD (usado en Docker) |

---

## Patrones de Mensajes (NATS)

Este microservicio escucha los siguientes mensajes a través de NATS:

```
{ cmd: 'create_product' }      → Payload: { name: string, price: number }
{ cmd: 'find_all_products' }   → Payload: { page?: number, limit?: number }
{ cmd: 'find_one_product' }    → Payload: { id: number }
{ cmd: 'update_product' }      → Payload: { id: number, name?: string, price?: number }
{ cmd: 'delete_product' }      → Payload: { id: number }
{ cmd: 'validate_products' }   → Payload: number[]
```

Estos mensajes son enviados por el **Client Gateway** y/o por **Orders Microservice** para comunicarse con este servicio.
