import { routes } from './app.routes';

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
    expect(routes.find((route) => route.path === '**')?.redirectTo).toBe('home');
  });
});
