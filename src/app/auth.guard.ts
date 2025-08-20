import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.user$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        return router.createUrlTree(['/login']);
      }
      const uidParam = route.params['uid'];
      if (uidParam && uidParam !== user.uid) {
        return router.createUrlTree([`/${user.uid}/dashboard`]);
      }
      return true;
    })
  );
};
