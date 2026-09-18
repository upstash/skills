#!/bin/bash
# Start the OpenCode TUI in a tmux session and expose it through ttyd on :7681.
set -e
cd /workspace/home/recorder
set -a; . ./.env; set +a
tmux kill-server 2>/dev/null || true
while tmux ls >/dev/null 2>&1; do sleep 0.2; done
pkill -f 'ttyd -p 768[1]' 2>/dev/null || true
sleep 0.5
cd /workspace/home/demo
tmux new-session -d -s demo -x 142 -y 44 "opencode --model $OC_MODEL"
tmux set -g status off
cd /workspace/home/recorder
(setsid ttyd -p 7681 -W -t fontSize=15 -t 'fontFamily=JetBrains Mono' -t cursorBlink=false -t disableLeaveAlert=true tmux attach -t demo > ttyd.log 2>&1 < /dev/null &)
sleep 1
tmux ls; ss -ltn | grep 7681
