# Unit Flow by OnEasy

AI-powered unit economics model builder. Describe your business in plain English and get a complete 17-sheet Excel model with formulas, cross-sheet links, and cost optimization suggestions.

## Features

- **Conversational model building** -- describe your business in natural language; the AI extracts company details, fills gaps with follow-up questions, and generates a full financial model
- **Industry-enriched** -- Exa web search pulls real salary benchmarks, pricing data, and market rates into the model
- **18-sheet Excel export** -- fully formatted `.xlsx` with 2,395+ formulas, color-coded input/formula/link cells, and cross-sheet references
- **Live spreadsheet preview** -- browser-based sheet viewer updates in real time as the AI generates
- **Inline editing** -- click any cell (numbers, text, margins) to edit directly; changes propagate across linked sheets
- **Smart cost suggestions** -- 3-6 actionable optimization ideas with specific savings amounts, shown as interactive cards in chat
- **Scenario analysis** -- best / base / worst case modeling with revenue and cost multipliers
- **Conversation persistence** -- save, load, and resume sessions with full model state

## Sheets

| #   | Sheet                       | Description                                       |
| --- | --------------------------- | ------------------------------------------------- |
| 0   | Instructions & Guide        | How to use the model                              |
| 1   | HR Costs                    | Roles, departments, salaries, headcount           |
| 1.1 | Rate Card                   | Auto-derived hourly/daily rates from HR           |
| 2   | Marketing Costs             | Channels, budgets, funnel metrics, CAC            |
| 3   | Manufacturing Costs         | Products, cost elements (BOM), COGS               |
| 3A  | Geo Purchase Costs          | City-wise raw material / input costs              |
| 3B  | Geo Sale Prices             | City-wise selling prices per product              |
| 3C  | Geo Selector                | Monthly P&L per product per city                  |
| 3D  | Admin & Other Expenses      | Rent, utilities, insurance, office costs          |
| 3E  | Capital Expenses (CAPEX)    | Assets, depreciation, useful life                 |
| 3F  | Finance Costs               | Loans, EMI, interest rates, tenure                |
| 4   | Product Market Mix          | Full cost build-up with overhead allocation        |
| 5   | Customer LTV Analysis       | Simple LTV + 24-month DCF cohort                  |
| 6   | Target Profit Calculator    | Margin-first pricing, break-even                  |
| 7   | Cash Flow                   | Monthly cash flow projections                     |
| 8   | KPI Dashboard               | Key metrics summary                               |
| 9   | Scenario Analysis           | Best / base / worst case                          |
| 10  | Smart Suggestions           | AI cost optimization recommendations              |

## Tech Stack

| Layer       | Technology                                                  |
| ----------- | ----------------------------------------------------------- |
| Framework   | Next.js 16 (App Router)                                     |
| Frontend    | React, Tailwind CSS v4, Lucide icons, react-markdown        |
| Auth        | Clerk                                                       |
| AI          | Vercel AI SDK + OpenAI (GPT-4o) via AI Gateway              |
| Web Search  | Exa (industry benchmarks, market data)                      |
| Database    | PostgreSQL (Neon serverless) + Drizzle ORM                  |
| Excel       | ExcelJS (programmatic workbook generation)                  |
| Validation  | Zod v4 (structured AI output schemas)                       |

## AI Flow

```
User message
    |
    v
1. EXTRACT -- parse business details from free-form text (confidence 0-1)
    |
    v  (confidence < 0.7)
2. FILL_GAPS -- one consolidated follow-up question (max 3 sub-questions)
    |
    v
3. GENERATE -- Exa web research + full draft generation via generateObject()
    |
    v
4. CONFIRM_REVIEW -- user reviews, edits, or approves
    |
    v
5. COMPLETE -- download Excel, make further edits, or start new
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- API keys for: OpenAI (via Vercel AI Gateway), Clerk, Exa

### Setup

```bash
git clone https://github.com/Babblu9/unit-flow.git
cd unit-flow
npm install
```

Create `.env.local` with the following variables:

```env
# Vercel AI Gateway
AI_GATEWAY_API_KEY=
AI_GATEWAY_BASE_URL=
AI_GATEWAY_MODEL=

# Exa API (web research)
EXA_API_KEY=

# Neon PostgreSQL
DATABASE_URL=

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

Push the database schema:

```bash
npm run db:push
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
  app/
    api/
      agent-chat/          # Main AI conversation endpoint
      conversations/       # Save/load conversation sessions
      excel-download/      # Excel file generation & download
      excel-fill/          # Live Excel cell patching
      excels/              # Excel storage & retrieval
    page.js                # Single-page app (chat + sheet viewer)
  components/
    ChatPanel.js           # AI chat with suggestion cards
    SheetViewer.js         # Tabbed spreadsheet viewer (all 18 sheets)
    ConversationSidebar.js # Saved conversation history
    TemplateViewer.js      # Template-based Excel viewer
  context/
    UnitEconomicsContext.js  # Global model state + update callbacks
  lib/
    ai/
      prompts.js           # System prompts for each AI step
      schemas.js           # Zod schemas for structured output
    db/
      schema.js            # Drizzle ORM table definitions
    excel/
      templateBuilder.js   # 2,051-line Excel workbook generator
      cellMapper.js        # Maps AI draft to cell addresses
      formulaEngine.js     # Formula generation
    exa/
      search.js            # Exa web search for benchmarks
```

## License

Proprietary. All rights reserved.
