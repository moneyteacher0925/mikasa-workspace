from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
import os

# 한글 폰트 등록
pdfmetrics.registerFont(UnicodeCIDFont('HYSMyeongJo-Medium'))
# Check for a TTF font
font_paths = [
    '/System/Library/Fonts/AppleSDGothicNeo.ttc',
    '/System/Library/Fonts/Supplemental/AppleGothic.ttf',
]
from reportlab.pdfbase.ttfonts import TTFont

# Try Apple SD Gothic Neo
try:
    from reportlab.pdfbase.ttfonts import TTFont
    pdfmetrics.registerFont(TTFont('AppleGothic', '/System/Library/Fonts/Supplemental/AppleGothic.ttf'))
    FONT = 'AppleGothic'
except:
    FONT = 'HYSMyeongJo-Medium'

BLUE = HexColor('#1E3A8A')
LIGHT_BLUE = HexColor('#DBEAFE')
GRAY = HexColor('#6B7280')
DARK = HexColor('#1F2937')
LIGHT_GRAY = HexColor('#F3F4F6')
ACCENT = HexColor('#3B82F6')

styles = getSampleStyleSheet()

# Custom styles
title_style = ParagraphStyle('Title2', fontName=FONT, fontSize=24, textColor=BLUE, alignment=TA_CENTER, spaceAfter=6, leading=30)
subtitle_style = ParagraphStyle('Sub', fontName=FONT, fontSize=14, textColor=GRAY, alignment=TA_CENTER, spaceAfter=20, leading=18)
h1_style = ParagraphStyle('H1', fontName=FONT, fontSize=16, textColor=BLUE, spaceBefore=20, spaceAfter=10, leading=22)
h2_style = ParagraphStyle('H2', fontName=FONT, fontSize=13, textColor=DARK, spaceBefore=14, spaceAfter=6, leading=18)
body_style = ParagraphStyle('Body', fontName=FONT, fontSize=10.5, textColor=DARK, spaceAfter=4, leading=16, leftIndent=10)
bullet_style = ParagraphStyle('Bullet', fontName=FONT, fontSize=10.5, textColor=DARK, spaceAfter=4, leading=16, leftIndent=20, bulletIndent=10)
quote_style = ParagraphStyle('Quote', fontName=FONT, fontSize=10, textColor=GRAY, spaceAfter=6, leading=15, leftIndent=30, rightIndent=20)
tag_style = ParagraphStyle('Tag', fontName=FONT, fontSize=11, textColor=BLUE, spaceBefore=4, spaceAfter=4, leading=16, leftIndent=10)
small_style = ParagraphStyle('Small', fontName=FONT, fontSize=9, textColor=GRAY, alignment=TA_CENTER, spaceAfter=4)

doc = SimpleDocTemplate(
    '/Users/kwoneren/.openclaw/workspace/엠타트업22기_4조_미션의도파악_0525.pdf',
    pagesize=A4,
    topMargin=2*cm, bottomMargin=2*cm, leftMargin=2.5*cm, rightMargin=2.5*cm
)

story = []

# ══ 표지 ══
story.append(Spacer(1, 80))
story.append(Paragraph('엠타트업 22기 — 4조', title_style))
story.append(Spacer(1, 10))
story.append(Paragraph('미션 의도 파악 스터디 리포트', subtitle_style))
story.append(Spacer(1, 20))
story.append(Paragraph('2026년 5월 25일 (월) 20:00', small_style))
story.append(Paragraph('정리: 39번 유아영', small_style))
story.append(PageBreak())

def divider():
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor('#E5E7EB')))
    story.append(Spacer(1, 10))

def h1(t): story.append(Paragraph(t, h1_style))
def h2(t): story.append(Paragraph(t, h2_style))
def body(t): story.append(Paragraph(t, body_style))
def bullet(t): story.append(Paragraph(f'• {t}', bullet_style))
def quote(t): story.append(Paragraph(f'"{t}"', quote_style))
def tag(label, val): story.append(Paragraph(f'<b>[{label}]</b> {val}', tag_style))
def sp(h=8): story.append(Spacer(1, h))

# ══ 미션 1 ══
h1('미션 1 — BB 예측')
sp()
tag('BB 예측', '55번')
sp()
h2('분석')
bullet('<b>표면적:</b> 정말 좋아했던 경험 기반으로 하는 게 맞을 듯')
bullet('<b>심층적:</b> 욕구 기반 접근 / 설득력이 중요')
sp()
h2('추가 인사이트')
bullet('21기에서 모바일 vs PC 비율도 언급된 적 있음')
bullet('예시: "서울 혼술바" — 지방에서 각잡고 올라오는 것 vs 홍대 근처에서 약속 끝나고 검색하는 것')
bullet('→ 같은 키워드라도 타겟의 상황/맥락이 다르다')
divider()

