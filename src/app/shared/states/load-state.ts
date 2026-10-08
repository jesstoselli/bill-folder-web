export type LoadState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'content'; readonly data: T; readonly refreshing: boolean }
  | { readonly kind: 'error'; readonly message: string };
