#!/bin/bash
# 엠타트업 21기 전체 강의 자동 다운로드 + Whisper 음성인식 스크립트
# 사용법: ./transcribe_all.sh

set -e

WHISPER="/tmp/whisper-env/bin/whisper"
WORKSPACE="/Users/kwoneren/.openclaw/workspace"
VIMEO_IDS="$WORKSPACE/memory/vimeo-ids.json"
AUDIO_DIR="/tmp/emtartup_audio"
TRANSCRIPT_DIR="$WORKSPACE/memory/transcripts"
PROGRESS_FILE="$WORKSPACE/memory/transcribe-progress.json"
REFERER="https://proveu.co.kr/mypage/69"

mkdir -p "$AUDIO_DIR" "$TRANSCRIPT_DIR"

# Initialize progress file if not exists
if [ ! -f "$PROGRESS_FILE" ]; then
    echo '{"completed": [], "failed": [], "current": null}' > "$PROGRESS_FILE"
fi

# Get total count
TOTAL=$(python3 -c "import json; data=json.load(open('$VIMEO_IDS')); print(len(data))")
echo "=== 총 ${TOTAL}개 영상 처리 시작 ==="
echo "시작 시간: $(date)"

# Process each video
python3 -c "
import json, subprocess, os, sys

vimeo_ids = json.load(open('$VIMEO_IDS'))
progress_file = '$PROGRESS_FILE'
audio_dir = '$AUDIO_DIR'
transcript_dir = '$TRANSCRIPT_DIR'
whisper = '$WHISPER'
referer = '$REFERER'

# Load progress
progress = json.load(open(progress_file))
completed = set(progress.get('completed', []))

for i, video in enumerate(vimeo_ids):
    vid = video['vimeo_id']
    week = video['week']
    idx = video['index']
    title = video['title']
    
    key = f'w{week}_{idx}_{vid}'
    
    if key in completed:
        print(f'[{i+1}/{len(vimeo_ids)}] SKIP (already done): {title}')
        continue
    
    print(f'[{i+1}/{len(vimeo_ids)}] Processing: W{week} - {title} (vimeo:{vid})')
    
    # Update current
    progress['current'] = {'week': week, 'index': idx, 'title': title, 'vimeo_id': vid}
    json.dump(progress, open(progress_file, 'w'), ensure_ascii=False, indent=2)
    
    audio_file = os.path.join(audio_dir, f'w{week}_{idx}_{vid}.mp4')
    transcript_file = os.path.join(transcript_dir, f'w{week}_{idx}.txt')
    
    # Step 1: Download audio
    if not os.path.exists(audio_file):
        print(f'  Downloading audio...')
        result = subprocess.run([
            'yt-dlp', '-f', 'bestaudio',
            '--referer', referer,
            '--no-check-certificates',
            '-o', audio_file,
            f'https://player.vimeo.com/video/{vid}'
        ], capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            print(f'  ERROR downloading: {result.stderr[-200:]}')
            progress.setdefault('failed', []).append({'key': key, 'error': 'download', 'detail': result.stderr[-200:]})
            json.dump(progress, open(progress_file, 'w'), ensure_ascii=False, indent=2)
            continue
    
    # Step 2: Whisper transcription
    if not os.path.exists(transcript_file):
        print(f'  Transcribing with Whisper...')
        result = subprocess.run([
            whisper, audio_file,
            '--model', 'base',
            '--language', 'ko',
            '--output_format', 'txt',
            '--output_dir', transcript_dir
        ], capture_output=True, text=True, timeout=600)
        
        # Whisper saves as original filename.txt, rename
        whisper_output = os.path.join(transcript_dir, f'w{week}_{idx}_{vid}.txt')
        if os.path.exists(whisper_output):
            os.rename(whisper_output, transcript_file)
            print(f'  Done! Saved to {transcript_file}')
        elif result.returncode != 0:
            print(f'  ERROR transcribing: {result.stderr[-200:]}')
            progress.setdefault('failed', []).append({'key': key, 'error': 'whisper', 'detail': result.stderr[-200:]})
            json.dump(progress, open(progress_file, 'w'), ensure_ascii=False, indent=2)
            continue
    
    # Mark as completed
    progress['completed'] = list(completed | {key})
    completed.add(key)
    progress['current'] = None
    json.dump(progress, open(progress_file, 'w'), ensure_ascii=False, indent=2)
    
    # Clean up audio to save disk space
    if os.path.exists(audio_file):
        os.remove(audio_file)
        print(f'  Cleaned up audio file')

print(f'\\n=== 완료! {len(completed)}/{len(vimeo_ids)} 처리됨 ===')
print(f'종료 시간: $(date)')
"
