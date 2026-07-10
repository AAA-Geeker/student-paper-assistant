# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project overview

Student Paper Writing Assistant ("学生论文写作助手") — a full-stack web app (FastAPI + React) for academic paper writing, augmented with a Hermes (Claude Code skills + memory) orchestration layer.

## Architecture

```
Hermes (Claude Code) ←→ WorkBuddy Web App
  ├── Memory files (in ~/.claude/projects/D--WorkBuddy-student-paper-assistant/memory/)
  ├── Skills       (in .claude/skills/)
  └── API calls →  FastAPI backend → LLM providers
```

- **Hermes**: thinking/orchestration layer — understands the user, plans work, calls skills
- **Web app**: execution layer — editing, LLM calling, formatting, export

## Key files

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Full architecture design document |
| `.claude/skills/*.md` | 6 paper-writing skill definitions |
| `backend/app/services/ai.py` | LLM calls (multi-model) |
| `backend/app/services/model_router.py` | Model selection + cost optimization |
| `backend/app/services/context_manager.py` | Token-efficient context windowing |
| `backend/app/services/skill_executor.py` | Multi-step skill execution engine |
| `backend/app/routers/ai.py` | AI API endpoints (skills, chat, models) |
| `frontend/src/components/SkillPanel.tsx` | Skill selector + execution UI |

## Skills

| Skill | Use when |
|-------|----------|
| `paper-outline` | User needs a detailed paper outline |
| `paper-draft` | User wants to draft a section |
| `paper-revise` | User has advisor/reviewer feedback to address |
| `paper-polish` | User wants academic-style polishing |
| `paper-review` | User wants pre-submission quality review |
| `paper-defense` | User is preparing for thesis defense |

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # runs on :8000

# Frontend
cd frontend
npm install && npm run dev      # runs on :5173
```

## Memory system

Memory files live at `~/.claude/projects/D--WorkBuddy-student-paper-assistant/memory/`:
- `researcher-profile.md` — who the user is
- `paper-style-guide.md` — writing preferences
- `current-progress.md` — what they're working on now
- `advisor-feedback.md` — advisor feedback patterns
- `field-conventions.md` — NLP/CS field norms

Always read relevant memory files before executing a skill — they provide essential context about the user's situation, preferences, and current state.
