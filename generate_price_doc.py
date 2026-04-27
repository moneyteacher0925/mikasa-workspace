import openpyxl
from datetime import datetime

wb = openpyxl.load_workbook('/Users/kwoneren/.openclaw/media/inbound/file_1046---30ea2f97-6bfc-47c4-8725-c059a7d96b24.xlsx')
ws = wb['Sheet1']

rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    sku = row[0]
    name = row[1]
    current = row[5]  # 쿠팡납품가
    new_price = round(row[8] * 0.65)  # 쿠팡요청판매가 * 0.65
    req_sale = row[8]  # 쿠팡요청판매가
    if current and new_price:
        diff = new_price - current
        pct = round((diff / current) * 100, 1) if current > 0 else 0
        rows.append((sku, name, current, new_price, diff, pct, req_sale))

# Generate HTML for PDF
html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>납품가 인상 요청 공문</title>
<style>
  @page {{ margin: 20mm 15mm; size: A4; }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-size: 11px; color: #222; padding: 30px; line-height: 1.6; }}
  .header {{ text-align: center; margin-bottom: 30px; border-bottom: 3px double #333; padding-bottom: 15px; }}
  .header h1 {{ font-size: 22px; letter-spacing: 8px; margin-bottom: 5px; }}
  .doc-info {{ display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 12px; }}
  .doc-info div {{ line-height: 1.8; }}
  .body-text {{ font-size: 12px; line-height: 1.8; margin-bottom: 20px; }}
  .body-text p {{ margin-bottom: 10px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 20px; }}
  th {{ background: #f5f5f5; border: 1px solid #ccc; padding: 5px 4px; text-align: center; font-weight: 600; }}
  td {{ border: 1px solid #ddd; padding: 4px; text-align: center; }}
  td.name {{ text-align: left; font-size: 8.5px; max-width: 250px; word-break: keep-all; }}
  td.num {{ text-align: right; }}
  .up {{ color: #c00; }}
  .footer {{ margin-top: 30px; text-align: center; }}
  .footer .company {{ font-size: 16px; font-weight: 700; margin-bottom: 5px; }}
  .stamp {{ margin-top: 20px; }}
  .summary {{ background: #f9f9f9; padding: 12px 15px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 20px; font-size: 12px; }}
</style>
</head>
<body>

<div class="header">
  <h1>공 &nbsp; 문</h1>
  <p style="font-size:13px;">납품가격 인상 요청의 건</p>
</div>

<div class="doc-info">
  <div>
    <strong>수 신:</strong> 쿠팡 주식회사 홈데코팀 김지영 MD님<br>
    <strong>발 신:</strong> 가든잇 주식회사 (Vendor ID: A00695038)<br>
    <strong>제 목:</strong> 로켓배송 납품가격 인상 요청
  </div>
  <div style="text-align:right;">
    <strong>문서번호:</strong> GI-2026-0427-001<br>
    <strong>발신일자:</strong> 2026년 04월 27일<br>
    <strong>페 이 지:</strong> 1/{len(rows)//40 + 2}
  </div>
</div>

<div class="body-text">
  <p>안녕하세요, 가든잇 주식회사입니다.</p>
  <p>귀사의 무궁한 발전을 기원합니다.</p>
  <p>최근 원자재 가격 상승, 물류비 인상, 포장재 단가 변동 등으로 인해 기존 납품가격으로는 안정적인 공급이 어려운 상황입니다. 이에 아래와 같이 납품가격 인상을 요청드리오니 검토 부탁드립니다.</p>
</div>

<div class="summary">
  <strong>요청 개요</strong><br>
  • 대상 SKU: {len(rows)}건<br>
  • 적용 요청일: 협의 후 결정<br>
  • 인상 사유: 원자재 가격 상승, 물류비 인상, 포장재 단가 변동
</div>

<table>
  <thead>
    <tr>
      <th style="width:60px;">SKU</th>
      <th>상품명</th>
      <th style="width:65px;">현 납품가</th>
      <th style="width:65px;">요청 납품가</th>
      <th style="width:55px;">인상액</th>
      <th style="width:45px;">인상률</th>
      <th style="width:65px;">요청 판매가</th>
    </tr>
  </thead>
  <tbody>
"""

for sku, name, cur, new, diff, pct, req_sale in rows:
    html += f"""    <tr>
      <td>{sku}</td>
      <td class="name">{name}</td>
      <td class="num">{cur:,}원</td>
      <td class="num">{new:,}원</td>
      <td class="num up">{'+' if diff > 0 else ''}{diff:,}원</td>
      <td class="up">{'+' if pct > 0 else ''}{pct}%</td>
      <td class="num">{req_sale:,}원</td>
    </tr>
"""

html += """  </tbody>
</table>

<div class="body-text">
  <p>상기 가격은 현 시장 상황과 원가 구조를 반영한 최소한의 조정 요청이며, 귀사와의 지속적인 파트너십을 위해 최대한 합리적인 수준에서 책정하였습니다.</p>
  <p>원활한 상품 공급과 품질 유지를 위해 긍정적인 검토를 부탁드립니다.</p>
  <p>감사합니다.</p>
</div>

<div class="footer">
  <div class="company">가든잇 주식회사</div>
  <p>대표이사 권현우</p>
  <p style="font-size:10px; color:#888; margin-top:10px;">
    사업자등록번호: (기재) | 주소: (기재)<br>
    연락처: (기재) | 이메일: (기재)
  </p>
</div>

</body>
</html>
"""

with open('/Users/kwoneren/.openclaw/workspace/price-increase-letter.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Done! {len(rows)} SKUs processed')

# Stats
increases = [r for r in rows if r[4] > 0]
decreases = [r for r in rows if r[4] < 0]
same = [r for r in rows if r[4] == 0]
avg_pct = sum(r[5] for r in rows) / len(rows) if rows else 0
print(f'Increases: {len(increases)}, Decreases: {len(decreases)}, Same: {len(same)}')
print(f'Avg change: {avg_pct:.1f}%')
