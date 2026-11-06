type StrydeMarkProps = {
  width?: number;
  height?: number;
  color?: string;
};

export function StrydeMark({ width = 16, height = 27, color = '#E14502' }: StrydeMarkProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 40" fill={color} aria-hidden="true">
      <path d="M 0 17.822 L 11.333 23.304 L 11.333 0 L 0 17.822 Z" />
      <path d="M 24 22.089 L 12.667 16.58 L 12.667 40 L 24 22.089 Z" />
    </svg>
  );
}
