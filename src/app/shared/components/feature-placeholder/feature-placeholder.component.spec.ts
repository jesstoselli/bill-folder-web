import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { FeaturePlaceholderComponent } from './feature-placeholder.component';

describe('FeaturePlaceholderComponent', () => {
  it('renders the route title without inventing product actions', () => {
    TestBed.configureTestingModule({
      imports: [FeaturePlaceholderComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { data: of({ title: 'Despesas' }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(FeaturePlaceholderComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Despesas');
    expect(root.querySelector('button, a')).toBeNull();
  });
});
