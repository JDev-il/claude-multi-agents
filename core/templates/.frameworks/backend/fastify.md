# Fastify — Scaffold Instructions

## Scaffold Location

Fastify has no official scaffold CLI. Create the structure manually inside `backend/`:

```bash
mkdir -p backend/src/routes
mkdir -p backend/src/plugins
mkdir -p backend/src/schemas
mkdir -p backend/src/services
mkdir -p backend/src/types
touch backend/src/app.ts
touch backend/src/index.ts
```

## package.json

```json
{
  "name": "backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "fastify": "^4.0.0",
    "@fastify/cors": "^8.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

## app.ts Template

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';

export const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
});

app.get('/health', async () => ({ status: 'ok' }));
```

## Post-Scaffold

```bash
cd backend && npm install
```

## Update .scaffold/.paths.json

```json
{
  "backend": {
    "typesDir": {
      "expected": "backend/src/types",
      "current": "backend/src/types",
      "status": "verified"
    }
  }
}
```
