import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'node_modules', 'pdf-parse', 'index.js');

try {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        // Replace the condition that triggers the test
        // It usually looks like: let isDebugMode = !module.parent;
        if (content.includes('!module.parent')) {
            content = content.replace('!module.parent', 'false');
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Successfully patched pdf-parse/index.js');
        } else {
            console.log('Pattern not found. Maybe already patched?');
        }
    } else {
        console.error('File not found:', filePath);
    }
} catch (err) {
    console.error('Error patching file:', err);
}
