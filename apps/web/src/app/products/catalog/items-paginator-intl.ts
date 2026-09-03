import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * Ukrainian labels for the catalogue paginator: the component ships with English ones, and
 * the admin panel is Ukrainian throughout. The wording names the items it counts ("Товарів
 * на сторінці"), so the factory lives beside its only caller rather than at the feature level.
 *
 * A factory rather than a subclass: the class has nothing to override, only strings to set,
 * and `providers:` needs a function it can call before the component exists.
 */
export function itemsPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Товарів на сторінці:';
  intl.nextPageLabel = 'Наступна сторінка';
  intl.previousPageLabel = 'Попередня сторінка';
  intl.firstPageLabel = 'Перша сторінка';
  intl.lastPageLabel = 'Остання сторінка';
  intl.getRangeLabel = (page, pageSize, length): string => {
    if (length === 0) {
      return '0 з 0';
    }
    const start = page * pageSize + 1;
    const end = Math.min(start + pageSize - 1, length);
    return `${String(start)}–${String(end)} з ${String(length)}`;
  };
  return intl;
}
