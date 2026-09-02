# StartupForge — Server

Backend API for **StartupForge**, a platform where startup founders publish startup ideas, build teams, and recruit collaborators.

## Tech Stack

- Node.js, Express.js
- MongoDB (native driver, Stable API v1)
- JWT Auth (Better Auth JWKS verification)
- Stripe Checkout

## Live Links

- **Client:** [https://startupforge-client-mauve.vercel.app/]


## Environment Variables

```
PORT=5000
MONGODB_URL=your_mongodb_connection_string
BETTER_AUTH_URL=your_better_auth_base_url
```

## Getting Started

```bash
npm install
npm run dev
```

## Key Features

- Role-based access (Founder / Collaborator / Admin)
- Startup & opportunity CRUD
- Search & filter opportunities ($regex, $in)
- Server-side pagination
- Stripe premium subscription
- Admin: manage users, approve startups, view transactions