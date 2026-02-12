import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const officeParser = require('officeparser');

console.log('Type of officeParser:', typeof officeParser);
console.log('Keys of officeParser:', Object.keys(officeParser));
if (typeof officeParser === 'function') {
    console.log('officeParser is a function itself');
}
console.log('Full officeParser object:', officeParser);
