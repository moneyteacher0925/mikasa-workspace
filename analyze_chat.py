import re
from collections import defaultdict

filepath = "/Users/kwoneren/.openclaw/media/inbound/file_568---4070e102-40e8-42f5-9e9b-3f363d025ed5.txt"

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse messages: [name] [time] message
msg_pattern = re.compile(r'^\[(.+?)\] \[.+?\] (.*)$')
date_pattern = re.compile(r'^-+ (\d{4}년 \d+월 \d+일 .+?) -+$')

current_date = ""
messages = []  # (date, name, text)

# Accumulate multi-line messages
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

print(f"Total messages parsed: {len(messages)}")

# Count messages per person
msg_count = defaultdict(int)
for date, name, text in messages:
    msg_count[name] += 1

print("\n=== Top 30 by message count ===")
for name, count in sorted(msg_count.items(), key=lambda x: -x[1])[:30]:
    print(f"  {name}: {count}")

# Count mission participation
mission_keywords = ['꿰미션', '꿰 미션', '꿰미', '플에', '플러스에너지', '동부리', '동기부여']
mission_count = defaultdict(int)
mission_days = defaultdict(set)
mission_texts = defaultdict(list)

for date, name, text in messages:
    lower = text.lower()
    is_mission = any(k in text for k in mission_keywords)
    if not is_mission:
        # Also check for just "꿰" at start or standalone
        if text.strip().startswith('꿰') or '꿰\n' in text:
            is_mission = True
    if is_mission:
        mission_count[name] += 1
        mission_days[name].add(date)
        mission_texts[name].append((date, text[:500]))

print("\n=== Top 30 by mission count ===")
for name, count in sorted(mission_count.items(), key=lambda x: -x[1])[:30]:
    days = len(mission_days[name])
    print(f"  {name}: {count} missions across {days} days")

# For top candidates, count interactions (replies, mentions of other names)
print("\n=== Mission day counts (unique days with missions) ===")
for name, days in sorted(mission_days.items(), key=lambda x: -len(x[1]))[:30]:
    print(f"  {name}: {len(days)} days, {mission_count[name]} missions")

