# Nyx - Monorepo

Monorepo do MVP de avaliação de carreira da Nyx. Contém API (Express/Prisma/Postgres) e front-end (React/Vite).

## Stack e estrutura
- **Workspace:** pnpm monorepo (`pnpm@9`)
- **API:** Node 20, Express, Prisma/Postgres
- **Web:** React 19 + Vite 6
- **AI:** Google Gemini (sugestão de metas)
- **Docker:** `docker-compose.yml` com Postgres + serviços `api` e `web`

Estrutura principal:
- `apps/api`: API, schema Prisma, seeds
- `apps/web`: front-end
- `docker/*`: Dockerfiles da API e Web

## Pré-requisitos
- Node 20 + pnpm 9 (corepack habilitado)
- Docker + Docker Compose (para subir DB/API/Web juntos)

## Execução rápida (Docker)
```bash
docker compose up -d
```
- DB (Postgres) sobe e expõe `5432`.
- API sobe em `http://localhost:4000` usando env de `apps/api/.env.example`.
- Web sobe em `http://localhost:3000` apontando para a API.

> Observação: as migrações/seed não são rodadas automaticamente. Após o `compose`, execute as migrações e seed (ver seção Banco & Prisma).

## Execução local (sem Docker)
Instale dependências:
```bash
pnpm install
```

API:
```bash
cd apps/api
cp .env.example .env    # se ainda não tiver configurado
pnpm prisma:generate
pnpm dev
```

Web:
```bash
cd apps/web
pnpm dev
```

## Banco & Prisma
- Schema: `apps/api/prisma/schema.prisma`
- Migrações: `apps/api/prisma/migrations/*`
- Seed: `apps/api/prisma/seed.ts` (cria ADMIN padrão, um MANAGER e um USER de exemplo, goals default, review e notificações)

Comandos (rodar em `apps/api`):
```bash
pnpm prisma:generate
pnpm prisma:migrate      # ambiente local (dev)
pnpm prisma:deploy       # produção/CI
pnpm seed                # popula admin padrão
```

## Variáveis de ambiente
API (`apps/api/.env` ou `.env.example`):
```
PORT=4000                  # fallback interno: 3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000   # fallback interno: http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nyxdb?schema=public
JWT_ACCESS_SECRET=dev-access-secret
JWT_REFRESH_SECRET=dev-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
RESEND_API_KEY=...
RESEND_FROM_EMAIL=no-reply@...
```

Web (`apps/web/.env`):
```
VITE_API_URL=http://localhost:4000
GEMINI_API_KEY=PLACEHOLDER_API_KEY
```

Notas:
- O front tenta ler `window.__ENV__.VITE_API_URL` (runtime) antes do `import.meta.env`.
- Cookies de refresh são HttpOnly (nome `nyx_refresh`) e usam `SameSite=lax` em dev e `none` em produção.

## Seed e credenciais padrão
O seed cria:
- ADMIN: `admin@nyx.local` / `admin123`
- MANAGER: `manager@nyx.local` / `manager123`
- USER: `elizabeth@nyx.local` / `user123`
- Goals default, uma review e notificações iniciais

## Endpoints existentes
- `GET /health` — status básico da API.

Auth:
- `POST /auth/login` — email/senha → access + refresh (session gravada, rate-limit 5 tentativas/15min por IP+email).
- `POST /auth/refresh` — rotaciona refresh (revoga o anterior).
- `POST /auth/logout` — revoga refresh (cookie e session).
- `POST /auth/register` — cria funcionário (somente ADMIN; requer Bearer token). Para não-admin, `managerId` é obrigatório.

Goals:
- `POST /goals` — cria goal (ADMIN; MANAGER apenas subordinados). Campos: `title`, `description?`, `type`, `role?`, `points`, `dependsOnId?`, `assignedToId`, `status?`, `progress?`, `deadline?`, `subtasks?`, `dependencies?`, `category?`, `reviewPeriod?`, `isPromotionBlocker?`.
- `GET /goals` — lista/paginação. ADMIN vê todos; MANAGER vê subordinados (ou filtro `assignedToId` subordinado); USER só os próprios. Filtros: `type`, `role`, `status`, `assignedToId`, `page`, `limit`.
- `PATCH /goals/:id` — atualiza goal (ADMIN; MANAGER apenas subordinados). Permite atualizar campos e status (ajusta `doneAt`).
- `POST /goals/:id/complete` — marca como feito/não-feito (`{ done: boolean }`). USER só se responsável; MANAGER apenas subordinados; ADMIN livre. USER não pode completar `MONTHLY`. Se houver dependência, precisa estar `DONE`.
- `DELETE /goals/:id` — remove goal (ADMIN; MANAGER apenas subordinados).

Reviews:
- `POST /reviews` — cria review (ADMIN; MANAGER somente para subordinados). Requer `revieweeId` e pelo menos `summary` ou `managerFeedback`. Campos extras: `comments?`, `score?`, `goalIds?`, `month?`, `completedTaskIds?`, `roleGoalProgress?`, `monthlyTaskCategoryDistribution?`. Gera notificação e envia email.
- `GET /reviews` — lista/paginação. ADMIN vê todos; MANAGER vê subordinados (e opcionalmente `reviewerId` se for ele mesmo); USER só onde é `reviewee`. Param `userId` funciona como alias de `revieweeId`. Inclui `goals` do review.
- `GET /reviews/summary` — contagem de reviews recebidos/dados (respeita escopo de permissão).
- `POST /reviews/:id/export` — gera HTML em `tmp/exports` e retorna `{ exportPath }` (ainda envia email stub interno com o caminho).
- `POST /reviews/email` — envia email com PDF anexado (base64) via Resend.

