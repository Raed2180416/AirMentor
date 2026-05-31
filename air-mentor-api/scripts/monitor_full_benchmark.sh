#!/bin/bash
# Passive monitor for full SOTA policy benchmark
# Logs to air-mentor-api/output/proof-risk-model/full-policy-benchmark-20260527/monitor.log

RUN_DIR="air-mentor-api/output/proof-risk-model/full-policy-benchmark-20260527"
LOG_FILE="$RUN_DIR/monitor.log"
PID_FILE="$RUN_DIR/benchmark.pid"
PRED_DIR="$RUN_DIR/shadow-benchmark/predictions"
SHADOW_PID=1603558

mkdir -p "$RUN_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_benchmark() {
    if ! ps -p "$SHADOW_PID" > /dev/null 2>&1; then
        log "ERROR: Shadow benchmark process $SHADOW_PID died unexpectedly"
        return 1
    fi
    return 0
}

check_resources() {
    local disk_avail=$(df -BG /home/raed/Projects/air-mentor-ui | awk 'NR==2 {print $4}' | tr -d 'G')
    local gpu_mem=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | head -1)
    local ram=$(ps -o rss= -p "$SHADOW_PID" 2>/dev/null | awk '{print int($1/1024/1024)}')
    
    if [ "$disk_avail" -lt 50 ]; then
        log "WARNING: Disk space low: ${disk_avail}G free"
    fi
    if [ -n "$gpu_mem" ] && [ "$gpu_mem" -lt 1000 ]; then
        log "WARNING: GPU memory low: ${gpu_mem}MB free"
    fi
    if [ -n "$ram" ] && [ "$ram" -gt 16000 ]; then
        log "WARNING: High RAM usage: ${ram}GB"
    fi
    
    log "Resources: disk ${disk_avail}G free, GPU ${gpu_mem}MB free, RAM ${ram}GB"
}

check_progress() {
    local pred_count=$(find "$PRED_DIR" -maxdepth 2 -type f 2>/dev/null | wc -l)
    local autogluon_size=$(du -sh "$RUN_DIR/shadow-benchmark/autogluon" 2>/dev/null | awk '{print $1}')
    local total_size=$(du -sh "$RUN_DIR" 2>/dev/null | awk '{print $1}')
    
    log "Progress: $pred_count prediction files, AutoGluon size $autogluon_size, total run size $total_size"
}

check_completion() {
    if [ -f "$RUN_DIR/intervention-policy-report.json" ]; then
        log "SUCCESS: Benchmark completed - intervention policy report found"
        return 0
    fi
    if [ -f "$RUN_DIR/manifest.json" ]; then
        local status=$(python3 -c "import json; print(json.load(open('$RUN_DIR/manifest.json')).get('status', 'unknown'))" 2>/dev/null)
        if [ "$status" = "completed" ]; then
            log "SUCCESS: Benchmark completed - manifest status=completed"
            return 0
        fi
    fi
    return 1
}

log "Starting passive monitor for full SOTA policy benchmark"
log "Shadow benchmark PID: $SHADOW_PID"
log "Output directory: $RUN_DIR"

while true; do
    if ! check_benchmark; then
        log "Monitor exiting due to benchmark process failure"
        exit 1
    fi
    
    if check_completion; then
        log "Monitor exiting - benchmark completed successfully"
        exit 0
    fi
    
    check_resources
    check_progress
    
    sleep 300  # Check every 5 minutes
done
