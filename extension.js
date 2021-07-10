const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const LoginManager = imports.misc.loginManager;
const Main = imports.ui.main;
const StatusSystem = imports.ui.status.system;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const ExtensionSystem = imports.ui.extensionSystem;
const ConfirmDialog = Me.imports.confirmDialog;
const Prefs = new Me.imports.prefs.Prefs();


// Use __ () and N__() for the extension gettext domain, and reuse
// the shell domain with the default _() and N_()
const Gettext = imports.gettext.domain('hibernate-status-button');
const __ = Gettext.gettext;
const N__ = function(e) { return e };
ExtensionUtils.initTranslations('hibernate-status-button');

const HIBERNATE_CHECK_TIMEOUT = 20000;

class Extension {
    _loginManagerCanHibernate(asyncCallback) {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("CanHibernate",
                null,
                Gio.DBusCallFlags.NONE,
                -1, null, function (proxy, asyncResult) {
                    let result, error;

                    try {
                        result = proxy.call_finish(asyncResult).deep_unpack();
                    } catch (e) {
                        error = e;
                    }

                    if (error)
                        asyncCallback(false);
                    else
                        asyncCallback(result[0] != 'no');
                });
        } else {
            Mainloop.idle_add(() => {
                asyncCallback(false);
                return false;
            });
        }
    }

    _loginManagerHibernate() {
        if (Prefs.getHibernateWorksCheckEnabled()) {
            this._hibernateStarted = new Date();
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, HIBERNATE_CHECK_TIMEOUT,
                () => this._checkDidHibernate());
        }
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("Hibernate",
                GLib.Variant.new('(b)', [true]),
                Gio.DBusCallFlags.NONE,
                -1, null, null);
        } else {
            // Can't do in ConsoleKit
            this._loginManager.emit('prepare-for-sleep', true);
            this._loginManager.emit('prepare-for-sleep', false);
        }
    }

    _loginManagerCanHybridSleep(asyncCallback) {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("CanHybridSleep",
                null,
                Gio.DBusCallFlags.NONE,
                -1, null, function (proxy, asyncResult) {
                    let result, error;

                    try {
                        result = proxy.call_finish(asyncResult).deep_unpack();
                    } catch (e) {
                        error = e;
                    }

                    if (error)
                        asyncCallback(false);
                    else
                        asyncCallback(result[0] != 'no');
                });
        } else {
            Mainloop.idle_add(() => {
                asyncCallback(false);
                return false;
            });
        }
    }

    _loginManagerHybridSleep() {
        if (this._loginManager._proxy) {
            // systemd path
            this._loginManager._proxy.call("HybridSleep",
                GLib.Variant.new('(b)', [true]),
                Gio.DBusCallFlags.NONE,
                -1, null, null);
        } else {
            // Can't do in ConsoleKit
            this._loginManager.emit('prepare-for-sleep', true);
            this._loginManager.emit('prepare-for-sleep', false);
        }
    }
    _updateHaveHibernate() {
        this._loginManagerCanHibernate((result) => {
            log(`have hibernate ${result}`);
            this._haveHibernate = result;
            this._updateHibernate();
        });
    }

    _updateHibernate() {
        this._hibernateMenuItem.visible = this._haveHibernate && !Main.sessionMode.isLocked;
    }

    _updateHaveHybridSleep() {
        this._loginManagerCanHybridSleep((result) => {
            this._haveHybridSleep = result;
            this._updateHybridSleep();
        });
    }

    _updateHybridSleep() {
        this._hybridSleepMenuItem.visible = this._haveHybridSleep && !Main.sessionMode.isLocked;
    }

    _onHibernateClicked() {
        this.systemMenu.menu.itemActivated();
        this._dialog = new ConfirmDialog.ConfirmDialog(ConfirmDialog.HibernateDialogContent);
        this._dialog.connect('ConfirmedHibernate', () => this._loginManagerHibernate());
        this._dialog.open();
    }

    _onHybridSleepClicked() {
        this.systemMenu.menu.itemActivated();
        this._loginManagerHybridSleep();
    }

    _disableExtension() {
        let enabledExtensions = global.settings.get_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY);
        enabledExtensions.splice(enabledExtensions.indexOf(Me.uuid), 1);
        global.settings.set_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY, enabledExtensions);
    }

    _cancelDisableExtension(notAgain) {
        if (notAgain)
            Prefs.setHibernateWorksCheckEnabled(false);
    }

    _checkRequirements() {
        if (!LoginManager.haveSystemd()) {
            this._dialog = new ConfirmDialog.ConfirmDialog(ConfirmDialog.SystemdMissingDialogContent);
            this._dialog.connect('DisableExtension', this._disableExtension);
            this._dialog.open();
        }
    }

    _checkDidHibernate() {
        /* This function is called HIBERNATE_CHECK_TIMEOUT ms after
         * hibernate started. If it is successful, at that point the GS
         * process is already frozen; so when this function is actually
         * called, way more than HIBERNATE_CHECK_TIMEOUT ms are passed*/
        if (new Date() - this._hibernateStarted > HIBERNATE_CHECK_TIMEOUT + 5000) {
            // hibernate succeeded
            return;
        }
        // hibernate failed
        this._dialog = new ConfirmDialog.ConfirmDialog(ConfirmDialog.HibernateFailedDialogContent);
        this._dialog.connect('DisableExtension', this._disableExtension);
        this._dialog.connect('Cancel', this._cancelDisableExtension);
        this._dialog.open();
    }

    enable() {
        this._checkRequirements();
        this._loginManager = LoginManager.getLoginManager();
        this.systemMenu = Main.panel.statusArea['aggregateMenu']._system;

        this._hibernateMenuItem = new PopupMenu.PopupMenuItem(__('Hibernate'));
        this._hibernateMenuItemId = this._hibernateMenuItem.connect('activate', () => this._onHibernateClicked());

        this._hybridSleepMenuItem = new PopupMenu.PopupMenuItem(__('Hybrid Sleep'));
        this._hybridSleepMenuItemId = this._hybridSleepMenuItem.connect('activate', () => this._onHybridSleepClicked());

        let afterSuspendPosition = this.systemMenu._sessionSubMenu.menu.numMenuItems - 5;

        this.systemMenu._sessionSubMenu.menu.addMenuItem(this._hybridSleepMenuItem, afterSuspendPosition);
        this.systemMenu._sessionSubMenu.menu.addMenuItem(this._hibernateMenuItem, afterSuspendPosition);

        this._menuOpenStateChangedId = this.systemMenu.menu.connect('open-state-changed',
            (menu, open) => {
                if (!open)
                    return;
                this._updateHaveHibernate();
                this._updateHaveHybridSleep();
            });
    }

    disable() {
        if (this._menuOpenStateChangedId) {
            this.systemMenu.menu.disconnect(this._menuOpenStateChangedId);
            this._menuOpenStateChangedId = 0;
        }

        if (this._hybridSleepMenuItemId) {
            this._hybridSleepMenuItem.disconnect(this._hybridSleepMenuItemId);
            this._hybridSleepMenuItemId = 0;
        }

        if (this._hibernateMenuItemId) {
            this._hibernateMenuItem.disconnect(this._hibernateMenuItemId);
            this._hibernateMenuItemId = 0;
        }

        if (this._hybridSleepMenuItem) {
            this._hybridSleepMenuItem.destroy();
            this._hybridSleepMenuItem = 0;
        }

        if (this._hibernateMenuItem) {
            this._hibernateMenuItem.destroy();
            this._hibernateMenuItem = 0;
        }
    }
}

let extension;
function init() {
    extension = new Extension();
}

function enable() {
    extension.enable();
}

function disable() {
    extension.disable();
}
