# Ruby on Rails — Scaffold Instructions

## Scaffold Location

Use the Rails CLI from the project root:

```bash
rails new backend --api --database=postgresql
```

Flags:
- `--api` strips views, uses API-only middleware stack
- `--database` set to your chosen DB: postgresql, mysql, sqlite3

## Key Directory Structure

```
backend/
  app/
    controllers/
      api/
        v1/
    models/
    serializers/
    services/
  config/
    routes.rb
  db/
    migrate/
    schema.rb
  spec/
    requests/
    models/
```

## Gemfile (key dependencies)

```ruby
gem 'rails', '~> 7.2'
gem 'pg', '~> 1.5'
gem 'puma', '>= 5.0'
gem 'rack-cors'
gem 'devise'
gem 'jwt'

group :development, :test do
  gem 'rspec-rails'
  gem 'factory_bot_rails'
end
```

## config/routes.rb Template

```ruby
Rails.application.routes.draw do
  get '/health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

  namespace :api do
    namespace :v1 do
      # define resources here
    end
  end
end
```

## Post-Scaffold

```bash
cd backend
bundle install
rails db:create
rails db:migrate
```

## Update .scaffold/.paths.json

```json
{
  "backend": {
    "modelsDir": { "expected": "backend/app/models", "current": "backend/app/models", "status": "verified" },
    "schemasDir": { "expected": "backend/app/serializers", "current": "backend/app/serializers", "status": "verified" }
  }
}
```
