// Google Apps Script - 딱모여 재테크 모임 신청서
function createFinanceForm() {
  var form = FormApp.create('[딱모여] 재테크 모임 신청서');
  form.setDescription(
    '💰 딱모여 재테크 모임에 관심을 가져주셔서 감사합니다!\n\n' +
    '같은 관심사를 가진 사람들과 함께 재테크 이야기를 나누는 오프라인 모임입니다.\n' +
    '아래 정보를 입력해주시면 모임 안내를 도와드리겠습니다.\n\n' +
    '⏱ 작성 소요시간: 약 2분'
  );
  form.setConfirmationMessage(
    '✅ 신청이 완료되었습니다!\n\n' +
    '💳 참가비 입금 안내\n' +
    '━━━━━━━━━━━━━━━━\n' +
    '은행: (은행명)\n' +
    '계좌번호: (계좌번호)\n' +
    '예금주: 주식회사 플로우머스\n' +
    '⚠️ 반드시 신청자 본인 이름으로 입금해주세요!\n' +
    '━━━━━━━━━━━━━━━━\n\n' +
    '입금 확인 후 카카오톡으로 오픈채팅방 링크를 보내드립니다.\n' +
    '문의: (연락처)'
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);

  // === 섹션 1: 기본 정보 ===
  form.addSectionHeaderItem()
    .setTitle('📋 기본 정보')
    .setHelpText('모임 안내 및 연락을 위해 필요합니다.');

  form.addTextItem()
    .setTitle('이름')
    .setHelpText('실명을 입력해주세요. (입금자명과 일치해야 합니다)')
    .setRequired(true);

  form.addTextItem()
    .setTitle('연락처')
    .setHelpText('카카오톡 오픈채팅방 링크를 보내드릴 번호입니다. (예: 010-1234-5678)')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('성별')
    .setChoiceValues(['남성', '여성'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('나이대')
    .setChoiceValues(['20대 초반 (20~23)', '20대 중후반 (24~29)', '30대 초반 (30~34)', '30대 중후반 (35~39)', '40대 이상'])
    .setRequired(true);

  form.addTextItem()
    .setTitle('거주 지역')
    .setHelpText('예: 서울 강남구, 경기 성남시')
    .setRequired(true);

  form.addTextItem()
    .setTitle('직업')
    .setHelpText('예: 회사원, 자영업, 프리랜서, 대학생')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('MBTI')
    .setHelpText('모르시면 "모름"을 선택해주세요.')
    .setChoiceValues(['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ','모름'])
    .setRequired(true);

  // === 섹션 2: 재테크 관심사 ===
  form.addSectionHeaderItem()
    .setTitle('💰 재테크 관심사')
    .setHelpText('모임 구성에 참고됩니다.');

  form.addCheckboxItem()
    .setTitle('관심 재테크 분야 (복수 선택 가능)')
    .setChoiceValues(['주식 (국내/해외)', '부동산 (투자/임대)', '코인 (암호화폐)', '기타 (예: 금 투자, ISA 계좌 등)'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('투자 경험')
    .setChoiceValues(['아직 시작 전 (관심만 있어요)', '1년 미만 (초보)', '1~3년 (어느 정도 해봤어요)', '3년 이상 (경험 많아요)'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('투자 가능 자금')
    .setHelpText('대략적인 범위로 선택해주세요. 모임 구성 참고용이며 외부에 공개되지 않습니다.')
    .setChoiceValues(['100만원 미만', '100만원 ~ 500만원', '500만원 ~ 1,000만원', '1,000만원 ~ 5,000만원', '5,000만원 이상', '밝히고 싶지 않음'])
    .setRequired(true);

  // === 섹션 3: 모임 참여 ===
  form.addSectionHeaderItem()
    .setTitle('🤝 모임 참여')
    .setHelpText('더 좋은 모임을 만들기 위한 질문입니다.');

  form.addParagraphTextItem()
    .setTitle('참여 동기 / 모임에서 기대하는 점')
    .setHelpText('자유롭게 작성해주세요.')
    .setRequired(true);

  form.addTextItem()
    .setTitle('함께 오는 분 이름')
    .setHelpText('없으면 "없음"이라고 적어주세요. 친구와 함께 오시면 할인 혜택이 있습니다!')
    .setRequired(true);

  // === 섹션 4: 입금 안내 ===
  form.addSectionHeaderItem()
    .setTitle('💳 참가비 입금 안내')
    .setHelpText(
      '━━━━━━━━━━━━━━━━\n' +
      '은행: (은행명)\n' +
      '계좌번호: (계좌번호)\n' +
      '예금주: 주식회사 플로우머스\n' +
      '━━━━━━━━━━━━━━━━\n\n' +
      '⚠️ 반드시 신청자 본인 이름으로 입금해주세요!\n' +
      '입금자명이 다를 경우 확인이 어려울 수 있습니다.\n\n' +
      '입금 확인 후 카카오톡으로 오픈채팅방 링크를 보내드립니다.'
    );

  // === 개인정보 수집 동의 ===
  form.addCheckboxItem()
    .setTitle('개인정보 수집 및 이용 동의')
    .setHelpText(
      '[개인정보 수집 및 이용 동의]\n\n' +
      '1. 수집 항목: 이름, 연락처, 성별, 나이대, 거주지역, 직업, MBTI, 투자 관심 분야, 투자 경험, 투자 가능 자금\n\n' +
      '2. 수집 목적:\n' +
      '   - 모임 운영 및 안내 (참가 확인, 입금 확인, 오픈채팅방 안내)\n' +
      '   - 맞춤형 모임 추천 및 마케팅 정보 제공\n' +
      '   - 서비스 개선을 위한 통계 분석\n\n' +
      '3. 보유 기간: 수집일로부터 1년 (목적 달성 후 지체 없이 파기)\n\n' +
      '4. 동의를 거부할 권리가 있으나, 거부 시 모임 신청이 불가합니다.\n\n' +
      '주식회사 플로우머스'
    )
    .setChoiceValues(['위 개인정보 수집 및 이용에 동의합니다.'])
    .setRequired(true);

  Logger.log('폼 생성 완료!');
  Logger.log('편집 URL: ' + form.getEditUrl());
  Logger.log('응답 URL: ' + form.getPublishedUrl());
}
