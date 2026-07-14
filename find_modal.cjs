const fs = require('fs');
const files = fs.readdirSync('src/components');
for (const file of files) {
  if (file.endsWith('.tsx')) {
    const content = fs.readFileSync('src/components/' + file, 'utf8');
    if (content.includes('AIUploadModal')) {
      console.log('Found AIUploadModal in', file);
    }
  }
}
