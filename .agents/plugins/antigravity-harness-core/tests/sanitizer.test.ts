import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { sanitizeToolArgs } from "../src/sanitizer";

describe("Harness³ Sanitizer (In-Flight Overwrite)", () => {
  const workspaceRoot = process.cwd().replace(/\\/g, "/");

  test("1. Returns sanitized: false for clean inputs", () => {
    const res = sanitizeToolArgs("view_file", {
      AbsolutePath: `${workspaceRoot}/package.json`,
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(false);
    expect(res.overwrittenArgs).toEqual({});
  });

  test("2. Normalizes duplicate slashes and backslashes in paths", () => {
    const messyPath = `${workspaceRoot}/sub\\\\dir///file.txt`;
    const res = sanitizeToolArgs("view_file", {
      AbsolutePath: messyPath,
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(true);
    expect(res.overwrittenArgs.AbsolutePath).toBe(`${workspaceRoot}/sub/dir/file.txt`);
  });

  test("3. Strips quotes wrapped around path arguments", () => {
    const res = sanitizeToolArgs("write_to_file", {
      TargetFile: `"${workspaceRoot}/file.txt"`,
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(true);
    expect(res.overwrittenArgs.TargetFile).toBe(`${workspaceRoot}/file.txt`);
  });

  test("4. Converts relative path to absolute path using workspace root", () => {
    const res = sanitizeToolArgs("view_file", {
      AbsolutePath: "src/features/resource/resource.ts",
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(true);
    expect(res.overwrittenArgs.AbsolutePath).toBe(`${workspaceRoot}/src/features/resource/resource.ts`);
    expect(res.overwrittenArgs.AbsolutePath).toMatch(/^(?:[a-zA-Z]:\/|\/)/);
  });

  test("5. Sanitizes CommandLine on Windows (python3 -> python)", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });

    const res = sanitizeToolArgs("run_command", {
      CommandLine: "python3 scripts/test.py --verbose ",
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(true);
    expect(res.overwrittenArgs.CommandLine).toBe("python scripts/test.py --verbose");

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  test("6. Only returns modified keys in overwrittenArgs", () => {
    const res = sanitizeToolArgs("replace_file_content", {
      TargetFile: "package.json",
      Instruction: "Do something",
      StartLine: 1,
      EndLine: 10,
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(true);
    expect(res.overwrittenArgs).toHaveProperty("TargetFile");
    expect(res.overwrittenArgs).not.toHaveProperty("Instruction");
    expect(res.overwrittenArgs).not.toHaveProperty("StartLine");
  });

  test("7. Strips file:/// protocol URI prefix without path corruption", () => {
    const isWindows = /^[a-zA-Z]:/i.test(workspaceRoot);
    const fileUri = isWindows
      ? `file:///${workspaceRoot}/file.txt`
      : `file://${workspaceRoot}/file.txt`;
    const res = sanitizeToolArgs("view_file", {
      AbsolutePath: fileUri,
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(true);
    expect(res.overwrittenArgs.AbsolutePath).toBe(`${workspaceRoot}/file.txt`);
  });

  test("8. Sanitizes nested paths inside Arguments object for call_mcp_tool", () => {
    const res = sanitizeToolArgs("call_mcp_tool", {
      ServerName: "fs",
      ToolName: "read_file",
      Arguments: {
        path: "src/index.ts",
      },
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(true);
    expect(res.overwrittenArgs.Arguments.path).toBe(`${workspaceRoot}/src/index.ts`);
  });

  test("9. Sanitizes Target in ask_permission when Action is read_file or write_file", () => {
    const res = sanitizeToolArgs("ask_permission", {
      Action: "read_file",
      Target: "src/features/resource/resource.ts",
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(true);
    expect(res.overwrittenArgs.Target).toBe(`${workspaceRoot}/src/features/resource/resource.ts`);
  });

  test("10. Resolves relative path without corruption when baseWorkspace has drive format on non-Windows", () => {
    const originalPlatform = process.platform;
    try {
      Object.defineProperty(process, "platform", { value: "linux" });
      const mockWindowsWorkspace = "C:/mock/workspace/project";
      const res = sanitizeToolArgs("view_file", {
        AbsolutePath: "./src/features/resource/resource.ts",
      }, [mockWindowsWorkspace]);

      expect(res.sanitized).toBe(true);
      expect(res.overwrittenArgs.AbsolutePath).toBe("C:/mock/workspace/project/src/features/resource/resource.ts");
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    }
  });

  test("11. Normalizes duplicate slashes immediately following drive letters", () => {
    const res = sanitizeToolArgs("view_file", {
      AbsolutePath: "C://folder//subfolder///file.txt",
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(true);
    expect(res.overwrittenArgs.AbsolutePath).toBe("C:/folder/subfolder/file.txt");
  });

  test("12. Does not rewrite MCP arguments that merely contain 'file' or 'path' in their name", () => {
    const res = sanitizeToolArgs("call_mcp_tool", {
      ServerName: "api",
      ToolName: "lookup",
      Arguments: { profile: "admin", pathname: "/api/users", file_type: "ts", filePattern: "*.ts" },
    }, [workspaceRoot]);

    expect(res.sanitized).toBe(false);
  });

  test("13. Leaves URLs untouched", () => {
    const res = sanitizeToolArgs("read_url_content", { path: "https://example.com/docs//guide" }, [workspaceRoot]);
    expect(res.sanitized).toBe(false);
  });

  test("14. Preserves UNC network paths", () => {
    const res = sanitizeToolArgs("view_file", { AbsolutePath: "\\\\server\\share\\file.txt" }, [workspaceRoot]);
    expect(res.overwrittenArgs.AbsolutePath).toBe("//server/share/file.txt");
  });

  test("15. Expands the home directory instead of nesting it inside the workspace", () => {
    const res = sanitizeToolArgs("view_file", { AbsolutePath: "~/notes.txt" }, [workspaceRoot]);
    expect(res.overwrittenArgs.AbsolutePath).toBe(`${homedir().replace(/\\/g, "/")}/notes.txt`);
  });

  test("16. Decodes percent-encoded file URIs", () => {
    const res = sanitizeToolArgs("view_file", { AbsolutePath: "file:///C:/My%20Project/a.txt" }, [workspaceRoot]);
    expect(res.overwrittenArgs.AbsolutePath).toBe("C:/My Project/a.txt");
  });

  test("17. Covers the 'Path' argument used by read_file in agy", () => {
    const res = sanitizeToolArgs("read_file", { Path: "src/index.ts" }, [workspaceRoot]);
    expect(res.overwrittenArgs.Path).toBe(`${workspaceRoot}/src/index.ts`);
  });
});