Notifications:
- `GET /notifications?unread=true|false` — lista do usuário autenticado (filtro unread opcional).
- `POST /notifications/:id/read` — marca como lida (somente dono).

Users:
- `GET /users/me` — perfil autenticado + contadores de reviews e agregados de goals (status/tipo/pontos).
- `GET /users/:id` — perfil + stats. ADMIN qualquer; MANAGER apenas subordinados; USER apenas o próprio.
- `GET /users` — paginação/filters (`search`, `role`, `isActive`, `managerId`). ADMIN vê todos; MANAGER só subordinados.
- `PATCH /users/:id/password` — ADMIN altera senha.
- `PATCH /users/:id` — ADMIN altera `role`, `managerId`, `isActive`, `name`, `email`, `department`, `roleTemplateId`, `progressHistory`.

Team:
- `GET /team` — hierarquia com contadores (goals pending/done, reviews given/received). ADMIN vê todos; MANAGER vê seu time; USER 403.

Templates:
- `GET /templates` — templates de carreira para geração de metas (usado pelo front).

## Emails (Resend)
- Integração em `apps/api/src/utils/email.ts`. Se `RESEND_API_KEY` e `RESEND_FROM_EMAIL` não estiverem setados, o envio vira stub e apenas loga no console.
- `POST /reviews/email` envia PDFs como anexo (`application/pdf`) a partir de `contentBase64`.
- **Estado atual de testes:** os destinatários estão fixos para `paulo.jose.n@outlook.com` e `paulo.j.nneto97@gmail.com` em `apps/api/src/routes/reviews/create.ts` e `apps/api/src/routes/reviews/email.ts`.

## Formato UI (mapeamento)
Para compatibilizar com o modelo do front, a API **sempre** responde no formato “UI”.

### O que é traduzido (responses)
- `user.role`: `ADMIN|MANAGER|USER` → `admin|manager|employee`
- `goal.type`: `BASIC|MONTHLY` → `Monthly Task`, `ROLE` → `Role Goal`
- `goal.status`: `PENDING` → `Not Started`, `DONE` → `Completed`
- `goal.role` (quando presente): mesmo mapeamento de `user.role`
- `/users/me` e `/users/:id` (`stats.goals.byStatus`, `stats.goals.byType`): chaves traduzidas para os rótulos UI
- `notification` (list/mark-read): campos adicionais `read` (booleano a partir de `readAt`) e `timestamp` (ISO de `createdAt`)
- `review` (list/create): retorna shape compatível com o front (`month`, `managerFeedback`, `completedTaskIds`, `roleGoalProgress`, `monthlyTaskCategoryDistribution`)

### O que é aceito (requests)
Em requests que recebem enums, a API aceita **tanto** valores internos **quanto** rótulos UI:
- `role`: `ADMIN|MANAGER|USER` **ou** `admin|manager|employee`
- `type`: `BASIC|MONTHLY|ROLE` **ou** `Monthly Task|Role Goal`
- `status`: `PENDING|DONE` **ou** `Not Started|In Progress|On Track|At Risk|Completed`

> Observação: os valores UI que não mapeiam para `DONE` são tratados como `PENDING`.

### Campos adicionais para manter o layout do front
Alguns campos usados no UI não existiam no schema original. Eles são persistidos assim:
- `User.department` (string), `User.roleTemplateId` (int), `User.progressHistory` (json)
- `Goal.meta` (json): `progress`, `deadline`, `subtasks`, `dependencies`, `category`, `reviewPeriod`, `isPromotionBlocker`, `uiStatus`
- `Review.meta` (json): `month`, `managerFeedback`, `completedTaskIds`, `roleGoalProgress`, `monthlyTaskCategoryDistribution`

Os endpoints incluem esses campos no `user` e nos `goals` retornados.

## Fluxo de auth (exemplo)
- Login:
  ```bash
  curl -X POST http://localhost:4000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@nyx.local","password":"admin123"}'
  ```
  → retorna `accessToken`, `refreshExpiresAt`, `user` e seta cookie HttpOnly `nyx_refresh`.
- Refresh:
  ```bash
  curl -X POST http://localhost:4000/auth/refresh
  ```
  → retorna novo `accessToken` e invalida o refresh anterior (cookie HttpOnly é rotacionado).
- Logout:
  ```bash
  curl -X POST http://localhost:4000/auth/logout
  ```
- Criar funcionário (ADMIN):
  ```bash
  curl -X POST http://localhost:4000/auth/register \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <accessToken>" \
    -d '{"email":"user@nyx.local","name":"User","password":"pass123","role":"USER","managerId":"<managerId>"}'
  ```

## Testes (API)
- Stack: Vitest + Supertest + Prisma mock (não precisa de DB real).
- Rodar (na raiz do repo já com deps instaladas): `pnpm --filter @nyx/api test`
- Config: `apps/api/vitest.config.ts`; testes em `apps/api/tests/**` (cobrem auth, users, goals, reviews, notifications).

## Notas rápidas
- Após atualizar schema Prisma, rode `pnpm prisma:generate` (e `pnpm prisma:migrate` se estiver em dev) para refletir mudanças.
- Em produção, use `pnpm prisma:deploy` e `pnpm seed` em `apps/api` para aplicar migrações e popular dados.
