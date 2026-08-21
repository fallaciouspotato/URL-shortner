# URL Shortener

A full-stack URL shortener with user authentication and a personal link dashboard, built with Node.js, Express, PostgreSQL (via Prisma), and React.

**Live demo:** _add your deployed link here once it's live_

## Features

- Shorten long URLs into short, random, collision-safe codes
- User accounts — register/login with hashed passwords
- Personal dashboard — see all links you've created, with click counts
- Click tracking per link
- Auth-protected routes — link creation and the dashboard require login

## Tech stack

**Backend:** Node.js, Express, PostgreSQL, Prisma ORM, bcrypt, JSON Web Tokens
**Frontend:** React
**Deployment:** Render (API), Neon (database)

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

### Authentication

- Passwords are hashed with `bcrypt` before storage — the plain password is never persisted, only a one-way hash.
- On login, a JSON Web Token is issued and stored in an `httpOnly` cookie (inaccessible to client-side JavaScript, reducing XSS token-theft risk).
- Protected routes use middleware that verifies the JWT before allowing access to a user's links.

## Database schema

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String   // bcrypt hash, never plaintext
  createdAt DateTime @default(now())
  urls      Url[]
}

model Url {
  id         Int      @id @default(autoincrement())
  shortCode  String   @unique
  longUrl    String
  createdAt  DateTime @default(now())
  clicks     Int      @default(0)
  userId     Int
  user       User     @relation(fields: [userId], references: [id])
}
```

Each `Url` belongs to exactly one `User` via the `userId` foreign key. A `User` can own many `Url`s.

## API reference

| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create a new account |
| POST | `/auth/login` | No | Log in, receive session cookie |
| POST | `/shorten` | Yes | Create a new short URL |
| GET | `/my-urls` | Yes | List the logged-in user's URLs |
| GET | `/:shortCode` | No | Redirect to the original URL, increments click count |
| GET | `/:shortCode/stats` | No | Get click count and metadata for a short URL |

## Project structure

```
url-shortener/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/          # Prisma client singleton
│   ├── controllers/     # Request/response handling
│   ├── middleware/      # Auth guard, error handler
│   ├── routes/          # Express route definitions
│   ├── services/        # Core business logic (DB queries live here)
│   └── utils/           # Short code generator, password/JWT helpers
├── client/               # React frontend (dashboard, login/register)
└── server.js             # Entry point
```

The project follows a layered architecture: **routes** map URLs to **controllers**, controllers handle HTTP concerns (request parsing, response shaping) and delegate actual logic to **services**, and services are the only layer that talks to the database (via the shared Prisma client). This keeps business logic testable and reusable independent of Express.

## Running locally

```bash
git clone <this-repo-url>
cd url-shortener
npm install

cp .env.example .env
# fill in your own DATABASE_URL, JWT_SECRET, etc.

npx prisma migrate dev
npm run dev
```

The frontend (in `/client`) is a separate app — see `client/README.md` for its own setup.

## Environment variables

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign/verify auth tokens |
| `BASE_URL` | Public base URL, used to construct short links in API responses |

## Design decisions worth noting

- **Random codes over encoded IDs** — trades a small amount of insert-time complexity (occasional retry) for not leaking sequence information.
- **DB constraint over app-level locking** — concurrency safety is enforced by PostgreSQL itself (`UNIQUE`), not by application-level flags, which removes an entire class of race conditions.
- **httpOnly JWT cookie over localStorage token** — prevents the token from being readable/stealable by injected client-side JavaScript (XSS).
- **Layered architecture** (routes → controllers → services → DB) — keeps HTTP concerns separate from business logic, so the core logic isn't tied to Express and could be reused (CLI script, tests, etc.) without modification.
