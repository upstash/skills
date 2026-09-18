#!/bin/bash
# Run a terminal program in a fixed-size tmux session and serve it in a browser with ttyd.
# Usage: tty-session.sh '<command>' [port=7681] [cols=142] [rows=44]     (run it from the directory the program should start in)
set -e
cmd=${1:?command}; port=${2:-7681}; cols=${3:-142}; rows=${4:-44}
tmux kill-server 2>/dev/null || true
while tmux ls >/dev/null 2>&1; do sleep 0.2; done
pkill -f "ttyd -p ${port}[ ]" 2>/dev/null || true
sleep 0.5
tmux new-session -d -s demo -x "$cols" -y "$rows" "$cmd"
tmux set -g status off
(setsid ttyd -p "$port" -W -t fontSize=15 -t 'fontFamily=JetBrains Mono' -t cursorBlink=false -t disableLeaveAlert=true tmux attach -t demo > /tmp/ttyd.log 2>&1 < /dev/null &)
sleep 1; tmux ls; ss -ltn | grep ":$port " >/dev/null && echo "ttyd on :$port"
