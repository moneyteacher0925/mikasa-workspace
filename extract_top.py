import re
from collections import defaultdict

filepath = "/Users/kwoneren/.openclaw/media/inbound/file_568---4070e102-40e8-42f5-9e9b-3f363d025ed5.txt"

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

msg_pattern = re.compile(r'^\[(.+?)\] \[.+?\] (.*)$')
date_pattern = re.compile(r'^-+ (\d{4}년 \d+월 \d+일 .+?) -+$')

current_date = ""
messages = []
current_name = None
current_text = ""

for line in lines:
    line = line.rstrip('\n')
    dm = date_pattern.match(line)
    if dm:
        if current_name:
            messages.append((current_date, current_name, current_text))
            current_name = None
            current_text = ""
        current_date = dm.group(1)
        continue
    mm = msg_pattern.match(line)
    if mm:
        if current_name:
            messages.append((current_date, current_name, current_text))
        current_name = mm.group(1)
        current_text = mm.group(2)
    else:
        if current_name:
            current_text += "\n" + line

if current_name:
    messages.append((current_date, current_name, current_text))

# Top candidates (excluding 권현우): 김기범, 김용화, 한우영, 김부건, 정외덕, 오병채, 정소희
# Let's extract sample 꿰미션 texts for these top people
targets = ['김기범', '김용화', '한우영', '김부건', '정외덕', '오병채', '정소희', '표경래', '정재영']

mission_keywords = ['꿰미션', '꿰 미션', '꿰미', '플에', '플러스에너지', '동부리', '동기부여']

for target in targets:
    print(f"\n{'='*60}")
    print(f"=== {target} - Sample missions ===")
    print(f"{'='*60}")
    count = 0
    for date, name, text in messages:
        if name != target:
            continue
        is_mission = any(k in text for k in mission_keywords) or text.strip().startswith('꿰')
        if is_mission and count < 5:
            print(f"\n[{date}]")
            print(text[:600])
            print("---")
            count += 1
    
    # Also check for interactions (mentions of others, 응원, 화이팅, etc)
    interaction_count = 0
    for date, name, text in messages:
        if name != target:
            continue
        if any(w in text for w in ['화이팅', '응원', '대박', '멋져', '좋아요', '짝짝', '👏', '🔥', '💪', '잘하', '최고']):
            interaction_count += 1
    print(f"\n상호작용 메시지 수: {interaction_count}")

