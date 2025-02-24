import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as LoginManager from 'resource:///org/gnome/shell/misc/loginManager.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as StatusSystem from 'resource:///org/gnome/shell/ui/status/system.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ExtensionSystem from 'resource:///org/gnome/shell/ui/extensionSystem.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import * as CheckBoxImport from 'resource:///org/gnome/shell/ui/checkBox.js';
import {loadInterfaceXML} from 'resource:///org/gnome/shell/misc/fileUtils.js';

const CheckBox = CheckBoxImport.CheckBox;
// Use __ () and N__() for the extension gettext domain, and reuse
// the shell domain with the default _() and N_()
import {Extension, gettext as __} from 'resource:///org/gnome/shell/extensions/extension.js';
export {__};
const N__ = function (e) {
    return e;
};

const HIBERNATE_CHECK_TIMEOUT = 20000;

export default class HibernateButtonExtension extends Extension {
    _loginManagerCanHibernate(asyncCallback) {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call(
                'CanHibernate',
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                function (proxy, asyncResult) {
                    let result, error;

                    try {
                        result = proxy.call_finish(asyncResult).deep_unpack();
                    } catch (e) {
                        error = e;
                    }

                    if (error) asyncCallback(false);
                    else asyncCallback(!['no', 'na'].includes(result[0]));
                }
            );
        } else {
            this.can_hibernate_sourceID = GLib.idle_add(() => {
                asyncCallback(false);
                return false;
            });
        }
    }

    _loginManagerHibernate() {
        if (this._setting.get_boolean('hibernate-works-check')) {
            this._hibernateStarted = new Date();
            this.hibernate_sourceID = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                HIBERNATE_CHECK_TIMEOUT,
                () => this._checkDidHibernate()
            );
        }
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call(
                'Hibernate',
                GLib.Variant.new('(b)', [true]),
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                null
            );
        } else {
            // Can't do in ConsoleKit
            this._loginManager.emit('prepare-for-sleep', true);
            this._loginManager.emit('prepare-for-sleep', false);
        }
    }

    _loginManagerCanHybridSleep(asyncCallback) {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call(
                'CanHybridSleep',
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                function (proxy, asyncResult) {
                    let result, error;

                    try {
                        result = proxy.call_finish(asyncResult).deep_unpack();
                    } catch (e) {
                        error = e;
                    }

                    if (error) asyncCallback(false);
                    else asyncCallback(!['no', 'na'].includes(result[0]));
                }
            );
        } else {
            this.can_hybrid_sleep_sourceID = GLib.idle_add(() => {
                asyncCallback(false);
                return false;
            });
        }
    }

    _loginManagerHybridSleep() {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call(
                'HybridSleep',
                GLib.Variant.new('(b)', [true]),
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                null
            );
        } else {
            // Can't do in ConsoleKit
            this._loginManager.emit('prepare-for-sleep', true);
            this._loginManager.emit('prepare-for-sleep', false);
        }
    }

    _loginManagerCanSuspendThenHibernate(asyncCallback) {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call(
                'CanSuspendThenHibernate',
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                function (proxy, asyncResult) {
                    let result, error;

                    try {
                        result = proxy.call_finish(asyncResult).deep_unpack();
                    } catch (e) {
                        error = e;
                    }

                    if (error) asyncCallback(false);
                    else asyncCallback(!['no', 'na'].includes(result[0]));
                }
            );
        } else {
            this.can_suspend_then_hibernate_sourceID = GLib.idle_add(() => {
                asyncCallback(false);
                return false;
            });
        }
    }

    _loginManagerSuspendThenHibernate() {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call(
                'SuspendThenHibernate',
                GLib.Variant.new('(b)', [true]),
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                null
            );
        } else {
            // Can't do in ConsoleKit
            this._loginManager.emit('prepare-for-sleep', true);
            this._loginManager.emit('prepare-for-sleep', false);
        }
    }

    _updateHaveHibernate() {
        this._loginManagerCanHibernate(result => {
            log(`Able to hibernate: ${result}`);
            this._haveHibernate = result;
            this._updateHibernate();
        });
    }

    _updateHibernate() {
        this._hibernateMenuItem.visible =
            this._haveHibernate && !Main.sessionMode.isLocked && this._setting.get_boolean('show-hibernate');
    }

    _updateHaveHybridSleep() {
        this._loginManagerCanHybridSleep(result => {
            log(`Able to hybrid-sleep: ${result}`);
            this._haveHybridSleep = result;
            this._updateHybridSleep();
        });
    }

    _updateHybridSleep() {
        this._hybridSleepMenuItem.visible =
            this._haveHybridSleep && !Main.sessionMode.isLocked  && this._setting.get_boolean('show-hybrid-sleep');
    }

    _updateHaveSuspendThenHibernate() {
        this._loginManagerCanSuspendThenHibernate(result => {
            log(`Able to suspend then hibernate: ${result}`);
            this._haveSuspendThenHibernate = result;
            this._updateSuspendThenHibernate();
        });
    }

    _updateSuspendThenHibernate() {
        this._suspendThenHibernateMenuItem.visible =
            this._haveSuspendThenHibernate && !Main.sessionMode.isLocked  && this._setting.get_boolean('show-suspend-then-hibernate');
    }

    _updateDefaults() {
        console.log("Update defaults");
        let menuItems = this.systemMenu._systemItem.menu._getMenuItems()
        for (let menuItem of menuItems) {
            console.log(menuItem.label.get_text())
            if ( menuItem.label.get_text() === _('Suspend') ) {
                console.log(`Show suspend button: ${this._setting.get_boolean('show-suspend')}`)
                menuItem.visible = this._setting.get_boolean('show-suspend');
            }
            if ( menuItem.label.get_text() === _('Restart…') ) {
                console.log(`Show restart button: ${this._setting.get_boolean('show-restart')}`)
                menuItem.visible = this._setting.get_boolean('show-restart');
            }
            if ( menuItem.label.get_text() === _('Power Off…') ) {
                console.log(`Show shutdown button: ${this._setting.get_boolean('show-shutdown')}`)
                menuItem.visible = this._setting.get_boolean('show-shutdown');
            }
        }
    }

    _onHibernateClicked() {
        this.systemMenu._systemItem.menu.itemActivated();

        if (this._setting.get_boolean('show-hibernate-dialog')) {
            let DialogContent = {
                subject: C_('title', __('Hibernate')),
                description: __('Do you really want to hibernate the system?'),
                confirmButtons: [
                    {
                        signal: 'Cancel',
                        label: C_('button', __('Cancel')),
                        key: Clutter.Escape,
                    },
                    {
                        signal: 'Confirmed',
                        label: C_('button', __('Hibernate')),
                        default: true,
                    },
                ],
            };

            this._dialog = new ConfirmDialog(
                DialogContent
            );
            this._dialog.connect('Confirmed', () =>
                this._loginManagerHibernate()
            );
            this._dialog.open();
        } else {
            this._loginManagerHibernate()
        }
    }

    _onHybridSleepClicked() {
        this.systemMenu._systemItem.menu.itemActivated();

        if (this._setting.get_boolean('show-hybrid-sleep-dialog')) {
            let DialogContent = {
                subject: C_('title', __('Hybrid Sleep')),
                description: __('Do you really want to hybrid sleep the system?'),
                confirmButtons: [
                    {
                        signal: 'Cancel',
                        label: C_('button', __('Cancel')),
                        key: Clutter.Escape,
                    },
                    {
                        signal: 'Confirmed',
                        label: C_('button', __('Hybrid Sleep')),
                        default: true,
                    },
                ],
            };

            this._dialog = new ConfirmDialog(
                DialogContent
            );
            this._dialog.connect('Confirmed', () =>
                this._loginManagerHybridSleep()
            );
            this._dialog.open();
        } else {
            this._loginManagerHybridSleep()
        }
    }

    _onSuspendThenHibernateClicked() {
        this.systemMenu._systemItem.menu.itemActivated();

        if (this._setting.get_boolean('show-suspend-then-hibernate-dialog')) {
            let DialogContent = {
                subject: C_('title', __('Suspend then Hibernate')),
                description: __('Do you really want to suspend then hibernate the system?'),
                confirmButtons: [
                    {
                        signal: 'Cancel',
                        label: C_('button', __('Cancel')),
                        key: Clutter.Escape,
                    },
                    {
                        signal: 'Confirmed',
                        label: C_('button', __('Suspend then Hibernate')),
                        default: true,
                    },
                ],
            };

            this._dialog = new ConfirmDialog(
                DialogContent
            );
            this._dialog.connect('Confirmed', () =>
                this._loginManagerSuspendThenHibernate()
            );
            this._dialog.open();
        } else {
            this._loginManagerSuspendThenHibernate()
        }
    }

    _disableExtension() {
        Main.extensionManager.disableExtension('hibernate-status@dromi')
        console.log('Disabled')
    }

    _cancelDisableExtension(notAgain) {
        if (notAgain) this.setHibernateWorksCheckEnabled(false);
    }

    _checkRequirements() {
        if (GLib.access('/run/systemd/seats', 0) < 0) {
            let SystemdMissingDialogContent = {
                subject: C_('title', __('Hibernate button: Systemd Missing')),
                description: __('Systemd seems to be missing and is required.'),
                confirmButtons: [
                    {
                        signal: 'Cancel',
                        label: C_('button', __('Cancel')),
                        key: Clutter.Escape,
                    },
                    {
                        signal: 'DisableExtension',
                        label: C_('button', __('Disable Extension')),
                        default: true,
                    },
                ],
                iconName: 'document-save-symbolic',
                iconStyleClass: 'end-session-dialog-shutdown-icon',
            };

            this._dialog = new ConfirmDialog(
                SystemdMissingDialogContent
            );
            this._dialog.connect('DisableExtension', this._disableExtension);
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

        let HibernateFailedDialogContent = {
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
                    key: Clutter.Escape,
                },
                {
                    signal: 'DisableExtension',
                    label: C_('button', __('Disable Extension')),
                    default: true,
                },
            ],
            iconName: 'document-save-symbolic',
            iconStyleClass: 'end-session-dialog-shutdown-icon',
        }
        this._dialog = new ConfirmDialog(
            HibernateFailedDialogContent
        );
        this._dialog.connect('DisableExtension', this._disableExtension);
        this._dialog.connect('Cancel', this._cancelDisableExtension);
        this._dialog.open();
    }

    setHibernateWorksCheckEnabled(enabled) {
        let key = 'hibernate-works-check';
        if (this._setting.is_writable(key)) {
            if (this._setting.set_boolean(key, enabled)) {
                Gio.Settings.sync();
            } else {
                throw this._errorSet(key);
            }
        } else {
            throw this._errorWritable(key);
        }
    }

    _modifySystemItem() {
        this._setting = this.getSettings()
        this._checkRequirements();
        this._loginManager = LoginManager.getLoginManager();
        this.systemMenu = Main.panel.statusArea.quickSettings._system;
        this._hibernateMenuItem = new PopupMenu.PopupMenuItem(__('Hibernate'));
        this._hibernateMenuItemId = this._hibernateMenuItem.connect(
            'activate',
            () => this._onHibernateClicked()
        );

        this._hybridSleepMenuItem = new PopupMenu.PopupMenuItem(
            __('Hybrid Sleep')
        );
        this._hybridSleepMenuItemId = this._hybridSleepMenuItem.connect(
            'activate',
            () => this._onHybridSleepClicked()
        );

        this._suspendThenHibernateMenuItem = new PopupMenu.PopupMenuItem(
            __('Suspend then Hibernate')
        );
        this._suspendThenHibernateMenuItemId = this._suspendThenHibernateMenuItem.connect(
            'activate',
            () => this._onSuspendThenHibernateClicked()
        );

        let afterSuspendPosition =
            this.systemMenu._systemItem.menu.numMenuItems - 5;

        this.systemMenu._systemItem.menu.addMenuItem(
            this._hybridSleepMenuItem,
            afterSuspendPosition
        );
        this.systemMenu._systemItem.menu.addMenuItem(
            this._hibernateMenuItem,
            afterSuspendPosition
        );
        this.systemMenu._systemItem.menu.addMenuItem(
            this._suspendThenHibernateMenuItem,
            afterSuspendPosition
        );

        this._menuOpenStateChangedId = this.systemMenu._systemItem.menu.connect(
            'open-state-changed',
            (menu, open) => {
                if (!open) return;
                this._updateDefaults();
                this._updateHaveHibernate();
                this._updateHaveHybridSleep();
                this._updateHaveSuspendThenHibernate();
            }
        );
    }

    _queueModifySystemItem() {
        this.sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!Main.panel.statusArea.quickSettings._system)
                return GLib.SOURCE_CONTINUE;

            this._modifySystemItem();
            return GLib.SOURCE_REMOVE;
        });
    }

    enable() {
        if (!Main.panel.statusArea.quickSettings._system) {
            this._queueModifySystemItem();
        } else {
            this._modifySystemItem();
        }
    }

    disable() {
        this._setting = null;
        if (this._menuOpenStateChangedId) {
            this.systemMenu._systemItem.menu.disconnect(
                this._menuOpenStateChangedId
            );
            this._menuOpenStateChangedId = 0;
        }

        if (this._suspendThenHibernateMenuItemId) {
            this._suspendThenHibernateMenuItem.disconnect(this._suspendThenHibernateMenuItemId);
            this._suspendThenHibernateMenuItemId = 0;
        }

        if (this._hybridSleepMenuItemId) {
            this._hybridSleepMenuItem.disconnect(this._hybridSleepMenuItemId);
            this._hybridSleepMenuItemId = 0;
        }

        if (this._hibernateMenuItemId) {
            this._hibernateMenuItem.disconnect(this._hibernateMenuItemId);
            this._hibernateMenuItemId = 0;
        }

        if (this._suspendThenHibernateMenuItem) {
            this._suspendThenHibernateMenuItem.destroy();
            this._suspendThenHibernateMenuItem = 0;
        }

        if (this._hybridSleepMenuItem) {
            this._hybridSleepMenuItem.destroy();
            this._hybridSleepMenuItem = 0;
        }

        if (this._hibernateMenuItem) {
            this._hibernateMenuItem.destroy();
            this._hibernateMenuItem = 0;
        }

        if (this.sourceId) {
            GLib.Source.remove(this.sourceId);
            this.sourceId = null;
        }

        if (this.can_suspend_then_hibernate_sourceID) {
            GLib.Source.remove(this.can_suspend_then_hibernate_sourceID);
            this.can_suspend_then_hibernate_sourceID = null;
        }

        if (this.can_hybrid_sleep_sourceID) {
            GLib.Source.remove(this.can_hybrid_sleep_sourceID);
            this.can_hybrid_sleep_sourceID = null;
        }

        if (this.can_hibernate_sourceID) {
            GLib.Source.remove(this.can_hibernate_sourceID);
            this.can_hibernate_sourceID = null;
        }

        if (this.hibernate_sourceID) {
            GLib.Source.remove(this.hibernate_sourceID);
            this.hibernate_sourceID = null;
        }
    };
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


            this._messageDialogContent = new Dialog.MessageDialogContent();


            this._messageDialogContent.description = dialog.description;
            this._messageDialogContent.title = dialog.subject;

            if (dialog.iconName) {
                this._icon = new St.Icon({
                    icon_name: dialog.iconName,
                    icon_size: _DIALOG_ICON_SIZE,
                    style_class: dialog.iconStyleClass,
                });
            }

            if (dialog.checkBox) {
                this._checkBox = new CheckBox(dialog.checkBox);
                this._messageDialogContent.add(this._checkBox.actor);
            }

            this.contentLayout.add_child(this._messageDialogContent);

            let buttons = [];
            for (let i = 0; i < dialog.confirmButtons.length; i++) {
                let signal = dialog.confirmButtons[i].signal;
                let label = dialog.confirmButtons[i].label;
                let keys = dialog.confirmButtons[i].key;
                buttons.push({
                    action: () => {
                        let signalId = this.connect('closed', () => {
                            this.disconnect(signalId);
                            this._confirm(signal);
                        });
                        this.close();
                    },
                    label: label,
                    key: keys,
                });
            }

            this.setButtons(buttons);
        }

        _confirm(signal) {
            var checked;
            if (this._checkBox) checked = this._checkBox.actor.get_checked();
            this.emit(signal, checked);
        }

        cancel() {
            this.close();
        }
    }
);

const _DIALOG_ICON_SIZE = 32;

