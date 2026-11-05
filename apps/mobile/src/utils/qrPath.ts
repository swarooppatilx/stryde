/** An SVG path with one unit square per dark module of a QR code, row by row. */
export function qrPath({ size, data }: { size: number; data: ArrayLike<number> }): string {
  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (data[row * size + col]) path += `M${col} ${row}h1v1h-1z`;
    }
  }
  return path;
}
