this is the published version of pathfish, guardrails below problems into test cases, I also checked that the file exists.

but its weird that init.store.ts and fs.service.ts not detected but in test cases is passed

---------------

realme-book@realme-book:~/Project/code/relaycode-new$ bun tsc -b
src/components/SettingsScreen.tsx:5:10 - error TS6133: 'AI_PROVIDERS' is declared but its value is never read.

5 import { AI_PROVIDERS, SETTINGS_FOOTER_ACTIONS } from '../constants/settings.constants';
           ~~~~~~~~~~~~

src/hooks/useDebugMenu.tsx:101:29 - error TS2554: Expected 4 arguments, but got 3.

101                 initActions.setAnalysisResults('relaycode-tui', true, false);
                                ~~~~~~~~~~~~~~~~~~

  src/stores/init.store.ts:30:99
    30         setAnalysisResults: (projectId: string, gitignoreFound: boolean, gitInitialized: boolean, configExists: boolean) => void;
                                                                                                         ~~~~~~~~~~~~~~~~~~~~~
    An argument for 'configExists' was not provided.

src/services/copy.service.ts:5:10 - error TS2305: Module '"./fs.service"' has no exported member 'FileSystemService'.

5 import { FileSystemService } from './fs.service';
           ~~~~~~~~~~~~~~~~~

src/services/init.service.ts:10:32 - error TS2305: Module '"../constants/fs.constants"' has no exported member 'PROMPT_FILE_NAME'.

10 import { STATE_DIRECTORY_NAME, PROMPT_FILE_NAME } from '../constants/fs.constants';
                                  ~~~~~~~~~~~~~~~~

src/services/init.service.ts:20:25 - error TS2554: Expected 1 arguments, but got 0.

20         await FsService.updateGitignore();
                           ~~~~~~~~~~~~~~~

  src/services/fs.service.ts:42:32
    42 const updateGitignore = async (cwd: string): Promise<{ created: boolean, updated: boolean }> => {
                                      ~~~~~~~~~~~
    An argument for 'cwd' was not provided.


Found 5 errors.

error: "tsc" exited with code 1
realme-book@realme-book:~/Project/code/relaycode-new$ bun tsc -b | pathfish --no-verify
error: "tsc" exited with code 1
[
  "src/components/SettingsScreen.tsx",
  "src/hooks/useDebugMenu.tsx",
  "src/services/copy.service.ts",
  "src/services/init.service.ts"
]
--------------------

===

current tests is focused on regex, I want when fixtures says using regex and fuzzy the test should run two tests so user can compare different strategy results

 example
-------------

- name: "Should extract paths from TypeScript compiler error output"
  options: { strategy: 'regex'  } //basically this should say something like regex and fuzzy. this is different from hybrid strategy
  input: |
    src/components/SettingsScreen.tsx:5:10 - error TS6133: 'AI_PROVIDERS' is declared but its value is never read.

    5 import { AI_PROVIDERS, SETTINGS_FOOTER_ACTIONS } from '../constants/settings.constants';
               ~~~~~~~~~~~~

    src/hooks/useDebugMenu.tsx:101:29 - error TS2554: Expected 4 arguments, but got 3.

    101                 initActions.setAnalysisResults('relaycode-tui', true, false);
                                    ~~~~~~~~~~~~~~~~~~

      src/stores/init.store.ts:30:99
        30         setAnalysisResults: (projectId: string, gitignoreFound: boolean, gitInitialized: boolean, configExists: boolean) => void;
                                                                                                             ~~~~~~~~~~~~~~~~~~~~~
        An argument for 'configExists' was not provided.

    src/services/copy.service.ts:5:10 - error TS2305: Module '"./fs.service"' has no exported member 'FileSystemService'.

    5 import { FileSystemService } from './fs.service';
               ~~~~~~~~~~~~~~~~~

    src/services/init.service.ts:10:32 - error TS2305: Module '"../constants/fs.constants"' has no exported member 'PROMPT_FILE_NAME'.

    10 import { STATE_DIRECTORY_NAME, PROMPT_FILE_NAME } from '../constants/fs.constants';
                                      ~~~~~~~~~~~~~~~~

    src/services/init.service.ts:20:25 - error TS2554: Expected 1 arguments, but got 0.

    20         await FsService.updateGitignore();
                               ~~~~~~~~~~~~~~~

      src/services/fs.service.ts:42:32
        42 const updateGitignore = async (cwd: string): Promise<{ created: boolean, updated: boolean }> => {
                                          ~~~~~~~~~~~
        An argument for 'cwd' was not provided.


    Found 5 errors.
  expected:
    - "src/components/SettingsScreen.tsx"
    - "src/hooks/useDebugMenu.tsx"
    - "src/stores/init.store.ts"
    - "src/services/copy.service.ts"
    - "src/services/init.service.ts"
    - "src/services/fs.service.ts"

------------

=== DONE

current algorithm is directly analysing blob to find the file path using regex strategy. I hate it only having one strategy..

given the fuzzy name in readme,

all I want is, the first class strategy is fuzzy which the algo should collect all cwd files and dirs to map out local paths, then parallelly fuzzy matching to find the best percentage match whether local files (file with ext, not full path) mentioned in the blob or not. for faster execution on large codebase, this fuzzy can ask for help of regex strategy to prioritize which files to check first

and user can choose which strategy to use. the fuzzy, regex, or both strategies for better results. defaulting to fuzzy strategy

=== DONE

1. prepare for npm publishing. implement eslint and tsup. make sure no eslint problems
2. make sure no bun test fail
3. make sure dist content is correct with all files and directories and d.ts files
4. publish to npm
5. install published version to local globally then test feature

=== DONE

add more comprehensive test cases and coverage. also add more complex fixtures domain and files

=== DONE

auto ignore files and dirs: like .gitignore package-lock.json node_modules .bun.lockb etc

dont forget to add the test cases

=== DONE

the concept of `verify is exist` actually to output paths that really exist and are valid and this should be default behavior. so please update test cases and logic

also focus on end goal of readme.md which is real production ready implementation

=== DONE

all parts executed. now

I want each cases should be isolated and on every run no any left over remain, even dirs... should be clean of temps

=== DONE

create comprehensive bun test cases to verify readme.md implementation;

1. no mock, stub or simulation. only real implementation
2. create test/test.util.ts to reuse test utilities
3. create test/e2e/[domain].test.ts, test/unit/[domain].test.ts, test/integration/[domain].test.ts files
4. create test/e2e/[domain].fixtures.yaml, test/unit/[domain].fixtures.yaml, test/integration/[domain].fixtures.yaml files
4. use real cli execution for e2e cases
5. use before all, after all, before each, after each, describe, it: from bun test
6. each cases should be isolated and on every run no any left over remain, even dirs

=== DONE

make sure to verify all readme.md implementation

=== DONE

boilerplate prepared. now understand readme then build the program in production ready manner.

1. use HOFs no OOP no classes.
2. no any or unknown types.
3. make sure the UI and UX so beautiful and cohesive

=== DONE

add features

1. to verify that mentioned files is exist in the path or in different location
2. auto copy to clipboard
3. multiple command stdin output

add use cases section
one of them is to let agentic cli app easily provide context to LLM by extracted paths

now, give me my final readme.md

=== DONE

give me the readme.md only.  I wanted to create typescript bun.sh cli app and programmatic api which takes raw text as input to fuzzy extract relative/absolute paths files and present the output as json string or yaml or something else... raw text example below
