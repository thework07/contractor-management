import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  Cloud,
  LogOut,
  Menu,
  PanelLeftClose,
  Settings,
  UserRound,
  X,
  LucideAngularModule,
} from 'lucide-angular';
import { ConfirmationDialog, type ConfirmationDialogData } from './shared/ui/confirmation-dialog';
import { MODULE_GROUPS, MODULE_VISIBILITY } from './core/navigation/module-registry';

@Component({
  selector: 'app-root',
  imports: [
    LucideAngularModule,
    MatButtonModule,
    MatDialogModule,
    MatMenuModule,
    MatSnackBarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './app.html',
})
export class App {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly icons = {
    Bell,
    Building2,
    Check,
    ChevronDown,
    Cloud,
    LogOut,
    Menu,
    PanelLeftClose,
    Settings,
    UserRound,
    X,
  };
  protected readonly collapsed = signal(false);
  protected readonly mobileNavOpen = signal(false);
  protected readonly navGroups = computed(() =>
    MODULE_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => MODULE_VISIBILITY[item.id]),
    })).filter((group) => group.items.length > 0),
  );

  protected toggleSidebar(): void {
    this.collapsed.update((value) => !value);
  }

  protected openMobileNav(): void {
    this.mobileNavOpen.set(true);
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected confirmSignOut(): void {
    const data: ConfirmationDialogData = {
      title: 'Sign out?',
      message: 'Are you sure you want to sign out of your account on this device?',
      confirmLabel: 'Sign out',
      destructive: true,
    };

    this.dialog
      .open(ConfirmationDialog, { data, width: '420px', maxWidth: 'calc(100vw - 32px)' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.snackBar.open('Sign out is not connected in this preview.', 'Dismiss', {
            duration: 4000,
          });
        }
      });
  }
}
