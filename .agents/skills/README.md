# Agent Skills Manual

Skills are an open standard for extending agent capabilities. A skill is a folder containing a SKILL.md file with instructions that the agent can follow when working on specific tasks.

## Rule for Creation in App_AlonCar
**Skills must be drafted and polished in Spanish with the user first. Once approved, the final `SKILL.md` must be written exclusively in English to maximize LLM logical reasoning and performance.**

## What are skills?
Skills are reusable packages of knowledge that extend what the agent can do. Each skill contains:
- Instructions for how to approach a specific type of task
- Best practices and conventions to follow
- Optional scripts and resources the agent can use

When you start a conversation, the agent sees a list of available skills with their names and descriptions. If a skill looks relevant to your task, the agent reads the full instructions and follows them.

## Where skills live
Antigravity supports two types of skills:
- `<workspace-root>/.agents/skills/<skill-folder>/` (Workspace-specific)
- `~/.gemini/config/skills/<skill-folder>/` (Global)

Workspace skills are great for project-specific workflows, like your team's deployment process or testing conventions.

## Creating a skill
To create a skill:
1. Create a folder for your skill in `.agents/skills/`
2. Add a `SKILL.md` file inside that folder

```yaml
---
name: my-skill
description: Helps with a specific task. Use when you need to do X or Y.
---
```

# My Skill
Detailed instructions for the agent go here.

## How the agent uses skills
Skills follow a progressive disclosure pattern:
- **Discovery**: When a conversation starts, the agent sees a list of available skills with their names and descriptions.
- **Activation**: If a skill looks relevant to your task, the agent reads the full `SKILL.md` content.
- **Execution**: The agent follows the skill's instructions while working on your task.

## Best practices
- Keep skills focused: Do one thing well.
- Write clear descriptions: Third person, clear keywords.
- Include decision trees for complex skills.
