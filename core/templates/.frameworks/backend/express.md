# Express — Scaffold Instructions

## Scaffold Location

Express has no official scaffold CLI. Create the structure manually inside `backend/`:

```bash
mkdir -p backend/src/routes
mkdir -p backend/src/middleware
mkdir -p backend/src/services
mkdir -p backend/src/types
touch backend/src/index.ts
touch backend/src/app.ts
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
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

## app.ts Template

```typescript
import express from 'express';
import cors from 'cors';

export const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));
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
