const fs = require('fs');
const path = require('path');
const { postToThreads } = require('./post');

const delay = ms => new Promise(r => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (const arg of args) {
    const match = arg.match(/^--(\w[\w-]*)=(.+)$/);
    if (match) parsed[match[1]] = match[2];
    else if (arg.startsWith('--')) parsed[arg.slice(2)] = true;
  }
  return parsed;
}

(async () => {
  const args = parseArgs();

  if (!args.file) {
    console.log('사용법:');
    console.log('  node batch-post.js --file=posts.json [--delay=300] [--debug] [--visible]');
    console.log('');
    console.log('JSON 형식 (posts.json):');
    console.log('  [');
    console.log('    { "text": "첫 번째 글" },');
    console.log('    { "text": "두 번째 글\\n줄바꿈 포함" },');
    console.log('    { "file": "원고3.txt" }');
    console.log('  ]');
    console.log('');
    console.log('CSV 형식 (posts.csv):');
    console.log('  한 줄에 하나씩, 각 줄이 하나의 게시글');
    process.exit(0);
  }

  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`파일 없음: ${filePath}`);
    process.exit(1);
  }

  const delaySeconds = parseInt(args.delay) || 300; // 기본 5분
  const options = {
    headless: !args.visible,
    debug: !!args.debug
  };

  let posts = [];
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    posts = raw.map(item => {
      if (item.file) {
        const fp = path.resolve(path.dirname(filePath), item.file);
        return { text: fs.readFileSync(fp, 'utf8').trim() };
      }
      return { text: (item.text || '').replace(/\\n/g, '\n') };
    });
  } else if (ext === '.csv' || ext === '.txt') {
    // 각 줄이 하나의 포스트 (빈 줄은 줄바꿈으로 합침)
    const content = fs.readFileSync(filePath, 'utf8').trim();
    // "---" 구분자로 여러 글 구분
    const sections = content.split(/\n---\n/);
    posts = sections.map(s => ({ text: s.trim() }));
  }

  if (posts.length === 0) {
    console.error('게시할 글이 없습니다.');
    process.exit(1);
  }

  console.log(`=== Threads 일괄 게시 ===`);
  console.log(`총 ${posts.length}개 글, 딜레이 ${delaySeconds}초\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < posts.length; i++) {
    console.log(`\n========== [${i + 1}/${posts.length}] ==========`);
    const result = await postToThreads(posts[i].text, options);

    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }

    // 마지막 글이 아니면 딜레이
    if (i < posts.length - 1) {
      console.log(`\n⏳ ${delaySeconds}초 대기...`);
      await delay(delaySeconds * 1000);
    }
  }

  console.log(`\n========== 결과 ==========`);
  console.log(`✅ 성공: ${successCount}`);
  console.log(`❌ 실패: ${failCount}`);
  console.log(`총: ${posts.length}`);

  process.exit(failCount > 0 ? 1 : 0);
})();