# ══ 미션 2 ══
h1('미션 2 — 프레임 조종 (타겟 프레임 조종 미션)')
sp()
h2('미션 의도')
bullet('더블바인드 활용')
bullet('"나한테 있는 프레임" 수준이 아니라 <b>성장과 연결</b>하는 방향으로 써야 함')
sp()
h2('BB 예측')
bullet('<b>라온님:</b> "이혼" 프레임')
bullet('<b>솔지님 (93번):</b> "여성" 프레임')
bullet('<b>엠군님:</b> (미공개)')
divider()

# ══ 미션 3 ══
h1('미션 3 — 욕구 + 사이드 R')
sp()
h2('미션 의도')
bullet('욕구에만 초점 맞추면 안 됨')
bullet('망가지는 걸 계속 망가지게 두고, 거기서 내 이득만 취하라')
bullet('핵심: <b>"이득의 교집합"</b>을 생각하라')
bullet('"타겟이 갖고 있는 욕구 안에서 이득을 보라"')
bullet('일단 타겟이 하는 걸 무조건 시키고 나서 + 알파')
sp()
h2('예시')
bullet('전자담배 — 100억 번의 영향을 받았을 것')
bullet('고등학생 술 뚫어주는 사례')
sp()
h2('BB 예측')
bullet('<b>20번:</b> 음주단속 알림 어플')
bullet('<b>31번:</b> 스포츠토토 AI 프로그램')
sp()
h2('결과')
tag('PP', '27번, 77번')
tag('BB', '16번 (에이즈)')
divider()

# ══ 미션 4 ══
h1('미션 4 — 무의식 조종 미션')
sp()
h2('미션 의도')
bullet('나에게 마이너스를 끼칠 안 좋은 프레임을 바꿔주기')
bullet('내 이득과 연결되도록 조종하라')
bullet('핵심 질문: <b>"당위성이 있나?"</b>')
sp()
h2('예시')
bullet('엠군님 어머님 물 받으시는 사례')
bullet('→ 엠군님의 이득으로 연결되도록 프레임 전환')
divider()

# ══ 미션 5 ══
h1('미션 5 — 프레임 분리')
sp()
h2('미션 의도')
bullet('프레임 분리를 <b>"타겟"</b> 기준으로 하라')
bullet('분리만 하면 안 됨 → 분리 후 이득이 되어야 진짜 분리')
sp()
h2('21기 재미션 사례')
bullet('재미션 이유: 분리만 하고 이득 연결을 안 한 사람이 많았음')
sp()
quote('여러분들은 프레임 분리를 하라는데 탈출을 했다. 분리한 다음에 이득이 되어야지 분리가 된 건데, 무리에서 떨어지라 했더니 무인도로 던져버리면 어떡하냐')
sp()
h2('핵심 포인트')
bullet('타겟이 <b>"가치를 느끼도록"</b> 하는 게 핵심')
bullet('가치 더하기는 기본')
sp()
h2('21기 BB 예시')
body('<b>"괄사가 아니다. 얼굴 조각칼이다"</b>')
bullet('→ 같은 제품, 프레임만 분리했는데 가치가 완전히 달라짐')
divider()

# ══ 미션 6 ══
h1('미션 6 — 적의 적은 내 편')
sp()
h2('미션 의도')
bullet('"적의 적은 내 편, 적은 곧 목표다"')
bullet('나와 팬덤의 적을 명확히 하라')
bullet('탄핵봉처럼 내 팬덤의 색도 뚜렷하게 만들어 놓고 → 적을 적어야 함')
sp()
h2('예시')
bullet('파란색 지지자 (정치 팬덤)')
bullet('아나키')
divider()

# ══ 요약 테이블 ══
h1('미션별 핵심 키워드 요약')
sp()

table_data = [
    ['미션', '핵심 의도', '키워드'],
    ['1번', 'BB 예측 + 타겟 맥락 분석', '욕구, 설득력, 모바일/PC'],
    ['2번', '프레임 조종 → 성장 연결', '더블바인드, 성장'],
    ['3번', '욕구 + 사이드R → 이득의 교집합', '욕구, 교집합, +알파'],
    ['4번', '무의식 프레임 → 내 이득 연결', '무의식, 당위성'],
    ['5번', '프레임 분리 → 타겟 가치', '탈출X 분리O, 가치더하기'],
    ['6번', '적의 적은 내 편 → 팬덤 색깔', '적=목표, 팬덤'],
]

# Wrap in Paragraphs for font
cell_style = ParagraphStyle('Cell', fontName=FONT, fontSize=9.5, textColor=DARK, leading=14)
cell_header = ParagraphStyle('CellH', fontName=FONT, fontSize=10, textColor=white, leading=14)

t_data = []
for i, row in enumerate(table_data):
    if i == 0:
        t_data.append([Paragraph(c, cell_header) for c in row])
    else:
        t_data.append([Paragraph(c, cell_style) for c in row])

t = Table(t_data, colWidths=[60, 180, 200])
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), BLUE),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('FONTNAME', (0, 0), (-1, -1), FONT),
    ('FONTSIZE', (0, 0), (-1, -1), 9.5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ('BACKGROUND', (0, 1), (-1, -1), LIGHT_GRAY),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E5E7EB')),
]))
story.append(t)

doc.build(story)
print('OK')
