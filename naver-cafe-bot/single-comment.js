#!/usr/bin/env node
/**
 * 단일 카페에 댓글 1개 달기 (v2: AI 댓글 생성 + 검증)
 * Usage: node single-comment.js <cafeId> <cafeUrl> [--comment="직접 지정"]
 * 
 * comment 미지정 시 글 제목 기반으로 자연스러운 댓글 자동 생성
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const args = process.argv.slice(2);
const cafeId = args[0];
const cafeUrl = args[1];
let manualComment = '';
for (const a of args) {
  const m = a.match(/^--comment=(.+)$/s);
  if (m) manualComment = m[1];
}
if (!cafeId || !cafeUrl) { console.error('Usage: node single-comment.js <cafeId> <cafeUrl> [--comment="..."]'); process.exit(1); }

const ACCOUNT = process.env.NAVER_ACCOUNT || 'acrogatden';
const COOKIE_PATH = path.join(__dirname, 'cookies', ACCOUNT + '.json');
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwEi1TmspCd9IIi7Ll4t_dZwfKJuGw0qruKrKoJj0zu_Ry4yf-PaXt6MC3L_9ADUcSfxA/exec';

const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
const delay = ms => new Promise(r => setTimeout(r, ms));

// --- 글 제목 기반 댓글 생성 ---
function generateComment(subject) {
  const s = subject.toLowerCase();
  
  // 스킵해야 할 글 유형
  if (/판매|할인|세일|홍보|광고|배송|공구|주문|결제|입금/.test(subject)) return null;
  if (/공지|규정|규칙|필독|안내문/.test(subject)) return null;
  if (/뉴스|속보|정치|경제|주가|유가|트럼프|대통령|국회/.test(subject)) return null;
  
  // 식물/꽃 관련
  if (/꽃|개화|피었|만개|봉오리|장미|튤립|벚꽃|수선화|수국|제라늄|란|난초/.test(subject)) {
    return pick([
      '와 꽃이 정말 예쁘게 피었네요~!', '색감이 너무 예뻐요 ㅎㅎ 잘 키우셨네요!',
      '정말 탐스럽네요~ 저도 키워보고 싶어요!', '꽃 보니까 마음이 환해지네요~',
      '와 대박 이렇게 예쁘게 피우시다니!', '진짜 예뻐요 ㅠㅠ 부럽습니다',
    ]);
  }
  
  // 파종/재배/농사
  if (/파종|심기|재배|모종|씨앗|발아|삽목|꺾꽂이|분갈이/.test(subject)) {
    return pick([
      '좋은 정보 감사합니다! 저도 올해 해봐야겠어요~', '오 참고할게요! 시기가 중요하죠 ㅎㅎ',
      '자세한 설명 감사합니다~ 도움 많이 됩니다!', '저도 준비하고 있는데 참고하겠습니다!',
      '역시 경험에서 나오는 노하우네요~ 감사합니다!',
    ]);
  }
  
  // 텃밭/채소/수확
  if (/텃밭|채소|수확|열매|토마토|고추|상추|오이|감자|배추|무|당근|콩/.test(subject)) {
    return pick([
      '텃밭 부럽습니다~ 올해도 풍작이길!', '직접 키운 거 먹으면 맛이 다르죠 ㅎㅎ',
      '와 잘 자랐네요! 관리 비법이 궁금해요~', '저도 올해 텃밭 시작해보려구요!',
    ]);
  }
  
  // 나무/분재/풍란
  if (/나무|분재|소나무|풍란|난|묵호|호|산야초|다육/.test(subject)) {
    return pick([
      '멋지네요~ 정성이 느껴집니다!', '와 건강하게 잘 자라고 있네요~',
      '역시 관리를 잘 하시네요! 배워갑니다~', '오 저도 관심 있는데 도움이 많이 돼요!',
    ]);
  }
  
  // 요리/음식
  if (/요리|레시피|만들|맛있|밥|국|찌개|김치|반찬|빵|약밥|떡/.test(subject)) {
    return pick([
      '맛있겠다! 레시피 참고할게요~', '오 저도 해봐야겠어요! 감사합니다 ㅎㅎ',
      '사진만 봐도 군침이 도네요~', '완전 맛있어 보여요! 손재주가 좋으시네요~',
    ]);
  }
  
  // 나눔/교환
  if (/나눔|교환|무료|드립니다|가져가/.test(subject)) {
    return pick([
      '좋은 나눔 감사합니다~!', '마음이 따뜻해지네요 ㅎㅎ',
      '이런 나눔 정말 좋아요~', '감사합니다! 좋은 하루 되세요~',
    ]);
  }
  
  // 성공/자랑/후기
  if (/성공|자랑|후기|드디어|완성|첫/.test(subject)) {
    return pick([
      '축하드려요~! 대단하시네요 ㅎㅎ', '와 고생하신 보람이 있네요!',
      '멋지네요! 저도 도전해봐야겠어요~', '정성이 대단하세요~ 부럽습니다!',
    ]);
  }
  
  // 출석/인사
  if (/출석|안녕|좋은아침|하루|일상/.test(subject)) {
    return pick([
      '좋은 하루 되세요~!', '오늘도 화이팅입니다 ㅎㅎ',
    ]);
  }
  
  // 질문
  if (/\?|질문|어떻게|뭐가|추천|알려|도움/.test(subject)) {
    return pick([
      '저도 궁금했던 건데 좋은 질문이네요!', '댓글 답변 보면서 저도 배워갑니다~',
    ]);
  }
  
  // 귀농/전원/시골
  if (/귀농|귀촌|전원|시골|농촌|이주|리모델링/.test(subject)) {
    return pick([
      '전원생활 부럽습니다~ 응원합니다!', '좋은 정보 감사해요! 참고하겠습니다~',
      '저도 언젠가 도전해보고 싶어요 ㅎㅎ',
    ]);
  }
  
  // 기본 (매칭 안 되는 경우)
  return pick([
    '좋은 글 잘 읽었습니다~', '공감합니다 ㅎㅎ 잘 보고 갑니다!',
    '좋은 정보 감사합니다~', '도움이 많이 됩니다! 감사해요~',
  ]);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- API ---
function fetchJson(p) {
  const cs = cookies.map(c => c.name + '=' + c.value).join('; ');
  return new Promise(r => {
    https.get({ hostname: 'apis.naver.com', path: p, headers: { 'Cookie': cs, 'Referer': 'https://cafe.naver.com/' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { r(JSON.parse(d)) } catch (e) { r(null) } });
    }).on('error', () => r(null));
  });
}

function recordActivity(data) {
  return new Promise((resolve) => {
    const url = new URL(WEBAPP_URL);
    url.searchParams.set('action', 'addActivity');
    Object.entries(data).forEach(([k, v]) => url.searchParams.set(k, v));
    https.get(url.toString(), res => {
      if (res.statusCode === 302) {
        https.get(res.headers.location, res2 => {
          let d = ''; res2.on('data', c => d += c); res2.on('end', () => { console.log('  📊 시트 기록 완료'); resolve(); });
        });
      } else {
        let d = ''; res.on('data', c => d += c); res.on('end', () => { console.log('  📊 시트 기록 완료'); resolve(); });
      }
    }).on('error', () => { console.log('  📊 시트 기록 실패'); resolve(); });
  });
}

(async () => {
  // 최근 글 가져오기
  const arts = await fetchJson(`/cafe-web/cafe2/ArticleListV2dot1.json?search.clubid=${cafeId}&search.queryType=lastArticle&search.page=1&search.perPage=10`);
  const list = arts?.message?.result?.articleList || [];
  if (!list.length) { console.log('  글 없음'); process.exit(0); }

  // 적절한 글 찾기 (댓글 생성 가능한 것)
  let target = null;
  let comment = manualComment;
  
  for (const a of list) {
    if (manualComment) {
      // 수동 댓글이면 광고만 스킵
      if (/판매|할인|세일|홍보|광고|배송|공지/.test(a.subject)) continue;
      target = a;
      break;
    } else {
      // 자동 댓글이면 generateComment로 적절한 글 찾기
      const gen = generateComment(a.subject);
      if (gen) {
        target = a;
        comment = gen;
        break;
      }
    }
  }
  
  if (!target || !comment) { console.log('  적절한 글 없음'); process.exit(0); }
  console.log('  -> ' + target.subject.substring(0, 40));
  console.log('  💬 ' + comment);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36']
  });

  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }) });
    for (const c of cookies) {
      try { await page.setCookie({ name: c.name, value: String(c.value), domain: c.domain, path: c.path || '/', httpOnly: !!c.httpOnly, secure: !!c.secure, ...(c.expires > 0 ? { expires: c.expires } : {}) }); } catch (e) { }
    }
    const client = await page.createCDPSession();

    await page.goto(`https://cafe.naver.com/${cafeUrl}/${target.articleId}`, { waitUntil: 'networkidle2', timeout: 20000 });
    await delay(2000);

    let af = null;
    for (const f of page.frames()) { if (f.url().includes('ca-fe/cafes')) { af = f; break; } }
    if (!af) { console.log('  iframe 없음'); await browser.close(); process.exit(0); }

    const ta = await af.$('textarea.comment_inbox_text');
    if (!ta) { console.log('  댓글란 없음'); 
      await recordActivity({ account: ACCOUNT, cafeName: cafeUrl, cafeId, articleUrl: '', comment: '', note: '댓글 권한 없음' });
      await browser.close(); process.exit(0); 
    }

    await ta.click(); await delay(500);
    await af.focus('textarea.comment_inbox_text'); await delay(300);
    await client.send('Input.insertText', { text: comment }); await delay(500);

    // 입력 확인
    const inputVal = await af.$eval('textarea.comment_inbox_text', el => el.value);
    if (!inputVal) { console.log('  입력 실패'); await browser.close(); process.exit(1); }

    const rb = await af.$('button.btn_register') || await af.$('.register_box');
    if (rb) {
      await rb.click();
      await delay(3000);
      
      // 등록 검증: 댓글 목록에서 방금 단 댓글 확인
      const verified = await af.evaluate((commentText) => {
        const comments = document.querySelectorAll('.comment_text_box .text_comment, .comment_text_view');
        for (const el of comments) {
          if (el.textContent.includes(commentText.substring(0, 10))) return true;
        }
        return false;
      }, comment);
      
      if (verified) {
        console.log('  ✅ 댓글 등록 확인됨');
      } else {
        console.log('  ⚠️ 등록 버튼 클릭했으나 확인 안 됨 (등록됐을 수 있음)');
      }
      
      const articleUrl = 'https://cafe.naver.com/' + cafeUrl + '/' + target.articleId;
      await recordActivity({ account: ACCOUNT, cafeName: cafeUrl, cafeId, articleUrl, comment, note: verified ? '' : '미확인' });
    } else {
      console.log('  등록 버튼 없음');
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('  ❌ ' + e.message); process.exit(1); });
