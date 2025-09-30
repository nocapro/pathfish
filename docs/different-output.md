The two outputs are **not different in content** – they’re just **formatted differently**:

- When you run `bun tsc -b`, TypeScript prints **full error messages** with line numbers, column numbers, and sometimes snippets of code.
- When you redirect output with `> docs/output.txt 2>&1`, **stdout and stderr** are captured, but **TypeScript detects it’s not running in a TTY** (interactive terminal), so it **switches to a more compact format** – no colors, no code snippets, just the file and error code.

---

### ✅ How to make the output **exactly the same** in the file?

Force TypeScript to use **pretty formatting** even when redirected:

```bash
bun tsc -b --pretty > docs/output.txt 2>&1
```

The `--pretty` flag tells TypeScript to **always use the full human-readable format**, regardless of whether it's writing to a terminal or a file.

---

### ✅ Summary

- The content is the same – just formatted differently.
- Use `bun tsc -b --pretty > docs/output.txt 2>&1` to get the **full format** in the file.
