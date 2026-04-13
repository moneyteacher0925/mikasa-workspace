#!/bin/bash
# 카페별로 개별 node 프로세스 실행 (hang 방지)
cd /Users/kwoneren/.openclaw/workspace/naver-cafe-bot

CAFES=(
  "11289639|kimyoooo|지성아빠의 나눔세상"
  "18885401|ipds700|풍미인"
  "29324630|geraniumgarden|제라늄이 있는 정원"
  "25415341|ghparkstory|꽃사랑"
  "29648567|merigold|부여메리골드"
  "10553650|familygarden|텃밭과 채소키우기"
)

COMMENTS=(
  "잘 키우셨네요! 관리 비법이 궁금해요~"
  "오 대박 저도 도전해봐야겠어요!"
  "건강하게 잘 자라고 있네요~"
  "사진 보니까 기분이 좋아지네요 ㅎㅎ"
  "우와 꽃이 정말 탐스럽네요~!"
  "저도 올해는 열심히 키워봐야겠어요!"
)

IDX=0
for entry in "${CAFES[@]}"; do
  IFS='|' read -r CAFE_ID CAFE_URL CAFE_NAME <<< "$entry"
  COMMENT="${COMMENTS[$IDX]}"
  echo ""
  echo "[$((IDX+1))/${#CAFES[@]}] $CAFE_NAME"
  
  # 30초 타임아웃으로 개별 실행
  gtimeout 60 node single-comment.js "$CAFE_ID" "$CAFE_URL" "$COMMENT" 2>&1 || echo "  타임아웃/에러"
  
  IDX=$((IDX+1))
  if [ $IDX -lt ${#CAFES[@]} ]; then
    echo "  ⏱ 30초 대기..."
    sleep 30
  fi
done

echo ""
echo "전체 완료!"
