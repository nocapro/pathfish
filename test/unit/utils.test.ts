import { describe, it, expect } from 'bun:test';
import { createFormatter, type Format } from '../../src/utils';
import { loadYamlFixture } from '../test.utils';

type FormatterTestCase = {
  name: string;
  format: Format;
  pretty: boolean;
  input: string[];
  expected: string;
};

type FormatterFixture = (
  | FormatterTestCase
  | { name: string; cases: FormatterTestCase[] }
)[];

describe('createFormatter', async () => {
  it('should throw an error for an unknown format', () => {
    // This is a type-level check, but we test the runtime guard
    const badFormat = 'xml' as any;
    expect(() => createFormatter(badFormat, true)).toThrow(
      'Unknown format: xml',
    );
  });

  const fixtures = await loadYamlFixture<FormatterFixture>(
    './utils.fixtures.yaml',
  );

  for (const fixture of fixtures) {
    if ('cases' in fixture) {
      describe(fixture.name, () => {
        for (const testCase of fixture.cases) {
          it(`should format as ${testCase.format}`, () => {
            const format = createFormatter(testCase.format, testCase.pretty);
            const result = format(testCase.input);
            expect(result.trim()).toEqual(testCase.expected.trim());
          });
        }
      });
    } else {
      it(fixture.name, () => {
        const format = createFormatter(fixture.format, fixture.pretty);
        const result = format(fixture.input);
        // Use trim to handle potential trailing newlines from YAML multiline strings
        expect(result.trim()).toEqual(fixture.expected.trim());
      });
    }
  }
});