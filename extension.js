import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';

import * as LoginManager from 'resource:///org/gnome/shell/misc/loginManager.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import * as CheckBoxImport from 'resource:///org/gnome/shell/ui/checkBox.js';

// Use __() and C_() for the extension gettext domain, and reuse
// the shell domain with the default _()
import {
    Extension,
    gettext as __,
    pgettext as C_,
} from 'resource:///org/gnome/shell/extensions/extension.js';
export {__};

const CheckBox = CheckBoxImport.CheckBox;

const HIBERNATE_CHECK_TIMEOUT = 20000;
const MENU_RETRY_INTERVAL = 250;
const MENU_RETRY_ATTEMPTS = 40;

/**
 * Translate a string in the shell's gettext domain.
 *
 * The built-in power menu items are translated by gnome-shell itself, so
 * the shell domain has to be used to find them on non-English systems.
 *
 * @param {string} text untranslated shell string
 * @returns {string} the translated string
 */
function shellText(text) {
    return GLib.dgettext('gnome-shell', text);
}

export default class HibernateButtonExtension extends Extension {
    /* ------------------------------------------------------------------ */
    /* logind helpers                                                      */
    /* ------------------------------------------------------------------ */

    _queryCapability(method, asyncCallback) {
        const proxy = this._loginManager?._proxy;

        if (!proxy) {
            asyncCallback(false);
            return;
        }

        proxy.call(method, null, Gio.DBusCallFlags.NONE, -1, null,
            (p, asyncResult) => {
                let available = false;

                try {
                    const [status] = p.call_finish(asyncResult).deep_unpack();
                    available = !['no', 'na'].includes(status);
                } catch (e) {
                    logError(e, `Hibernate Status Button: ${method} failed`);
                }

                asyncCallback(available);
            });
    }

    _loginManagerCanHibernate(asyncCallback) {
        this._queryCapability('CanHibernate', asyncCallback);
    }

    _loginManagerCanHybridSleep(asyncCallback) {
        this._queryCapability('CanHybridSleep', asyncCallback);
    }

    _loginManagerCanSuspendThenHibernate(asyncCallback) {
        this._queryCapability('CanSuspendThenHibernate', asyncCallback);
    }

    _callSleepMethod(method) {
        const proxy = this._loginManager?._proxy;

        if (!proxy) {
            // Can't do in ConsoleKit
            this._loginManager?.emit('prepare-for-sleep', true);
            this._loginManager?.emit('prepare-for-sleep', false);
            return;
        }

        proxy.call(method, GLib.Variant.new('(b)', [true]),
            Gio.DBusCallFlags.NONE, -1, null,
            (p, asyncResult) => {
                try {
                    p.call_finish(asyncResult);
                } catch (e) {
                    logError(e, `Hibernate Status Button: ${method} failed`);
                }
            });
    }

    _loginManagerHibernate() {
        if (this._setting?.get_boolean('hibernate-works-check')) {
            this._hibernateStarted = new Date();
            this.hibernate_sourceID = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                HIBERNATE_CHECK_TIMEOUT,
                () => this._checkDidHibernate()
            );
        }

