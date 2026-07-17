import fs from 'fs';

// Fix EngineerManagement.tsx
let engCode = fs.readFileSync('src/components/EngineerManagement.tsx', 'utf8');

// Replace key={idx} or key={index} with something unique where applicable.
engCode = engCode.replace(/<tr key=\{idx\}/g, "<tr key={idx} "); // Let's check exactly what line 893, 1118, 1182 are
fs.writeFileSync('src/components/EngineerManagement.tsx', engCode);

