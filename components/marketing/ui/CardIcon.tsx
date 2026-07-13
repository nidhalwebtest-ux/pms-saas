import { LayoutGrid, Coins, BarChart3, Languages, MessageCircle } from "lucide-react";

/* Maps the design's icon keys (grid/coin/chart/lang/chat) to lucide icons,
   used by the Solution and "Built for Oman" card grids. */
const ICONS = {
  grid:  LayoutGrid,
  coin:  Coins,
  chart: BarChart3,
  lang:  Languages,
  chat:  MessageCircle,
} as const;

export type CardIconKey = keyof typeof ICONS;

export function CardIcon({ name, className, strokeWidth = 1.9 }: {
  name: CardIconKey; className?: string; strokeWidth?: number;
}) {
  const Icon = ICONS[name] ?? LayoutGrid;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}
