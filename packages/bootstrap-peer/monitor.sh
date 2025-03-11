#!/usr/bin/env sh

SESSIONNAME="canvas-bootstrap-logs"
tmux has-session -t $SESSIONNAME &> /dev/null

if [ $? != 0 ]
 then
    tmux new-session -s $SESSIONNAME -n $SESSIONNAME -d
    tmux split-window -v
    tmux split-window -v
    tmux select-layout even-vertical
    tmux send-keys -t $SESSIONNAME:0.0 "fly logs -a canvas-bootstrap-p0" C-m
    tmux send-keys -t $SESSIONNAME:0.1 "fly logs -a canvas-bootstrap-p1" C-m
    tmux send-keys -t $SESSIONNAME:0.2 "fly logs -a canvas-bootstrap-p2" C-m
fi

tmux attach -t $SESSIONNAME
