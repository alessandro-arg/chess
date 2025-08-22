import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  initializeApp as initializeFirebaseApp,
  deleteApp,
  FirebaseApp,
} from 'firebase/app';
import { getAuth as getFirebaseAuth } from 'firebase/auth';
import { environment } from '../environments/environment';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  updateProfile,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  User,
} from 'firebase/auth';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSubject = new BehaviorSubject<User | null>(null);
  readonly user$: Observable<User | null> = this.userSubject.asObservable();
  readonly isAuthenticated$: Observable<boolean> = this.user$.pipe(
    map((u) => !!u)
  );

  private readonly isBrowser: boolean;

  constructor(
    private readonly auth: Auth,
    private readonly firestore: Firestore,
    private readonly userService: UserService,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      setPersistence(this.auth, browserLocalPersistence).catch(() => {});
      onAuthStateChanged(this.auth, async (user) => {
        this.userSubject.next(user);
        if (user) {
          await this.ensureUserDocument(user);
        }
      });
    }
  }

  mapAuthError(err: unknown): string {
    const code = (err as any)?.code as string | undefined;

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Invalid email or password. Please try again.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait and try again later.';
      default:
        return 'Login failed. Please try again.';
    }
  }

  private async ensureUserDocument(user: User): Promise<void> {
    const ref = doc(this.firestore, 'users', user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: user.displayName ?? null,
        email: user.email ?? null,
        photoURL: user.photoURL ?? null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: user.displayName ?? null,
        email: user.email ?? null,
        photoURL: user.photoURL ?? null,
        lastLoginAt: serverTimestamp(),
      });
      const data = snap.data() as any;
      if (!data.createdAt && user.metadata?.creationTime) {
        await updateDoc(ref, {
          createdAt: new Date(user.metadata.creationTime),
        });
      }
    }

    await this.userService.upsertProfile(user.uid, {
      uid: user.uid,
      displayName: user.displayName ?? user.email ?? null,
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
    });
  }

  async loginWithEmail(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    if (cred.user) {
      await this.ensureUserDocument(cred.user);
    }
    return cred.user;
  }

  async register(
    username: string,
    email: string,
    password: string
  ): Promise<void> {
    if (!this.isBrowser) return;
    const secondaryApp: FirebaseApp = initializeFirebaseApp(
      environment.firebase,
      `secondary-${Date.now()}`
    );
    const secondaryAuth = getFirebaseAuth(secondaryApp);
    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      if (cred.user && username) {
        await updateProfile(cred.user, { displayName: username });
      }
      if (cred.user) {
        await this.ensureUserDocument(cred.user);
      }
      await signOut(secondaryAuth);
    } finally {
      await deleteApp(secondaryApp);
    }
  }

  async loginWithGooglePopup(): Promise<User | null> {
    if (!this.isBrowser) return null;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(this.auth, provider);
      if (result.user) {
        await this.ensureUserDocument(result.user);
        return result.user;
      }
      return null;
    } catch (err: any) {
      return null;
    }
  }

  async handleRedirectResult(): Promise<User | null> {
    if (!this.isBrowser) return null;
    const result = await getRedirectResult(this.auth);
    if (result?.user) {
      await this.ensureUserDocument(result.user);
      return result.user;
    }
    return null;
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
