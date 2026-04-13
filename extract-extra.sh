#!/bin/bash
set -e
cd /Users/kwoneren/.openclaw/workspace

VIMEO_IDS=("1140295637" "1144737529" "1147937259" "1150790193")
NAMES=("extra_1_251120" "extra_2_251203" "extra_3_251215" "extra_4_251231")

for i in 0 1 2 3; do
  VID="${VIMEO_IDS[$i]}"
  NAME="${NAMES[$i]}"
  AUDIO="/tmp/${NAME}.mp3"
  TRANSCRIPT="memory/transcripts/${NAME}.txt"
  
  if [ -f "$TRANSCRIPT" ]; then
    echo "[$NAME] Already exists, skipping"
    continue
  fi
  
  echo "[$NAME] Downloading audio from Vimeo $VID..."
  yt-dlp --referer "https://proveu.co.kr/" \
    -f bestaudio -x --audio-format mp3 \
    -o "$AUDIO" \
    "https://player.vimeo.com/video/$VID" 2>&1 | tail -2
  
  echo "[$NAME] Running Whisper..."
  whisper "$AUDIO" --model medium --language ko --output_format txt --output_dir /tmp/ 2>&1 | tail -3
  
  # Move transcript
  mv "/tmp/${NAME}.txt" "$TRANSCRIPT"
  echo "[$NAME] Done! Saved to $TRANSCRIPT"
  
  # Cleanup audio
  rm -f "$AUDIO"
done

echo "=== ALL DONE ==="
