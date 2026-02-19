# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Next.js dev server (Turbopack)
npm run build        # Build for production
npm run lint         # ESLint (flat config)
npm run remotion     # Open Remotion Studio
npm run render       # Render video via Remotion CLI
npm run deploy       # Deploy Lambda function + site to AWS
```

## Architecture

This is an AI-powered motion graphics generator that turns natural language prompts into Remotion video components. Built with Next.js 16 (App Router) + Remotion + OpenAI.

### Pipeline Flow

```
User Prompt → Validation (LLM classifier) → Skill Detection (LLM) → Code Generation (streaming) → Sanitization → Babel Compilation (in-browser) → Remotion Player Preview
```

### Key Layers

**API Route** (`src/app/api/generate/route.ts`): The core generation endpoint. Handles two modes:
- **Initial generation**: Streams code via `streamText()` from the AI SDK. Validates prompts first, detects applicable skills, then generates a full React/Remotion component.
- **Follow-up edits**: Uses `generateObject()` (non-streaming) with a structured schema. Returns either targeted search-replace edits or full code replacement. Has a self-healing loop for failed edits.

**Skills System** (`src/skills/`): Modular knowledge units injected into prompts based on content. Two types:
- *Guidance skills*: Markdown files with domain patterns (charts, typography, transitions, etc.)
- *Example skills*: Complete working code references from `src/examples/code/`
- Skills are loaded at build time via `raw-loader` (webpack) / Turbopack rules for `.md` files
- Skill detection runs a separate LLM call before code generation; previously-used skills are filtered to avoid redundant context

**In-Browser Compiler** (`src/remotion/compiler.ts`): Transforms LLM-generated code into runnable React components. Strips imports, extracts component body, transpiles with Babel standalone, and injects all Remotion/Three.js/React APIs via `new Function()` scope injection. The available API surface here determines what the LLM-generated code can use.

**Generate Page** (`src/app/generate/page.tsx`): Main workspace. Orchestrates chat sidebar, code editor (Monaco), and Remotion Player. Manages streaming state, conversation history, manual edit tracking, and auto-correction (retries compilation/runtime errors up to 3 times).

### Path Aliases

`@/*` maps to `./src/*` (configured in tsconfig.json).

### Environment Variables

- `OPENAI_API_KEY` — Required for code generation
- `REMOTION_AWS_ACCESS_KEY_ID` / `REMOTION_AWS_SECRET_ACCESS_KEY` — Optional, for Lambda rendering

### Remotion Integration

- `src/remotion/` contains Remotion-specific files (composition root, dynamic component, webpack override)
- ESLint uses Remotion plugin rules only within `src/remotion/` and disables Next.js rules there
- `remotion.config.ts` is excluded from the main tsconfig
- Lambda deployment config lives in `config.mjs` (region, RAM, disk, timeout)

### Styling

Tailwind CSS v4 with `@tailwindcss/postcss`. UI components use shadcn/ui pattern (`src/components/ui/`) with `class-variance-authority` and `tailwind-merge`. Generated Remotion components use inline styles only (no Tailwind in generated code).
