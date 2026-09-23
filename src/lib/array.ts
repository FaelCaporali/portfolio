/** Item na posição i de uma lista circular (i pode passar do fim). Lista vazia é erro de programação. */
export function cyclicAt<T>(list: readonly T[], i: number): T {
  const item = list[((i % list.length) + list.length) % list.length]
  if (item === undefined) throw new Error('cyclicAt: lista vazia')
  return item
}
