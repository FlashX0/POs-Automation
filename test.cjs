const fs = require('fs');
console.log(fs.readFileSync('src/components/PriceComparison.tsx', 'utf8').includes('useAdvancedAI'));
