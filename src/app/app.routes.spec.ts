import { routes } from './app.routes';
import { anonymousGuard, authGuard } from './core/auth/auth.guard';

describe('application routes', () => {
  it('keeps every MVP destination available behind the application shell', () => {
    const shellRoute = routes.find((route) => route.path === '');
    const destinations = shellRoute?.children
      ?.filter((route) => route.path && route.path !== '**')
      .map((route) => [route.path, route.data?.['title']]);

    expect(destinations).toEqual([
      ['home', 'Home'],
      ['despesas', 'Despesas'],
      ['gastos-diarios', 'Gastos diários'],
      ['receitas', 'Receitas'],
      ['cartoes', 'Cartões'],
      ['poupanca', 'Poupança'],
      ['ajustes', 'Ajustes'],
    ]);
    expect(shellRoute?.children?.find((route) => route.path === '')?.redirectTo).toBe('home');
    expect(shellRoute?.canActivate).toEqual([authGuard]);
    expect(routes.find((route) => route.path === '**')?.redirectTo).toBe('home');
  });

  it('keeps public auth routes outside the application shell', () => {
    const publicRoutes = routes.filter((route) =>
      ['login', 'cadastro', 'esqueci-senha', 'redefinir-senha'].includes(route.path ?? ''),
    );

    expect(publicRoutes.map((route) => route.path)).toEqual([
      'login',
      'cadastro',
      'esqueci-senha',
      'redefinir-senha',
    ]);
    expect(publicRoutes.every((route) => route.canActivate?.includes(anonymousGuard))).toBe(true);
  });
});
