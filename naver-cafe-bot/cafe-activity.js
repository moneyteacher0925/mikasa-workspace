#!/usr/bin/env node
/**
 * 카페 활동 자동화 (안전 모드)
 * - 카페별 최근 글에 자연스러운 댓글 1~2개
 * - 좋아요 클릭
 * - 간격: 글 사이 30~60초, 카페 사이 3~5분
 * 
 * Usage: NAVER_ACCOUNT=acrogatden node cafe-activity.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ACCOUNT = process.env.NAVER_ACCOUNT || 'acrogatden';
const COOKIE_PATH = path.join(__dirname, 'cookies', ACCOUNT + '.json');
const delay = ms => new Promise(r => setTimeout(r, ms + Math.random() * ms * 0.5));

// 카페 주제에 맞는 자연스러운 댓글 풀
const COMMENTS = {
  plant: [
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
  ],
  garden: [
    '텃밭 준비하시는군요~ 올해도 풍작 기원합니다!',
    '와 벌써 파종하셨군요! 저도 서둘러야겠어요',
    '좋은 정보 감사합니다! 참고할게요~',
    '올해 처음 도전해보려구요 ㅎㅎ 도움 많이 됩니다',
    '역시 경험이 많으시네요~ 배워갑니다!',
  ],
  general: [
    '좋은 글 감사합니다~',
    '잘 읽었습니다 ㅎㅎ',
    '오 좋은 정보네요!',
    '공감합니다~',
    '감사해요! 도움이 많이 됩니다',
  ]
};

function getRandomComment(cafeName) {
  const name = cafeName.toLowerCase();
  let pool;
  if (name.includes('텃밭') || name.includes('채소') || name.includes('귀농') || name.includes('전원')) {
    pool = [...COMMENTS.garden, ...COMMENTS.general];
  } else if (name.includes('토분') || name.includes('제라늄') || name.includes('꽃') || name.includes('풍') || name.includes('메리골드') || name.includes('식물') || name.includes('정원')) {
    pool = [...COMMENTS.plant, ...COMMENTS.general];
  } else {
    pool = [...COMMENTS.plant, ...COMMENTS.general];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function fetchJson(urlPath, cookies) {
  const cookieStr = cookies.map(c => c.name + '=' + c.value).join('; ');
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'apis.naver.com',
      path: urlPath,
      headers: { 'Cookie': cookieStr, 'Referer': 'https://cafe.naver.com/' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    }).on('error', reject);
  });
}

async function setupBrowser(cookies) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  for (const c of cookies) {
    try {
      await page.setCookie({ name: c.name, value: String(c.value), domain: c.domain, path: c.path || '/', httpOnly: !!c.httpOnly, secure: !!c.secure, ...(c.expires > 0 ? { expires: c.expires } : {}) });
    } catch (e) {}
  }
  return { browser, page };
}

async function likeArticle(page, cafeUrl, articleId) {
  try {
    await page.goto(`https://cafe.naver.com/${cafeUrl}/${articleId}`, { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(2000);
    
    // iframe 안에 있는 경우
    const frames = page.frames();
    let targetFrame = page;
    for (const f of frames) {
      if (f.url().includes('ArticleRead')) {
        targetFrame = f;
        break;
      }
    }
    
    // 좋아요 버튼 클릭
    const liked = await targetFrame.evaluate(() => {
      const btn = document.querySelector('.u_likeit_list_btn, .button_like, [class*="like"], .se-module-oglink');
      // 좋아요 API 직접 호출
      return false;
    });
    
    return liked;
  } catch (e) {
    console.log('  좋아요 실패:', e.message);
    return false;
  }
}

async function postComment(page, cafeId, cafeUrl, articleId, comment) {
  try {
    const url = `https://cafe.naver.com/${cafeUrl}/${articleId}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(3000);
    
    // iframe 찾기
    const frames = page.frames();
    let articleFrame = null;
    for (const f of frames) {
      if (f.url().includes('ArticleRead') || f.url().includes('articleid')) {
        articleFrame = f;
        break;
      }
    }
    
    if (!articleFrame) {
      console.log('  iframe 못 찾음, 직접 페이지에서 시도');
      articleFrame = page;
    }
    
    // 댓글 입력란 찾기 & 입력
    const commentArea = await articleFrame.$('textarea.comment_inbox, .comment_inbox textarea, textarea[placeholder*="댓글"], .CommentWriter textarea');
    if (commentArea) {
      await commentArea.click();
      await delay(1000);
      
      // CDP로 한글 입력
      const client = await articleFrame._client?.() || await page.createCDPSession();
      await client.send('Input.insertText', { text: comment });
      await delay(1000);
      
      // 등록 버튼 클릭
      const submitBtn = await articleFrame.$('a.btn_register, button.btn_register, .comment_attach .btn_type, [class*="submit"], [class*="register"]');
      if (submitBtn) {
        await submitBtn.click();
        await delay(2000);
        console.log('  ✅ 댓글 등록: "' + comment.substring(0, 30) + '..."');
        return true;
      } else {
        console.log('  등록 버튼 못 찾음');
      }
    } else {
      console.log('  댓글 입력란 못 찾음');
    }
    return false;
  } catch (e) {
    console.log('  댓글 실패:', e.message);
    return false;
  }
}

// 댓글 API 직접 호출 방식
async function postCommentAPI(cookies, cafeId, articleId, comment) {
  const cookieStr = cookies.map(c => c.name + '=' + c.value).join('; ');
  
  return new Promise((resolve) => {
    const body = JSON.stringify({
      content: comment,
      stickerId: '',
      parentCommentNo: 0
    });
    
    const req = https.request({
      hostname: 'apis.naver.com',
      path: `/cafe-web/cafe-articleapi/v2.1/cafes/${cafeId}/articles/${articleId}/comments`,
      method: 'POST',
      headers: {
        'Cookie': cookieStr,
        'Content-Type': 'application/json',
        'Referer': `https://cafe.naver.com/`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.result && j.result.commentId) {
            resolve({ ok: true, commentId: j.result.commentId });
          } else {
            resolve({ ok: false, raw: d.substring(0, 200) });
          }
        } catch(e) { resolve({ ok: false, raw: d.substring(0, 200) }); }
      });
    });
    req.on('error', e => resolve({ ok: false, err: e.message }));
    req.write(body);
    req.end();
  });
}

// 좋아요 API 직접 호출
async function likeArticleAPI(cookies, cafeId, articleId) {
  const cookieStr = cookies.map(c => c.name + '=' + c.value).join('; ');
  
  return new Promise((resolve) => {
    const body = JSON.stringify({ reactionType: 'like' });
    
    const req = https.request({
      hostname: 'apis.naver.com',
      path: `/cafe-web/cafe-articleapi/v2/cafes/${cafeId}/articles/${articleId}/reaction`,
      method: 'POST',
      headers: {
        'Cookie': cookieStr,
        'Content-Type': 'application/json',
        'Referer': `https://cafe.naver.com/`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d.substring(0, 200) }); }
      });
    });
    req.on('error', e => resolve({ err: e.message }));
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log(`\n🌱 카페 활동 시작 [계정: ${ACCOUNT}]\n`);
  
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
  
  // 가입 카페 목록 가져오기
  const cafeData = await fetchJson('/cafe-home-web/cafe-home/v1/cafes/join?page=1&perPage=50&orderBy.field=LAST_VISIT_DATE&orderBy.direction=DESC', cookies);
  
  if (!cafeData || !cafeData.message || !cafeData.message.result) {
    console.error('카페 목록 가져오기 실패');
    process.exit(1);
  }
  
  const cafes = cafeData.message.result.cafes;
  console.log(`가입 카페 ${cafes.length}개 발견\n`);
  
  let totalComments = 0;
  let totalLikes = 0;
  
  for (let i = 0; i < cafes.length; i++) {
    const cafe = cafes[i];
    console.log(`\n[${ i + 1}/${cafes.length}] ${cafe.cafeName} (/${cafe.cafeUrl})`);
    
    // 최근 글 가져오기
    const articles = await fetchJson(`/cafe-web/cafe2/ArticleListV2dot1.json?search.clubid=${cafe.cafeId}&search.queryType=lastArticle&search.page=1&search.perPage=5`, cookies);
    
    if (!articles || !articles.message || !articles.message.result) {
      console.log('  글 목록 가져오기 실패, 스킵');
      continue;
    }
    
    const articleList = articles.message.result.articleList || [];
    if (articleList.length === 0) {
      console.log('  최근 글 없음, 스킵');
      continue;
    }
    
    // 1~2개 글에 활동
    const targetCount = Math.random() > 0.5 ? 2 : 1;
    
    for (let j = 0; j < Math.min(targetCount, articleList.length); j++) {
      const article = articleList[j];
      console.log(`  📝 [${article.articleId}] ${article.subject.substring(0, 40)}`);
      
      // 광고성/공지 글 스킵
      if (article.subject.includes('판매') || article.subject.includes('할인') || article.subject.includes('세일')) {
        console.log('  ⏭ 광고성 글 스킵');
        continue;
      }
      
      // 좋아요
      const likeResult = await likeArticleAPI(cookies, cafe.cafeId, article.articleId);
      if (likeResult.result || (likeResult.message && likeResult.message.status === '200')) {
        console.log('  👍 좋아요 완료');
        totalLikes++;
      } else {
        console.log('  👍 좋아요:', JSON.stringify(likeResult).substring(0, 100));
      }
      
      await delay(5000); // 5초 대기
      
      // 댓글
      const comment = getRandomComment(cafe.cafeName);
      const commentResult = await postCommentAPI(cookies, cafe.cafeId, article.articleId, comment);
      if (commentResult.ok) {
        console.log(`  💬 댓글 완료: "${comment}"`);
        totalComments++;
      } else {
        console.log('  💬 댓글:', JSON.stringify(commentResult).substring(0, 150));
      }
      
      // 글 사이 30~60초 대기
      if (j < targetCount - 1) {
        const waitSec = 30 + Math.floor(Math.random() * 30);
        console.log(`  ⏱ ${waitSec}초 대기...`);
        await delay(waitSec * 1000);
      }
    }
    
    // 카페 사이 3~5분 대기 (마지막 카페 제외)
    if (i < cafes.length - 1) {
      const waitMin = 3 + Math.floor(Math.random() * 2);
      console.log(`\n⏱ 다음 카페까지 ${waitMin}분 대기...`);
      await delay(waitMin * 60 * 1000);
    }
  }
  
  console.log(`\n✅ 활동 완료! 댓글 ${totalComments}개, 좋아요 ${totalLikes}개\n`);
})().catch(e => {
  console.error('에러:', e.message);
  process.exit(1);
});
