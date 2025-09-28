// Debug file for filtering logic
const versionPattern = /^[a-zA-Z]?v?\d+(?:\.\d+)*$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hashPattern = /^[a-f0-9]{7,40}$/i;
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const urlDomainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const testPaths = ["bun.lockb", "README.md", "package.json"];

testPaths.forEach(p => {
  console.log(`${p}:`);
  console.log(`  versionPattern: ${versionPattern.test(p)}`);
  console.log(`  uuidPattern: ${uuidPattern.test(p)}`);
  console.log(`  hashPattern: ${hashPattern.test(p)}`);
  console.log(`  emailPattern: ${emailPattern.test(p)}`);
  console.log(`  urlDomainPattern: ${urlDomainPattern.test(p)}`);
  console.log(`  empty string: ${p.trim() === ''}`);
  console.log(`  should be filtered: ${versionPattern.test(p) || uuidPattern.test(p) || hashPattern.test(p) || emailPattern.test(p) || urlDomainPattern.test(p) || p.trim() === ''}`);
});