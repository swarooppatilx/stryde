import QRCode from 'qrcode';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { Palette } from '@/constants/palette';
import { qrPath } from '@/utils/qrPath';

/** Modules of white around the code that scanners need to find its edge. */
const QUIET_ZONE = 4;

interface Props {
  text: string;
  size: number;
  /** What a screen reader says in place of the picture. */
  label: string;
}

/** A QR code for `text`, drawn as vector squares: black on white so it scans in dark mode too. */
export function QrCode({ text, size, label }: Props) {
  const modules = useMemo(() => QRCode.create(text, { errorCorrectionLevel: 'M' }).modules, [text]);
  const path = useMemo(() => qrPath(modules), [modules]);
  const span = modules.size + QUIET_ZONE * 2;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${span} ${span}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={span} height={span} fill={Palette.white} />
      <Path d={path} fill={Palette.black} />
    </Svg>
  );
}
