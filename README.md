# raport-bot

Production-ready Telegram bot that walks the user through filling out an Uzbek
**Ариза** (legal application) template and returns a generated **DOCX** or **PDF**.

- **Stack:** Node.js 20 + TypeScript (strict), Telegraf, Prisma + SQLite,
  docxtemplater + pizzip, LibreOffice (headless) for DOCX→PDF, Zod for validation,
  Pino for logging.
- **Architecture:** clean, layered — `config → utils → repositories → services
  → bot/scenes → main`. Composition root is in `src/bot/index.ts`.

---

## Project layout

```
.
├── docker/
│   └── entrypoint.sh
├── prisma/
│   └── schema.prisma
├── scripts/
│   ├── create-sample-template.ts   # generates templates/ariza-alimony.docx
│   └── seed-templates.ts           # inserts Template rows into the DB
├── src/
│   ├── bot/                        # bot wiring, middleware, keyboards, commands
│   │   ├── commands.ts
│   │   ├── context.ts
│   │   ├── index.ts                # composition root
│   │   ├── keyboards.ts
│   │   └── middleware.ts
│   ├── config/
│   │   ├── env.ts                  # zod-validated process.env
│   │   └── index.ts
│   ├── repositories/               # Prisma data access
│   │   ├── document.repository.ts
│   │   ├── draft.repository.ts
│   │   ├── prisma.ts
│   │   ├── template.repository.ts
│   │   └── user.repository.ts
│   ├── scenes/
│   │   ├── ariza-wizard.scene.ts   # FSM for collecting data
│   │   └── index.ts
│   ├── services/                   # pure business logic
│   │   ├── docx.service.ts
│   │   ├── document.service.ts
│   │   ├── pdf.service.ts
│   │   └── template.service.ts
│   ├── types/
│   │   └── index.ts                # zod schemas + FSM types
│   ├── utils/
│   │   ├── errors.ts
│   │   ├── fs.ts
│   │   └── logger.ts
│   └── main.ts                     # entry point
├── templates/                      # generated DOCX templates live here
├── data/                           # SQLite DB (mounted volume in Docker)
├── generated/                      # rendered DOCX/PDF documents
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Quickstart (local)

### 1. Prerequisites
- Node.js 20+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- **LibreOffice** installed and on PATH (required for PDF):
  - Linux: `sudo apt install libreoffice` (the binary is `libreoffice` or `soffice`)
  - macOS: `brew install --cask libreoffice`
  - Windows: install from libreoffice.org, then set in `.env`:
    `LIBREOFFICE_BIN="C:\\Program Files\\LibreOffice\\program\\soffice.exe"`

### 2. Configure
```bash
cp .env.example .env
# edit BOT_TOKEN
```

### 3. Install + bootstrap
```bash
npm install
npm run bootstrap
```

`bootstrap` runs the full first-time setup:
1. `prisma generate`
2. `prisma db push` — syncs schema to `./data/raport.db` (no migrations folder required)
3. `template:sample` — programmatically writes `templates/ariza-alimony.docx`
4. `template:seed` — inserts the template into the DB

> If you want to use migration history instead, run `npm run prisma:migrate` to create
> `prisma/migrations/`, commit it, and switch `db push` for `migrate deploy` in
> `docker/entrypoint.sh`.

### 4. Run
```bash
npm run dev      # tsx watch
# or
npm run build && npm start
```

Open the bot in Telegram → `/start`.

---

## Quickstart (Docker)

```bash
cp .env.example .env   # set BOT_TOKEN
docker compose up -d --build
docker compose logs -f bot
```

The container installs LibreOffice automatically, runs migrations and template
seeding on first boot via `docker/entrypoint.sh`, then launches the bot.

Mounted volumes:
- `./data` → `/app/data` (SQLite DB)
- `./templates` → `/app/templates` (DOCX templates)
- `./generated` → `/app/generated` (rendered documents)

---

## Bot commands & UX

| Command   | Purpose                                          |
|-----------|--------------------------------------------------|
| `/start`  | Greeting + reply keyboard with main menu         |
| `/new`    | Start the Ariza wizard                           |
| `/mydocs` | Show user's last 10 generated documents          |
| `/help`   | Show command help                                |
| `/cancel` | Cancel the current draft and clear it from the DB|

Reply keyboard during wizard: **⬅️ Орқага**, **❌ Бекор қилиш**.
Inline keyboards are used for template selection, preview confirmation,
and DOCX/PDF format choice.

After **every** answered step the FSM state is serialized into JSON and
persisted in the `Draft` table, so the user can resume after a restart.

---

## Wizard data

Collected fields (validated with Zod — `src/types/index.ts`):

| Field               | Placeholder                       |
|---------------------|-----------------------------------|
| `plaintiff_name`    | `{{plaintiff_name}}`              |
| `plaintiff_address` | `{{plaintiff_address}}`           |
| `plaintiff_phone`   | `{{plaintiff_phone}}`             |
| `defendant_name`    | `{{defendant_name}}`              |
| `defendant_address` | `{{defendant_address}}`           |
| `defendant_phone`   | `{{defendant_phone}}`             |
| `marriage_date`     | `{{marriage_date}}`               |
| `marriage_place`    | `{{marriage_place}}`              |
| `reason`            | `{{reason}}`                      |
| `children` (array)  | loop / positional (see below)     |
| `alimony_amount`    | `{{alimony_amount}}`              |
| `court_name`        | `{{court_name}}`                  |
| `judge_name`        | `{{judge_name}}`                  |

### Children — three rendering options

In a template `.docx` you can use **any** of these:

1. **docxtemplater loop (recommended):**
   ```
   {{#children}}
   {{index}}. {{name}} — туғилган сана: {{birthdate}}
   {{/children}}
   ```

2. **Pre-rendered string** — `{{children_block}}` (multiline).

3. **Positional placeholders** — `{{child_name_1}}`, `{{child_birthdate_1}}`,
   `{{child_name_2}}`, ... — useful when the legal layout requires fixed slots.

All three are populated for the same payload (see `DocumentService.toRenderModel`).

---

## Templates

- Templates live in `./templates/*.docx`.
- They are registered in the DB via the `Template` table; `code` is unique
  and used as a stable identifier.
- The user picks a template at the start of the wizard. With a single active
  template the picker is skipped.

To add a new template:

1. Author a `.docx` in Word/LibreOffice with `{{ ... }}` placeholders.
2. Drop it into `./templates/your-template.docx`.
3. Add an entry to `scripts/seed-templates.ts`:
   ```ts
   { code: 'your-template', title: 'My title', filePath: path.resolve('./templates/your-template.docx') }
   ```
4. Run `npm run template:seed`.

---

## Example: sample template content

The auto-generated `templates/ariza-alimony.docx` (created by
`scripts/create-sample-template.ts`) contains the following text — exactly
matching the spec in this README's "Template example" section:

```
Фуқаролик ишлари бўйича {{court_name}} суди
раиси {{judge_name}} га

Даъвогар:
{{plaintiff_name}}
{{plaintiff_address}}
Телефон: {{plaintiff_phone}}

Жавобгар:
{{defendant_name}}
{{defendant_address}}
Телефон: {{defendant_phone}}

                       АРИЗА

Мен, {{plaintiff_name}}, {{defendant_name}} билан
{{marriage_date}} санасида {{marriage_place}} да никоҳдан ўтганман.

Никоҳдан кейин қуйидаги фарзандлар туғилди:
{{#children}}
{{index}}. {{name}} — туғилган сана: {{birthdate}}
{{/children}}

Даъво сабаби:
{{reason}}

Юқоридагилар асосида {{alimony_amount}} сўм миқдорида алимент
ундирилишини сўрайман.

                                      Даъвогар: {{plaintiff_name}} __________
                                      Сана: ____________
```

---

## Example: rendered output (after wizard)

Given inputs:

```text
plaintiff_name    = Алиев Алишер Бахтиёрович
plaintiff_address = Тошкент ш., Чилонзор тумани, 12-уй
plaintiff_phone   = +998 90 123 45 67
defendant_name    = Алиева Дилноза Рустамовна
defendant_address = Тошкент ш., Юнусобод тумани, 5-уй
defendant_phone   = +998 90 987 65 43
marriage_date     = 12.05.2015
marriage_place    = Тошкент ш. ФҲДЁ
reason            = Оилавий ҳаёт давом этмаслиги сабабли
children          = [{ Алиев Аброр, 03.07.2017 }, { Алиева Зилола, 21.11.2019 }]
alimony_amount    = 2 500 000
court_name        = Чилонзор тумани фуқаролик
judge_name        = Қодиров А.А.
```

the generated DOCX/PDF will read:

```
Фуқаролик ишлари бўйича Чилонзор тумани фуқаролик суди
раиси Қодиров А.А. га

Даъвогар:
Алиев Алишер Бахтиёрович
Тошкент ш., Чилонзор тумани, 12-уй
Телефон: +998 90 123 45 67

Жавобгар:
Алиева Дилноза Рустамовна
Тошкент ш., Юнусобод тумани, 5-уй
Телефон: +998 90 987 65 43

                       АРИЗА

Мен, Алиев Алишер Бахтиёрович, Алиева Дилноза Рустамовна билан
12.05.2015 санасида Тошкент ш. ФҲДЁ да никоҳдан ўтганман.

Никоҳдан кейин қуйидаги фарзандлар туғилди:
1. Алиев Аброр — туғилган сана: 03.07.2017
2. Алиева Зилола — туғилган сана: 21.11.2019

Даъво сабаби:
Оилавий ҳаёт давом этмаслиги сабабли

Юқоридагилар асосида 2 500 000 сўм миқдорида алимент
ундирилишини сўрайман.

                                      Даъвогар: Алиев Алишер Бахтиёрович __________
                                      Сана: ____________
```

The PDF version is byte-for-byte the same content, rendered by LibreOffice
from the freshly produced DOCX.

---

## NPM scripts

| Script             | What it does                                    |
|--------------------|-------------------------------------------------|
| `npm run dev`      | tsx watch — fast local dev                      |
| `npm run build`    | TypeScript build to `dist/`                     |
| `npm start`        | run compiled bot                                |
| `npm run typecheck`| strict typecheck without emit                   |
| `npm run prisma:generate` | Prisma client generation                 |
| `npm run prisma:push`     | Prisma `db push` (sync schema → DB)      |
| `npm run prisma:migrate`  | Prisma `migrate dev --name init`         |
| `npm run prisma:deploy`   | Prisma `migrate deploy` (prod)           |
| `npm run prisma:studio`   | Prisma Studio                            |
| `npm run template:sample` | regenerate sample DOCX template          |
| `npm run template:seed`   | register templates in DB                 |
| `npm run bootstrap`       | full first-time setup (all of the above) |

---

## Production checklist

- Strict TypeScript, no implicit `any`.
- Zod validates both env config and the final user-collected payload.
- Pino structured logs (pretty in dev, JSON in prod).
- Centralized error boundary middleware + `bot.catch` for safety.
- Repository layer abstracts Prisma so services stay framework-agnostic.
- Draft FSM state persisted after each input → resilient to restarts.
- Graceful shutdown on `SIGINT`/`SIGTERM`.
- Docker image uses Tini as PID 1 + apt-installed LibreOffice & Cyrillic fonts.
