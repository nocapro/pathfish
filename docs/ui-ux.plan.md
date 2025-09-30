UI UX plan

```
pathfish_ui/
├── 1_STREAMING_INPUT_SCREEN/
│   ├── state.md
│   ├── layout.ascii
│   └── interactions.md
│
├── 2_PROCESSING_SCREEN/
│   ├── state.md
│   ├── layout.ascii
│   └── interactions.md
│
├── 3_RESULTS_SUCCESS_SCREEN/
│   ├── state.md
│   ├── layout.ascii
│   └── interactions.md
│
├── 4_RESULTS_RAW_VIEW_SCREEN/
│   ├── state.md
│   ├── layout.ascii
│   └── interactions.md
│
├── 5_COMPARING_STRATEGIES_SCREEN/
│   ├── state.md
│   ├── layout.ascii
│   └── interactions.md
│
├── 6_WATCHING_SCREEN/
│   ├── state.md
│   ├── layout.ascii
│   └── interactions.md
│
├── 7_RESULTS_EMPTY_SCREEN/
│   ├── state.md
│   ├── layout.ascii
│   └── interactions.md
│
└── 8_ERROR_SCREEN/
    ├── state.md
    ├── layout.ascii
    └── interactions.md
```

---

### `1_STREAMING_INPUT_SCREEN/`

*   #### `state.md`
    ```
    State Name: STREAMING_INPUT
    Description: The initial state when pathfish is actively receiving data from a pipe (stdin). It provides a live preview of the incoming data stream.
    ```

*   #### `layout.ascii`
    ```
    eslint . | pathfish
    --------------------------------------------------------------------------------------
    src/cli.ts:187:3 - error TS2345: Argument of type 'string' is not assignable to...
    src/core.ts:44:1 - warning 'path' is defined but never used
    <... more output streams in as it arrives ...>

    ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
    🐠 Potential paths found: 17
    🌊 Receiving input... (0.215s)   [p] Pause/Peek Stream   [Ctrl+C] Cancel
    ```

*   #### `interactions.md`
    *   **`p`**: Pauses the live stream, allowing the user to scroll through already-received input. The state remains `STREAMING_INPUT` but enters a "paused" sub-state. Pressing `p` again resumes.
    *   **`Ctrl+C`**: Aborts the operation and exits the program.
    *   **`stdin closes`**: Automatically transitions to `PROCESSING` state.

---

### `2_PROCESSING_SCREEN/`

*   #### `state.md`
    ```
    State Name: PROCESSING
    Description: A brief, transitional state that shows progress while the received input is being parsed, verified against the filesystem, and formatted.
    ```

*   #### `layout.ascii`
    ```
    🎣 Analyzing input... (0.234s)
       [▓▓▓▓▓▓▓░░░░░░░░░░░░]  (1/2) Running 'fuzzy' strategy...
       [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]  (2/2) Verifying 152 filesystem paths...
    ```

*   #### `interactions.md`
    *   **User Interaction**: None. This is an automatic, non-interactive state.
    *   **`Processing completes`**: Transitions to `RESULTS_SUCCESS` if paths are found, or `RESULTS_EMPTY` if no paths are found.
    *   **`Processing fails`**: Transitions to `ERROR`.

---

### `3_RESULTS_SUCCESS_SCREEN/`

*   #### `state.md`
    ```
    State Name: RESULTS_SUCCESS
    Description: The default final screen, displaying a scrollable list of paths found by the primary strategy. This is the main hub for post-processing actions.
    ```

*   #### `layout.ascii`
    ```
    ✨ Success! Found 5 of 152 potential paths. (0.456s). Copied to clipboard!

       src/cli.ts
       src/core.ts
       src/engine.ts
       test/e2e/cli.test.ts
       package.json

      [c] Copy [o] Copy stdin output  [b] Copy both  [r] Raw input [s] Compare Strategies  [q] Quit
    ```

*   #### `interactions.md`
    *   **`c`**: Copies the list of found paths to the clipboard.
    *   **`r`**: Transitions to `RESULTS_RAW_VIEW` state.
    *   **`s`**: Transitions to `COMPARING_STRATEGIES` state.
    *   **`q`, `Enter`, `Esc`**: Exits the application.

---

