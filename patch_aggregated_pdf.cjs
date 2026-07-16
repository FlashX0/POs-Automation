const fs = require('fs');
let code = fs.readFileSync('src/components/AggregatedStatement.tsx', 'utf-8');

const targetStr = `          onclone: (clonedDocument) => {
            const elements = clonedDocument.querySelectorAll('*');
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
          }`;

const replacement = `          onclone: (clonedDocument) => {
            const elements = clonedDocument.querySelectorAll('*');
            elements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              
              if (htmlEl.tagName === 'TD' || htmlEl.tagName === 'TH' || htmlEl.tagName === 'TR' || htmlEl.tagName === 'DIV' || htmlEl.tagName === 'SPAN' || htmlEl.tagName === 'INPUT' || htmlEl.tagName === 'TABLE') {
                const bg = window.getComputedStyle(htmlEl).backgroundColor;
                if (bg && (bg.includes('rgba(15') || bg.includes('rgb(15') || htmlEl.className.includes('bg-slate-') || htmlEl.className.includes('bg-gray-') || htmlEl.className.includes('bg-[#') || htmlEl.className.includes('bg-indigo-'))) {
                  htmlEl.style.backgroundColor = '#ffffff';
                }
                htmlEl.style.color = '#000000';
                htmlEl.style.borderColor = '#d1d5db';
              }
              
              const computedStyle = window.getComputedStyle(htmlEl);
              if (computedStyle.backgroundColor.includes('oklch')) {
                htmlEl.style.backgroundColor = '#ffffff';
              }
              if (computedStyle.color.includes('oklch')) {
                htmlEl.style.color = '#000000';
              }
              if (computedStyle.borderColor.includes('oklch')) {
                htmlEl.style.borderColor = '#d1d5db';
              }
            });
          }`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/components/AggregatedStatement.tsx', code);
