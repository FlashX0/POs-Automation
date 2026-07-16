const fs = require('fs');
let code = fs.readFileSync('api/database.ts', 'utf-8');

code = code.replace(
  /const parsed = sanitizeDeletedRecords\(row\.data\);/,
  `const parsed = sanitizeDeletedRecords(row.data);
            parsed.projects = Array.from(new Set([...defaultProjects, ...(parsed.projects || [])]));`
);

fs.writeFileSync('api/database.ts', code);
