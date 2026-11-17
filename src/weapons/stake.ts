/**
 * The aspen stake as pure logic: which ways one throw sends its stakes.
 * It never seeks an enemy and never tilts: it is thrown along the hero's
 * facing, exactly left or right, however he moves.
 */

/**
 * The directions of the stakes of one throw by a hero facing `facing` (1
 * right, -1 left), in radians on screen: `ways` stakes spread evenly round,
 * the first straight ahead, so 2 is ahead and behind (left and right) and 4
 * adds straight up and straight down.
 */
export function throwAngles(facing: number, ways: number): number[] {
  const ahead = facing < 0 ? Math.PI : 0;
  return Array.from({ length: ways }, (_, i) => ahead + (i * 2 * Math.PI) / ways);
}