### `4_RESULTS_RAW_VIEW_SCREEN/`

*   #### `state.md`
    ```
    State Name: RESULTS_RAW_VIEW
    Description: A view that allows the user to inspect the complete, original input that was piped into the program, with full scrolling capabilities.
    ```

*   #### `layout.ascii`
    ```
    📄 Raw Input (Line 15 of 248)

       > src/services/fs.service.ts:42:32
       >   42 const updateGitignore = async (cwd: string): Promise<{ ... }> => {
       >                                     ~~~~~~~~~~~
       >   An argument for 'cwd' was not provided.

       [r] Results  [s] Compare  [↑↓] Scroll Lines  [Home/End] Jump  [q] Quit
    ```

*   #### `interactions.md`
    *   **`↑/↓`, `PgUp/PgDown`, `Home/End`**: Navigates the raw input buffer.
    *   **`r`**: Transitions back to `RESULTS_SUCCESS` state.
    *   **`s`**: Transitions to `COMPARING_STRATEGIES` state.
    *   **`q`, `Esc`**: Exits the application.

---

### `5_COMPARING_STRATEGIES_SCREEN/`

*   #### `state.md`
    ```
    State Name: COMPARING_STRATEGIES
    Description: An advanced view that presents a unified matrix of all found paths, showing which strategy found which path, and allowing for fine-grained selection and copying.
    ```

*   #### `layout.ascii`
    ```
    📊 Strategy Comparison (Use ↑↓ to navigate, Space to select)

      Path                       Regex   Fuzzy   Both
      ------------------------- ------- ------- -------
    > [x] src/cli.ts                ✔       ✔       ✔
      [ ] src/core.ts               ✔       ✔       ✔

    ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
    [c] Copy Selected (1)   [Ctrl+R] Copy Regex (2)   [Ctrl+F] Copy Fuzzy (2)   [Esc] Back
    ```

*   #### `interactions.md`
    *   **`↑/↓`**: Navigates the master path list.
    *   **`Spacebar`**: Toggles the checkbox `[ ]`/`[x]` for the currently highlighted path.
    *   **`c`**: Copies only the user-selected (`[x]`) paths.
    *   **`Ctrl+R`**: Ignores selection and copies all paths found by the Regex strategy.
    *   **`Ctrl+F`**: Ignores selection and copies all paths found by the Fuzzy strategy.
    *   **`Esc`, `s`**: Transitions back to `RESULTS_SUCCESS` state.

---

### `6_WATCHING_SCREEN/`

*   #### `state.md`
    ```
    State Name: WATCHING
    Description: A persistent state activated by a specific flag (e.g., --watch). It monitors a file for changes, re-runs processing, and automatically copies new results to the clipboard.
    ```

*   #### `layout.ascii`
    ```
    👀 Watching compiler.log for changes...
       (Press Ctrl+C to stop)

    LOG:
    [14:32:05] File changed! Found 3 paths. Results copied to clipboard.
    [14:32:19] File changed! Found 3 paths. (No change in output)
    ```

*   #### `interactions.md`
    *   **`Ctrl+C`**: Stops watching and exits the application.
    *   **`File change detected`**: Triggers an internal processing cycle and updates the log.

---

### `7_RESULTS_EMPTY_SCREEN/`

*   #### `state.md`
    ```
    State Name: RESULTS_EMPTY
    Description: A final state for when the input was processed successfully but no valid, existing file paths were found.
    ```

*   #### `layout.ascii`
    ```
    🌊 Nothing found. No paths matched in the input. (0.310s)

       [r] Show raw input to inspect  [q] Quit
    ```

*   #### `interactions.md`
    *   **`r`**: Transitions to `RESULTS_RAW_VIEW` state.
    *   **`q`, `Enter`, `Esc`**: Exits the application.

---

### `8_ERROR_SCREEN/`

*   #### `state.md`
    ```
    State Name: ERROR
    Description: A terminal state for fatal errors, such as being unable to read a file or encountering an unrecoverable internal error.
    ```

*   #### `layout.ascii`
    ```
    ❌ Error!

       Could not read input file: 'nonexistent.log'
       Please check the path and permissions.

       [q] Quit
    ```

*   #### `interactions.md`
    *   **`q`, `Enter`, `Esc`**: Exits the application.
