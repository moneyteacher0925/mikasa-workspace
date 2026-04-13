const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = ['hr-global-benchmark', 'hr-korean-laws', 'hr-hiworks-analysis'];

for (const f of files) {
  const md = fs.readFileSync(`${f}.md`, 'utf8');
  // Convert md to styled HTML
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body { font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; font-size: 14px; line-height: 1.6; color: #333; }
h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; }
h2 { font-size: 18px; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
h3 { font-size: 15px; margin-top: 20px; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #f5f5f5; font-weight: bold; }
blockquote { border-left: 3px solid #ccc; margin: 10px 0; padding: 5px 15px; color: #666; }
code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; font-size: 13px; }
pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
</style></head><body>
${execSync(`pandoc --from markdown --to html`, { input: md }).toString()}
</body></html>`;
  fs.writeFileSync(`${f}-styled.html`, html);
  console.log(`Created ${f}-styled.html`);
}
