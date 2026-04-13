#!/usr/bin/env node
/**
 * 카페 활동 자동화 v2 (Puppeteer 방식, 안전 모드)
 * Usage: NAVER_ACCOUNT=acrogatden node cafe-activity-v2.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ACCOUNT = process.env.NAVER_ACCOUNT || 'acrogatden';
const COOKIE_PATH = path.join(__dirname, 'cookies', ACCOUNT + '.json');
const delay = ms => new Promise(r => setTimeout(r, ms + Math.random() * ms * 0.3));

const COMMENTS = [
  '와 정말 예쁘네요~ 저도 키워보고 싶어요!',
  '봄이라 식물들이 정말 싱싱하네요 ㅎㅎ',
  '잘 키우셨네요! 관리 비법이 궁금해요~',
  '너무 예뻐요 ㅠㅠ 부럽습니다',
  '오 대박 저도 도전해봐야겠어요!',
  '건강하게 잘 자라고 있네요~',
  '역시 봄이 오니까 식물들이 다르네요',
  '사진 보니까 기분이 좋아지네요 ㅎㅎ',
  '우와 꽃이 정말 탐스럽네요~!',
  '저도 올해는 열심히 키워봐야겠어요!',
  '좋은 정보 감사합니다~',
  '매번 잘 보고 있어요 ㅎㅎ',
  '오 이거 좋은데요? 참고할게요!',
  '저희 집 애들도 이렇게 키우고 싶네요~',
  '너무 건강해 보여요! 비결이 뭔가요?',
  '텃밭 준비하시는군요~ 올해도 풍작 기원합니다!',
  '와 벌써 파종하셨군요! 저도 서둘러야겠어요',
  '올해 처음 도전해보려구요 ㅎㅎ 도움 많이 됩니다',
  '역시 경험이 많으시네요~ 배워갑니다!',
  '좋은 글이네요 ㅎㅎ 잘 보고 갑니다~',
  '아 이거 진짜 도움돼요! 감사합니다',
  '오 저도 이런 거 해보고 싶었는데 ㅎㅎ',
];

const usedComments = new Set();
function getRandomComment() {
  const available = COMMENTS.filter(c => !usedComments.has(c));
  if (available.length === 0) { usedComments.clear(); return COMMENTS[Math.floor(Math.random() * COMMENTS.length)]; }
  const picked = available[Math.floor(Math.random() * available.length)];
  usedComments.add(picked);
  return picked;
}

function fetchJson(urlPath, cookies) {
  const cookieStr = cookies.map(c => c.name + '=' + c.value).join('; ');
  return new Promise((resolve) => {
    https.get({
      hostname: 'apis.naver.com',
      path: urlPath,
      headers: { 'Cookie': cookieStr, 'Referer': 'https://cafe.naver.com/' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

async function commentOnArticle(page, client, cafeUrl, cafeId, articleId, comment) {
  try {
    await page.goto(`https://cafe.naver.com/${cafeUrl}/${articleId}`, { waitUntil: 'networkidle2', timeout: 20000 });
    await delay(3000);
    
    let articleFrame = null;
    for (const f of page.frames()) {
      if (f.url().includes('ca-fe/cafes')) { articleFrame = f; break; }
    }
    if (!articleFrame) { console.log('    iframe 없음'); return false; }
    
    const textarea = await articleFrame.$('textarea.comment_inbox_text');
    if (!textarea) { console.log('    댓글란 없음 (비로그인 또는 댓글 불가)'); return false; }
    
    await textarea.click();
    await delay(1000);
    await articleFrame.focus('textarea.comment_inbox_text');
    await delay(500);
    await client.send('Input.insertText', { text: comment });
    await delay(1000);
    
    // 입력 확인
    const val = await articleFrame.$eval('textarea.comment_inbox_text', el => el.value);
    if (!val) { console.log('    입력 실패'); return false; }
    
    // 등록 버튼
    const regBtn = await articleFrame.$('button.btn_register') || await articleFrame.$('.register_box');
    if (regBtn) {
      await regBtn.click();
      await delay(3000);
      console.log(`    ✅ 댓글: "${comment}"`);
      return true;
    }
    console.log('    등록 버튼 없음');
    return false;
  } catch(e) {
    console.log('    ❌ 에러:', e.message);
    return false;
  }
}

async function likeOnArticle(page, cafeUrl, articleId) {
  try {
    // 이미 해당 페이지에 있다고 가정
    let articleFrame = null;
    for (const f of page.frames()) {
      if (f.url().includes('ca-fe/cafes')) { articleFrame = f; break; }
    }
    if (!articleFrame) return false;
    
    // 좋아요 버튼 찾기
    const liked = await articleFrame.evaluate(() => {
      // 공감 버튼
      const likeBtn = document.querySelector('.u_likeit_list_btn:not(.on), .ArticleLike .button_like:not(.on), [class*="like_article"] button:not(.on)');
      if (likeBtn) { likeBtn.click(); return true; }
      return false;
    });
    
    if (liked) {
      await delay(1000);
      console.log('    👍 좋아요 완료');
    }
    return liked;
  } catch(e) { return false; }
}

(async () => {
  console.log(`\n🌱 카페 활동 시작 [계정: ${ACCOUNT}]`);
  console.log(`시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`);
  
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
  
  // 카페 목록
  const cafeData = await fetchJson('/cafe-home-web/cafe-home/v1/cafes/join?page=1&perPage=50&orderBy.field=LAST_VISIT_DATE&orderBy.direction=DESC', cookies);
  if (!cafeData?.message?.result?.cafes) { console.error('카페 목록 실패'); process.exit(1); }
  
  const cafes = cafeData.message.result.cafes;
  console.log(`가입 카페 ${cafes.length}개\n`);
  
  // 브라우저 시작
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator,'webdriver',{get:()=>false}); });
  for (const c of cookies) {
    try { await page.setCookie({name:c.name, value:String(c.value), domain:c.domain, path:c.path||'/', httpOnly:!!c.httpOnly, secure:!!c.secure, ...(c.expires>0?{expires:c.expires}:{})}); } catch(e){}
  }
  const client = await page.createCDPSession();
  
  let totalComments = 0;
  let totalLikes = 0;
  
  for (let i = 0; i < cafes.length; i++) {
    const cafe = cafes[i];
    console.log(`\n[${i+1}/${cafes.length}] ${cafe.cafeName} (/${cafe.cafeUrl})`);
    
    // 최근 글
    const articles = await fetchJson(`/cafe-web/cafe2/ArticleListV2dot1.json?search.clubid=${cafe.cafeId}&search.queryType=lastArticle&search.page=1&search.perPage=5`, cookies);
    const articleList = articles?.message?.result?.articleList || [];
    
    if (articleList.length === 0) { console.log('  글 없음, 스킵'); continue; }
    
    const targetCount = Math.random() > 0.5 ? 2 : 1;
    let commented = 0;
    
    for (let j = 0; j < articleList.length && commented < targetCount; j++) {
      const article = articleList[j];
      
      // 광고/세일 글 스킵
      if (/판매|할인|세일|홍보|광고|배송/.test(article.subject)) {
        console.log(`  ⏭ 스킵: ${article.subject.substring(0, 30)}`);
        continue;
      }
      
      console.log(`  📝 [${article.articleId}] ${article.subject.substring(0, 40)}`);
      
      const comment = getRandomComment();
      const ok = await commentOnArticle(page, client, cafe.cafeUrl, cafe.cafeId, article.articleId, comment);
      if (ok) {
        totalComments++;
        commented++;
      }
      
      // 좋아요도 시도
      await likeOnArticle(page, cafe.cafeUrl, article.articleId);
      
      if (commented < targetCount) {
        const waitSec = 30 + Math.floor(Math.random() * 30);
        console.log(`  ⏱ ${waitSec}초 대기...`);
        await delay(waitSec * 1000);
      }
    }
    
    // 카페 간 대기 (마지막 제외)
    if (i < cafes.length - 1) {
      const waitMin = 3 + Math.floor(Math.random() * 3);
      console.log(`\n⏱ 다음 카페까지 ${waitMin}분 대기...`);
      await delay(waitMin * 60 * 1000);
    }
  }
  
  await browser.close();
  console.log(`\n✅ 전체 완료! 댓글 ${totalComments}개, 좋아요 ${totalLikes}개`);
  console.log(`종료: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`);
})().catch(e => { console.error('에러:', e.message); process.exit(1); });
