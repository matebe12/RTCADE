import { Activity, Wifi, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NetplayNetworkQuality, NetplayNetworkStats } from "@/netplay/peer";

const QUALITY_LABELS: Record<NetplayNetworkQuality, string> = {
  unknown: "진단 대기",
  good: "좋음",
  unstable: "불안정",
  poor: "나쁨",
};

const QUALITY_CLASSES: Record<NetplayNetworkQuality, string> = {
  unknown: "border-border/70 bg-secondary text-muted-foreground",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  unstable: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
  poor: "border-red-500/40 bg-red-500/10 text-red-200",
};

interface NetplayNetworkStatsBadgeProps {
  stats: NetplayNetworkStats | null;
  compact?: boolean;
  className?: string;
}

function formatMs(value: number | null) {
  return value === null ? "--ms" : `${value}ms`;
}

function formatPercent(value: number | null) {
  if (value === null) return "--%";
  return `${value < 1 ? value.toFixed(1) : value.toFixed(0)}%`;
}

function formatKbps(value: number | null) {
  if (value === null) return "--";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}Mbps`;
  return `${value}kbps`;
}

function formatFps(value: number | null) {
  return value === null ? "--fps" : `${value}fps`;
}

function getTitle(stats: NetplayNetworkStats | null) {
  if (!stats) {
    return "네트워크 지표 수집 대기";
  }

  return [
    `RTT ${formatMs(stats.rttMs)}`,
    `손실 ${formatPercent(stats.packetLossPercent)}`,
    `지터 ${formatMs(stats.jitterMs)}`,
    `영상 ${formatKbps(stats.videoBitrateKbps)}`,
    `가용 ${formatKbps(stats.availableOutgoingBitrateKbps)}`,
    `FPS ${formatFps(stats.videoFps)}`,
    `입력 ${formatMs(stats.inputRoundTripMs)}`,
    `경로 ${stats.localCandidateType}->${stats.remoteCandidateType}`,
    `입력버퍼 ${stats.inputBufferedBytes}B`,
  ].join(" / ");
}

function NetworkIcon({ quality }: { quality: NetplayNetworkQuality }) {
  if (quality === "poor") {
    return <WifiOff className="size-3" />;
  }

  if (quality === "unknown") {
    return <Activity className="size-3" />;
  }

  return <Wifi className="size-3" />;
}

export default function NetplayNetworkStatsBadge({
  stats,
  compact = false,
  className,
}: NetplayNetworkStatsBadgeProps) {
  const quality = stats?.quality ?? "unknown";

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 text-[10px] tabular-nums", QUALITY_CLASSES[quality], className)}
      title={getTitle(stats)}
    >
      <NetworkIcon quality={quality} />
      <span>{QUALITY_LABELS[quality]}</span>
      {stats && (
        <>
          <span>{formatMs(stats.rttMs)}</span>
          {!compact && <span>손실 {formatPercent(stats.packetLossPercent)}</span>}
          {!compact && <span>{formatFps(stats.videoFps)}</span>}
          {!compact && stats.inputRoundTripMs !== null && (
            <span>입력 {formatMs(stats.inputRoundTripMs)}</span>
          )}
        </>
      )}
    </Badge>
  );
}
