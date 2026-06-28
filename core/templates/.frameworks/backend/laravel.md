# Laravel — Scaffold Instructions

## Scaffold Location

Use the Laravel installer inside the project root:

```bash
composer create-project laravel/laravel backend
```

## Key Directory Structure

```
backend/
  app/
    Http/
      Controllers/
      Middleware/
    Models/
    Services/
  routes/
    api.php
    web.php
  database/
    migrations/
    seeders/
  config/
  tests/
```

## composer.json (key dependencies)

```json
{
  "require": {
    "php": "^8.2",
    "laravel/framework": "^11.0",
    "laravel/sanctum": "^4.0"
  },
  "require-dev": {
    "phpunit/phpunit": "^11.0"
  }
}
```

## routes/api.php Template

```php
<?php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn() => response()->json(['status' => 'ok']));

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn(Request $request) => $request->user());
});
```

## Post-Scaffold

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
```

## Update .scaffold/.paths.json

```json
{
  "backend": {
    "routesDir": { "expected": "backend/routes", "current": "backend/routes", "status": "verified" },
    "modelsDir": { "expected": "backend/app/Models", "current": "backend/app/Models", "status": "verified" }
  }
}
```
