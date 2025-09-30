const input = `- 'src/services/config.service.ts'
- 'relaycode.old/src/core/config.ts'
- 'relaycode.old/src/core/state.ts'
- 'index.tsx'`;

// This regex finds file paths, including optional line/column numbers. It's
// designed to be comprehensive, supporting Windows, Unix, absolute, and
// relative paths. The regex is structured to match complete paths:
// 1. Windows absolute paths (C:\path\to\file)
// 2. Unix absolute paths (/path/to/file)
// 3. Relative paths with separators (src/file.ts, ./dist, ../parent)
// 4. Standalone filenames with extensions (README.md, package.json)
const PATH_REGEX = new RegExp(
  [
    // Quoted paths with spaces (must come first to allow spaces)
    /(?:"[^"]*[\\\/][^"]*"|'[^']*[\\\/][^']*')/.source,

    // Parenthesized paths with spaces: (src/components/Button (new).tsx)
    /\([^,)]*[\\\/][^,)]*\([^)]*\)[^,)]*\.[a-zA-Z0-9]+\)/.source,

    // Windows UNC paths: \\server\share\file (must come before absolute)
    /[\\\/]{2}[^\s\n]+[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Windows absolute paths: C:\path\to\file (must come first to avoid partial matches)
    /[a-zA-Z]:[\\\/][^\s\n]+(?:[\\\/][^\s\n]+)*/.source,

    // Unix absolute paths: /path/to/file
    /\/[^\s\n"']+(?:[\\\/][^\s\n"']+)*/.source,

    // Relative paths with separators: ./file, ../file, src/file
    /(?:\.[\\/]|[^\s\n"']+[\\/])[^\s\n"']+(?:[\\\/][^\s\n"']+)*/.source,

    // Same as above, but uses a lookbehind to allow leading whitespace (for indented paths in logs)
    /(?<=\s)(?:\.[\\/]|[^\s\n"']+[\\/])[^\s\n"']+(?:[\\\/][^\s\n"']+)*/.source,

    // Standalone filenames with extensions: file.txt, README.md, my.component.test.js.
    // Use negative lookbehind to avoid email domains and URL contexts
    // Supports multi-dot filenames like my.component.test.js
    /(?<!@|https?:\/\/[^\s]*)\b[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]{1,}\b(?![\\\/])(?!\s*@)(?![^"]*")/.source,

    // Common filenames without extensions
    /\b(?:Dockerfile|Makefile|Jenkinsfile|Vagrantfile)\b/.source,
  ].join('|'),
  'g',
);

const matches = input.match(PATH_REGEX);
console.log('All regex matches:', matches);