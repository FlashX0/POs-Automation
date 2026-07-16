const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// The onclone in src/App.tsx:
const oncloneReplacement = `        onclone: (clonedDoc) => {
          // Clean all <style> tags inside the cloned document before html2canvas parses them
          const clonedStyles = clonedDoc.getElementsByTagName("style");
          Array.from(clonedStyles).forEach((styleEl: any) => {
            if (styleEl.textContent && (styleEl.textContent.includes('oklch') || styleEl.textContent.includes('oklab'))) {
              styleEl.textContent = convertOklToRgb(styleEl.textContent);
            }
          });
          
          const elements = clonedDoc.querySelectorAll('*');
          elements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const computedStyle = window.getComputedStyle(htmlEl);
            if (computedStyle.backgroundColor.includes('oklch')) {
              htmlEl.style.backgroundColor = '#ffffff'; // Fallback safe color
            }
            if (computedStyle.color.includes('oklch')) {
              htmlEl.style.color = '#000000'; // Fallback safe color
            }
            if (computedStyle.borderColor.includes('oklch')) {
              htmlEl.style.borderColor = '#e5e7eb'; // Safe gray border
            }
          });

          const clonedElement = clonedDoc.getElementById("printable-excel-sheet-delta-isolated");`;

content = content.replace(/onclone: \(clonedDoc\) => \{\s+\/\/ Clean all <style> tags inside the cloned document before html2canvas parses them\s+const clonedStyles = clonedDoc\.getElementsByTagName\("style"\);\s+Array\.from\(clonedStyles\)\.forEach\(\(styleEl: any\) => \{\s+if \(styleEl\.textContent && \(styleEl\.textContent\.includes\('oklch'\) \|\| styleEl\.textContent\.includes\('oklab'\)\)\) \{\s+styleEl\.textContent = convertOklToRgb\(styleEl\.textContent\);\s+\}\s+\}\);\s+const clonedElement = clonedDoc\.getElementById\("printable-excel-sheet-delta-isolated"\);/g, oncloneReplacement);

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed onclone in App.tsx');
