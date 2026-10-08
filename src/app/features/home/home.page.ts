import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CycleStore } from '../../core/cycles/cycle.store';
import { CycleNavigatorComponent } from '../../shared/components/cycle-navigator/cycle-navigator.component';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { BalanceHeroComponent } from './components/balance-hero/balance-hero.component';
import { CategoryBreakdownComponent } from './components/category-breakdown/category-breakdown.component';
import { HomeTab, HomeTabsComponent } from './components/home-tabs/home-tabs.component';
import { ProjectionListComponent } from './components/projection-list/projection-list.component';
import { collectHomeRows, projectRecent } from './home-projections';
import { HomeStore } from './home.store';

@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    CycleNavigatorComponent,
    PageStateComponent,
    BalanceHeroComponent,
    CategoryBreakdownComponent,
    HomeTabsComponent,
    ProjectionListComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit {
  protected readonly store = inject(HomeStore);
  protected readonly cycles = inject(CycleStore);
  protected readonly selectedTab = signal<HomeTab>('upcoming');
  protected readonly content = computed(() => {
    const state = this.store.state();
    return state.kind === 'content' ? state.data : null;
  });
  protected readonly refreshing = computed(() => {
    const state = this.store.state();
    return state.kind === 'content' && state.refreshing;
  });
  protected readonly errorMessage = computed(() => {
    const state = this.store.state();
    return state.kind === 'error' ? state.message : '';
  });
  private readonly obligations = computed(() => {
    const content = this.content();
    return content
      ? collectHomeRows(
          content.upcomingExpenses,
          content.overdueExpenses,
          content.cardStatementsInCycle,
        )
      : { upcoming: [], overdue: [] };
  });
  protected readonly overdueCount = computed(() => this.content()?.expenseBreakdown.overdue ?? 0);
  protected readonly visibleRows = computed(() => {
    switch (this.selectedTab()) {
      case 'upcoming':
        return this.obligations().upcoming;
      case 'recent':
        return projectRecent(this.store.recentDailyExpenses());
      case 'overdue':
        return this.obligations().overdue;
    }
  });
  protected readonly emptyMessage = computed(() => {
    switch (this.selectedTab()) {
      case 'upcoming':
        return 'Nenhuma conta a vencer neste ciclo.';
      case 'recent':
        return 'Nenhum gasto diário neste ciclo.';
      case 'overdue':
        return 'Nada atrasado neste ciclo.';
    }
  });

  ngOnInit(): void {
    void this.initialize();
  }

  protected selectTab(tab: HomeTab): void {
    this.selectedTab.set(tab);
  }

  protected selectPreviousCycle(): void {
    const cycleId = this.cycles.previous();
    if (cycleId && this.store.selectCycle(cycleId)) {
      this.selectedTab.set('upcoming');
    }
  }

  protected selectNextCycle(): void {
    const cycleId = this.cycles.next();
    if (cycleId && this.store.selectCycle(cycleId)) {
      this.selectedTab.set('upcoming');
    }
  }

  protected refresh(): void {
    void this.store.refresh();
  }

  private async initialize(): Promise<void> {
    if (this.cycles.state().kind === 'loading') {
      await this.cycles.load();
    }
    await this.store.load(this.cycles.current()?.id ?? undefined);
  }
}
