/** Junta classes, ignorando as condicionais falsas: cx('a', open && 'b'). */
export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')
