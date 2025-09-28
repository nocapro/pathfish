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
