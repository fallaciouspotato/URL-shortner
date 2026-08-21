# URL Shortener
 
A backend URL shortener API built with Node.js, Express, PostgreSQL, and Prisma. Generates short, random, collision-safe codes for long URLs and tracks click counts.
 
## Features
 
- Shorten long URLs into short, random codes
- Redirect from short code to original URL
- Per-link click tracking
- Collision-safe code generation under concurrent requests, enforced at the database level
## Tech stack
 
Node.js, Express, PostgreSQL, Prisma ORM
 
## How it works
 
### Short code generation
 
Short codes are generated using [`nanoid`](https://github.com/ai/nanoid), producing a random 7-character alphanumeric string (62-character alphabet: a-z, A-Z, 0-9) — roughly 3.5 trillion possible combinations.
 
Codes are **randomly generated, not derived from the database's auto-increment ID**. Encoding a sequential ID (e.g. base62 of `1, 2, 3...`) is easy to reverse-engineer or enumerate, effectively leaking how many links exist and letting anyone guess adjacent codes. Fully random generation avoids that.
 
### Handling collisions safely under concurrency
 
Since codes are random, two requests could theoretically generate the same code at nearly the same moment. Rather than a separate "reserved" flag column (which has its own check-then-set race window), this project relies on the database's own `UNIQUE` constraint on `short_code` as the single source of truth for uniqueness:
 
1. Generate a random code
2. Attempt to insert it
3. If the database rejects it as a duplicate (Prisma error `P2002`), regenerate and retry (up to 5 attempts)
4. If it succeeds, the code is guaranteed unique — the database enforced it atomically, so there's no race condition to reason about at the application level
## Database schema
 
```prisma
model Url {
  id         Int      @id @default(autoincrement())
  shortCode  String   @unique
  longUrl    String
  createdAt  DateTime @default(now())
  clicks     Int      @default(0)
}
```
 
## API reference
 
| Method | Endpoint | Description |
|---|---|---|
| POST | `/shorten` | Create a new short URL. Body: `{ "longUrl": "https://example.com" }` |
| GET | `/:shortCode` | Redirect to the original URL, increments click count |
| GET | `/:shortCode/stats` | Get click count and metadata for a short URL |
 
## Project structure
 
```
url-shortener/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/          # Prisma client singleton
│   ├── controllers/     # Request/response handling
│   ├── middleware/      # Error handler
│   ├── routes/          # Express route definitions
│   ├── services/        # Core business logic (DB queries live here)
│   └── utils/           # Short code generator
└── server.js             # Entry point
```
 
The project follows a layered architecture: **routes** map URLs to **controllers**, controllers handle HTTP concerns (request parsing, response shaping) and delegate actual logic to **services**, and services are the only layer that talks to the database (via the shared Prisma client). This keeps business logic testable and reusable independent of Express.
 
## Running locally
 
```bash
git clone <this-repo-url>
cd url-shortener
npm install
 
cp .env.example .env
# fill in your own DATABASE_URL
 
npx prisma migrate dev
npm run dev
```
 
## Environment variables
 
| Variable | Description |
|---|---|
| `PORT` | Port the server listens on |
| `DATABASE_URL` | PostgreSQL connection string |
| `BASE_URL` | Public base URL, used to construct short links in API responses |
 
## Design decisions worth noting
 
- **Random codes over encoded IDs** — trades a small amount of insert-time complexity (occasional retry) for not leaking sequence information.
- **DB constraint over app-level locking** — concurrency safety is enforced by PostgreSQL itself (`UNIQUE`), not by application-level flags, which removes an entire class of race conditions.
- **Layered architecture** (routes → controllers → services → DB) — keeps HTTP concerns separate from business logic, so the core logic isn't tied to Express and could be reused (CLI script, tests, etc.) without modification.