        this._callSleepMethod('Hibernate');
    }

    _loginManagerHybridSleep() {
        this._callSleepMethod('HybridSleep');
    }

    _loginManagerSuspendThenHibernate() {
        this._callSleepMethod('SuspendThenHibernate');
    }

    /* ------------------------------------------------------------------ */
    /* Menu items                                                          */
    /* ------------------------------------------------------------------ */

    _getSystemMenu() {
        const quickSettings = Main.panel?.statusArea?.quickSettings;
        return quickSettings?._system?._systemItem?.menu ?? null;
    }

    _findSystemMenuItem(items, label) {
        const text = shellText(label);
        return items.find(item => item.label?.get_text?.() === text) ?? null;
    }

    _updateHaveHibernate() {
        this._loginManagerCanHibernate(result => {
            if (!this._setting || !this._hibernateMenuItem)
                return;

            log(`Able to hibernate: ${result}`);
            this._haveHibernate = result;
            this._updateHibernate();
        });
    }

    _updateHibernate() {
        if (!this._hibernateMenuItem || !this._setting)
            return;

        this._hibernateMenuItem.visible =
            this._haveHibernate &&
            !Main.sessionMode.isLocked &&
            this._setting.get_boolean('show-hibernate');
    }

    _updateHaveHybridSleep() {
        this._loginManagerCanHybridSleep(result => {
            if (!this._setting || !this._hybridSleepMenuItem)
                return;

            log(`Able to hybrid-sleep: ${result}`);
            this._haveHybridSleep = result;
            this._updateHybridSleep();
        });
    }

    _updateHybridSleep() {
        if (!this._hybridSleepMenuItem || !this._setting)
            return;

        this._hybridSleepMenuItem.visible =
            this._haveHybridSleep &&
            !Main.sessionMode.isLocked &&
            this._setting.get_boolean('show-hybrid-sleep');
    }

    _updateHaveSuspendThenHibernate() {
        this._loginManagerCanSuspendThenHibernate(result => {
            if (!this._setting || !this._suspendThenHibernateMenuItem)
                return;

            log(`Able to suspend then hibernate: ${result}`);
            this._haveSuspendThenHibernate = result;
            this._updateSuspendThenHibernate();
        });
    }

    _updateSuspendThenHibernate() {
        if (!this._suspendThenHibernateMenuItem || !this._setting)
            return;

        this._suspendThenHibernateMenuItem.visible =
            this._haveSuspendThenHibernate &&
            !Main.sessionMode.isLocked &&
            this._setting.get_boolean('show-suspend-then-hibernate');
    }

    _updateDefaults() {
        if (!this._setting)
            return;

        if (this._suspendItem)
            this._suspendItem.visible = this._setting.get_boolean('show-suspend');

        if (this._restartItem)
            this._restartItem.visible = this._setting.get_boolean('show-restart');

        if (this._powerOffItem)
            this._powerOffItem.visible = this._setting.get_boolean('show-shutdown');
    }

    _restoreDefaults() {
        if (!this._defaultVisibility)
            return;

        for (const [item, visible] of this._defaultVisibility) {
            try {
                item.visible = visible;
            } catch (e) {
                // The item might already have been destroyed
            }
        }

        this._defaultVisibility = null;
    }

    _closeMenu() {
        const menu = this._getSystemMenu();

        if (!menu)
            return;

        try {
            menu.itemActivated();
        } catch (e) {
            menu.close?.();
        }
    }

    _onHibernateClicked() {
        this._closeMenu();

        if (this._setting.get_boolean('show-hibernate-dialog')) {
            this._dialog = new ConfirmDialog({
                subject: C_('title', __('Hibernate')),
                description: __('Do you really want to hibernate the system?'),
                confirmButtons: [
                    {
                        signal: 'Cancel',
                        label: C_('button', __('Cancel')),
                        key: Clutter.KEY_Escape,
                    },
                    {
                        signal: 'Confirmed',
                        label: C_('button', __('Hibernate')),
                        default: true,
                    },
                ],
            });
            this._dialog.connect('Confirmed', () => this._loginManagerHibernate());
            this._dialog.open();
        } else {
            this._loginManagerHibernate();
        }
    }

    _onHybridSleepClicked() {
        this._closeMenu();

        if (this._setting.get_boolean('show-hybrid-sleep-dialog')) {
            this._dialog = new ConfirmDialog({
                subject: C_('title', __('Hybrid Sleep')),
                description: __('Do you really want to hybrid sleep the system?'),
                confirmButtons: [
                    {
                        signal: 'Cancel',
                        label: C_('button', __('Cancel')),
                        key: Clutter.KEY_Escape,
                    },
                    {
                        signal: 'Confirmed',
                        label: C_('button', __('Hybrid Sleep')),
                        default: true,
                    },
                ],
            });
            this._dialog.connect('Confirmed', () => this._loginManagerHybridSleep());
            this._dialog.open();
        } else {
            this._loginManagerHybridSleep();
        }
    }

    _onSuspendThenHibernateClicked() {
        this._closeMenu();

        if (this._setting.get_boolean('show-suspend-then-hibernate-dialog')) {
            this._dialog = new ConfirmDialog({
                subject: C_('title', __('Suspend then Hibernate')),
                description: __('Do you really want to suspend then hibernate the system?'),
                confirmButtons: [
                    {
                        signal: 'Cancel',
                        label: C_('button', __('Cancel')),
                        key: Clutter.KEY_Escape,
                    },
                    {
                        signal: 'Confirmed',
                        label: C_('button', __('Suspend then Hibernate')),
                        default: true,
                    },
                ],
            });
            this._dialog.connect('Confirmed', () => this._loginManagerSuspendThenHibernate());
            this._dialog.open();
        } else {
            this._loginManagerSuspendThenHibernate();
        }
    }

    _disableExtension() {
        Main.extensionManager?.disableExtension(this.uuid);
    }

    _cancelDisableExtension(notAgain) {
        if (notAgain)
            this.setHibernateWorksCheckEnabled(false);
    }

    _checkRequirements() {
        if (GLib.access('/run/systemd/seats', 0) < 0) {
            this._dialog = new ConfirmDialog({
                subject: C_('title', __('Hibernate button: Systemd Missing')),
                description: __('Systemd seems to be missing and is required.'),
                confirmButtons: [
                    {
                        signal: 'Cancel',
                        label: C_('button', __('Cancel')),
                        key: Clutter.KEY_Escape,
                    },
                    {
                        signal: 'DisableExtension',
                        label: C_('button', __('Disable Extension')),
                        default: true,
                    },
                ],
            });
            this._dialog.connect('DisableExtension', () => this._disableExtension());
            this._dialog.open();
        }
    }

    _checkDidHibernate() {
        /* This function is called HIBERNATE_CHECK_TIMEOUT ms after
         * hibernate started. If it is successful, at that point the GS
         * process is already frozen; so when this function is actually
         * called, way more than HIBERNATE_CHECK_TIMEOUT ms are passed*/
        if (
            new Date() - this._hibernateStarted >
            HIBERNATE_CHECK_TIMEOUT + 5000
        ) {
            // hibernate succeeded
            return;
        }
        // hibernate failed

        this._dialog = new ConfirmDialog({
            subject: C_('title', __('Hibernate button: Hibernate failed')),
            description: __(
                'Looks like hibernation failed. On some linux distributions hibernation is disabled ' +
                    'because not all hardware supports it well; ' +
                    'please check your distribution documentation ' +
                    'on how to enable it.'
            ),
            checkBox: __("You are wrong, don't check this anymore!"),
            confirmButtons: [
                {
                    signal: 'Cancel',
                    label: C_('button', __('Cancel')),
                    key: Clutter.KEY_Escape,
                },
                {
                    signal: 'DisableExtension',
                    label: C_('button', __('Disable Extension')),
                    default: true,
                },
            ],
        });
        this._dialog.connect('DisableExtension', () => this._disableExtension());
        this._dialog.connect('Cancel', (dialog, checked) =>
            this._cancelDisableExtension(checked)
        );
        this._dialog.open();
    }

    setHibernateWorksCheckEnabled(enabled) {
        const key = 'hibernate-works-check';

        if (!this._setting?.is_writable(key))
            throw new Error(`The key '${key}' is not writable.`);

        if (!this._setting.set_boolean(key, enabled))
            throw new Error(`Couldn't set the key '${key}'`);

        Gio.Settings.sync();
    }

    _modifySystemItem() {
        if (this._hibernateMenuItem)
            return true;

        const menu = this._getSystemMenu();

        if (!menu)
            return false;

        this._checkRequirements();
        this._loginManager = LoginManager.getLoginManager();
        this.systemMenu = Main.panel.statusArea.quickSettings._system;

        const items = menu._getMenuItems();

        // Find the built-in items by their (translated) labels, falling back
        // to their position in the menu if the translation differs.
        this._suspendItem = this._findSystemMenuItem(items, 'Suspend') ?? items[0] ?? null;
        this._restartItem = this._findSystemMenuItem(items, 'Restart…') ?? items[1] ?? null;
        this._powerOffItem = this._findSystemMenuItem(items, 'Power Off…') ?? items[2] ?? null;

        this._defaultVisibility = new Map();
        for (const item of [this._suspendItem, this._restartItem, this._powerOffItem]) {
            if (item)
                this._defaultVisibility.set(item, item.visible);
        }

        this._hibernateMenuItem = new PopupMenu.PopupMenuItem(__('Hibernate'));
        this._hibernateMenuItemId = this._hibernateMenuItem.connect(
            'activate',
            () => this._onHibernateClicked()
        );

        this._hybridSleepMenuItem = new PopupMenu.PopupMenuItem(__('Hybrid Sleep'));
        this._hybridSleepMenuItemId = this._hybridSleepMenuItem.connect(
            'activate',
            () => this._onHybridSleepClicked()
        );

        this._suspendThenHibernateMenuItem = new PopupMenu.PopupMenuItem(
            __('Suspend then Hibernate')
        );
        this._suspendThenHibernateMenuItemId =
            this._suspendThenHibernateMenuItem.connect(
                'activate',
                () => this._onSuspendThenHibernateClicked()
            );

        const suspendIndex = this._suspendItem ? items.indexOf(this._suspendItem) : 0;
        const insertIndex = Math.max(0, suspendIndex) + 1;

        menu.addMenuItem(this._hibernateMenuItem, insertIndex);
        menu.addMenuItem(this._hybridSleepMenuItem, insertIndex + 1);
        menu.addMenuItem(this._suspendThenHibernateMenuItem, insertIndex + 2);

        this._menuOpenStateChangedId = menu.connect(
            'open-state-changed',
            (m, open) => {
                if (!open)
                    return;

                this._updateDefaults();
                this._updateHaveHibernate();
                this._updateHaveHybridSleep();
                this._updateHaveSuspendThenHibernate();
            }
        );

        this._updateDefaults();
        this._updateHaveHibernate();
        this._updateHaveHybridSleep();
        this._updateHaveSuspendThenHibernate();

        return true;
    }

    _queueModifySystemItem() {
        let attempts = 0;

        this.sourceId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            MENU_RETRY_INTERVAL,
            () => {
                if (this._getSystemMenu()) {
                    this.sourceId = 0;
                    this._modifySystemItem();
                    return GLib.SOURCE_REMOVE;
                }

                if (++attempts >= MENU_RETRY_ATTEMPTS) {
                    this.sourceId = 0;
                    console.error(
                        'Hibernate Status Button: failed to find the system power menu'
                    );
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    enable() {
        this._setting = this.getSettings();
        this._haveHibernate = false;
        this._haveHybridSleep = false;
        this._haveSuspendThenHibernate = false;

        if (this._getSystemMenu())
            this._modifySystemItem();
        else
            this._queueModifySystemItem();
    }

    disable() {
        const menu = this._getSystemMenu();

        if (menu && this._menuOpenStateChangedId)
            menu.disconnect(this._menuOpenStateChangedId);
        this._menuOpenStateChangedId = 0;

        if (this._suspendThenHibernateMenuItem) {
            if (this._suspendThenHibernateMenuItemId)
                this._suspendThenHibernateMenuItem.disconnect(
                    this._suspendThenHibernateMenuItemId
                );
            this._suspendThenHibernateMenuItem.destroy();
            this._suspendThenHibernateMenuItem = null;
            this._suspendThenHibernateMenuItemId = 0;
        }

        if (this._hybridSleepMenuItem) {
            if (this._hybridSleepMenuItemId)
                this._hybridSleepMenuItem.disconnect(this._hybridSleepMenuItemId);
            this._hybridSleepMenuItem.destroy();
            this._hybridSleepMenuItem = null;
            this._hybridSleepMenuItemId = 0;
        }

        if (this._hibernateMenuItem) {
            if (this._hibernateMenuItemId)
                this._hibernateMenuItem.disconnect(this._hibernateMenuItemId);
            this._hibernateMenuItem.destroy();
            this._hibernateMenuItem = null;
            this._hibernateMenuItemId = 0;
        }

        this._restoreDefaults();

        if (this._dialog) {
            try {
                this._dialog.destroy();
            } catch (e) {
                // The dialog may already have been destroyed
            }
            this._dialog = null;
        }

        if (this.sourceId) {
            GLib.Source.remove(this.sourceId);
            this.sourceId = null;
        }

        if (this.hibernate_sourceID) {
            GLib.Source.remove(this.hibernate_sourceID);
            this.hibernate_sourceID = null;
        }

        this.systemMenu = null;
        this._suspendItem = null;
        this._restartItem = null;
        this._powerOffItem = null;
        this._loginManager = null;
        this._setting = null;
    }
}

var ConfirmDialog = GObject.registerClass(
    {
        Signals: {
            Confirmed: {param_types: [GObject.TYPE_BOOLEAN]},
            DisableExtension: {param_types: [GObject.TYPE_BOOLEAN]},
            Cancel: {param_types: [GObject.TYPE_BOOLEAN]},
        },
    },
    class ConfirmDialog extends ModalDialog.ModalDialog {
        _init(dialog) {
            super._init({
                styleClass: 'end-session-dialog',
                destroyOnClose: true,
            });

            const content = new Dialog.MessageDialogContent({
                title: dialog.subject,
                description: dialog.description,
            });

            if (dialog.checkBox) {
                this._checkBox = new CheckBox(dialog.checkBox);
                content.add_child(this._checkBox);
            }

            this.contentLayout.add_child(content);

            const buttons = dialog.confirmButtons.map(confirmButton => ({
                action: () => {
                    const signalId = this.connect('closed', () => {
                        this.disconnect(signalId);
                        this._confirm(confirmButton.signal);
                    });
                    this.close();
                },
                label: confirmButton.label,
                key: confirmButton.key,
                default: confirmButton.default,
            }));

            this.setButtons(buttons);
        }

        _confirm(signal) {
            const checked = this._checkBox?.checked ?? false;
            this.emit(signal, checked);
        }

        cancel() {
            this.close();
        }
    }
);
