#!/usr/bin/env python3
import json, sys, urllib.request

PAGES = [
    ("메인", "355a2e3e-1084-80a3-8f7f-deaac7ae8398"),
    ("1. 작업 전 필독사항", "355a2e3e-1084-819d-b542-f4bb9a54e8e9"),
    ("2. 테더링 IP 변경방법", "355a2e3e-1084-81c7-8a0f-c89932d9584d"),
    ("3. 작업할 키워드 확인방법", "355a2e3e-1084-81a2-a9d5-c66906fd56f5"),
    ("4. 본문글 프롬포트 세팅방법", "355a2e3e-1084-813a-8207-ce33e1772571"),
    ("5. 클로드 AI를 이용한 본문글 작성법", "355a2e3e-1084-81cf-9102-f614659f80d9"),
    ("6. 이미지 작업 방법", "355a2e3e-1084-81bc-b6b9-f965fbba4e2d"),
    ("7. 이미지 재가공 방법", "355a2e3e-1084-818f-a2bc-c9db96a7ee41"),
    ("8. 작업 간의 IP 변경", "355a2e3e-1084-811a-b8dc-c4855cdb530c"),
    ("9. CCleaner를 사용한 트래픽 청소작업", "355a2e3e-1084-8124-ba4c-c19d6de7b72e"),
    ("10. 시크릿 모드를 통한 네이버 로그인", "355a2e3e-1084-81b4-ad19-dbd23a793288"),
    ("11. 본문글 업로드 방법", "355a2e3e-1084-8119-8242-e77fe9dd8791"),
    ("12. 본문글 댓글 작업방법", "355a2e3e-1084-8114-bcaf-f87508507de7"),
    ("13. 급여시트 사용법", "355a2e3e-1084-8181-9dbc-d3cbc04a63c4"),
    ("14. 기타 안내사항", "355a2e3e-1084-8159-aa74-c9ba02b0e879"),
    ("15. 댓글 내 이미지 작업방법", "355a2e3e-1084-814e-8cb8-e782da71db3a"),
]

API_URL = "https://west-havarti-19d.notion.site/api/v3/loadPageChunk"

def fetch_page(page_id):
    data = json.dumps({
        "page": {"id": page_id},
        "limit": 200,
        "cursor": {"stack": []},
        "chunkNumber": 0,
        "verticalColumns": False
    }).encode()
    req = urllib.request.Request(API_URL, data=data, headers={
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def extract_text(block_val):
    props = block_val.get("properties", {})
    title = props.get("title", [])
    texts = []
    for item in title:
        if isinstance(item, list) and len(item) > 0:
            texts.append(item[0])
    return "".join(texts)

def extract_page_content(result, page_id):
    blocks = result.get("recordMap", {}).get("block", {})
    page_block = blocks.get(page_id, {})
    page_val = page_block.get("value", {}).get("value", {})
    content_ids = page_val.get("content", [])
    
    lines = []
    for cid in content_ids:
        block = blocks.get(cid, {})
        val = block.get("value", {}).get("value", {})
        btype = val.get("type", "")
        text = extract_text(val)
        
        if btype == "header":
            lines.append(f"# {text}")
        elif btype == "sub_header":
            lines.append(f"## {text}")
        elif btype == "sub_sub_header":
            lines.append(f"### {text}")
        elif btype == "bulleted_list":
            lines.append(f"- {text}")
        elif btype == "numbered_list":
            lines.append(f"1. {text}")
        elif btype == "to_do":
            lines.append(f"- [ ] {text}")
        elif btype == "toggle":
            lines.append(f"▶ {text}")
        elif btype == "callout":
            lines.append(f"> ⚠️ {text}")
        elif btype == "quote":
            lines.append(f"> {text}")
        elif btype == "divider":
            lines.append("---")
        elif btype == "image":
            lines.append("[이미지]")
        elif btype == "video":
            lines.append("[동영상]")
        elif text:
            lines.append(text)
        
        # Nested blocks
        sub_ids = val.get("content", [])
        for sid in sub_ids:
            sblock = blocks.get(sid, {})
            sval = sblock.get("value", {}).get("value", {})
            stype = sval.get("type", "")
            stext = extract_text(sval)
            if stext:
                lines.append(f"  - {stext}")
            elif stype == "image":
                lines.append("  [이미지]")
            # sub-sub nested
            ssub_ids = sval.get("content", [])
            for ssid in ssub_ids:
                ssblock = blocks.get(ssid, {})
                ssval = ssblock.get("value", {}).get("value", {})
                sstext = extract_text(ssval)
                if sstext:
                    lines.append(f"    - {sstext}")
    
    return "\n".join(lines)

results = {}
for name, pid in PAGES:
    try:
        data = fetch_page(pid)
        content = extract_page_content(data, pid)
        results[name] = content
        print(f"✅ {name}: {len(content)} chars", file=sys.stderr)
    except Exception as e:
        results[name] = f"[오류: {e}]"
        print(f"❌ {name}: {e}", file=sys.stderr)

print(json.dumps(results, ensure_ascii=False, indent=2))
