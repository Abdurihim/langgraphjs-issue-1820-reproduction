# Minimal Reproduction for LangGraphJS Issue #1820

This repository contains minimal reproductions for the bug reported in:
- https://github.com/langchain-ai/langgraphjs/issues/1820
- https://github.com/langchain-ai/deepagentsjs/issues/75

## The Bug

When using `deepagents` (or any library that uses middleware with custom state schemas), the following error occurs during agent creation:

```
Error: Channel "files" already exists with a different type.
    at StateGraph._addSchema
    at new StateGraph
    at new ReactAgent
```

## Root Cause

`SchemaMetaRegistry.getChannelsForSchema()` creates new channel instances every time it's called. Since `StateGraph._addSchema()` uses identity comparison (`!==`) to check for channel conflicts, different instances of the same channel type incorrectly trigger the error.

This happens when:
1. Main agent uses filesystem middleware (adds `files` channel)
2. Subagent also uses filesystem middleware (adds same `files` channel)
3. Both use the same field schema but `getChannelsForSchema` creates different channel instances
4. StateGraph rejects the second instance as a "different type"

## Two Reproduction Methods

### Method 1: Using deepagents (Real-world scenario)

This reproduces the exact error users encounter with deepagents.

1. Copy `.env.example` to `.env` and add your OpenAI API key:
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

2. Install dependencies:
```bash
npm install
```

3. Run the deepagents reproduction:
```bash
npm run reproduce-deepagents
```

**Expected error with @langchain/langgraph@1.0.4:**
```
Error: Channel "files" already exists with a different type.
    at StateGraph._addSchema (/node_modules/@langchain/langgraph/src/graph/state.ts:516:19)
    at new StateGraph (/node_modules/@langchain/langgraph/src/graph/state.ts:460:10)
    at new ReactAgent (/node_modules/langchain/src/agents/ReactAgent.ts:205:22)
    at createAgent (/node_modules/langchain/src/agents/index.ts:418:10)
```

### Method 2: Standalone reproduction (No API key needed)

This is a pure unit test that demonstrates the bug without requiring external APIs.

```bash
npm run reproduce-bug
```

**Expected output with bug:**
```
❌ Error: Channel "messages" already exists with a different type.
```

**Expected output with fix:**
```
✅ StateGraph created successfully
```

## Environment

- `@langchain/langgraph`: 1.0.4 (contains the bug)
- `deepagents`: 1.3.1
- `langchain`: 1.2.0
- `zod`: 3.24.1
- Node.js: 20.x

## The Fix

The fix for this issue is submitted in: https://github.com/langchain-ai/langgraphjs/pull/1819

The fix adds channel instance caching to ensure the same field schema always returns the same channel instance.
