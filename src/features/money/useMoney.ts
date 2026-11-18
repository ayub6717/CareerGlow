import { useEffect, useRef } from 'react';
import { useData } from '../../storage/DataContext';
import { defaultCategories } from './money';

/** First visit: fill the Categories sheet with the default set (plus names already used in old transactions). */
export function useEnsureCategories() {
  const { db, create, loadState } = useData();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || loadState !== 'ready' || db.categories.length) return;
    done.current = true;
    create('categories', defaultCategories(db.txns), 'Categories set up');
  }, [db.categories.length, db.txns, create, loadState]);
}
