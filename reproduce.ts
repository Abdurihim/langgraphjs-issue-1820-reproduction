// Minimal reproduction for "Channel already exists with a different type" error
// Related to: https://github.com/langchain-ai/langgraphjs/issues/1820
// and: https://github.com/langchain-ai/deepagentsjs/issues/75

import { z } from "zod";
import { withLangGraph, schemaMetaRegistry } from "@langchain/langgraph/zod";
import { StateGraph, MessagesZodState } from "@langchain/langgraph";

// Simulate a file data schema similar to what deepagents uses
const FileDataSchema = z.object({
  content: z.array(z.string()),
  created_at: z.string(),
  modified_at: z.string(),
});

// Custom reducer for file data
function fileDataReducer(
  left: Record<string, any> | undefined,
  right: Record<string, any | null>,
): Record<string, any> {
  if (left === undefined) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(right)) {
      if (value !== null) result[key] = value;
    }
    return result;
  }
  const result = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (value === null) delete result[key];
    else result[key] = value;
  }
  return result;
}

// Create a FilesystemStateSchema with a custom reducer (module-level singleton)
const FilesystemStateSchema = z.object({
  files: withLangGraph(z.record(z.string(), FileDataSchema).default({}), {
    reducer: {
      fn: fileDataReducer,
      schema: z.record(z.string(), FileDataSchema.nullable()),
    },
  }),
});

console.log("=== Test 1: Check schema object references ===");
const shape1 = FilesystemStateSchema.shape;
const shape2 = FilesystemStateSchema.shape;
console.log("shape1 === shape2:", shape1 === shape2);
console.log("shape1.files === shape2.files:", shape1.files === shape2.files);

console.log("\n=== Test 2: Simulate createAgentAnnotationConditional ===");

function simulateCreateAgentAnnotation(middlewareSchemas: any[]) {
  const schemaShape: Record<string, any> = {};

  for (const schema of middlewareSchemas) {
    const shape = schema.shape;
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (!(key in schemaShape)) {
        schemaShape[key] = fieldSchema;
      }
    }
  }

  // Return extended schema
  return MessagesZodState.extend(schemaShape);
}

// Simulate main agent and subagent both using FilesystemMiddleware
const mainAgentSchema = simulateCreateAgentAnnotation([FilesystemStateSchema]);
const subAgentSchema = simulateCreateAgentAnnotation([FilesystemStateSchema]);

console.log("mainAgentSchema.shape.files === subAgentSchema.shape.files:",
  mainAgentSchema.shape.files === subAgentSchema.shape.files);

console.log("\n=== Test 3: Check if channels are cached ===");

// Get channels
const mainChannels = (schemaMetaRegistry as any).getChannelsForSchema(mainAgentSchema);
const subChannels = (schemaMetaRegistry as any).getChannelsForSchema(subAgentSchema);

console.log("mainChannels.files:", mainChannels.files);
console.log("subChannels.files:", subChannels.files);
console.log("mainChannels.files === subChannels.files:", mainChannels.files === subChannels.files);

console.log("\n=== Test 4: Create StateGraph with different state/input/output schemas ===");

try {
  // This simulates how langchain's createAgentAnnotationConditional works
  // It creates different state, input, output schema objects
  const stateSchema = MessagesZodState.extend({ files: FilesystemStateSchema.shape.files });
  const inputSchema = z.object({
    messages: MessagesZodState.shape.messages,
    files: FilesystemStateSchema.shape.files
  });
  const outputSchema = z.object({
    messages: MessagesZodState.shape.messages,
    files: FilesystemStateSchema.shape.files
  });

  console.log("stateSchema.shape.files === inputSchema.shape.files:",
    stateSchema.shape.files === inputSchema.shape.files);

  const workflow1 = new StateGraph({
    state: stateSchema,
    input: inputSchema,
    output: outputSchema,
  });
  console.log("✅ StateGraph created successfully");
} catch (error: any) {
  console.log("❌ Error:", error.message);
}

console.log("\n=== Test 5: Create StateGraph with same schema ===");

try {
  const singleSchema = MessagesZodState.extend({ files: FilesystemStateSchema.shape.files });

  console.log("MessagesZodState.shape.messages === singleSchema.shape.messages:",
    MessagesZodState.shape.messages === singleSchema.shape.messages);

  const workflow1 = new StateGraph({
    state: singleSchema,
    input: singleSchema,
    output: singleSchema,
  });
  console.log("✅ Single schema StateGraph created successfully");
} catch (error: any) {
  console.log("❌ Error:", error.message);
}
