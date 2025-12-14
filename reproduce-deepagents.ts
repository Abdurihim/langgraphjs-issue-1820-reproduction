/**
 * Minimal reproduction for "Channel already exists with a different type" error
 *
 * Related issues:
 * - https://github.com/langchain-ai/langgraphjs/issues/1820
 * - https://github.com/langchain-ai/deepagentsjs/issues/75
 *
 * This script reproduces the error that occurs when using deepagents with
 * @langchain/langgraph@1.0.4. The error happens during agent creation when
 * the filesystem middleware is used in both main agent and subagents.
 */

import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import "dotenv/config";
import * as path from "path";

const systemPrompt = `You are a helpful coding assistant with access to a real filesystem.

You can directly read and write files in the workspace directory for persistent code tasks.

## Workflow

1. Read existing code files to understand the project structure
2. Create new files or edit existing ones as needed
3. Write implementation plans and documentation

## Important Notes

- All files you create will be written to the real filesystem
- Use the current workspace as your working directory
- You can use standard filesystem tools (ls, read_file, write_file, edit_file)
- Files will persist after the conversation ends`;

const workspaceDir = path.join(process.cwd(), "workspace");

console.log("=== Attempting to create DeepAgent ===");
console.log("This will fail with @langchain/langgraph@1.0.4");
console.log("Error: Channel \"files\" already exists with a different type.\n");

// This will throw an error with @langchain/langgraph@1.0.4
// The error occurs during createDeepAgent when subagents are initialized
try {
  const agent = createDeepAgent({
    model: new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY || "sk-test-key",
      model: "gpt-4o-mini",
      temperature: 0,
    }),
    systemPrompt,
    backend: new FilesystemBackend({
      rootDir: workspaceDir,
      virtualMode: true,
    }),
  });

  console.log("✅ Agent created successfully!");
  console.log("(This means the fix is working or you're using a patched version)");

  // Optionally test the agent (requires valid OpenAI API key)
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-test-key") {
    async function testAgent() {
      const uniqueThreadId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      console.log("\nThread ID:", uniqueThreadId);
      console.log("Workspace:", workspaceDir);
      console.log("\nStarting execution...\n");

      const res = await agent.invoke(
        {
          messages: [
            {
              role: "user",
              content: "Create a simple TypeScript utility function for email validation.",
            },
          ],
        },
        {
          recursionLimit: 50,
          configurable: { thread_id: uniqueThreadId },
        },
      );

      console.log("\n✅ Execution completed!", res);
    }

    testAgent();
  }
} catch (error: any) {
  console.error("\n❌ Error occurred during agent creation:");
  console.error("Message:", error.message);
  console.error("\nStack trace:");
  console.error(error.stack);
  console.error("\n");
  console.error("This is the expected error with @langchain/langgraph@1.0.4");
  console.error("The fix is available in PR: https://github.com/langchain-ai/langgraphjs/pull/1819");
}
